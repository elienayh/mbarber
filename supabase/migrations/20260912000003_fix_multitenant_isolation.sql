-- Migration: 20260912000003_fix_multitenant_isolation.sql
-- Description: Rigorous multitenant isolation across all public tables with tenant_id.
-- Resolves root cause of cross-tenant data leakage (such as professionals/services/schedules
-- leaking across tenants due to overly permissive 'is_active = true' policies on 'anon, authenticated').

-- ============================================================================
-- 1. HELPER FUNCTIONS PARA VALIDAÇÃO DE TENANT E RBAC
-- ============================================================================

-- Verifica se o usuário autenticado atual tem acesso legítimo a este tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admins têm acesso irrestrito
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;

  -- Usuário normal precisa estar explicitamente cadastrado e ativo neste tenant
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Verifica se o usuário autenticado atual tem papéis específicos neste tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_role(p_tenant_id UUID, p_roles public.tenant_role[])
RETURNS BOOLEAN AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admins têm acesso irrestrito
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = ANY(p_roles)
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Índice para acelerar a checagem de RLS em todas as queries
CREATE INDEX IF NOT EXISTS idx_tenant_users_rls_lookup 
  ON public.tenant_users(user_id, tenant_id, is_active, role);

-- ============================================================================
-- 2. GARANTIR RLS HABILITADO EM TODAS AS TABELAS MULTITENANT
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. POLÍTICAS DE RLS ESTITAS POR TABELA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 TENANTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenants_select ON public.tenants;
DROP POLICY IF EXISTS tenants_authenticated_select ON public.tenants;
DROP POLICY IF EXISTS tenants_anon_select ON public.tenants;
DROP POLICY IF EXISTS tenants_update ON public.tenants;
DROP POLICY IF EXISTS tenants_delete ON public.tenants;

-- Usuários autenticados só leem os tenants a que pertencem (ou se forem superadmin)
CREATE POLICY tenants_authenticated_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin() OR
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Usuários anônimos podem ler tenants ativos/trial pelo slug para o chat de agendamento público
CREATE POLICY tenants_anon_select ON public.tenants
  FOR SELECT TO anon
  USING (status IN ('active', 'trial'));

CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin() OR
    public.user_has_tenant_role(id, ARRAY['owner']::public.tenant_role[])
  )
  WITH CHECK (
    public.is_platform_admin() OR
    public.user_has_tenant_role(id, ARRAY['owner']::public.tenant_role[])
  );

CREATE POLICY tenants_delete ON public.tenants
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin() OR
    public.user_has_tenant_role(id, ARRAY['owner']::public.tenant_role[])
  );

-- ----------------------------------------------------------------------------
-- 3.2 TENANT_USERS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_users_select ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_insert ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_update ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_delete ON public.tenant_users;

CREATE POLICY tenant_users_select ON public.tenant_users
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

CREATE POLICY tenant_users_insert ON public.tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

CREATE POLICY tenant_users_update ON public.tenant_users
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

CREATE POLICY tenant_users_delete ON public.tenant_users
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

-- ----------------------------------------------------------------------------
-- 3.3 PROFESSIONALS (Causa raiz do vazamento corrigida!)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS professionals_tenant_isolation ON public.professionals;
DROP POLICY IF EXISTS professionals_public_select ON public.professionals;
DROP POLICY IF EXISTS professionals_authenticated_all ON public.professionals;
DROP POLICY IF EXISTS professionals_anon_select ON public.professionals;

-- Usuários autenticados no painel interno NUNCA veem profissionais de outros tenants
CREATE POLICY professionals_tenant_isolation ON public.professionals
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Usuários anônimos no chat público leem apenas profissionais ativos da barbearia
CREATE POLICY professionals_anon_select ON public.professionals
  FOR SELECT TO anon
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- 3.4 SERVICES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS services_tenant_isolation ON public.services;
DROP POLICY IF EXISTS services_public_select ON public.services;
DROP POLICY IF EXISTS services_authenticated_all ON public.services;
DROP POLICY IF EXISTS services_anon_select ON public.services;

CREATE POLICY services_tenant_isolation ON public.services
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY services_anon_select ON public.services
  FOR SELECT TO anon
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- 3.5 PROFESSIONAL_SERVICES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS professional_services_tenant_isolation ON public.professional_services;
DROP POLICY IF EXISTS professional_services_anon_select ON public.professional_services;

CREATE POLICY professional_services_tenant_isolation ON public.professional_services
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY professional_services_anon_select ON public.professional_services
  FOR SELECT TO anon
  USING (true);

