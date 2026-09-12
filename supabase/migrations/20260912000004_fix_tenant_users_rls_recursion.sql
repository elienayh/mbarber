-- Migration: 20260912000004_fix_tenant_users_rls_recursion.sql
-- Description: Elimina o erro de "infinite recursion detected in policy for relation tenant_users"
-- reescrevendo as políticas de tenant_users para condições diretas (user_id = auth.uid() OR is_platform_admin())
-- sem nenhuma subquery ou auto-referência recursiva.

-- ============================================================================
-- 1. DEFINIÇÃO DAS FUNÇÕES DE ACESSO (SECURITY DEFINER + search_path)
-- ============================================================================

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

-- ============================================================================
-- 2. RECONSTRUÇÃO DAS POLÍTICAS DE TENANT_USERS (ZERO RECURSÃO)
-- ============================================================================

-- Remove todas as versões anteriores das policies que causavam recursão
DROP POLICY IF EXISTS tenant_users_select ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_insert ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_update ON public.tenant_users;
DROP POLICY IF EXISTS tenant_users_delete ON public.tenant_users;

-- SELECT: Usuário autenticado acessa exclusivamente seus próprios registros de membership,
-- ou platform admin acessa todos. Nenhuma subquery é realizada em tenant_users.
CREATE POLICY tenant_users_select ON public.tenant_users
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

-- INSERT: Permite inserção do próprio vínculo (onboarding / self-healing) ou platform admin.
CREATE POLICY tenant_users_insert ON public.tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

-- UPDATE: Permite atualização do próprio vínculo ou platform admin.
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

-- DELETE: Permite exclusão do próprio vínculo ou platform admin.
CREATE POLICY tenant_users_delete ON public.tenant_users
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_platform_admin()
  );

-- ============================================================================
-- 3. POLÍTICA DE LEITURA EM TENANTS UTILIZANDO A FUNÇÃO SEGURA
-- ============================================================================

DROP POLICY IF EXISTS tenants_authenticated_select ON public.tenants;
CREATE POLICY tenants_authenticated_select ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin() OR
    public.user_has_tenant_access(id)
  );
