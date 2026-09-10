-- LEGACY REFERENCE ONLY
-- The official production schema is the ordered migrations in supabase/migrations.
-- Do not apply this consolidated file to production.
-- ============================================================================
-- ============================================================================
-- METRICBARBER - SETUP CONSOLIDADO 100% IDEMPOTENTE
-- ============================================================================

-- ============================================================================
-- METRICBARBER - MIGRATION 01: INITIAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'professional', 'receptionist');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE appointment_origin AS ENUM ('public_chat', 'backoffice', 'recurrent');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE series_status AS ENUM ('active', 'completed', 'canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE financial_category AS ENUM ('service_revenue', 'product_sale', 'commission_payout', 'rent', 'utilities', 'supplies', 'software', 'marketing', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('money', 'pix', 'credit_card', 'debit_card', 'transfer', 'voucher');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'paid', 'canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('in_purchase', 'out_sale', 'out_internal_use', 'out_loss_expired', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('whatsapp', 'email', 'sms', 'push');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE notification_event AS ENUM ('created', 'confirmed', 'reminder', 'canceled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE webhook_status AS ENUM ('pending', 'processed', 'ignored', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  trade_name VARCHAR(150) NOT NULL,
  document_number VARCHAR(20),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  address_street VARCHAR(200),
  address_number VARCHAR(20),
  address_neighborhood VARCHAR(100),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zip_code VARCHAR(10),
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#f59e0b',
  secondary_color VARCHAR(7) DEFAULT '#0f172a',
  status tenant_status DEFAULT 'trial' NOT NULL,
  trial_ends_at TIMESTAMPTZ NOT NULL,
  settings JSONB DEFAULT '{"allow_client_cancel_hours": 2, "slot_interval_minutes": 30, "send_reminders_hours_before": 2}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 2. PLANS (SAAS CATALOG)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  stripe_product_id VARCHAR(100) NOT NULL,
  stripe_price_id VARCHAR(100) NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  billing_cycle billing_cycle DEFAULT 'monthly' NOT NULL,
  max_professionals INTEGER NOT NULL CHECK (max_professionals > 0),
  features JSONB DEFAULT '{"reports": true, "inventory": true, "whatsapp_alerts": true}'::jsonb NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. SUBSCRIPTIONS (STRIPE BILLING)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  stripe_customer_id VARCHAR(100) NOT NULL,
  stripe_subscription_id VARCHAR(100) NOT NULL UNIQUE,
  status subscription_status NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- 4. PROFILES (AUTH USERS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(150) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  is_platform_admin BOOLEAN DEFAULT false NOT NULL,
  platform_role VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. TENANT_USERS
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role tenant_role DEFAULT 'professional' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);

-- 6. PROFESSIONALS
CREATE TABLE IF NOT EXISTS public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  nickname VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(150),
  avatar_url TEXT,
  bio TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 50.00 NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
  color_hex VARCHAR(7) DEFAULT '#3b82f6' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_professionals_tenant ON public.professionals(tenant_id);

-- 7. SERVICES
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'Cabelo' NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INTEGER DEFAULT 0 NOT NULL CHECK (buffer_minutes >= 0),
  is_active BOOLEAN DEFAULT true NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON public.services(tenant_id);

-- 8. PROFESSIONAL_SERVICES
CREATE TABLE IF NOT EXISTS public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_price_cents INTEGER,
  custom_duration_minutes INTEGER,
  custom_commission_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(professional_id, service_id)
);

-- 9. BUSINESS_HOURS
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_closed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, day_of_week)
);

-- 10. PROFESSIONAL_SCHEDULES
CREATE TABLE IF NOT EXISTS public.professional_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_day_off BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(professional_id, day_of_week)
);

-- 11. SCHEDULE_BLOCKS
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  notes TEXT,
  total_appointments INTEGER DEFAULT 0 NOT NULL,
  total_spent_cents BIGINT DEFAULT 0 NOT NULL,
  last_appointment_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON public.customers(tenant_id, phone);

