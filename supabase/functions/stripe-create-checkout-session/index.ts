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

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: 'Stripe/Supabase secrets are not configured.' }, 500);
  }

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return response({ error: 'Authentication required' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return response({ error: 'Authentication required' }, 401);

    const payload = await request.json();
    const tenantId = payload.tenant_id;
    const planSlug = payload.plan_slug || 'pro';
    if (!tenantId) return response({ error: 'tenant_id is required' }, 400);

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
    if (!profile?.is_platform_admin && !['owner', 'admin'].includes(membership?.role)) {
      return response({ error: 'You are not allowed to manage this subscription.' }, 403);
    }

    const [{ data: tenant }, { data: plan }] = await Promise.all([
      adminClient.from('tenants').select('id, name, trade_name, email').eq('id', tenantId).single(),
      adminClient.from('plans').select('id, name, stripe_price_id').eq('slug', planSlug).eq('is_active', true).single(),
    ]);
    if (!tenant || !plan?.stripe_price_id) return response({ error: 'Tenant or active Stripe plan not found.' }, 404);

    const { data: existingSubscription } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeRequest('/customers', {
        email: tenant.email,
        name: tenant.trade_name || tenant.name,
        'metadata[tenant_id]': tenantId,
      });
      customerId = customer.id;
    }

    const origin = payload.origin || request.headers.get('Origin') || 'https://mbarber.com.br';
    const session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': plan.stripe_price_id,
      'line_items[0][quantity]': '1',
      'automatic_tax[enabled]': 'true',
      'subscription_data[metadata][tenant_id]': tenantId,
      'subscription_data[metadata][plan_id]': plan.id,
      'metadata[tenant_id]': tenantId,
      'metadata[plan_id]': plan.id,
      success_url: `${origin}/configuracoes/assinatura?checkout=success`,
      cancel_url: `${origin}/configuracoes/assinatura?checkout=cancelled`,
    });

    return response({ url: session.url });
  } catch (error) {
    console.error('[stripe-create-checkout-session]', error);
    return response({ error: error instanceof Error ? error.message : 'Unable to create checkout session.' }, 400);
  }
});
