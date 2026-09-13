-- ============================================================================
-- METRICBARBER - MIGRATION 20260913000002
-- DESCRIÇÃO: Trilha de Auditoria Anti-Fraude e Soft Delete para Registros Financeiros.
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE SOFT DELETE EM TABELAS DE IMPACTO FINANCEIRO E CADASTROS
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.appointment_items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 2. EXPANDIR TABELA DE AUDIT_LOGS
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_data JSONB,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Índices de performance para busca em auditoria e soft delete
CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at 
  ON public.appointments(deleted_at) 
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_deleted_at 
  ON public.financial_transactions(deleted_at) 
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON public.audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
  ON public.audit_logs(entity_type, entity_id);

-- 3. AJUSTE DE RLS PARA AUDIT_LOGS
-- - Leitura: Apenas Owner e Admin do tenant (ou platform admin)
-- - Inserção: Qualquer membro autenticado da barbearia (para registrar sua própria ação)
-- - Modificação/Exclusão: RIGOROSAMENTE PROIBIDO (sem policies para UPDATE/DELETE)
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::public.tenant_role[])
    OR public.is_platform_admin()
  );

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IS NULL
    OR public.user_has_tenant_access(tenant_id)
    OR public.is_platform_admin()
  );

-- 4. RPC DE AUDITORIA GENERICA (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_previous_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_actor_email VARCHAR(150);
BEGIN
  -- Identifica o e-mail do ator autenticado
  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    previous_state,
    previous_data,
    new_state,
    deletion_reason,
    created_at
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    auth.uid(),
    COALESCE(v_actor_email, 'usuario_autenticado'),
    p_action,
    p_entity_type,
    p_entity_id,
    p_previous_data,
    p_previous_data,
    p_new_data,
    p_reason,
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- 5. RPC PARA EXCLUSÃO DE ATENDIMENTO COM AUDITORIA ANTIFRAUDE (SOFT DELETE)
CREATE OR REPLACE FUNCTION public.delete_appointment_with_audit(
  p_appointment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_apt RECORD;
  v_items JSONB;
  v_snapshot JSONB;
  v_user_id UUID := auth.uid();
  v_user_email VARCHAR(150);
BEGIN
  -- 1. Carregar dados atuais do agendamento
  SELECT a.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS service_name, p.name AS professional_name
  INTO v_apt
  FROM public.appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.professionals p ON p.id = a.professional_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Validar permissão de acesso ao tenant
  IF NOT public.user_has_tenant_access(v_apt.tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado ao registro da barbearia.';
  END IF;

  -- 2. Coletar itens extras vinculados
  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  INTO v_items
  FROM public.appointment_items i
  WHERE i.appointment_id = p_appointment_id;

  -- 3. Montar snapshot completo do atendimento antes da exclusão
  v_snapshot := jsonb_build_object(
    'id', v_apt.id,
    'tenant_id', v_apt.tenant_id,
    'customer_name', v_apt.customer_name,
    'customer_phone', v_apt.customer_phone,
    'service_name', v_apt.service_name,
    'professional_name', v_apt.professional_name,
    'start_time', v_apt.start_time,
    'end_time', v_apt.end_time,
    'duration_minutes', v_apt.duration_minutes,
    'price_cents', v_apt.price_cents,
    'manual_adjustment_cents', v_apt.manual_adjustment_cents,
    'adjustment_notes', v_apt.adjustment_notes,
    'status', v_apt.status,
    'items', v_items
  );

  -- 4. Executar SOFT DELETE no agendamento e itens (NUNCA DELETE FÍSICO)
  UPDATE public.appointments
  SET deleted_at = now(),
      deleted_by = v_user_id,
      deletion_reason = p_reason
  WHERE id = p_appointment_id;

  UPDATE public.appointment_items
  SET deleted_at = now(),
      deleted_by = v_user_id,
      deletion_reason = p_reason
  WHERE appointment_id = p_appointment_id;

  -- NOTA ANTIFRAUDE: As transações financeiras em public.financial_transactions
  -- NÃO são apagadas. O valor continua existindo e contabilizado no caixa da barbearia,
  -- apenas com anotação de que o atendimento na agenda foi excluído por auditoria.
  UPDATE public.financial_transactions
  SET description = description || ' [ATENDIMENTO EXCLUÍDO DA AGENDA]',
      deletion_reason = COALESCE(p_reason, 'Excluído da agenda')
  WHERE appointment_id = p_appointment_id;

  -- 5. Registrar na trilha de auditoria imutável
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    previous_state,
    previous_data,
    new_state,
    deletion_reason,
    created_at
  ) VALUES (
    v_apt.tenant_id,
    v_user_id,
    v_user_id,
    COALESCE(v_user_email, 'usuario_autenticado'),
    'soft_delete',
    'appointment',
    p_appointment_id::text,
    v_snapshot,
    v_snapshot,
    jsonb_build_object('deleted_at', now(), 'deleted_by', v_user_id, 'reason', p_reason),
    p_reason,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'message', 'Atendimento excluído com sucesso e registrado na auditoria.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_appointment_with_audit TO authenticated;

-- 6. RPC PARA EXCLUSÃO DE PROFISSIONAL COM PROTEÇÃO DE HISTÓRICO E AUDITORIA
CREATE OR REPLACE FUNCTION public.delete_professional_with_audit(
  p_professional_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pro RECORD;
  v_history_count INTEGER := 0;
  v_tx_count INTEGER := 0;
  v_snapshot JSONB;
  v_user_id UUID := auth.uid();
  v_user_email VARCHAR(150);
  v_action TEXT := 'delete';
  v_is_soft BOOLEAN := false;
BEGIN
  SELECT * INTO v_pro FROM public.professionals WHERE id = p_professional_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado.';
  END IF;

  IF NOT public.user_has_tenant_role(v_pro.tenant_id, ARRAY['owner', 'admin']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'Apenas proprietários e administradores podem excluir profissionais.';
  END IF;

  -- Snapshot
  v_snapshot := to_jsonb(v_pro);

  -- Verificar histórico de atendimentos e transações
  SELECT COUNT(*) INTO v_history_count FROM public.appointments WHERE professional_id = p_professional_id;
  SELECT COUNT(*) INTO v_tx_count FROM public.financial_transactions WHERE professional_id = p_professional_id;

  IF (v_history_count > 0 OR v_tx_count > 0) THEN
    -- Possui histórico financeiro ou atendimentos: converter em soft delete / inativação
    v_action := 'soft_delete';
    v_is_soft := true;

    UPDATE public.professionals
    SET is_active = false,
        deleted_at = now(),
        deleted_by = v_user_id,
        deletion_reason = p_reason
    WHERE id = p_professional_id;
  ELSE
    -- Sem histórico: remoção física
    v_action := 'delete';
    v_is_soft := false;

    DELETE FROM public.professional_services WHERE professional_id = p_professional_id;
    DELETE FROM public.professional_schedules WHERE professional_id = p_professional_id;
    DELETE FROM public.professionals WHERE id = p_professional_id;
  END IF;

  -- Registrar na auditoria
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    previous_state,
    previous_data,
    new_state,
    deletion_reason,
    created_at
  ) VALUES (
    v_pro.tenant_id,
    v_user_id,
    v_user_id,
    COALESCE(v_user_email, 'usuario_autenticado'),
    v_action,
    'professional',
    p_professional_id::text,
    v_snapshot,
    v_snapshot,
    jsonb_build_object('soft_deleted', v_is_soft, 'deleted_at', now(), 'reason', p_reason),
    p_reason,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'professional_id', p_professional_id,
    'is_soft_deleted', v_is_soft,
    'message', CASE 
      WHEN v_is_soft THEN 'Profissional possui histórico de atendimentos e foi inativado/arquivado para manter a integridade dos relatórios.'
      ELSE 'Profissional excluído com sucesso.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_professional_with_audit TO authenticated;

-- 7. RPC PARA EXCLUSÃO DE SERVIÇO COM PROTEÇÃO DE HISTÓRICO E AUDITORIA
CREATE OR REPLACE FUNCTION public.delete_service_with_audit(
  p_service_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_srv RECORD;
  v_history_count INTEGER := 0;
  v_items_count INTEGER := 0;
  v_snapshot JSONB;
  v_user_id UUID := auth.uid();
  v_user_email VARCHAR(150);
  v_action TEXT := 'delete';
  v_is_soft BOOLEAN := false;
BEGIN
  SELECT * INTO v_srv FROM public.services WHERE id = p_service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado.';
  END IF;

  IF NOT public.user_has_tenant_role(v_srv.tenant_id, ARRAY['owner', 'admin', 'receptionist']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'Acesso negado para excluir serviços.';
  END IF;

  v_snapshot := to_jsonb(v_srv);

  -- Verificar histórico em atendimentos
  SELECT COUNT(*) INTO v_history_count FROM public.appointments WHERE service_id = p_service_id;
  SELECT COUNT(*) INTO v_items_count FROM public.appointment_items WHERE service_id = p_service_id;

  IF (v_history_count > 0 OR v_items_count > 0) THEN
    -- Manter integridade: inativação
    v_action := 'soft_delete';
    v_is_soft := true;

    UPDATE public.services
    SET is_active = false,
        deleted_at = now(),
        deleted_by = v_user_id,
        deletion_reason = p_reason
    WHERE id = p_service_id;
  ELSE
    v_action := 'delete';
    v_is_soft := false;

    DELETE FROM public.professional_services WHERE service_id = p_service_id;
    DELETE FROM public.services WHERE id = p_service_id;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    previous_state,
    previous_data,
    new_state,
    deletion_reason,
    created_at
  ) VALUES (
    v_srv.tenant_id,
    v_user_id,
    v_user_id,
    COALESCE(v_user_email, 'usuario_autenticado'),
    v_action,
    'service',
    p_service_id::text,
    v_snapshot,
    v_snapshot,
    jsonb_build_object('soft_deleted', v_is_soft, 'deleted_at', now(), 'reason', p_reason),
    p_reason,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_id,
    'is_soft_deleted', v_is_soft,
    'message', CASE 
      WHEN v_is_soft THEN 'Serviço possui agendamentos passados vinculados e foi inativado para manter os relatórios íntegros.'
      ELSE 'Serviço excluído com sucesso.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_service_with_audit TO authenticated;

-- 8. RPC PARA EXCLUSÃO DE PRODUTO COM PROTEÇÃO DE HISTÓRICO E AUDITORIA
CREATE OR REPLACE FUNCTION public.delete_product_with_audit(
  p_product_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prod RECORD;
  v_items_count INTEGER := 0;
  v_movements_count INTEGER := 0;
  v_snapshot JSONB;
  v_user_id UUID := auth.uid();
  v_user_email VARCHAR(150);
  v_action TEXT := 'delete';
  v_is_soft BOOLEAN := false;
BEGIN
  SELECT * INTO v_prod FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF NOT public.user_has_tenant_role(v_prod.tenant_id, ARRAY['owner', 'admin', 'receptionist']::public.tenant_role[]) THEN
    RAISE EXCEPTION 'Acesso negado para excluir produtos.';
  END IF;

  v_snapshot := to_jsonb(v_prod);

  -- Verificar histórico em vendas ou estoque
  SELECT COUNT(*) INTO v_items_count FROM public.appointment_items WHERE product_id = p_product_id;
  SELECT COUNT(*) INTO v_movements_count FROM public.stock_movements WHERE product_id = p_product_id;

  IF (v_items_count > 0 OR v_movements_count > 0) THEN
    v_action := 'soft_delete';
    v_is_soft := true;

    UPDATE public.products
    SET is_active = false,
        deleted_at = now(),
        deleted_by = v_user_id,
        deletion_reason = p_reason
    WHERE id = p_product_id;
  ELSE
    v_action := 'delete';
    v_is_soft := false;

    DELETE FROM public.products WHERE id = p_product_id;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    previous_state,
    previous_data,
    new_state,
    deletion_reason,
    created_at
  ) VALUES (
    v_prod.tenant_id,
    v_user_id,
    v_user_id,
    COALESCE(v_user_email, 'usuario_autenticado'),
    v_action,
    'product',
    p_product_id::text,
    v_snapshot,
    v_snapshot,
    jsonb_build_object('soft_deleted', v_is_soft, 'deleted_at', now(), 'reason', p_reason),
    p_reason,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'is_soft_deleted', v_is_soft,
    'message', CASE 
      WHEN v_is_soft THEN 'Produto possui histórico de movimentação ou vendas e foi inativado/arquivado para manter o estoque e caixa consistentes.'
      ELSE 'Produto excluído com sucesso.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_product_with_audit TO authenticated;

-- 9. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
