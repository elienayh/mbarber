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
