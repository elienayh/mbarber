import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripeApiUrl = 'https://api.stripe.com/v1';

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const stripeRequest = async (path: string, params: Record<string, string>, method = 'POST') => {
  const body = new URLSearchParams(params);
  const result = await fetch(`${stripeApiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
  });

  const data = await result.json();
  if (!result.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!stripeKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ 
      error: 'As chaves do Stripe (STRIPE_SECRET_KEY) ou do Supabase não estão configuradas nas Secrets das Edge Functions do Supabase.' 
    }, 500);
  }

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return response({ error: 'Autenticação necessária. Por favor, faça login.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) return response({ error: 'Usuário não autenticado ou sessão expirada.' }, 401);

    const payload = await request.json();
    const tenantId = payload.tenant_id;
    const planSlug = payload.plan_slug || 'pro';
    const planId = payload.plan_id;
    if (!tenantId) return response({ error: 'tenant_id é obrigatório' }, 400);

    const { data: tenant } = await adminClient
      .from('tenants')
      .select('id, name, trade_name, email')
      .eq('id', tenantId)
      .single();

    if (!tenant) return response({ error: 'Barbearia não encontrada.' }, 404);

    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', userData.user.id)
      .maybeSingle();

    const { data: membership } = await adminClient
      .from('tenant_users')
      .select('role, is_active')
      .eq('tenant_id', tenantId)
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isAllowed = profile?.is_platform_admin || ['owner', 'admin'].includes(membership?.role);
    if (!isAllowed) {
      // Auto-reparação: se o usuário for profissional ou o e-mail for o mesmo do cadastro da barbearia
      const isTenantEmailMatch = Boolean(
        tenant.email &&
        userData.user.email &&
        tenant.email.toLowerCase().trim() === userData.user.email.toLowerCase().trim()
      );

      const { data: pro } = await adminClient
        .from('professionals')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (pro || isTenantEmailMatch) {
        await adminClient.from('tenant_users').upsert({
          tenant_id: tenantId,
          user_id: userData.user.id,
          role: 'owner',
          is_active: true,
        }, { onConflict: 'tenant_id,user_id' });
      } else {
        return response({ error: 'Permissão negada. Apenas proprietários ou administradores podem gerenciar a assinatura.' }, 403);
      }
    }

    let planQuery = adminClient.from('plans').select('id, name, slug, price_cents, billing_cycle, max_professionals, stripe_price_id, stripe_product_id').eq('is_active', true);
    if (planId) {
      planQuery = planQuery.eq('id', planId);
    } else {
      planQuery = planQuery.eq('slug', planSlug);
    }
    let { data: plan } = await planQuery.maybeSingle();

    if (!plan) {
      const { data: fallbackPlan } = await adminClient
        .from('plans')
        .select('id, name, slug, price_cents, billing_cycle, max_professionals, stripe_price_id, stripe_product_id')
        .eq('is_active', true)
        .order('price_cents', { ascending: true })
        .limit(1)
        .maybeSingle();
      plan = fallbackPlan;
    }

    if (!plan) return response({ error: 'Plano não encontrado no catálogo do sistema.' }, 404);

    const { data: existingSubscription } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id;
    if (customerId) {
      try {
        await stripeRequest(`/customers/${customerId}`, {}, 'GET');
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customerEmail = tenant.email || userData.user.email || 'financeiro@metricbarber.com.br';
      const customer = await stripeRequest('/customers', {
        email: customerEmail,
        name: tenant.trade_name || tenant.name || 'Barbearia MetricBarber',
        'metadata[tenant_id]': tenantId,
      });
      customerId = customer.id;
    }

    const origin = payload.origin || request.headers.get('Origin') || 'https://mbarber.com.br';
    
    // Quantidade de barbeiros contratados (regra comercial: R$ 29,90 por barbeiro/mês)
    const requestedSeats = Math.max(1, Number(payload.professionals_count) || Number(plan.max_professionals) || 1);
    const unitPriceCents = 2990; // R$ 29,90 por barbeiro
    const totalFormatted = (requestedSeats * 29.9).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Verifica se há um ID de preço Stripe real configurado (ex: price_1...)
    const isRealStripePrice = Boolean(
      plan.stripe_price_id && 
      plan.stripe_price_id.startsWith('price_') && 
      !plan.stripe_price_id.includes('monthly')
    );

    // Parâmetros da sessão de checkout
    const sessionParams: Record<string, string> = {
      mode: 'subscription',
      customer: customerId,
      'subscription_data[metadata][tenant_id]': tenantId,
      'subscription_data[metadata][plan_id]': plan.id,
      'subscription_data[metadata][professionals_count]': String(requestedSeats),
      'metadata[tenant_id]': tenantId,
      'metadata[plan_id]': plan.id,
      'metadata[professionals_count]': String(requestedSeats),
      success_url: `${origin}/assinatura?checkout=success`,
      cancel_url: `${origin}/assinatura?checkout=cancelled`,
      allow_promotion_codes: 'true',
    };

    if (isRealStripePrice) {
      sessionParams['line_items[0][price]'] = plan.stripe_price_id;
      sessionParams['line_items[0][quantity]'] = '1';
    } else {
      sessionParams['line_items[0][quantity]'] = String(requestedSeats);
      sessionParams['line_items[0][price_data][currency]'] = 'brl';
      sessionParams['line_items[0][price_data][unit_amount]'] = String(unitPriceCents);
      sessionParams['line_items[0][price_data][recurring][interval]'] = 'month';
      sessionParams['line_items[0][price_data][product_data][name]'] = `MetricBarber - ${plan.name || 'Licença por Barbeiro'}`;
      sessionParams['line_items[0][price_data][product_data][description]'] = `${requestedSeats} profissional(is) • R$ 29,90/mês cada (${totalFormatted}/mês)`;
    }

    let session;
    try {
      session = await stripeRequest('/checkout/sessions', sessionParams);
    } catch (checkoutErr: any) {
      // Se falhar ao tentar price_id não cadastrado na conta do Stripe, realiza fallback dinâmico
      if (isRealStripePrice && (checkoutErr?.message?.includes('No such price') || checkoutErr?.message?.includes('price'))) {
        delete sessionParams['line_items[0][price]'];
        sessionParams['line_items[0][quantity]'] = String(requestedSeats);
        sessionParams['line_items[0][price_data][currency]'] = 'brl';
        sessionParams['line_items[0][price_data][unit_amount]'] = String(unitPriceCents);
        sessionParams['line_items[0][price_data][recurring][interval]'] = 'month';
        sessionParams['line_items[0][price_data][product_data][name]'] = `MetricBarber - ${plan.name || 'Licença por Barbeiro'}`;
        sessionParams['line_items[0][price_data][product_data][description]'] = `${requestedSeats} profissional(is) • R$ 29,90/mês cada (${totalFormatted}/mês)`;
        session = await stripeRequest('/checkout/sessions', sessionParams);
      } else {
        throw checkoutErr;
      }
    }

    return response({ url: session.url });
  } catch (error) {
    console.error('[stripe-create-checkout-session]', error);
    return response({ error: error instanceof Error ? error.message : 'Não foi possível gerar a sessão de pagamento.' }, 400);
  }
  }
});
