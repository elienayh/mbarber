-- Migration: 20260912000007_performance_optimization_indexes_and_rls.sql
-- Description: Otimização de performance de banco de dados:
-- 1. Índices compostos e de chaves estrangeiras críticos que estavam ausentes (especialmente professional_services e schedule_blocks).
-- 2. Reescreve funções de RLS de PL/pgSQL para SQL STABLE inlineável com (SELECT auth.uid()) prevenindo reavaliação linha a linha.

-- ============================================================================
-- 1. ÍNDICES DE ALTA PERFORMANCE (FILTROS DE TENANT, STATUS E JOINS)
-- ============================================================================

-- Tabela: professional_services (Crítico: delete e select sofriam Seq Scan completo por falta de índice em tenant_id)
CREATE INDEX IF NOT EXISTS idx_professional_services_tenant_pro 
  ON public.professional_services(tenant_id, professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_services_pro_id 
  ON public.professional_services(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_services_service_id 
  ON public.professional_services(service_id);

-- Tabela: schedule_blocks (Crítico: agenda buscava por tenant e range de datas sem nenhum índice)
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_tenant_time 
  ON public.schedule_blocks(tenant_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_pro_time 
  ON public.schedule_blocks(professional_id, start_time);

-- Tabela: professionals (Acelera listagem ordenada e verificação de user_id no login)
CREATE INDEX IF NOT EXISTS idx_professionals_tenant_active_order 
  ON public.professionals(tenant_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_professionals_user_id 
  ON public.professionals(user_id);

-- Tabela: services (Acelera listagem de serviços ativos por nome)
CREATE INDEX IF NOT EXISTS idx_services_tenant_active_name 
  ON public.services(tenant_id, is_active, name);

-- Tabela: appointments (Acelera filtros de dashboard e agenda que filtram status e data)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status_time 
  ON public.appointments(tenant_id, status, start_time);

-- Tabela: financial_transactions (Acelera joins com agendamentos e profissionais)
CREATE INDEX IF NOT EXISTS idx_financial_appointment 
  ON public.financial_transactions(appointment_id);

CREATE INDEX IF NOT EXISTS idx_financial_professional 
  ON public.financial_transactions(professional_id);

-- Tabela: audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
  ON public.audit_logs(tenant_id, created_at DESC);


-- ============================================================================
-- 2. OTIMIZAÇÃO DE FUNÇÕES RLS (INLINE SQL + SCALAR SUBQUERY INITPLAN)
-- ============================================================================
-- Problema anterior: Funções em PL/pgSQL não são inlineáveis pelo otimizador do Postgres,
-- forçando execução procedural linha a linha para cada registro das tabelas.
-- Solução: Usar LANGUAGE sql STABLE com (SELECT auth.uid()), permitindo que o PostgreSQL
-- execute como InitPlan (uma única vez por query) e use os índices em tenant_users.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND is_platform_admin = true
    ),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (p_tenant_id IS NOT NULL) AND (
    (SELECT public.is_platform_admin()) OR
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = (SELECT auth.uid())
        AND tenant_id = p_tenant_id
        AND is_active = true
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_has_tenant_role(p_tenant_id UUID, p_roles public.tenant_role[])
RETURNS BOOLEAN AS $$
  SELECT (p_tenant_id IS NOT NULL) AND (
    (SELECT public.is_platform_admin()) OR
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = (SELECT auth.uid())
        AND tenant_id = p_tenant_id
        AND role = ANY(p_roles)
        AND is_active = true
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
