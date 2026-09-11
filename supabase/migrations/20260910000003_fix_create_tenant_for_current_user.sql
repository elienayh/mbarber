-- ==============================================================================
-- MIGRATION: 20260910000003_fix_create_tenant_for_current_user.sql
-- DESCRIÇÃO: Corrige e disponibiliza a RPC public.create_tenant_for_current_user
--            com a assinatura e parâmetros esperados pelo frontend, concede permissões
--            necessárias para a role 'authenticated' e recarrega o schema cache do PostgREST.
-- ==============================================================================

-- 1. Garantir permissões de execução para a verificação de slug
GRANT EXECUTE ON FUNCTION public.check_slug_availability(TEXT, UUID) TO anon, authenticated;

-- 2. Limpar possíveis versões/assinaturas anteriores conflitantes da função
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'create_tenant_for_current_user'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 3. Criar a RPC public.create_tenant_for_current_user com a assinatura compatível
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
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_email VARCHAR(150);
  v_user_full_name TEXT;
  v_slug_check JSONB;
  v_tenant_id UUID;
  v_clean_slug TEXT;
  v_street TEXT;
  v_trade_name TEXT;
  v_phone TEXT;
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

  -- Higienizar e validar o slug
  v_clean_slug := lower(trim(p_slug));
  IF v_clean_slug IS NULL OR v_clean_slug = '' THEN
    RAISE EXCEPTION 'O link público da barbearia é obrigatório.';
  END IF;

  v_slug_check := public.check_slug_availability(v_clean_slug);
  IF NOT COALESCE((v_slug_check->>'available')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_slug_check->>'error', 'Este link público já está em uso.');
  END IF;

  -- Tratar dados complementares
  v_street := COALESCE(NULLIF(trim(p_address_street), ''), NULLIF(trim(p_address), ''));
  v_trade_name := COALESCE(NULLIF(trim(p_trade_name), ''), trim(p_name));
  v_phone := COALESCE(NULLIF(trim(p_phone), ''), '11999999999');

  -- Assegurar existência do registro em public.profiles para satisfazer a foreign key tenant_users_user_id_fkey
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    updated_at
  ) VALUES (
    v_user_id,
    COALESCE(v_user_email, ''),
    COALESCE(NULLIF(v_user_full_name, ''), trim(p_name), 'Barbeiro Principal'),
    v_phone,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(NULLIF(public.profiles.email, ''), EXCLUDED.email),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = now();

  -- 1. Inserir barbearia na tabela tenants
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
    COALESCE(NULLIF(trim(p_email), ''), v_user_email, 'contato@mbarber.com.br'),
    v_street,
    NULLIF(trim(p_address_number), ''),
    NULLIF(trim(p_address_neighborhood), ''),
    NULLIF(trim(p_address_city), ''),
    NULLIF(trim(p_address_state), ''),
    NULLIF(trim(p_address_zip_code), ''),
    NULLIF(trim(p_logo_url), ''),
    'trial',
    now() + interval '35 days',
    '{"allow_client_cancel_hours": 2, "slot_interval_minutes": 30, "send_reminders_hours_before": 2}'::jsonb
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Vincular usuário logado como 'owner' na tabela tenant_users
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    role,
    is_active
  ) VALUES (
    v_tenant_id,
    v_user_id,
    'owner',
    true
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'owner', is_active = true;

  -- 3. Inserir horários de funcionamento padrão (Segunda a Sábado 09:00 às 19:00)
  INSERT INTO public.business_hours (tenant_id, day_of_week, open_time, close_time, break_start, break_end, is_closed)
  VALUES
    (v_tenant_id, 0, '00:00', '00:00', NULL, NULL, true),
    (v_tenant_id, 1, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant_id, 2, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant_id, 3, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant_id, 4, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant_id, 5, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant_id, 6, '09:00', '18:00', '12:00', '13:00', false)
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

  -- 4. Inserir serviços básicos para ativação imediata
  INSERT INTO public.services (tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active)
  VALUES
    (v_tenant_id, 'Corte de Cabelo Tradicional', 'Corte completo com lavagem e acabamento.', 'Cabelo', 4000, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Alinhamento na navalha e toalha quente.', 'Barba', 3500, 30, 5, true)
  ON CONFLICT DO NOTHING;

  -- 5. Cadastrar o perfil do usuário como profissional inicial
  INSERT INTO public.professionals (tenant_id, user_id, name, phone, email, commission_rate, color_hex, is_active, display_order)
  SELECT
    v_tenant_id,
    v_user_id,
    COALESCE(NULLIF(p.full_name, ''), 'Barbeiro Principal'),
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
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Conceder permissão de execução explícita para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_tenant_for_current_user(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- 5. Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
