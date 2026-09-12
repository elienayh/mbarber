-- Migration: 20260912000008_enforce_professional_plan_limit.sql
-- Description: Bloqueio estrito de limite de profissionais por plano no banco de dados (PostgreSQL Trigger).
-- Impede novos INSERTs ou ativações de profissionais quando o tenant já atingiu a capacidade máxima do plano.
-- Não remove registros existentes caso já estejam acima do limite (apenas impede novas adições/ativações).

-- ============================================================================
-- 1. FUNÇÃO TRIGGER PARA BLOQUEIO NO BACKEND (FONTE DE VERDADE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_professional_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_professionals INTEGER := 1;
  v_current_active_count INTEGER := 0;
  v_plan_name TEXT := 'Plano Solo / Teste';
  v_tenant_name TEXT := '';
BEGIN
  -- 1. Se o registro estiver sendo marcado como inativo, não consome vaga do plano
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 2. Se for um UPDATE onde o profissional já estava ativo e permanece no mesmo tenant,
  -- não está consumindo uma nova vaga (ex: apenas editando nome, telefone, foto ou comissão).
  -- Permitir edição sem bloqueio para não travar cadastros já existentes.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_active IS TRUE AND OLD.tenant_id = NEW.tenant_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- 3. Buscar informações do tenant e limite máximo do plano contratado
  -- Consulta a assinatura ativa/trialing associada ao plano
  SELECT 
    t.name,
    COALESCE(
      (t.settings->>'max_professionals')::integer,
      p.max_professionals,
      1
    ),
    COALESCE(p.name, 'Plano Solo (1 profissional)')
  INTO 
    v_tenant_name,
    v_max_professionals,
    v_plan_name
  FROM public.tenants t
  LEFT JOIN public.subscriptions s 
    ON s.tenant_id = t.id 
    AND s.status IN ('active', 'trialing')
  LEFT JOIN public.plans p 
    ON p.id = s.plan_id
  WHERE t.id = NEW.tenant_id;

  -- Fallback de segurança: limite mínimo é 1
  IF v_max_professionals IS NULL OR v_max_professionals < 1 THEN
    v_max_professionals := 1;
  END IF;

  -- 4. Contar quantos profissionais ATIVOS o tenant já possui no momento
  -- (desconsiderando o próprio registro caso seja um UPDATE de ativação)
  SELECT count(*)
  INTO v_current_active_count
  FROM public.professionals
  WHERE tenant_id = NEW.tenant_id
    AND is_active = true
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 5. Se já atingiu ou superou o limite do plano, BLOQUEIA a operação
  IF v_current_active_count >= v_max_professionals THEN
    RAISE EXCEPTION 'Limite de profissionais do plano atingido (%): seu plano permite no máximo % profissional(is) ativo(s), mas sua barbearia já possui %. Faça upgrade do seu plano na aba Assinatura para adicionar novos profissionais.',
      v_plan_name,
      v_max_professionals,
      v_current_active_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger anterior se existir e recriar
DROP TRIGGER IF EXISTS trg_check_professional_plan_limit ON public.professionals;

CREATE TRIGGER trg_check_professional_plan_limit
  BEFORE INSERT OR UPDATE OF is_active, tenant_id
  ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_professional_plan_limit();

-- ============================================================================
-- 2. FUNÇÃO RPC AUXILIAR PARA CONSULTA DIRETA DE CAPACIDADE PELO FRONTEND
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_plan_limit(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_max_professionals INTEGER := 1;
  v_current_active_count INTEGER := 0;
  v_plan_name TEXT := 'Plano Solo / Teste';
  v_plan_slug TEXT := 'solo';
BEGIN
  SELECT 
    COALESCE((t.settings->>'max_professionals')::integer, p.max_professionals, 1),
    COALESCE(p.name, 'Plano Solo (1 profissional)'),
    COALESCE(p.slug, 'solo')
  INTO v_max_professionals, v_plan_name, v_plan_slug
  FROM public.tenants t
  LEFT JOIN public.subscriptions s 
    ON s.tenant_id = t.id 
    AND s.status IN ('active', 'trialing')
  LEFT JOIN public.plans p 
    ON p.id = s.plan_id
  WHERE t.id = p_tenant_id;

  IF v_max_professionals IS NULL OR v_max_professionals < 1 THEN
    v_max_professionals := 1;
  END IF;

  SELECT count(*)
  INTO v_current_active_count
  FROM public.professionals
  WHERE tenant_id = p_tenant_id
    AND is_active = true;

  RETURN jsonb_build_object(
    'max_professionals', v_max_professionals,
    'current_active_count', v_current_active_count,
    'is_limit_reached', (v_current_active_count >= v_max_professionals),
    'plan_name', v_plan_name,
    'plan_slug', v_plan_slug
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_tenant_plan_limit(UUID) TO authenticated, anon;
