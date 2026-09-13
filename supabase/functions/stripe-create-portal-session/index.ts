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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
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
    if (!tenantId) return response({ error: 'tenant_id é obrigatório.' }, 400);

    const { data: tenant } = await adminClient
      .from('tenants')
      .select('id, name, trade_name, email')
      .eq('id', tenantId)
      .single();

    if (!tenant) return response({ error: 'Barbearia não encontrada.' }, 404);

    const { data: profile } = await adminClient.from('profiles').select('is_platform_admin').eq('id', userData.user.id).maybeSingle();
    const { data: membership } = await adminClient
      .from('tenant_users')
      .select('role, is_active')
      .eq('tenant_id', tenantId)
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isAllowed = profile?.is_platform_admin || ['owner', 'admin'].includes(membership?.role);
    if (!isAllowed) {
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
        return response({ error: 'Você não tem permissão para gerenciar a assinatura desta barbearia.' }, 403);
      }
    }

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!subscription?.stripe_customer_id) {
      return response({ error: 'Nenhum cadastro de faturamento ativo foi encontrado para esta barbearia. Assine um plano primeiro.' }, 404);
    }

    const origin = payload.origin || request.headers.get('Origin') || 'https://mbarber.com.br';
    const params = new URLSearchParams({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/assinatura`,
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
    if (!stripeResponse.ok) throw new Error(data?.error?.message || 'Não foi possível abrir o portal de faturamento.');

    return response({ url: data.url });
  } catch (error) {
    console.error('[stripe-create-portal-session]', error);
    return response({ error: error instanceof Error ? error.message : 'Não foi possível abrir o painel de faturamento.' }, 400);
  }
});
