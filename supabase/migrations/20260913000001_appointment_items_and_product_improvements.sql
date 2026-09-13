-- ============================================================================
-- METRICBARBER - MIGRATION 20260913000001
-- DESCRIÇÃO: Itens de Agendamento (Venda de Produtos e Serviços Extras),
--            Upload de Fotos de Produtos, Ajuste Manual de Atendimentos
--            e Padrão de Buffer 0 Minutos para Novos Serviços.
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE FOTO NA TABELA DE PRODUTOS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. ADICIONAR CAMPOS DE AJUSTE MANUAL NA TABELA DE AGENDAMENTOS
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS manual_adjustment_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_notes TEXT;

-- 3. AJUSTAR PADRÃO DO BUFFER_MINUTES PARA 0 MINUTOS EM SERVIÇOS
ALTER TABLE public.services 
  ALTER COLUMN buffer_minutes SET DEFAULT 0;

-- 4. CRIAR TABELA APPOINTMENT_ITEMS (PRODUTOS E SERVIÇOS EXTRAS VINCULADOS AO AGENDAMENTO)
CREATE TABLE IF NOT EXISTS public.appointment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'product', -- 'product' | 'service'
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_appointment_items_appointment_id 
  ON public.appointment_items(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_items_tenant_id 
  ON public.appointment_items(tenant_id);

-- Ativar RLS
ALTER TABLE public.appointment_items ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE RLS PARA APPOINTMENT_ITEMS
DROP POLICY IF EXISTS appointment_items_select ON public.appointment_items;
CREATE POLICY appointment_items_select ON public.appointment_items
  FOR SELECT
  USING (
    public.user_has_tenant_access(tenant_id)
    OR auth.role() = 'anon'
    OR auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS appointment_items_insert ON public.appointment_items;
CREATE POLICY appointment_items_insert ON public.appointment_items
  FOR INSERT
  WITH CHECK (
    public.user_has_tenant_access(tenant_id)
    OR auth.role() = 'anon'
    OR auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS appointment_items_update ON public.appointment_items;
CREATE POLICY appointment_items_update ON public.appointment_items
  FOR UPDATE
  USING (
    public.user_has_tenant_access(tenant_id)
  )
  WITH CHECK (
    public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS appointment_items_delete ON public.appointment_items;
CREATE POLICY appointment_items_delete ON public.appointment_items
  FOR DELETE
  USING (
    public.user_has_tenant_access(tenant_id)
  );

-- 6. RPC PARA ADICIONAR PRODUTOS/ITENS VIA CHAT PÚBLICO OU BACKOFFICE COM VALIDAÇÃO DE ESTOQUE
CREATE OR REPLACE FUNCTION public.add_appointment_product(
  p_appointment_id UUID,
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment RECORD;
  v_product RECORD;
  v_item_id UUID;
  v_item_total INTEGER;
  v_new_appointment_price INTEGER;
BEGIN
  -- Validar quantidade
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
  END IF;

  -- Buscar agendamento
  SELECT id, tenant_id, price_cents, status INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Buscar produto
  SELECT id, name, sale_price_cents, current_stock, is_active INTO v_product
  FROM public.products
  WHERE id = p_product_id AND tenant_id = v_appointment.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'Este produto não está ativo para venda.';
  END IF;

  v_item_total := v_product.sale_price_cents * p_quantity;

  -- Inserir item
  INSERT INTO public.appointment_items (
    tenant_id,
    appointment_id,
    item_type,
    product_id,
    description,
    quantity,
    unit_price_cents,
    total_cents
  ) VALUES (
    v_appointment.tenant_id,
    v_appointment.id,
    'product',
    v_product.id,
    v_product.name,
    p_quantity,
    v_product.sale_price_cents,
    v_item_total
  )
  RETURNING id INTO v_item_id;

  -- Atualizar preço do agendamento
  v_new_appointment_price := v_appointment.price_cents + v_item_total;
  UPDATE public.appointments
  SET price_cents = v_new_appointment_price,
      updated_at = now()
  WHERE id = v_appointment.id;

  -- Se o agendamento já estava concluído, sincronizar no financeiro
  IF v_appointment.status = 'completed' THEN
    UPDATE public.financial_transactions
    SET amount_cents = v_new_appointment_price,
        updated_at = now()
    WHERE appointment_id = v_appointment.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', v_item_id,
    'new_price_cents', v_new_appointment_price
  );
END;
$$;

-- 7. ATUALIZAR TRIGGER DE CONCLUSÃO DE AGENDAMENTO COM SUPORTE A RECALCULO DE VALOR
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- 1. Atualizar histórico do cliente
    UPDATE public.customers
    SET
      total_appointments = total_appointments + 1,
      total_spent_cents = total_spent_cents + NEW.price_cents,
      last_appointment_at = NEW.start_time,
      updated_at = now()
    WHERE id = NEW.customer_id;

    -- 2. Gerar receita no financeiro
    INSERT INTO public.financial_transactions (
      tenant_id,
      appointment_id,
      type,
      category,
      amount_cents,
      payment_method,
      status,
      description,
      professional_id,
      paid_at
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      'income',
      'service_revenue',
      NEW.price_cents,
      'pix',
      'paid',
      format('Atendimento Concluído (#%s)', substring(NEW.id::text from 1 for 6)),
      NEW.professional_id,
      now()
    )
    ON CONFLICT (appointment_id) DO UPDATE
    SET amount_cents = EXCLUDED.amount_cents,
        description = EXCLUDED.description,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- 8. CONFIGURAR STORAGE BUCKET DE IMAGENS DE PRODUTOS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DO $$ BEGIN
  CREATE POLICY "Public Read Product Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Upload Product Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Update Product Images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Delete Product Images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;
