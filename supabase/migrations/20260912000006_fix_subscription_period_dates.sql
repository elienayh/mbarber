-- Migration: 20260912000006_fix_subscription_period_dates.sql
-- Description: Corrige as datas de início e término do ciclo de cobrança na tabela public.subscriptions.
-- Ajusta pontualmente a assinatura ativa da Elienay Barber com base nos dados reais retornados pela API do Stripe
-- (Stripe API 2026-08-26+: período contido em items.data[0]: 1789240810 -> 1791832810).
-- Início Real: 2026-09-12T19:20:10.000Z
-- Fim Real (Próxima Renovação): 2026-10-12T19:20:10.000Z

-- 1. Correção pontual para a assinatura da Elienay Barber
UPDATE public.subscriptions
SET
  current_period_start = '2026-09-12T19:20:10.000Z',
  current_period_end = '2026-10-12T19:20:10.000Z',
  status = 'active',
  updated_at = now()
WHERE stripe_subscription_id = 'sub_1UEwTARM4uVgKrKN2tnGzpJr'
   OR tenant_id = '0bd026cd-a337-47f8-88a7-8f961afa47a2';

-- 2. Correção preventiva para qualquer outro registro onde o fim do ciclo ficou menor ou igual ao início
UPDATE public.subscriptions
SET
  current_period_end = current_period_start + INTERVAL '1 month',
  updated_at = now()
WHERE current_period_end <= current_period_start;
