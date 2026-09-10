-- ============================================================================
-- METRICBARBER - MIGRATION 04: PERMISSÕES PÚBLICAS PARA MOTOR DE AGENDAMENTO
-- ============================================================================

-- Garantir permissões de execução para visitantes anônimos e autenticados no chat público
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_public_appointment(TEXT, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Garantir acesso de leitura pública às tabelas necessárias para o catálogo público (filtrado por tenant_id)
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

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
