-- ============================================================================
-- METRICBARBER - MIGRATION 20260912000001
-- DESCRIÇÃO: Resolve a sobrecarga duplicada da RPC create_tenant_for_current_user
-- Elimina o erro PGRST203: "Could not choose the best candidate function between..."
-- ============================================================================

-- 0. Garantir que a coluna updated_at exista na tabela tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1. Remover explicitamente a assinatura de 12 parâmetros (versão sem p_address)
DROP FUNCTION IF EXISTS public.create_tenant_for_current_user(
  text, text, text, text, text, text, text, text, text, text, text, text
);

-- 2. Remover explicitamente a assinatura de 13 parâmetros anterior
DROP FUNCTION IF EXISTS public.create_tenant_for_current_user(
  text, text, text, text, text, text, text, text, text, text, text, text, text
);

-- 3. Bloco PL/pgSQL defensivo: remove qualquer assinatura residual da função
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

-- 4. Criar a versão canônica e única de public.create_tenant_for_current_user
-- Inclui p_address para retrocompatibilidade, suporte a 35 dias de teste e inicialização completa
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

  -- Higienizar e validar o slug
  v_base_slug := lower(regexp_replace(COALESCE(NULLIF(trim(p_slug), ''), trim(p_name)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'barbearia';
  END IF;

  v_clean_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) LOOP
    v_suffix := v_suffix + 1;
    v_clean_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  -- Tratar endereço unificando p_address_street e p_address
  v_street := COALESCE(NULLIF(trim(p_address_street), ''), NULLIF(trim(p_address), ''));
  v_trade_name := COALESCE(NULLIF(trim(p_trade_name), ''), trim(p_name));
  v_phone := COALESCE(NULLIF(trim(p_phone), ''), '11999999999');

  -- Assegurar existência do registro em public.profiles
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

  -- 1. Inserir barbearia na tabela tenants com período de teste comercial de 35 dias
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
  SET role = 'owner', is_active = true, updated_at = now();

  -- 3. Configurar horários de funcionamento padrão (Segunda a Sábado 08:00 às 19:00)
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

  -- 4. Inserir serviços básicos iniciais
  INSERT INTO public.services (
    tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active
  ) VALUES
    (v_tenant_id, 'Corte Cabelo Masculino', 'Corte moderno na tesoura ou máquina.', 'Cabelo', 4500, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Barboterapia com toalha quente e finalização.', 'Barba', 3500, 30, 5, true),
    (v_tenant_id, 'Combo Cabelo + Barba', 'Corte completo e barboterapia.', 'Combo', 7000, 60, 10, true)
  ON CONFLICT DO NOTHING;

  -- 5. Inserir o primeiro profissional automaticamente vinculado ao perfil do proprietário
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

-- 5. Conceder permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_tenant_for_current_user(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- 6. Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
