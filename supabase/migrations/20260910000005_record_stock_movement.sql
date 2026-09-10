-- ============================================================================
-- METRICBARBER - MIGRATION 07: RPC PARA REGISTRO DE MOVIMENTAÇÃO DE ESTOQUE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_tenant_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_unit_cost_cents INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_type_enum public.stock_movement_type;
BEGIN
  -- Validar permissão do usuário autenticado no tenant
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Não autorizado a movimentar estoque nesta barbearia.';
    END IF;
  END IF;

  -- Obter produto e estoque atual
  SELECT current_stock INTO v_current_stock
  FROM public.products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado para esta barbearia.';
  END IF;

  -- Converter com segurança para o tipo ENUM stock_movement_type
  BEGIN
    v_type_enum := p_type::public.stock_movement_type;
  EXCEPTION WHEN OTHERS THEN
    v_type_enum := 'adjustment'::public.stock_movement_type;
  END;

  -- Calcular novo estoque
  IF v_type_enum = 'in_purchase' THEN
    v_new_stock := v_current_stock + p_quantity;
  ELSIF v_type_enum IN ('out_sale', 'out_internal_use', 'out_loss_expired') THEN
    v_new_stock := GREATEST(0, v_current_stock - p_quantity);
  ELSIF v_type_enum = 'adjustment' THEN
    v_new_stock := p_quantity;
  ELSE
    v_new_stock := v_current_stock;
  END IF;

  -- Inserir movimentação no histórico
  INSERT INTO public.stock_movements (
    tenant_id,
    product_id,
    type,
    quantity,
    unit_cost_cents,
    notes,
    created_by,
    created_at
  ) VALUES (
    p_tenant_id,
    p_product_id,
    v_type_enum,
    p_quantity,
    p_unit_cost_cents,
    p_notes,
    auth.uid(),
    now()
  )
  RETURNING id INTO v_movement_id;

  -- Atualizar o saldo de estoque do produto
  UPDATE public.products
  SET
    current_stock = v_new_stock,
    updated_at = now()
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'product_id', p_product_id,
    'new_stock', v_new_stock
  );
END;
$$;

-- Conceder permissão para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- Notificar PostgREST para recarregar schema cache
NOTIFY pgrst, 'reload schema';
