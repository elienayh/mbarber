import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const verifySignature = async (payload: string, signature: string, secret: string) => {
  const parts = signature.split(',').reduce<Record<string, string[]>>((result, item) => {
    const [key, value] = item.split('=', 2);
    if (key && value) result[key] = [...(result[key] || []), value];
    return result;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return signatures.some((candidate) => candidate === digest);
};

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const stripeGet = async (path: string) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
};

const isoFromUnix = (value: number | null | undefined) => value ? new Date(value * 1000).toISOString() : null;

const extractSubscriptionPeriod = (sub: any) => {
  // 1. Na versão 2026-08-26+ do Stripe, as datas de início e fim do ciclo estão em items.data[0]
  const firstItem = sub?.items?.data?.[0];
  const itemStart = firstItem?.current_period_start;
  const itemEnd = firstItem?.current_period_end;

  // 2. Fallback para o nível raiz da assinatura (versões anteriores da API do Stripe)
  const rootStart = sub?.current_period_start;
  const rootEnd = sub?.current_period_end;

  const startUnix = Number(itemStart || rootStart || sub?.created || Math.floor(Date.now() / 1000));
  let endUnix = Number(itemEnd || rootEnd);

  // Se o fim não estiver definido ou for menor/igual ao início, define 30 dias (1 ciclo mensal padrão)
  if (!endUnix || endUnix <= startUnix) {
    endUnix = startUnix + (30 * 24 * 60 * 60);
  }

  return {
    periodStartIso: new Date(startUnix * 1000).toISOString(),
    periodEndIso: new Date(endUnix * 1000).toISOString(),
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  if (!signingSecret || !serviceRoleKey || !supabaseUrl) return response({ error: 'Webhook secrets are not configured.' }, 500);

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature || !(await verifySignature(rawBody, signature, signingSecret))) {
    return response({ error: 'Invalid Stripe signature.' }, 400);
  }

  try {
    const event = JSON.parse(rawBody);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: existing } = await adminClient.from('webhook_events').select('id, status').eq('event_id', event.id).maybeSingle();
    if (existing?.status === 'processed') return response({ received: true, duplicate: true });

    await adminClient.from('webhook_events').upsert({
      provider: 'stripe',
      event_id: event.id,
      event_type: event.type,
      payload: event,
      status: 'pending',
    }, { onConflict: 'event_id' });

    const object = event.data?.object || {};
    const metadata = object.metadata || {};
    const subscriptionId = object.subscription || object.id;
    let subscription = object;
    if (event.type.startsWith('checkout.session') && object.subscription) {
      try {
        subscription = await stripeGet(`/subscriptions/${object.subscription}`);
      } catch (subErr) {
        console.warn('Could not fetch subscription details:', subErr);
      }
    }

    let tenantId = metadata.tenant_id || subscription.metadata?.tenant_id;
    let planId = metadata.plan_id || subscription.metadata?.plan_id;
    const customerId = subscription.customer || object.customer;

    // Se o webhook não trouxer metadata diretamente, tenta localizar pelo customerId ou subscriptionId existente
    if (!tenantId && (customerId || subscriptionId)) {
      const { data: existingSub } = await adminClient
        .from('subscriptions')
        .select('tenant_id, plan_id')
        .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`)
        .maybeSingle();

      if (existingSub) {
        tenantId = existingSub.tenant_id;
        if (!planId) planId = existingSub.plan_id;
      }
    }

    // Se planId ainda não foi determinado (ex: alteração direto no portal Stripe), deduz pela quantidade de assentos
    if (!planId) {
      const seatsCount = Number(
        metadata.professionals_count ||
        subscription.metadata?.professionals_count ||
        subscription.items?.data?.[0]?.quantity ||
        1
      );

      const { data: matchedPlan } = await adminClient
        .from('plans')
        .select('id')
        .eq('is_active', true)
        .eq('max_professionals', seatsCount)
        .maybeSingle();

      if (matchedPlan) {
        planId = matchedPlan.id;
      } else {
        const { data: defaultPlan } = await adminClient
          .from('plans')
          .select('id')
          .eq('is_active', true)
          .order('max_professionals', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (defaultPlan) planId = defaultPlan.id;
      }
    }

    if (['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type) && tenantId && subscriptionId) {
      const canceled = event.type === 'customer.subscription.deleted';
      const status = canceled ? 'canceled' : subscription.status;
      const { periodStartIso, periodEndIso } = extractSubscriptionPeriod(subscription);

      const { error: subscriptionError } = await adminClient.from('subscriptions').upsert({
        tenant_id: tenantId,
        plan_id: planId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id || subscriptionId,
        status,
        current_period_start: periodStartIso,
        current_period_end: periodEndIso,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        canceled_at: subscription.canceled_at ? isoFromUnix(subscription.canceled_at) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });
      if (subscriptionError) throw subscriptionError;

      await adminClient.from('tenants').update({ status: ['active', 'trialing'].includes(status) ? 'active' : status === 'past_due' ? 'past_due' : 'canceled' }).eq('id', tenantId);
    }

    if (event.type === 'invoice.payment_succeeded' && customerId) {
      const invoice = event.data?.object || {};
      const invoiceLine = invoice.lines?.data?.[0];
      const invStart = invoiceLine?.period?.start;
      const invEnd = invoiceLine?.period?.end;

      const updatePayload: Record<string, any> = {
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      if (invStart && invEnd && invEnd > invStart) {
        updatePayload.current_period_start = new Date(invStart * 1000).toISOString();
        updatePayload.current_period_end = new Date(invEnd * 1000).toISOString();
      }

      await adminClient.from('subscriptions').update(updatePayload).eq('stripe_customer_id', customerId);
      if (tenantId) {
        await adminClient.from('tenants').update({ status: 'active' }).eq('id', tenantId);
      }
    }
    if (event.type === 'invoice.payment_failed' && customerId) {
      await adminClient.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('stripe_customer_id', customerId);
      if (tenantId) {
        await adminClient.from('tenants').update({ status: 'past_due' }).eq('id', tenantId);
      }
    }

    await adminClient.from('webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    return response({ received: true });
  } catch (error) {
    console.error('[stripe-webhook]', error);
    return response({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 500);
  }
});
