-- Migration: 20260912000005_fix_plans_stripe_price.sql
-- Description: Restaura e unifica o Stripe Price ID e Product ID para o modelo por assento (per-seat)
-- Price ID: price_1UEW5xRM4uVgKrKNFrEOb7mA (R$ 29,90/mês por assento/profissional)
-- Product ID: prod_VF06W8nKwqioy6

-- 1. Garantir que as colunas sejam flexíveis e não bloqueiem operações
ALTER TABLE public.plans ALTER COLUMN stripe_price_id DROP NOT NULL;
ALTER TABLE public.plans ALTER COLUMN stripe_product_id DROP NOT NULL;

-- 2. Atualizar todos os planos ativos com o Price ID e Product ID reais do Stripe
UPDATE public.plans
SET 
  stripe_price_id = 'price_1UEW5xRM4uVgKrKNFrEOb7mA',
  stripe_product_id = 'prod_VF06W8nKwqioy6'
WHERE is_active = true;

-- 3. Comentários explicativos da arquitetura de faturamento
COMMENT ON COLUMN public.plans.stripe_price_id IS 'Stripe Price ID unificado por assento (R$ 29,90/mês). No checkout do Stripe, a quantidade de assentos define o total.';
COMMENT ON COLUMN public.plans.stripe_product_id IS 'Stripe Product ID unificado (prod_VF06W8nKwqioy6).';
