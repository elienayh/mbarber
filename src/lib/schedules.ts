import { supabase } from "@/lib/supabase";
import { RecurrenceRule, isDateMatchingRecurrence } from "./recurrence";

export interface BusinessHourConfig {
  id?: string;
  day_of_week: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  open_time: string; // HH:mm
  close_time: string; // HH:mm
  break_start?: string | null;
  break_end?: string | null;
  is_closed: boolean;
}

export interface BarberLunchSchedule {
  professionalId: string;
  professionalName: string;
  hasLunchBreak: boolean;
  lunchStart: string; // HH:mm
  lunchEnd: string; // HH:mm
}

export interface RecurringBlockItem {
  id: string;
  tenant_id: string;
  professional_id: string | null; // null = Toda a barbearia
  title: string;
  recurrence_type: "weekly" | "biweekly" | "fixed_day_of_month" | "relative_day_of_month";
  day_of_week: number | null;
  day_of_month: number | null;
  week_of_month: number | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
}

export interface RecurringClientItem {
  id: string;
  tenant_id: string;
  customer_id?: string;
  client_name: string;
  client_phone: string;
  professional_id: string;
  professional_name?: string;
  service_id: string;
  service_name?: string;
  price_cents: number;
  rule_type: "weekly" | "biweekly" | "fixed_day_of_month" | "relative_day_of_month";
  day_of_week: number | null;
  day_of_month: number | null;
  week_of_month: number | null;
  preferred_time: string; // HH:mm
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHourConfig[] = [
  { day_of_week: 0, open_time: "09:00", close_time: "14:00", is_closed: true },
  { day_of_week: 1, open_time: "09:00", close_time: "19:00", is_closed: false },
  { day_of_week: 2, open_time: "09:00", close_time: "19:00", is_closed: false },
  { day_of_week: 3, open_time: "09:00", close_time: "19:00", is_closed: false },
  { day_of_week: 4, open_time: "09:00", close_time: "19:00", is_closed: false },
  { day_of_week: 5, open_time: "09:00", close_time: "20:00", is_closed: false },
  { day_of_week: 6, open_time: "08:30", close_time: "19:00", is_closed: false },
];

/**
 * Carrega os horários de funcionamento da barbearia
 */
export async function getBusinessHours(tenantId: string): Promise<BusinessHourConfig[]> {
  try {
    const { data, error } = await (supabase.from("business_hours") as any)
      .select("id, day_of_week, open_time, close_time, break_start, break_end, is_closed")
      .eq("tenant_id", tenantId)
      .order("day_of_week");

    if (!error && data && data.length > 0) {
      const merged = DEFAULT_BUSINESS_HOURS.map((def) => {
        const found = data.find((d: any) => d.day_of_week === def.day_of_week);
        if (found) {
          return {
            id: found.id,
            day_of_week: found.day_of_week,
            open_time: found.open_time?.slice(0, 5) || def.open_time,
            close_time: found.close_time?.slice(0, 5) || def.close_time,
            break_start: found.break_start?.slice(0, 5) || null,
            break_end: found.break_end?.slice(0, 5) || null,
            is_closed: Boolean(found.is_closed),
          };
        }
        return def;
      });
      localStorage.setItem(`mb_business_hours_${tenantId}`, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Erro ao buscar business_hours do Supabase:", err);
  }

  // Fallback cache local
  try {
    const cached = localStorage.getItem(`mb_business_hours_${tenantId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return DEFAULT_BUSINESS_HOURS;
}

/**
 * Salva os horários de funcionamento da barbearia
 */
export async function saveBusinessHours(
  tenantId: string,
  hours: BusinessHourConfig[]
): Promise<void> {
  localStorage.setItem(`mb_business_hours_${tenantId}`, JSON.stringify(hours));

  try {
    for (const h of hours) {
      await (supabase.from("business_hours") as any).upsert(
        {
          tenant_id: tenantId,
          day_of_week: h.day_of_week,
          open_time: h.open_time.length === 5 ? `${h.open_time}:00` : h.open_time,
          close_time: h.close_time.length === 5 ? `${h.close_time}:00` : h.close_time,
          break_start: h.break_start ? (h.break_start.length === 5 ? `${h.break_start}:00` : h.break_start) : null,
          break_end: h.break_end ? (h.break_end.length === 5 ? `${h.break_end}:00` : h.break_end) : null,
          is_closed: h.is_closed,
        },
        { onConflict: "tenant_id,day_of_week" }
      );
    }
  } catch (err) {
    console.warn("Aviso ao persistir business_hours no Supabase:", err);
  }
}

/**
 * Carrega a lista centralizada de intervalos de almoço dos barbeiros
 */
export async function getBarberLunchSchedules(tenantId: string): Promise<BarberLunchSchedule[]> {
  const result: BarberLunchSchedule[] = [];

  try {
    const { data: pros, error } = await (supabase.from("professionals") as any)
      .select("id, name, work_schedule, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");

    if (!error && pros && Array.isArray(pros)) {
      pros.forEach((p: any) => {
        const sched = p.work_schedule || {};
        result.push({
          professionalId: p.id,
          professionalName: p.name,
          hasLunchBreak: sched.hasLunchBreak !== false,
          lunchStart: sched.lunchStart || "12:00",
          lunchEnd: sched.lunchEnd || "13:00",
        });
      });
      localStorage.setItem(`mb_barber_lunch_schedules_${tenantId}`, JSON.stringify(result));
      return result;
    }
  } catch (err) {
    console.warn("Erro ao buscar profissionais para almoço:", err);
  }

  // Fallback cache local
  try {
    const cached = localStorage.getItem(`mb_barber_lunch_schedules_${tenantId}`);
    if (cached) return JSON.parse(cached);

    // Fallback de mb_professionals
    const proRaw = localStorage.getItem(`mb_professionals_${tenantId}`);
    if (proRaw) {
      const parsed = JSON.parse(proRaw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p: any) => p.is_active !== false)
          .map((p: any) => {
            const sched = p.work_schedule || p.workSchedule || {};
            return {
              professionalId: p.id,
              professionalName: p.name,
              hasLunchBreak: sched.hasLunchBreak !== false,
              lunchStart: sched.lunchStart || "12:00",
              lunchEnd: sched.lunchEnd || "13:00",
            };
          });
      }
    }
  } catch {}

  return result;
}

/**
 * Salva a configuração de almoço de um barbeiro específico
 */
export async function saveBarberLunchSchedule(
  tenantId: string,
  professionalId: string,
  schedule: { hasLunchBreak: boolean; lunchStart: string; lunchEnd: string }
): Promise<void> {
  // 1. Atualizar cache local imediato
  try {
    const current = await getBarberLunchSchedules(tenantId);
    const updated = current.map((item) =>
      item.professionalId === professionalId
        ? { ...item, ...schedule }
        : item
    );
    localStorage.setItem(`mb_barber_lunch_schedules_${tenantId}`, JSON.stringify(updated));

    // Atualiza também em mb_professionals_${tenantId}
    const proRaw = localStorage.getItem(`mb_professionals_${tenantId}`);
    if (proRaw) {
      const parsed = JSON.parse(proRaw);
      if (Array.isArray(parsed)) {
        const nextPros = parsed.map((p: any) => {
          if (p.id === professionalId) {
            const existingSched = p.work_schedule || p.workSchedule || {};
            const nextSched = {
              ...existingSched,
              hasLunchBreak: schedule.hasLunchBreak,
              lunchStart: schedule.lunchStart,
              lunchEnd: schedule.lunchEnd,
            };
            return {
              ...p,
              work_schedule: nextSched,
              workSchedule: nextSched,
            };
          }
          return p;
        });
        localStorage.setItem(`mb_professionals_${tenantId}`, JSON.stringify(nextPros));
      }
    }
  } catch (e) {
    console.warn("Erro ao atualizar cache local de almoço:", e);
  }

  // 2. Persistir no Supabase
  try {
    const { data: pro } = await (supabase.from("professionals") as any)
      .select("work_schedule")
      .eq("id", professionalId)
      .single();

    const existingSched = pro?.work_schedule || {};
    const newSched = {
      ...existingSched,
      hasLunchBreak: schedule.hasLunchBreak,
      lunchStart: schedule.lunchStart,
      lunchEnd: schedule.lunchEnd,
    };

    await (supabase.from("professionals") as any)
      .update({ work_schedule: newSched, updated_at: new Date().toISOString() })
      .eq("id", professionalId);
  } catch (err) {
    console.warn("Aviso ao persistir almoço no Supabase:", err);
  }
}

/**
 * Carrega bloqueios recorrentes de horários
 */
export async function getRecurringBlocks(tenantId: string): Promise<RecurringBlockItem[]> {
  try {
    const { data, error } = await (supabase.from("recurring_schedule_blocks") as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (!error && data && Array.isArray(data)) {
      const formatted = data.map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        professional_id: b.professional_id || null,
        title: b.title,
        recurrence_type: b.recurrence_type,
        day_of_week: b.day_of_week,
        day_of_month: b.day_of_month,
        week_of_month: b.week_of_month,
        start_time: b.start_time?.slice(0, 5) || "08:00",
        end_time: b.end_time?.slice(0, 5) || "09:00",
        is_all_day: Boolean(b.is_all_day),
        start_date: b.start_date || new Date().toISOString().slice(0, 10),
        end_date: b.end_date || null,
        is_active: b.is_active !== false,
        notes: b.notes || null,
        created_at: b.created_at,
      }));
      localStorage.setItem(`mb_recurring_blocks_${tenantId}`, JSON.stringify(formatted));
      return formatted;
    }
  } catch (err) {
    console.warn("Erro ao buscar recurring_schedule_blocks do Supabase:", err);
  }

  // Fallback cache local
  try {
    const cached = localStorage.getItem(`mb_recurring_blocks_${tenantId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return [];
}

/**
 * Salva ou atualiza um bloqueio recorrente
 */
export async function saveRecurringBlock(
  tenantId: string,
  block: Omit<RecurringBlockItem, "id"> & { id?: string }
): Promise<RecurringBlockItem> {
  const blockId = block.id || crypto.randomUUID();
  const fullBlock: RecurringBlockItem = {
    ...block,
    id: blockId,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  };

  // 1. Atualizar cache local
  try {
    const current = await getRecurringBlocks(tenantId);
    const existingIndex = current.findIndex((b) => b.id === blockId);
    let updated: RecurringBlockItem[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = fullBlock;
    } else {
      updated = [fullBlock, ...current];
    }
    localStorage.setItem(`mb_recurring_blocks_${tenantId}`, JSON.stringify(updated));
  } catch {}

  // 2. Persistir no Supabase
  try {
    await (supabase.from("recurring_schedule_blocks") as any).upsert({
      id: blockId,
      tenant_id: tenantId,
      professional_id: block.professional_id || null,
      title: block.title,
      recurrence_type: block.recurrence_type,
      day_of_week: block.day_of_week,
      day_of_month: block.day_of_month,
      week_of_month: block.week_of_month,
      start_time: block.start_time.length === 5 ? `${block.start_time}:00` : block.start_time,
      end_time: block.end_time.length === 5 ? `${block.end_time}:00` : block.end_time,
      is_all_day: block.is_all_day,
      start_date: block.start_date,
      end_date: block.end_date || null,
      is_active: block.is_active,
      notes: block.notes || null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Aviso ao persistir recurring_schedule_blocks no Supabase:", err);
  }

  return fullBlock;
}

/**
 * Remove um bloqueio recorrente
 */
export async function deleteRecurringBlock(tenantId: string, blockId: string): Promise<void> {
  try {
    const current = await getRecurringBlocks(tenantId);
    const updated = current.filter((b) => b.id !== blockId);
    localStorage.setItem(`mb_recurring_blocks_${tenantId}`, JSON.stringify(updated));
  } catch {}

  try {
    await (supabase.from("recurring_schedule_blocks") as any)
      .delete()
      .eq("id", blockId)
      .eq("tenant_id", tenantId);
  } catch (err) {
    console.warn("Erro ao deletar recurring_schedule_blocks:", err);
  }
}

/**
 * Carrega a lista de clientes com agendamentos recorrentes (appointment_series)
 */
export async function getRecurringClients(tenantId: string): Promise<RecurringClientItem[]> {
  try {
    const { data, error } = await (supabase.from("appointment_series") as any)
      .select(`
        id, tenant_id, customer_id, professional_id, service_id,
        frequency, day_of_week, day_of_month, week_of_month, rule_type,
        preferred_time, start_date, end_date, price_cents, notes,
        client_name, client_phone, is_active, created_at,
        customers(name, phone),
        professionals(name),
        services(name, price_cents)
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (!error && data && Array.isArray(data)) {
      const formatted: RecurringClientItem[] = data.map((s: any) => ({
        id: s.id,
        tenant_id: s.tenant_id,
        customer_id: s.customer_id,
        client_name: s.client_name || s.customers?.name || "Cliente Recorrente",
        client_phone: s.client_phone || s.customers?.phone || "",
        professional_id: s.professional_id,
        professional_name: s.professionals?.name || "Profissional",
        service_id: s.service_id,
        service_name: s.services?.name || "Serviço",
        price_cents: s.price_cents ?? (s.services?.price_cents || 0),
        rule_type: s.rule_type || (s.frequency === "monthly" ? "fixed_day_of_month" : s.frequency || "weekly"),
        day_of_week: s.day_of_week,
        day_of_month: s.day_of_month,
        week_of_month: s.week_of_month,
        preferred_time: s.preferred_time?.slice(0, 5) || "10:00",
        start_date: s.start_date || new Date().toISOString().slice(0, 10),
        end_date: s.end_date || null,
        is_active: s.is_active !== false && s.status !== "canceled",
        notes: s.notes || null,
        created_at: s.created_at,
      }));

      localStorage.setItem(`mb_recurring_clients_${tenantId}`, JSON.stringify(formatted));
      return formatted;
    }
  } catch (err) {
    console.warn("Erro ao buscar appointment_series:", err);
  }

  // Fallback cache local
  try {
    const cached = localStorage.getItem(`mb_recurring_clients_${tenantId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return [];
}

/**
 * Salva ou atualiza um cliente com agendamento recorrente
 */
export async function saveRecurringClient(
  tenantId: string,
  item: Omit<RecurringClientItem, "id"> & { id?: string }
): Promise<RecurringClientItem> {
  const seriesId = item.id || crypto.randomUUID();
  const fullItem: RecurringClientItem = {
    ...item,
    id: seriesId,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  };

  // 1. Atualizar cache local
  try {
    const current = await getRecurringClients(tenantId);
    const existingIndex = current.findIndex((c) => c.id === seriesId);
    let updated: RecurringClientItem[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = fullItem;
    } else {
      updated = [fullItem, ...current];
    }
    localStorage.setItem(`mb_recurring_clients_${tenantId}`, JSON.stringify(updated));
  } catch {}

  // 2. Persistir no Supabase
  try {
    // Garante que o cliente existe ou cria na tabela customers
    let customerId = item.customer_id;
    if (!customerId && item.client_name && item.client_phone) {
      try {
        const cleanPhone = item.client_phone.replace(/\D/g, "");
        const { data: existingCust } = await (supabase.from("customers") as any)
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("phone", cleanPhone)
          .maybeSingle();

        if (existingCust?.id) {
          customerId = existingCust.id;
        } else {
          const { data: newCust } = await (supabase.from("customers") as any)
            .insert({
              tenant_id: tenantId,
              name: item.client_name,
              phone: cleanPhone,
            })
            .select("id")
            .single();
          if (newCust?.id) customerId = newCust.id;
        }
      } catch (custErr) {
        console.warn("Aviso ao vincular cliente:", custErr);
      }
    }

    const frequencyMap: Record<string, string> = {
      weekly: "weekly",
      biweekly: "biweekly",
      fixed_day_of_month: "monthly",
      relative_day_of_month: "monthly",
    };

    await (supabase.from("appointment_series") as any).upsert({
      id: seriesId,
      tenant_id: tenantId,
      customer_id: customerId,
      professional_id: item.professional_id,
      service_id: item.service_id,
      frequency: frequencyMap[item.rule_type] || "weekly",
      rule_type: item.rule_type,
      day_of_week: item.day_of_week,
      day_of_month: item.day_of_month,
      week_of_month: item.week_of_month,
      preferred_time: item.preferred_time.length === 5 ? `${item.preferred_time}:00` : item.preferred_time,
      start_date: item.start_date,
      end_date: item.end_date || null,
      price_cents: item.price_cents,
      client_name: item.client_name,
      client_phone: item.client_phone,
      total_occurrences: 52, // 1 ano de ocorrências por padrão
      status: item.is_active ? "active" : "canceled",
      is_active: item.is_active,
      notes: item.notes || null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Aviso ao persistir appointment_series no Supabase:", err);
  }

  return fullItem;
}

/**
 * Remove um agendamento recorrente
 */
export async function deleteRecurringClient(tenantId: string, seriesId: string): Promise<void> {
  try {
    const current = await getRecurringClients(tenantId);
    const updated = current.filter((c) => c.id !== seriesId);
    localStorage.setItem(`mb_recurring_clients_${tenantId}`, JSON.stringify(updated));
  } catch {}

  try {
    await (supabase.from("appointment_series") as any)
      .delete()
      .eq("id", seriesId)
      .eq("tenant_id", tenantId);
  } catch (err) {
    console.warn("Erro ao deletar appointment_series:", err);
  }
}