-- 13. APPOINTMENT_SERIES (RECURRING)
CREATE TABLE IF NOT EXISTS public.appointment_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  frequency recurrence_frequency NOT NULL,
  day_of_week INTEGER,
  preferred_time TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  total_occurrences INTEGER NOT NULL CHECK (total_occurrences > 0),
  status series_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  series_id UUID REFERENCES public.appointment_series(id) ON DELETE SET NULL,
  series_index INTEGER,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_cents INTEGER NOT NULL GENERATED ALWAYS AS (ROUND((price_cents * commission_rate) / 100)) STORED,
  status appointment_status DEFAULT 'scheduled' NOT NULL,
  origin appointment_origin DEFAULT 'public_chat' NOT NULL,
  cancellation_reason TEXT,
  canceled_by VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_appointment_time CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time ON public.appointments(tenant_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_professional ON public.appointments(professional_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.appointments(customer_id);

-- Double-Booking Prevention Exclusion Constraint
DO $$ BEGIN
  ALTER TABLE public.appointments
ADD CONSTRAINT prevent_barber_double_booking
EXCLUDE USING gist (
  tenant_id WITH =,
  professional_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status IN ('scheduled', 'confirmed', 'in_progress'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 15. FINANCIAL_TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  category financial_category NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  payment_method payment_method DEFAULT 'pix' NOT NULL,
  status transaction_status DEFAULT 'paid' NOT NULL,
  description VARCHAR(255) NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ DEFAULT now(),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_tenant_date ON public.financial_transactions(tenant_id, paid_at);

-- 16. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  barcode VARCHAR(50),
  category VARCHAR(50) DEFAULT 'Pomadas' NOT NULL,
  cost_price_cents INTEGER DEFAULT 0 NOT NULL,
  sale_price_cents INTEGER NOT NULL,
  current_stock INTEGER DEFAULT 0 NOT NULL,
  min_stock_alert INTEGER DEFAULT 3 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);

-- 17. STOCK_MOVEMENTS
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost_cents INTEGER,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 18. NOTIFICATION_LOGS
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  event notification_event NOT NULL,
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(150),
  message_body TEXT NOT NULL,
  status notification_status DEFAULT 'queued' NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_queue ON public.notification_logs(status, scheduled_for);

-- 19. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  previous_state JSONB,
  new_state JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 20. WEBHOOK_EVENTS (IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(150) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status webhook_status DEFAULT 'pending' NOT NULL,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider, event_id);

-- ============================================================================
-- HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_tenant_role()
RETURNS public.tenant_role AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role')::public.tenant_role;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Tenants
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (
    public.is_platform_admin() OR
    id = public.current_tenant_id() OR
    status = 'active' OR status = 'trial'
  );

DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE USING (
    public.is_platform_admin() OR
    (id = public.current_tenant_id() AND public.current_user_tenant_role() = 'owner')
  );

-- Plans
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans
  FOR SELECT USING (true);

-- Appointments
DROP POLICY IF EXISTS appointments_tenant_isolation ON public.appointments;
CREATE POLICY appointments_tenant_isolation ON public.appointments
  FOR ALL USING (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin', 'receptionist')) OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() = 'professional' AND professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    ))
  );

-- Financial Transactions
DROP POLICY IF EXISTS financial_tenant_isolation ON public.financial_transactions;
CREATE POLICY financial_tenant_isolation ON public.financial_transactions
  FOR ALL USING (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin'))
  );

-- Customers
DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;
CREATE POLICY customers_tenant_isolation ON public.customers
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id()
  );

-- Services
DROP POLICY IF EXISTS services_tenant_isolation ON public.services;
CREATE POLICY services_tenant_isolation ON public.services
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id() OR
    is_active = true
  );

-- Professionals
DROP POLICY IF EXISTS professionals_tenant_isolation ON public.professionals;
CREATE POLICY professionals_tenant_isolation ON public.professionals
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id() OR
    is_active = true
  );

-- Schedule Blocks
DROP POLICY IF EXISTS schedule_blocks_tenant_isolation ON public.schedule_blocks;
CREATE POLICY schedule_blocks_tenant_isolation ON public.schedule_blocks
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id() OR
    true
  );


-- ============================================================================
-- METRICBARBER - MIGRATION 02: MOTOR DE DISPONIBILIDADE, RPCS & TRIGGERS
-- ============================================================================

-- 1. MOTOR DE CÁLCULO DE HORÁRIOS LIVRES
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id UUID,
  p_professional_id UUID,
  p_service_id UUID,
  p_date DATE
)
RETURNS TABLE (
  slot_time TIME,
  is_available BOOLEAN
) AS $$
DECLARE
  v_day_of_week INTEGER;
  v_open_time TIME;
  v_close_time TIME;
  v_break_start TIME;
  v_break_end TIME;
  v_duration INTEGER;
  v_current_slot TIME;
  v_slot_start_ts TIMESTAMPTZ;
  v_slot_end_ts TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
