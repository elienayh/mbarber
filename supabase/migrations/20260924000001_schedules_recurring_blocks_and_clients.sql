-- ============================================================================
-- METRICBARBER - MIGRATION: RECURRING SCHEDULE BLOCKS, CLIENTS & UNIFIED SCHEDULES
-- ============================================================================

-- 1. TABELA DE BLOQUEIOS RECORRENTES DE HORÁRIO
CREATE TABLE IF NOT EXISTS public.recurring_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE, -- NULL = toda a barbearia
  title VARCHAR(150) NOT NULL,
  recurrence_type VARCHAR(50) NOT NULL DEFAULT 'weekly', -- 'weekly', 'biweekly', 'monthly_fixed_day', 'monthly_relative'
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda, ..., 6=Sábado
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31), -- Ex: todo dia 15
  week_of_month INTEGER CHECK (week_of_month BETWEEN -1 AND 5), -- -1 = última semana do mês, 1 = 1ª semana, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_all_day BOOLEAN DEFAULT false NOT NULL,
  start_date DATE DEFAULT CURRENT_DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_recurring_blocks_tenant_active 
  ON public.recurring_schedule_blocks(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_blocks_prof 
  ON public.recurring_schedule_blocks(professional_id);

-- RLS para recurring_schedule_blocks
ALTER TABLE public.recurring_schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_blocks_tenant_isolation ON public.recurring_schedule_blocks;
CREATE POLICY recurring_blocks_tenant_isolation ON public.recurring_schedule_blocks
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS recurring_blocks_anon_select ON public.recurring_schedule_blocks;
CREATE POLICY recurring_blocks_anon_select ON public.recurring_schedule_blocks
  FOR SELECT TO anon
  USING (is_active = true);

-- 2. EXPANDIR APPOINTMENT_SERIES PARA RECORRÊNCIAS AVANÇADAS (DIA FIXO DO MÊS, ÚLTIMA SEXTA, ETC.)
ALTER TABLE public.appointment_series 
  ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50) DEFAULT 'weekly' NOT NULL,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS week_of_month INTEGER CHECK (week_of_month BETWEEN -1 AND 5),
  ADD COLUMN IF NOT EXISTS price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS client_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- 3. GARANTIR RLS EM APPOINTMENT_SERIES
ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_series_tenant_isolation ON public.appointment_series;
CREATE POLICY appointment_series_tenant_isolation ON public.appointment_series
  FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS appointment_series_anon_select ON public.appointment_series;
CREATE POLICY appointment_series_anon_select ON public.appointment_series
  FOR SELECT TO anon
  USING (status = 'active' AND is_active = true);

-- 4. RECARREGAR SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
