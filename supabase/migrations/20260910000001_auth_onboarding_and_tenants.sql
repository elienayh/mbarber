-- ============================================================================
-- METRICBARBER - MIGRATION 05: FLUXO DE ONBOARDING, PERFIL E GESTÃO DE TENANTS
-- ============================================================================

-- 1. ATUALIZAR TABELA PROFILES (Telefone/WhatsApp e CPF)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);

-- 2. TRIGGER AUTOMÁTICO PARA CRIAÇÃO DE PERFIL VIA AUTH (Google OAuth & Email/Senha)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    is_platform_admin,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. AJUSTAR HELPER DE SUPER ADMIN
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = true),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. POLÍTICAS DE RLS PARA PROFILES
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR
    public.is_platform_admin() OR
    EXISTS (
      SELECT 1 FROM public.tenant_users tu1
      JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
      WHERE tu1.user_id = auth.uid() AND tu2.user_id = public.profiles.id
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    public.is_platform_admin()
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR
    public.is_platform_admin()
  );

-- 5. POLÍTICAS DE RLS PARA TENANTS
DROP POLICY IF EXISTS tenants_select ON public.tenants;
DROP POLICY IF EXISTS tenants_insert ON public.tenants;
DROP POLICY IF EXISTS tenants_update ON public.tenants;

CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (
    public.is_platform_admin() OR
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()) OR
    status IN ('active', 'trial')
  );

CREATE POLICY tenants_insert ON public.tenants
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE USING (
    public.is_platform_admin() OR
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- 6. POLÍTICAS DE RLS PARA TENANT_USERS
DROP POLICY IF EXISTS tenant_users_select ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_insert ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_update ON public.tenant_users;

CREATE POLICY tenant_users_select ON public.tenant_users
  FOR SELECT USING (
    public.is_platform_admin() OR
    user_id = auth.uid() OR
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY tenant_users_insert ON public.tenant_users
  FOR INSERT WITH CHECK (
    public.is_platform_admin() OR
    user_id = auth.uid() OR
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY tenant_users_update ON public.tenant_users
  FOR UPDATE USING (
    public.is_platform_admin() OR
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- 7. VALIDADOR DE SLUG DE TENANT (Função SQL)
CREATE OR REPLACE FUNCTION public.check_slug_availability(
  p_slug TEXT,
  p_exclude_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_normalized_slug TEXT;
  v_is_reserved BOOLEAN;
  v_is_taken BOOLEAN;
  v_reserved_list TEXT[] := ARRAY[
    'admin', 'auth', 'dashboard', 'agenda', 'clientes', 'servicos',
    'profissionais', 'financeiro', 'estoque', 'relatorios', 'configuracoes',
    'onboarding', 'api', 'login', 'register', 'reset-password', 'app',
    'mbarber', 'public', 'home', 'terms', 'privacy', 'suporte', 'planos'
  ];
BEGIN
  v_normalized_slug := lower(trim(p_slug));

  -- Validar formato (somente letras, números e hífens, min 3, max 60)
  IF v_normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'O link deve ter entre 3 e 60 caracteres e conter apenas letras minúsculas, números e hífens.'
    );
  END IF;

  -- Validar rotas reservadas
  IF v_normalized_slug = ANY(v_reserved_list) THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Este termo é reservado pelo sistema e não pode ser utilizado como link público.'
    );
  END IF;

  -- Validar unicidade no banco
  SELECT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE slug = v_normalized_slug
      AND (p_exclude_tenant_id IS NULL OR id != p_exclude_tenant_id)
  ) INTO v_is_taken;

  IF v_is_taken THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Este link público já está sendo utilizado por outra barbearia.'
    );
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'slug', v_normalized_slug
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. RPC ATÔMICA PARA CONFIGURAR BARBEARIA DO USUÁRIO LOGADO
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
  v_slug_check JSONB;
  v_tenant_id UUID;
  v_clean_slug TEXT;
  v_street TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Obter e-mail do usuário autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Validar slug
  v_clean_slug := lower(trim(p_slug));
  v_slug_check := public.check_slug_availability(v_clean_slug);
  IF NOT (v_slug_check->>'available')::boolean THEN
    RAISE EXCEPTION '%', (v_slug_check->>'error');
  END IF;

  v_street := COALESCE(p_address_street, p_address);

  -- Inserir nova barbearia
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
    COALESCE(NULLIF(trim(p_trade_name), ''), trim(p_name)),
    v_clean_slug,
    COALESCE(p_phone, '11999999999'),
    COALESCE(NULLIF(trim(p_email), ''), v_user_email, 'contato@mbarber.com.br'),
    v_street,
    p_address_number,
    p_address_neighborhood,
    p_address_city,
    p_address_state,
    p_address_zip_code,
    p_logo_url,
    'trial',
    now() + interval '14 days',
    '{"allow_client_cancel_hours": 2, "slot_interval_minutes": 30, "send_reminders_hours_before": 2}'::jsonb
  )
  RETURNING id INTO v_tenant_id;

  -- Criar membership como 'owner'
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

  -- Inserir horários de funcionamento padrão (Segunda a Sábado 09:00 às 19:00)
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

  -- Inserir serviços básicos iniciais para facilitar o teste imediato
  INSERT INTO public.services (tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active)
  VALUES
    (v_tenant_id, 'Corte de Cabelo Tradicional', 'Corte completo com lavagem e acabamento.', 'Cabelo', 4000, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Alinhamento na navalha e toalha quente.', 'Barba', 3500, 30, 5, true)
  ON CONFLICT DO NOTHING;

  -- Se o perfil do usuário tiver nome, adicioná-lo também como profissional inicial
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
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
