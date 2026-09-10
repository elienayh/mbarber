-- ============================================================================
-- METRICBARBER - MIGRATION 06: EXCLUSÃO DE TENANT PELO SUPER ADMIN
-- ============================================================================

-- 1. Garantir política de DELETE na tabela public.tenants para super administradores
DROP POLICY IF EXISTS tenants_delete ON public.tenants;
CREATE POLICY tenants_delete ON public.tenants
  FOR DELETE USING (
    public.is_platform_admin()
  );

-- 2. RPC para Exclusão Ordenada e Segura de Barbearia pelo Super Admin
CREATE OR REPLACE FUNCTION public.delete_tenant_by_admin(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validar se o usuário logado possui privilégios de plataforma (super admin)
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma podem excluir barbearias.';
  END IF;

  -- 1. Excluir dados vinculados com constraints restritivas em ordem
  DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM public.appointment_series WHERE tenant_id = p_tenant_id;
  DELETE FROM public.schedule_blocks WHERE tenant_id = p_tenant_id;
  DELETE FROM public.product_movements WHERE tenant_id = p_tenant_id;
  DELETE FROM public.products WHERE tenant_id = p_tenant_id;
  DELETE FROM public.services WHERE tenant_id = p_tenant_id;
  DELETE FROM public.professionals WHERE tenant_id = p_tenant_id;
  DELETE FROM public.customers WHERE tenant_id = p_tenant_id;
  DELETE FROM public.business_hours WHERE tenant_id = p_tenant_id;
  DELETE FROM public.subscriptions WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_users WHERE tenant_id = p_tenant_id;

  -- 2. Excluir o tenant em si
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'deleted_tenant_id', p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant_by_admin(UUID) TO authenticated;
