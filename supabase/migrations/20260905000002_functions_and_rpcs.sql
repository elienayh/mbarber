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
    -- Barbearia fechada neste dia
    RETURN;
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

CREATE OR REPLACE TRIGGER trg_appointment_completed
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_completion();