BEGIN
  -- Dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- 1. Buscar duração do serviço
  SELECT duration_minutes INTO v_duration
  FROM public.services
  WHERE id = p_service_id AND tenant_id = p_tenant_id;

  IF v_duration IS NULL THEN
    v_duration := 30; -- default
  END IF;

  -- 2. Buscar expediente da barbearia
  SELECT open_time, close_time, break_start, break_end
  INTO v_open_time, v_close_time, v_break_start, v_break_end
  FROM public.business_hours
  WHERE tenant_id = p_tenant_id AND day_of_week = v_day_of_week AND is_closed = false;

  IF v_open_time IS NULL THEN
    -- Fallback: se a barbearia ainda não tem business_hours gravados, assume expediente comercial padrão
    IF NOT EXISTS (SELECT 1 FROM public.business_hours WHERE tenant_id = p_tenant_id) THEN
      IF v_day_of_week = 0 THEN
        RETURN;
      ELSE
        v_open_time := '09:00'::TIME;
        v_close_time := '19:00'::TIME;
        v_break_start := '12:00'::TIME;
        v_break_end := '13:00'::TIME;
      END IF;
    ELSE
      -- Barbearia fechada neste dia
      RETURN;
    END IF;
  END IF;

  -- 3. Se profissional específico foi passado, verificar folga dele
  IF p_professional_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.professional_schedules
      WHERE professional_id = p_professional_id
        AND day_of_week = v_day_of_week
        AND is_day_off = true
    ) THEN
      -- Profissional de folga
      RETURN;
    END IF;
  END IF;

  -- 4. Iterar sobre os slots de 30 em 30 minutos
  v_current_slot := v_open_time;

  WHILE v_current_slot + (v_duration || ' minutes')::interval <= v_close_time LOOP
    -- Montar timestamps
    v_slot_start_ts := p_date + v_current_slot;
    v_slot_end_ts := v_slot_start_ts + (v_duration || ' minutes')::interval;

    -- Não permitir agendamentos no passado
    IF v_slot_start_ts > (now() + interval '15 minutes') THEN
      -- Verificar intervalo de almoço geral
      IF v_break_start IS NOT NULL AND (
        (v_current_slot >= v_break_start AND v_current_slot < v_break_end) OR
        (v_current_slot + (v_duration || ' minutes')::interval > v_break_start AND v_current_slot < v_break_end)
      ) THEN
        v_has_conflict := true;
      ELSE
        -- Verificar bloqueios e agendamentos existentes
        SELECT EXISTS (
          SELECT 1 FROM public.appointments
          WHERE tenant_id = p_tenant_id
            AND (p_professional_id IS NULL OR professional_id = p_professional_id)
            AND status IN ('scheduled', 'confirmed', 'in_progress')
            AND (start_time < v_slot_end_ts AND end_time > v_slot_start_ts)
        ) OR EXISTS (
          SELECT 1 FROM public.schedule_blocks
          WHERE tenant_id = p_tenant_id
            AND (professional_id IS NULL OR professional_id = p_professional_id)
            AND (start_time < v_slot_end_ts AND end_time > v_slot_start_ts)
        ) INTO v_has_conflict;
      END IF;

      IF NOT v_has_conflict THEN
        slot_time := v_current_slot;
        is_available := true;
        RETURN NEXT;
      END IF;
    END IF;

    v_current_slot := v_current_slot + interval '30 minutes';
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. RPC PÚBLICA DE AGENDAMENTO VIA CHAT CONVERSACIONAL
CREATE OR REPLACE FUNCTION public.book_public_appointment(
  p_slug TEXT,
  p_service_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_time TIME,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_customer_id UUID;
  v_service RECORD;
  v_professional RECORD;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_appointment_id UUID;
  v_booking_code TEXT;
BEGIN
  -- 1. Obter tenant e validar status
  SELECT id, status, trade_name, phone INTO v_tenant
  FROM public.tenants
  WHERE slug = p_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barbearia não encontrada.';
  END IF;

  IF v_tenant.status NOT IN ('active', 'trial') THEN
    RAISE EXCEPTION 'Esta barbearia não está aceitando novos agendamentos online no momento.';
  END IF;

  -- 2. Obter serviço
  SELECT name, price_cents, duration_minutes INTO v_service
  FROM public.services
  WHERE id = p_service_id AND tenant_id = v_tenant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado.';
  END IF;

  -- 3. Obter profissional (se não especificado, escolher primeiro disponível)
  IF p_professional_id IS NULL THEN
    SELECT id, name, commission_rate INTO v_professional
    FROM public.professionals
    WHERE tenant_id = v_tenant.id AND is_active = true
    LIMIT 1;
  ELSE
    SELECT id, name, commission_rate INTO v_professional
    FROM public.professionals
    WHERE id = p_professional_id AND tenant_id = v_tenant.id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado.';
  END IF;

  -- 4. Upsert do cliente por telefone dentro do tenant
  INSERT INTO public.customers (tenant_id, name, phone)
  VALUES (v_tenant.id, p_customer_name, regexp_replace(p_customer_phone, '\D', '', 'g'))
  ON CONFLICT (tenant_id, phone) DO UPDATE
  SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_customer_id;

  -- 5. Calcular timestamps
  v_start_time := p_date + p_time;
  v_end_time := v_start_time + (v_service.duration_minutes || ' minutes')::interval;

  -- 6. Inserir agendamento atômico (a constraint de exclusão impede conflito concorrente)
  INSERT INTO public.appointments (
    tenant_id,
    customer_id,
    professional_id,
    service_id,
    start_time,
    end_time,
    duration_minutes,
    price_cents,
    commission_rate,
    status,
    origin,
    notes
  ) VALUES (
    v_tenant.id,
    v_customer_id,
    v_professional.id,
    p_service_id,
    v_start_time,
    v_end_time,
    v_service.duration_minutes,
    v_service.price_cents,
    v_professional.commission_rate,
    'scheduled',
    'public_chat',
    p_notes
  )
  RETURNING id INTO v_appointment_id;

  -- 7. Criar log de notificação enfileirada
  INSERT INTO public.notification_logs (
    tenant_id,
    appointment_id,
    channel,
    event,
    recipient_phone,
    recipient_name,
    message_body,
    scheduled_for
  ) VALUES (
    v_tenant.id,
    v_appointment_id,
    'whatsapp',
    'created',
    p_customer_phone,
    p_customer_name,
    format('Seu agendamento na %s foi confirmado para %s às %s!', v_tenant.trade_name, p_date, p_time),
    now()
  );

  v_booking_code := 'MB-' || substring(v_appointment_id::text from 1 for 6);

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'booking_code', v_booking_code,
    'barbershop', v_tenant.trade_name,
    'service', v_service.name,
    'barber', v_professional.name,
    'start_time', v_start_time,
    'price_cents', v_service.price_cents
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- 3. TRIGGER: ATUALIZA MÉTRICAS DO CLIENTE E GERA CAIXA AO CONCLUIR AGENDAMENTO
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
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
    ON CONFLICT (appointment_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_appointment_completed ON public.appointments;
CREATE TRIGGER trg_appointment_completed AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_completion();


-- ============================================================================
-- METRICBARBER - MIGRATION 03: SEED DATA (PLANOS & BARBEARIA DEMONSTRAÇÃO)
-- ============================================================================

-- 1. SEED PLANS
INSERT INTO public.plans (id, name, slug, description, stripe_product_id, stripe_price_id, price_cents, billing_cycle, max_professionals, features, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Plano Solo', 'solo', 'Ideal para barbeiros autônomos.', 'prod_solo', 'price_solo_monthly', 3900, 'monthly', 1, '{"reports": true, "inventory": false, "whatsapp_alerts": true}'::jsonb, true),
  ('22222222-2222-2222-2222-222222222222', 'Plano Barbearia Pro', 'pro', 'Para barbearias de 2 a 5 cadeiras.', 'prod_pro', 'price_pro_monthly', 7900, 'monthly', 5, '{"reports": true, "inventory": true, "whatsapp_alerts": true, "recurrence": true}'::jsonb, true),
  ('33333333-3333-3333-3333-333333333333', 'Plano Rede / Enterprise', 'enterprise', 'Para grandes barbearias e redes.', 'prod_enterprise', 'price_enterprise_monthly', 14900, 'monthly', 15, '{"reports": true, "inventory": true, "whatsapp_alerts": true, "recurrence": true, "multi_unit": true}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. SEED DEMO TENANT
INSERT INTO public.tenants (
  id,
  slug,
  name,
  trade_name,
  phone,
  email,
  address_street,
  address_number,
  address_neighborhood,
  address_city,
  address_state,
  status,
  trial_ends_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'vintage-barber',
  'Barbearia Vintage Club Ltda',
  'Barbearia Vintage Club',
  '11987654321',
  'contato@barbeariavintage.com',
  'Rua Augusta',
  '1420',
  'Consolação',
  'São Paulo',
  'SP',
  'active',
  now() + interval '365 days'
) ON CONFLICT (slug) DO NOTHING;

-- 3. SEED BUSINESS HOURS FOR DEMO TENANT
INSERT INTO public.business_hours (tenant_id, day_of_week, open_time, close_time, break_start, break_end, is_closed)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, '00:00', '00:00', NULL, NULL, true), -- Domingo fechado
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '09:00', '20:00', '12:00', '13:00', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '09:00', '20:00', '12:00', '13:00', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '09:00', '20:00', '12:00', '13:00', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, '09:00', '20:00', '12:00', '13:00', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, '09:00', '20:00', '12:00', '13:00', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 6, '09:00', '19:00', '12:00', '13:00', false)
ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

-- 4. SEED PROFESSIONALS
INSERT INTO public.professionals (id, tenant_id, name, nickname, phone, email, commission_rate, color_hex, is_active, display_order)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'João Silva', 'Navalha de Ouro', '11988881111', 'joao@barbeariavintage.com', 50.00, '#3b82f6', true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Carlos Barbeiro', 'Mestre', '11977772222', 'carlos@barbeariavintage.com', 50.00, '#10b981', true, 2),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lucas Ferreira', 'Freestyle', '11966663333', 'lucas@barbeariavintage.com', 45.00, '#8b5cf6', true, 3)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED SERVICES
INSERT INTO public.services (id, tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Corte Tradicional / Degradê', 'Corte completo com lavagem e finalização com pomada.', 'Cabelo', 4500, 30, 5, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Barba Terapia com Toalha Quente', 'Alinhamento na navalha, massagem facial e hidratação com óleos.', 'Barba', 3500, 30, 5, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Combo Cabelo + Barba Completa', 'Experiência premium completa com desconto especial.', 'Combos', 7000, 50, 10, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acabamento / Pezinho / Sobrancelha', 'Manutenção rápida de contorno e barba.', 'Acabamento', 2000, 20, 0, true)
ON CONFLICT (id) DO NOTHING;

-- 6. SEED PRODUCTS
INSERT INTO public.products (id, tenant_id, name, sku, category, cost_price_cents, sale_price_cents, current_stock, min_stock_alert, is_active)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pomada Modeladora Efeito Matte 150g', 'POM-MAT-01', 'Pomadas', 2200, 6500, 14, 5, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Óleo para Barba Hidratante 30ml', 'OLE-BAR-02', 'Óleos', 1800, 4500, 8, 4, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Shampoo Anticaspa Fortalecedor 250ml', 'SHA-FOR-03', 'Shampoo', 2500, 5500, 2, 5, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- METRICBARBER - MIGRATION 05: FLUXO DE ONBOARDING, PERFIL E GESTÃO DE TENANTS
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);

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

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_admin = true),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

  IF v_normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'O link deve ter entre 3 e 60 caracteres e conter apenas letras minúsculas, números e hífens.'
    );
  END IF;

  IF v_normalized_slug = ANY(v_reserved_list) THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Este termo é reservado pelo sistema e não pode ser utilizado como link público.'
    );
  END IF;

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

