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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Supabase secrets are not configured.' }, 500);

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return response({ error: 'Authentication required' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return response({ error: 'Authentication required' }, 401);

    const payload = await request.json();
    const tenantId = String(payload.tenant_id || '');
    const professionalId = String(payload.professional_id || '');
    const origin = String(payload.origin || request.headers.get('Origin') || 'https://mbarber.com.br');
    if (!tenantId || !professionalId) return response({ error: 'tenant_id and professional_id are required' }, 400);

    const [{ data: profile }, { data: membership }, { data: professional }] = await Promise.all([
      adminClient.from('profiles').select('is_platform_admin').eq('id', authData.user.id).maybeSingle(),
      adminClient.from('tenant_users').select('role, is_active').eq('tenant_id', tenantId).eq('user_id', authData.user.id).eq('is_active', true).maybeSingle(),
      adminClient.from('professionals').select('id, tenant_id, user_id, name, email, is_active').eq('id', professionalId).eq('tenant_id', tenantId).maybeSingle(),
    ]);

    if (!profile?.is_platform_admin && !['owner', 'admin'].includes(membership?.role || '')) return response({ error: 'Only the owner or an admin can invite professionals.' }, 403);
    if (!professional) return response({ error: 'Professional not found.' }, 404);
    if (!professional.email) return response({ error: 'The professional must have an email before receiving an invite.' }, 400);
    if (!professional.is_active) return response({ error: 'Activate the professional before sending an invite.' }, 400);
    if (professional.user_id) return response({ error: 'This professional already has access.' }, 409);

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(professional.email, {
      redirectTo: `${origin}/auth/reset-password`,
      data: { full_name: professional.name, invited_tenant_id: tenantId, invited_professional_id: professionalId },
    });
    if (inviteError || !inviteData.user) return response({ error: inviteError?.message || 'Unable to send the invite.' }, 400);

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: inviteData.user.id,
      email: professional.email,
      full_name: professional.name,
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: membershipError } = await adminClient.from('tenant_users').upsert({
      tenant_id: tenantId,
      user_id: inviteData.user.id,
      role: 'professional',
      is_active: true,
    }, { onConflict: 'tenant_id,user_id' });
    if (membershipError) throw membershipError;

    const { error: professionalError } = await adminClient.from('professionals').update({ user_id: inviteData.user.id }).eq('id', professionalId).eq('tenant_id', tenantId);
    if (professionalError) throw professionalError;

    return response({ success: true, user_id: inviteData.user.id });
  } catch (error) {
    console.error('[invite-professional]', error);
    return response({ error: error instanceof Error ? error.message : 'Unable to invite professional.' }, 400);
  }
});
