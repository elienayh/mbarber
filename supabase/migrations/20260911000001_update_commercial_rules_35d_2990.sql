-- ============================================================================
-- METRICBARBER - MIGRATION 20260911000001: REGRA COMERCIAL UNIFICADA
-- 35 dias de teste gratuito
-- R$ 29,90 por barbeiro/profissional por mês (2990 centavos)
-- ============================================================================

-- 1. Atualizar RPC create_tenant_for_current_user para 35 dias de teste
CREATE OR REPLACE FUNCTION public.create_tenant_for_current_user(
  p_name TEXT,
  p_trade_name TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_zip_code TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_tenant_id UUID;
  v_base_slug TEXT;
  v_clean_slug TEXT;
  v_trade_name TEXT;
  v_phone TEXT;
  v_street TEXT;
  v_slug_suffix INT := 1;
BEGIN
  -- Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. Faça login para cadastrar a barbearia.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'O nome da barbearia é obrigatório.';
  END IF;

  v_base_slug := lower(regexp_replace(COALESCE(NULLIF(trim(p_slug), ''), trim(p_name)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'barbearia';
  END IF;

  v_clean_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) LOOP
    v_slug_suffix := v_slug_suffix + 1;
    v_clean_slug := v_base_slug || '-' || v_slug_suffix;
  END LOOP;

  v_trade_name := COALESCE(NULLIF(trim(p_trade_name), ''), trim(p_name));
  v_phone := NULLIF(trim(p_phone), '');
  v_street := NULLIF(trim(p_address_street), '');

  -- Inserir nova barbearia com 35 dias de teste gratuito
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

  -- Vincular usuário logado como 'owner' na tabela tenant_users
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

  -- Garantir registro na tabela profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone
  ) VALUES (
    v_user_id,
    COALESCE(v_trade_name, 'Proprietário'),
    COALESCE(v_user_email, 'usuario@mbarber.com.br'),
    v_phone
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name, updated_at = now();

  -- Inserir serviços básicos iniciais
  INSERT INTO public.services (tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active)
  VALUES
    (v_tenant_id, 'Corte Cabelo Masculino', 'Corte moderno na tesoura ou máquina.', 'Cabelo', 4500, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Barboterapia com toalha quente e finalização.', 'Barba', 3500, 30, 5, true),
    (v_tenant_id, 'Combo Cabelo + Barba', 'Corte completo e barboterapia.', 'Combo', 7000, 60, 10, true)
  ON CONFLICT DO NOTHING;

  -- Inserir o primeiro profissional automaticamente (o proprietário)
  INSERT INTO public.professionals (
    tenant_id,
    user_id,
    name,
    nickname,
    email,
    phone,
    commission_rate,
    is_active
  ) VALUES (
    v_tenant_id,
    v_user_id,
    v_trade_name,
    split_part(v_trade_name, ' ', 1),
    v_user_email,
    v_phone,
    50,
    true
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'id', v_tenant_id,
    'slug', v_clean_slug,
    'name', trim(p_name),
    'trade_name', v_trade_name,
    'status', 'trial',
    'trial_ends_at', (now() + interval '35 days'),
    'created_at', now()
  );
END;
$$;

-- 2. Atualizar tenants existentes que estejam em 'trial' para terem 35 dias a partir da criação
UPDATE public.tenants
SET trial_ends_at = created_at + interval '35 days'
WHERE status = 'trial' AND trial_ends_at < (created_at + interval '35 days');

-- 3. Atualizar planos para refletir a nova regra comercial: R$ 29,90 por barbeiro/mês
UPDATE public.plans
SET 
  price_cents = 2990,
  description = '1 barbeiro • R$ 29,90/mês'
WHERE slug = 'solo';

UPDATE public.plans
SET 
  price_cents = 5980,
  max_professionals = 2,
  description = '2 barbeiros • R$ 29,90 por barbeiro (R$ 59,80/mês)'
WHERE slug = 'pro';

UPDATE public.plans
SET 
  price_cents = 8970,
  max_professionals = 3,
  description = '3 barbeiros • R$ 29,90 por barbeiro (R$ 89,70/mês)'
WHERE slug = 'enterprise';
