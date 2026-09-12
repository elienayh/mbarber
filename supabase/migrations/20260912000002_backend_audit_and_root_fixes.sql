-- ============================================================================
-- METRICBARBER - MIGRATION 20260912000002
-- DESCRIÇÃO: Auditoria do Backend e Correção de Raiz (Schema x RPCs x RLS)
-- 
-- 1. Garante colunas esperadas em tabelas (tenant_users.updated_at, etc.)
-- 2. Corrige delete_tenant_by_admin (tabela stock_movements em vez de product_movements,
--    e cascata ordenada de todas as tabelas filhas incluindo financial_transactions)
-- 3. Cria update_tenant_by_admin para persistência confiável pelo super admin
-- 4. Consolida create_tenant_for_current_user com tipos e colunas reais
-- 5. Atualiza e blinda políticas de RLS para UPDATE e DELETE em public.tenants
-- ============================================================================

-- 1. ADICIONAR COLUNAS DEFENSIVAS
ALTER TABLE public.tenant_users 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. RPC ATÔMICA PARA EXCLUSÃO COMPLETA DE BARBEARIA PELO SUPER ADMIN
CREATE OR REPLACE FUNCTION public.delete_tenant_by_admin(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validar privilégios de plataforma
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma podem excluir barbearias.';
  END IF;

  -- 1. Excluir transações financeiras vinculadas
  DELETE FROM public.financial_transactions WHERE tenant_id = p_tenant_id;

  -- 2. Excluir agendamentos e séries
  DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM public.appointment_series WHERE tenant_id = p_tenant_id;
  DELETE FROM public.schedule_blocks WHERE tenant_id = p_tenant_id;

  -- 3. Excluir movimentações de estoque e produtos (corrigido: stock_movements em vez de product_movements)
  DELETE FROM public.stock_movements WHERE tenant_id = p_tenant_id;
  DELETE FROM public.products WHERE tenant_id = p_tenant_id;

  -- 4. Excluir serviços e vínculos com profissionais
  DELETE FROM public.professional_services WHERE tenant_id = p_tenant_id;
  DELETE FROM public.services WHERE tenant_id = p_tenant_id;

  -- 5. Excluir horários de profissionais e profissionais
  DELETE FROM public.professional_schedules WHERE tenant_id = p_tenant_id;
  DELETE FROM public.professionals WHERE tenant_id = p_tenant_id;

  -- 6. Excluir clientes e horários da barbearia
  DELETE FROM public.customers WHERE tenant_id = p_tenant_id;
  DELETE FROM public.business_hours WHERE tenant_id = p_tenant_id;

  -- 7. Excluir assinaturas, notificações e logs de auditoria
  DELETE FROM public.subscriptions WHERE tenant_id = p_tenant_id;
  DELETE FROM public.notification_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = p_tenant_id;

  -- 8. Excluir vínculos de usuários do tenant
  DELETE FROM public.tenant_users WHERE tenant_id = p_tenant_id;

  -- 9. Excluir a barbearia
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true, 
    'deleted_tenant_id', p_tenant_id,
    'message', 'Barbearia e todos os registros associados foram excluídos permanentemente.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant_by_admin(UUID) TO authenticated;

-- 3. RPC PARA ATUALIZAÇÃO SEGURA DE BARBEARIA PELO SUPER ADMIN
CREATE OR REPLACE FUNCTION public.update_tenant_by_admin(
  p_tenant_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_tenant public.tenants%ROWTYPE;
BEGIN
  -- Validar privilégios de plataforma
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma podem atualizar barbearias via painel master.';
  END IF;

  UPDATE public.tenants
  SET
    name                 = COALESCE(p_payload->>'name', name),
    trade_name           = COALESCE(p_payload->>'trade_name', trade_name),
    slug                 = COALESCE(p_payload->>'slug', slug),
    phone                = CASE WHEN p_payload ? 'phone' THEN p_payload->>'phone' ELSE phone END,
    email                = CASE WHEN p_payload ? 'email' THEN p_payload->>'email' ELSE email END,
    address_street       = CASE WHEN p_payload ? 'address_street' THEN p_payload->>'address_street' ELSE address_street END,
    address_number       = CASE WHEN p_payload ? 'address_number' THEN p_payload->>'address_number' ELSE address_number END,
    address_neighborhood = CASE WHEN p_payload ? 'address_neighborhood' THEN p_payload->>'address_neighborhood' ELSE address_neighborhood END,
    address_city         = CASE WHEN p_payload ? 'address_city' THEN p_payload->>'address_city' ELSE address_city END,
    address_state        = CASE WHEN p_payload ? 'address_state' THEN p_payload->>'address_state' ELSE address_state END,
    address_zip_code     = CASE WHEN p_payload ? 'address_zip_code' THEN p_payload->>'address_zip_code' ELSE address_zip_code END,
    status               = COALESCE(p_payload->>'status', status),
    primary_color        = COALESCE(p_payload->>'primary_color', primary_color),
    updated_at           = now()
  WHERE id = p_tenant_id
  RETURNING * INTO v_updated_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barbearia com ID % não foi encontrada.', p_tenant_id;
  END IF;

  RETURN to_jsonb(v_updated_tenant);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tenant_by_admin(UUID, JSONB) TO authenticated;

-- 4. CONSOLIDAR CREATE_TENANT_FOR_CURRENT_USER COM SCHEMA REAL
CREATE OR REPLACE FUNCTION public.create_tenant_for_current_user(
  p_name TEXT,
  p_slug TEXT,
  p_trade_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_zip_code TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_email VARCHAR(150);
  v_user_full_name TEXT;
  v_tenant_id UUID;
  v_clean_slug TEXT;
  v_base_slug TEXT;
  v_street TEXT;
  v_trade_name TEXT;
  v_phone TEXT;
  v_suffix INT := 1;
BEGIN
  -- Validar usuário autenticado via sessão Supabase
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. Faça login para cadastrar sua barbearia.';
  END IF;

  -- Obter e-mail e metadados cadastrados do usuário autenticado
  SELECT 
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
  INTO v_user_email, v_user_full_name 
  FROM auth.users 
  WHERE id = v_user_id;

  -- Resolver sanitização e unicidade do slug
  v_base_slug := lower(trim(regexp_replace(COALESCE(p_slug, p_name), '[^a-zA-Z0-9]+', '-', 'g'), '-'));
  IF v_base_slug IS NULL OR length(v_base_slug) = 0 THEN
    v_base_slug := 'barbearia-' || substr(v_user_id::text, 1, 8);
  END IF;

  v_clean_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) LOOP
    v_clean_slug := v_base_slug || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  END LOOP;

  -- Unificar valores padrão e fallback de endereço
  v_street := COALESCE(nullif(trim(p_address_street), ''), nullif(trim(p_address), ''));
  v_trade_name := COALESCE(nullif(trim(p_trade_name), ''), trim(p_name));
  v_phone := COALESCE(nullif(trim(p_phone), ''), '00000000000');

  -- 1. Inserir registro na tabela tenants (35 dias de teste grátis por padrão comercial)
  INSERT INTO public.tenants (
    name,
    trade_name,
    slug,
    phone,
    email,
    address_street,
    address_number,
    address_neighborhood,
    address_city,
    address_state,
    address_zip_code,
    logo_url,
    status,
    trial_ends_at,
    settings
  ) VALUES (
    trim(p_name),
    v_trade_name,
    v_clean_slug,
    v_phone,
    COALESCE(nullif(trim(p_email), ''), v_user_email),
    v_street,
    nullif(trim(p_address_number), ''),
    nullif(trim(p_address_neighborhood), ''),
    nullif(trim(p_address_city), ''),
    nullif(trim(p_address_state), ''),
    nullif(trim(p_address_zip_code), ''),
    nullif(trim(p_logo_url), ''),
    'trial',
    now() + interval '35 days',
    jsonb_build_object('theme', 'dark', 'plan_tier', 'trial_35d')
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Vincular perfil do usuário
  INSERT INTO public.profiles (
    id, email, full_name, phone, updated_at
  ) VALUES (
    v_user_id,
    COALESCE(v_user_email, 'usuario@mbarber.com.br'),
    COALESCE(nullif(v_user_full_name, ''), trim(p_name)),
    v_phone,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(nullif(profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(nullif(profiles.phone, ''), EXCLUDED.phone),
    updated_at = now();

  -- 3. Vincular usuário logado como 'owner' na tabela tenant_users
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    role,
    is_active,
    updated_at
  ) VALUES (
    v_tenant_id,
    v_user_id,
    'owner',
    true,
    now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'owner', is_active = true, updated_at = now();

  -- 4. Configurar horários de funcionamento padrão (Segunda a Sábado 08:00 às 19:00)
  INSERT INTO public.business_hours (
    tenant_id, day_of_week, is_closed, open_time, close_time, break_start, break_end
  ) VALUES
    (v_tenant_id, 0, true,  '08:00', '12:00', NULL, NULL),
    (v_tenant_id, 1, false, '08:00', '19:00', '12:00', '13:00'),
    (v_tenant_id, 2, false, '08:00', '19:00', '12:00', '13:00'),
    (v_tenant_id, 3, false, '08:00', '19:00', '12:00', '13:00'),
    (v_tenant_id, 4, false, '08:00', '19:00', '12:00', '13:00'),
    (v_tenant_id, 5, false, '08:00', '19:00', '12:00', '13:00'),
    (v_tenant_id, 6, false, '08:00', '18:00', '12:00', '13:00')
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

  -- 5. Inserir serviços básicos iniciais
  INSERT INTO public.services (
    tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active
  ) VALUES
    (v_tenant_id, 'Corte Cabelo Masculino', 'Corte moderno na tesoura ou máquina.', 'Cabelo', 4500, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Barboterapia com toalha quente e finalização.', 'Barba', 3500, 30, 5, true),
    (v_tenant_id, 'Combo Cabelo + Barba', 'Corte completo e barboterapia.', 'Combo', 7000, 60, 10, true)
  ON CONFLICT DO NOTHING;

  -- 6. Inserir o primeiro profissional automaticamente vinculado ao perfil do proprietário (usa color_hex correto)
  INSERT INTO public.professionals (
    tenant_id,
    user_id,
    name,
    nickname,
    phone,
    email,
    commission_rate,
    color_hex,
    is_active,
    display_order
  )
  SELECT 
    v_tenant_id,
    p.id,
    p.full_name,
    split_part(p.full_name, ' ', 1),
    p.phone,
    p.email,
    50.00,
    '#F28322',
    true,
    1
  FROM public.profiles p
  WHERE p.id = v_user_id
  ON CONFLICT DO NOTHING;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_for_current_user(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) TO authenticated;

-- 5. BLINDAGEM DE POLÍTICAS DE RLS PARA TENANTS
DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE 
  USING (
    public.is_platform_admin() OR
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  )
  WITH CHECK (
    public.is_platform_admin() OR
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS tenants_delete ON public.tenants;
CREATE POLICY tenants_delete ON public.tenants
  FOR DELETE 
  USING (
    public.is_platform_admin()
  );

-- Notificar recarga de schema no PostgREST
NOTIFY pgrst, 'reload schema';