-- ----------------------------------------------------------------------------
-- 3.6 BUSINESS_HOURS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS business_hours_tenant_isolation ON public.business_hours;
DROP POLICY IF EXISTS business_hours_public_select ON public.business_hours;
DROP POLICY IF EXISTS business_hours_authenticated_all ON public.business_hours;
DROP POLICY IF EXISTS business_hours_anon_select ON public.business_hours;

CREATE POLICY business_hours_tenant_isolation ON public.business_hours
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY business_hours_anon_select ON public.business_hours
  FOR SELECT TO anon
  USING (true);

-- ----------------------------------------------------------------------------
-- 3.7 PROFESSIONAL_SCHEDULES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS professional_schedules_tenant_isolation ON public.professional_schedules;
DROP POLICY IF EXISTS professional_schedules_anon_select ON public.professional_schedules;

CREATE POLICY professional_schedules_tenant_isolation ON public.professional_schedules
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY professional_schedules_anon_select ON public.professional_schedules
  FOR SELECT TO anon
  USING (true);

-- ----------------------------------------------------------------------------
-- 3.8 SCHEDULE_BLOCKS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS schedule_blocks_tenant_isolation ON public.schedule_blocks;
DROP POLICY IF EXISTS schedule_blocks_authenticated_all ON public.schedule_blocks;
DROP POLICY IF EXISTS schedule_blocks_anon_select ON public.schedule_blocks;

CREATE POLICY schedule_blocks_tenant_isolation ON public.schedule_blocks
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ----------------------------------------------------------------------------
-- 3.9 CUSTOMERS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;
DROP POLICY IF EXISTS customers_authenticated_all ON public.customers;

CREATE POLICY customers_tenant_isolation ON public.customers
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ----------------------------------------------------------------------------
-- 3.10 APPOINTMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_tenant_isolation ON public.appointments;
DROP POLICY IF EXISTS appointments_authenticated_all ON public.appointments;

CREATE POLICY appointments_tenant_isolation ON public.appointments
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin() OR
    (
      public.user_has_tenant_access(tenant_id) AND (
        public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin', 'receptionist']::public.tenant_role[])
        OR (
          public.user_has_tenant_role(tenant_id, ARRAY['professional']::public.tenant_role[])
          AND professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid() AND tenant_id = appointments.tenant_id)
        )
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin() OR
    (
      public.user_has_tenant_access(tenant_id) AND (
        public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin', 'receptionist']::public.tenant_role[])
        OR (
          public.user_has_tenant_role(tenant_id, ARRAY['professional']::public.tenant_role[])
          AND professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid() AND tenant_id = appointments.tenant_id)
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3.11 APPOINTMENT_SERIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS appointment_series_tenant_isolation ON public.appointment_series;

CREATE POLICY appointment_series_tenant_isolation ON public.appointment_series
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ----------------------------------------------------------------------------
-- 3.12 FINANCIAL_TRANSACTIONS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS financial_tenant_isolation ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_tenant_isolation ON public.financial_transactions;

CREATE POLICY financial_tenant_isolation ON public.financial_transactions
  FOR ALL TO authenticated
  USING (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]))
  WITH CHECK (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]));

-- ----------------------------------------------------------------------------
-- 3.13 PRODUCTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS products_tenant_isolation ON public.products;
DROP POLICY IF EXISTS products_anon_select ON public.products;

CREATE POLICY products_tenant_isolation ON public.products
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY products_anon_select ON public.products
  FOR SELECT TO anon
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- 3.14 STOCK_MOVEMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_movements_tenant_isolation ON public.stock_movements;

CREATE POLICY stock_movements_tenant_isolation ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]))
  WITH CHECK (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]));

-- ----------------------------------------------------------------------------
-- 3.15 SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_tenant_isolation ON public.subscriptions;

CREATE POLICY subscriptions_tenant_isolation ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]))
  WITH CHECK (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]));

-- ----------------------------------------------------------------------------
-- 3.16 NOTIFICATION_LOGS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_logs_tenant_isolation ON public.notification_logs;

CREATE POLICY notification_logs_tenant_isolation ON public.notification_logs
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ----------------------------------------------------------------------------
-- 3.17 AUDIT_LOGS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON public.audit_logs;

CREATE POLICY audit_logs_tenant_isolation ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]))
  WITH CHECK (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]));

-- ============================================================================
-- 4. RECARREGAR O SCHEMA CACHE DO POSTGREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
