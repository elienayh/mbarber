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
  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
};

const isoFromUnix = (value: number | null | undefined) => value ? new Date(value * 1000).toISOString() : new Date().toISOString();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
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
      subscription = await stripeGet(`/subscriptions/${object.subscription}`);
    }

    const tenantId = metadata.tenant_id || subscription.metadata?.tenant_id;
    const planId = metadata.plan_id || subscription.metadata?.plan_id;
    const customerId = subscription.customer || object.customer;

    if (['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type) && tenantId && subscriptionId) {
      const canceled = event.type === 'customer.subscription.deleted';
      const status = canceled ? 'canceled' : subscription.status;
      const { error: subscriptionError } = await adminClient.from('subscriptions').upsert({
        tenant_id: tenantId,
        plan_id: planId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id || subscriptionId,
        status,
        current_period_start: isoFromUnix(subscription.current_period_start),
        current_period_end: isoFromUnix(subscription.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        canceled_at: subscription.canceled_at ? isoFromUnix(subscription.canceled_at) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });
      if (subscriptionError) throw subscriptionError;

      await adminClient.from('tenants').update({ status: ['active', 'trialing'].includes(status) ? 'active' : status === 'past_due' ? 'past_due' : 'canceled' }).eq('id', tenantId);
    }

    if (event.type === 'invoice.payment_succeeded' && customerId) {
      await adminClient.from('subscriptions').update({ status: 'active', updated_at: new Date().toISOString() }).eq('stripe_customer_id', customerId);
    }
    if (event.type === 'invoice.payment_failed' && customerId) {
      await adminClient.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('stripe_customer_id', customerId);
    }

    await adminClient.from('webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', event.id);
    return response({ received: true });
  } catch (error) {
    console.error('[stripe-webhook]', error);
    return response({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 500);
  }
});
