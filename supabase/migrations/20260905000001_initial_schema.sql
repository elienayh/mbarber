-- ============================================================================
-- METRICBARBER - MIGRATION 01: INITIAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'professional', 'receptionist');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show', 'rescheduled');
CREATE TYPE appointment_origin AS ENUM ('public_chat', 'backoffice', 'recurrent');
CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE series_status AS ENUM ('active', 'completed', 'canceled');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE financial_category AS ENUM ('service_revenue', 'product_sale', 'commission_payout', 'rent', 'utilities', 'supplies', 'software', 'marketing', 'other');
CREATE TYPE payment_method AS ENUM ('money', 'pix', 'credit_card', 'debit_card', 'transfer', 'voucher');
CREATE TYPE transaction_status AS ENUM ('pending', 'paid', 'canceled');
CREATE TYPE stock_movement_type AS ENUM ('in_purchase', 'out_sale', 'out_internal_use', 'out_loss_expired', 'adjustment');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'email', 'sms', 'push');
CREATE TYPE notification_event AS ENUM ('created', 'confirmed', 'reminder', 'canceled', 'rescheduled');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');
CREATE TYPE webhook_status AS ENUM ('pending', 'processed', 'ignored', 'failed');

-- 1. TENANTS
CREATE TABLE public.tenants (
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
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_status ON public.tenants(status);

-- 2. PLANS (SAAS CATALOG)
CREATE TABLE public.plans (
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
CREATE TABLE public.subscriptions (
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
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- 4. PROFILES (AUTH USERS)
CREATE TABLE public.profiles (
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
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role tenant_role DEFAULT 'professional' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant ON public.tenant_users(tenant_id);

-- 6. PROFESSIONALS
CREATE TABLE public.professionals (
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
CREATE INDEX idx_professionals_tenant ON public.professionals(tenant_id);

-- 7. SERVICES
CREATE TABLE public.services (
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
CREATE INDEX idx_services_tenant ON public.services(tenant_id);

-- 8. PROFESSIONAL_SERVICES
CREATE TABLE public.professional_services (
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
CREATE TABLE public.business_hours (
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
CREATE TABLE public.professional_schedules (
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
CREATE TABLE public.schedule_blocks (
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
CREATE TABLE public.customers (
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
CREATE INDEX idx_customers_tenant_phone ON public.customers(tenant_id, phone);

-- 13. APPOINTMENT_SERIES (RECURRING)
CREATE TABLE public.appointment_series (
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
CREATE TABLE public.appointments (
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
CREATE INDEX idx_appointments_tenant_time ON public.appointments(tenant_id, start_time, end_time);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id, start_time);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);

-- Double-Booking Prevention Exclusion Constraint
ALTER TABLE public.appointments
ADD CONSTRAINT prevent_barber_double_booking
EXCLUDE USING gist (
  tenant_id WITH =,
  professional_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status IN ('scheduled', 'confirmed', 'in_progress'));

-- 15. FINANCIAL_TRANSACTIONS
CREATE TABLE public.financial_transactions (
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
CREATE INDEX idx_financial_tenant_date ON public.financial_transactions(tenant_id, paid_at);

-- 16. PRODUCTS
CREATE TABLE public.products (
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
CREATE INDEX idx_products_tenant ON public.products(tenant_id);

-- 17. STOCK_MOVEMENTS
CREATE TABLE public.stock_movements (
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
CREATE TABLE public.notification_logs (
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
CREATE INDEX idx_notifications_queue ON public.notification_logs(status, scheduled_for);

-- 19. AUDIT_LOGS
CREATE TABLE public.audit_logs (
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
CREATE TABLE public.webhook_events (
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
CREATE INDEX idx_webhook_events_provider ON public.webhook_events(provider, event_id);

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
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (
    public.is_platform_admin() OR
    id = public.current_tenant_id() OR
    status = 'active' OR status = 'trial'
  );

CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE USING (
    public.is_platform_admin() OR
    (id = public.current_tenant_id() AND public.current_user_tenant_role() = 'owner')
  );

-- Plans
CREATE POLICY plans_select ON public.plans
  FOR SELECT USING (true);

-- Appointments
CREATE POLICY appointments_tenant_isolation ON public.appointments
  FOR ALL USING (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin', 'receptionist')) OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() = 'professional' AND professional_id IN (
      SELECT id FROM public.professionals WHERE user_id = auth.uid()
    ))
  );

-- Financial Transactions
CREATE POLICY financial_tenant_isolation ON public.financial_transactions
  FOR ALL USING (
    public.is_platform_admin() OR
    (tenant_id = public.current_tenant_id() AND public.current_user_tenant_role() IN ('owner', 'admin'))
  );

-- Customers
CREATE POLICY customers_tenant_isolation ON public.customers
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id()
  );

-- Services
CREATE POLICY services_tenant_isolation ON public.services
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id() OR
    is_active = true
  );

-- Professionals
CREATE POLICY professionals_tenant_isolation ON public.professionals
  FOR ALL USING (
    public.is_platform_admin() OR
    tenant_id = public.current_tenant_id() OR
    is_active = true
  );
