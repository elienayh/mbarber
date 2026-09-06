import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
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
    const { data: profile } = await adminClient.from('profiles').select('is_platform_admin').eq('id', userData.user.id).maybeSingle();
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

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!subscription?.stripe_customer_id) return response({ error: 'No Stripe customer is linked to this tenant.' }, 404);

    const origin = payload.origin || request.headers.get('Origin') || 'https://mbarber.com.br';
    const params = new URLSearchParams({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/configuracoes/assinatura`,
    });
    const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const data = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(data?.error?.message || 'Unable to create portal session.');

    return response({ url: data.url });
  } catch (error) {
    console.error('[stripe-create-portal-session]', error);
    return response({ error: error instanceof Error ? error.message : 'Unable to create portal session.' }, 400);
  }
});