-- 1. Garantir permissões de execução para a verificação de slug
GRANT EXECUTE ON FUNCTION public.check_slug_availability(TEXT, UUID) TO anon, authenticated;

-- 2. Limpar possíveis versões/assinaturas anteriores conflitantes da função
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'create_tenant_for_current_user'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 3. Criar a RPC public.create_tenant_for_current_user com a assinatura compatível
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
  v_user_full_name TEXT;
  v_slug_check JSONB;
  v_tenant_id UUID;
  v_clean_slug TEXT;
  v_street TEXT;
  v_trade_name TEXT;
  v_phone TEXT;
BEGIN
  -- Validar usuário autenticado via sessão Supabase
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. Faça login para cadastrar sua barbearia.';
  END IF;

  -- Obter e-mail e metadados cadastrados do usuário autenticado
  SELECT 
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
  INTO v_user_email, v_user_full_name 
  FROM auth.users 
  WHERE id = v_user_id;

  -- Higienizar e validar o slug
  v_clean_slug := lower(trim(p_slug));
  IF v_clean_slug IS NULL OR v_clean_slug = '' THEN
    RAISE EXCEPTION 'O link público da barbearia é obrigatório.';
  END IF;

  v_slug_check := public.check_slug_availability(v_clean_slug);
  IF NOT COALESCE((v_slug_check->>'available')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_slug_check->>'error', 'Este link público já está em uso.');
  END IF;

  -- Tratar dados complementares
  v_street := COALESCE(NULLIF(trim(p_address_street), ''), NULLIF(trim(p_address), ''));
  v_trade_name := COALESCE(NULLIF(trim(p_trade_name), ''), trim(p_name));
  v_phone := COALESCE(NULLIF(trim(p_phone), ''), '11999999999');

  -- Assegurar existência do registro em public.profiles para satisfazer a foreign key tenant_users_user_id_fkey
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    updated_at
  ) VALUES (
    v_user_id,
    COALESCE(v_user_email, ''),
    COALESCE(NULLIF(v_user_full_name, ''), trim(p_name), 'Barbeiro Principal'),
    v_phone,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(NULLIF(public.profiles.email, ''), EXCLUDED.email),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = now();

  -- 1. Inserir barbearia na tabela tenants
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
    now() + interval '14 days',
    '{"allow_client_cancel_hours": 2, "slot_interval_minutes": 30, "send_reminders_hours_before": 2}'::jsonb
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Vincular usuário logado como 'owner' na tabela tenant_users
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

  -- 3. Inserir horários de funcionamento padrão (Segunda a Sábado 09:00 às 19:00)
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

  -- 4. Inserir serviços básicos para ativação imediata
  INSERT INTO public.services (tenant_id, name, description, category, price_cents, duration_minutes, buffer_minutes, is_active)
  VALUES
    (v_tenant_id, 'Corte de Cabelo Tradicional', 'Corte completo com lavagem e acabamento.', 'Cabelo', 4000, 30, 5, true),
    (v_tenant_id, 'Barba Completa', 'Alinhamento na navalha e toalha quente.', 'Barba', 3500, 30, 5, true)
  ON CONFLICT DO NOTHING;

  -- 5. Cadastrar o perfil do usuário como profissional inicial
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
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Conceder permissão de execução explícita para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_tenant_for_current_user(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- 5. RPC para o Chat Público: busca cliente por telefone dentro do tenant pelo slug
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

GRANT EXECUTE ON FUNCTION public.find_customer_by_phone(TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. RPC para Barbearia: Exclusão completa e segura de cliente e seus históricos
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
  IF NOT (public.is_platform_admin() OR public.has_tenant_permission(p_tenant_id, 'manage_settings') OR public.current_tenant_id() = p_tenant_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users 
      WHERE tenant_id = p_tenant_id 
        AND user_id = auth.uid() 
        AND is_active = true
    ) AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Não autorizado a excluir clientes nesta barbearia.';
    END IF;
  END IF;

  DELETE FROM public.appointments 
  WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id;

  DELETE FROM public.appointment_series 
  WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id;

  DELETE FROM public.customers 
  WHERE id = p_customer_id AND tenant_id = p_tenant_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_by_id(UUID, UUID) TO authenticated, service_role;

-- 7. RPC: Registro de Movimentação de Estoque
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
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Não autorizado a movimentar estoque nesta barbearia.';
    END IF;
  END IF;

  SELECT current_stock INTO v_current_stock
  FROM public.products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado para esta barbearia.';
  END IF;

  BEGIN
    v_type_enum := p_type::public.stock_movement_type;
  EXCEPTION WHEN OTHERS THEN
    v_type_enum := 'adjustment'::public.stock_movement_type;
  END;

  IF v_type_enum = 'in_purchase' THEN
    v_new_stock := v_current_stock + p_quantity;
  ELSIF v_type_enum IN ('out_sale', 'out_internal_use', 'out_loss_expired') THEN
    v_new_stock := GREATEST(0, v_current_stock - p_quantity);
  ELSIF v_type_enum = 'adjustment' THEN
    v_new_stock := p_quantity;
  ELSE
    v_new_stock := v_current_stock;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- 8. Permissões públicas para o Motor de Agendamento (Chat Público)
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_public_appointment(TEXT, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS services_public_select ON public.services;
CREATE POLICY services_public_select ON public.services
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS professionals_public_select ON public.professionals;
CREATE POLICY professionals_public_select ON public.professionals
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS business_hours_public_select ON public.business_hours;
CREATE POLICY business_hours_public_select ON public.business_hours
  FOR SELECT TO anon, authenticated
  USING (true);

-- Notificar PostgREST para recarregar o cache
NOTIFY pgrst, 'reload schema';
