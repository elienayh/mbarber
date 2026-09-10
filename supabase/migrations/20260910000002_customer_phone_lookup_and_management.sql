-- ============================================================================
-- METRICBARBER - MIGRATION 06: BUSCA DE CLIENTE POR TELEFONE E GESTÃO
-- ============================================================================

-- 1. RPC para o Chat Público: busca cliente por telefone dentro do tenant pelo slug
CREATE OR REPLACE FUNCTION public.find_customer_by_phone(
  p_slug TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_clean_phone TEXT;
  v_customer RECORD;
BEGIN
  -- Obter o ID do tenant pelo slug
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Barbearia não encontrada.');
  END IF;

  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_clean_phone) < 8 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Busca cliente correspondente pelo telefone limpo
  SELECT id, name, phone, notes, total_appointments, total_spent_cents, last_appointment_at
  INTO v_customer
  FROM public.customers
  WHERE tenant_id = v_tenant_id
    AND (
      phone = v_clean_phone 
      OR regexp_replace(phone, '\D', '', 'g') = v_clean_phone
      OR phone LIKE '%' || v_clean_phone
    )
  ORDER BY last_appointment_at DESC NULLS LAST, updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'found', true,
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'notes', v_customer.notes,
      'total_appointments', v_customer.total_appointments,
      'total_spent_cents', v_customer.total_spent_cents,
      'last_appointment_at', v_customer.last_appointment_at
    );
  END IF;

  -- Se não achou na tabela customers, buscar nos agendamentos recentes
  SELECT a.id, a.notes, a.created_at, c.name, c.phone
  INTO v_customer
  FROM public.appointments a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.tenant_id = v_tenant_id
    AND (
      regexp_replace(c.phone, '\D', '', 'g') = v_clean_phone
      OR c.phone LIKE '%' || v_clean_phone
    )
  ORDER BY a.start_time DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'found', true,
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone
    );
  END IF;

  RETURN jsonb_build_object('found', false);
END;
$$;

-- Permitir acesso anônimo à RPC de identificação no chat público
GRANT EXECUTE ON FUNCTION public.find_customer_by_phone(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2. RPC para Barbearia: Exclusão completa e segura de cliente e seus históricos
CREATE OR REPLACE FUNCTION public.delete_customer_by_id(
  p_customer_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Validar permissão: apenas membros da barbearia ou admin podem excluir
  IF NOT (public.is_platform_admin() OR public.has_tenant_permission(p_tenant_id, 'manage_settings') OR public.current_tenant_id() = p_tenant_id) THEN
    -- Fallback: verifica se há membership ativa
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users 
      WHERE tenant_id = p_tenant_id 
        AND user_id = auth.uid() 
        AND is_active = true
    ) AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Não autorizado a excluir clientes nesta barbearia.';
    END IF;
  END IF;

  -- Excluir agendamentos dependentes para não violar foreign key RESTRICT
  DELETE FROM public.appointments 
  WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id;

  DELETE FROM public.appointment_series 
  WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id;

  -- Excluir o cliente
  DELETE FROM public.customers 
  WHERE id = p_customer_id AND tenant_id = p_tenant_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_by_id(UUID, UUID) TO authenticated, service_role;
