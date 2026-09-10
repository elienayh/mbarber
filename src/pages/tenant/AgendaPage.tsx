import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Scissors,
  X,
  Repeat,
  Lock,
  Coffee,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { broadcastNewAppointment } from "@/lib/notifications";

interface Appointment {
  id: string;
  barberId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  time: string;
  durationMinutes: number;
  priceCents: number;
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "canceled";
  isRecurrent?: boolean;
}

interface WorkSchedule {
  followBarbershopHours: boolean;
  startTime: string;
  endTime: string;
  workDays: number[];
  hasLunchBreak: boolean;
  lunchStart: string;
  lunchEnd: string;
}

interface Barber {
  id: string;
  name: string;
  nickname: string | null;
  color: string;
  avatarUrl?: string | null;
  workSchedule?: WorkSchedule | null;
}

export interface ScheduleBlock {
  id: string;
  tenantId: string;
  barberId: string | null; // null or 'all'
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  title: string;
  reason?: string;
}

interface ServiceOption {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

export const AgendaPage: React.FC = () => {
  const { tenant } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockBarberId, setBlockBarberId] = useState<string>("all");
  const [blockDate, setBlockDate] = useState<string>(() => selectedDate);
  const [blockType, setBlockType] = useState<"slot" | "day">("slot");
  const [blockStartTime, setBlockStartTime] = useState("12:00");
  const [blockEndTime, setBlockEndTime] = useState("13:00");
  const [blockTitle, setBlockTitle] = useState("Almoço");
  const [savingBlock, setSavingBlock] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [isBlockDetailModalOpen, setIsBlockDetailModalOpen] = useState(false);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBarber, setNewBarber] = useState("");
  const [newService, setNewService] = useState("");
  const [newTime, setNewTime] = useState("15:00");
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const dateLabel = useMemo(() => {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }, [selectedDate]);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadAgenda = async () => {
      setLoading(true);
      setError(null);
      const start = `${selectedDate}T00:00:00`;
      const end = `${selectedDate}T23:59:59`;

      const [{ data: professionalsData }, { data: servicesData }, { data: appointmentsData }, { data: blocksData }] = await Promise.all([
        (supabase.from("professionals") as any)
          .select("id, name, nickname, color_hex, avatar_url")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .order("display_order"),
        (supabase.from("services") as any)
          .select("id, name, price_cents, duration_minutes")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .order("name"),
        (supabase.from("appointments") as any)
          .select("id, professional_id, start_time, duration_minutes, price_cents, status, customers(name, phone), services(name)")
          .eq("tenant_id", tenant.id)
          .gte("start_time", start)
          .lte("start_time", end)
          .neq("status", "canceled")
          .order("start_time"),
        (supabase.from("schedule_blocks") as any)
          .select("*")
          .eq("tenant_id", tenant.id)
          .gte("start_date", selectedDate)
          .lte("start_date", selectedDate),
      ]);

      let loadedBarbers: Barber[] = (professionalsData || []).map((professional: any) => ({
        id: professional.id,
        name: professional.name,
        nickname: professional.nickname,
        color: professional.color_hex || "var(--accent)",
        avatarUrl: professional.avatar_url || null,
        workSchedule: professional.work_schedule || null,
      }));

      // Mescla com cache local de profissionais para carregar horários próprios e fotos
      try {
        const cachedProsRaw =
          localStorage.getItem(`mb_professionals_${tenant.id}`) ||
          (tenant.slug ? localStorage.getItem(`mb_professionals_${tenant.slug}`) : null) ||
          localStorage.getItem("mb_professionals_default") ||
          localStorage.getItem("mb_professionals_vintage-barber");

        if (cachedProsRaw) {
          const cachedPros = JSON.parse(cachedProsRaw);
          if (Array.isArray(cachedPros)) {
            const barMap = new Map<string, Barber>();
            loadedBarbers.forEach((b) => barMap.set(b.id, b));
            cachedPros.forEach((p: any) => {
              if (p.is_active !== false) {
                const ex = barMap.get(p.id);
                barMap.set(p.id, {
                  id: p.id,
                  name: p.name,
                  nickname: p.nickname || null,
                  color: p.color_hex || ex?.color || "var(--accent)",
                  avatarUrl: p.avatar_url || ex?.avatarUrl || null,
                  workSchedule: p.work_schedule || p.workSchedule || ex?.workSchedule || null,
                });
              }
            });
            loadedBarbers = Array.from(barMap.values());
          }
        }
      } catch {}
      const loadedServices = (servicesData || []) as ServiceOption[];

      setBarbers(loadedBarbers);
      setServices(loadedServices);
      setSelectedBarberId((current) => current || loadedBarbers[0]?.id || "");
      setNewBarber((current) => current || loadedBarbers[0]?.id || "");
      setNewService((current) => current || loadedServices[0]?.id || "");

      const remoteAppointments: Appointment[] = (appointmentsData || []).map((appointment: any) => ({
        id: appointment.id,
        barberId: appointment.professional_id,
        customerName: appointment.customers?.name || "Cliente",
        customerPhone: appointment.customers?.phone || "",
        serviceName: appointment.services?.name || "Serviço",
        time: new Date(appointment.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        durationMinutes: appointment.duration_minutes,
        priceCents: appointment.price_cents,
        status: appointment.status,
      }));

      // Merge com agendamentos em cache local deste dia
      let localAppointments: Appointment[] = [];
      try {
        const raw = localStorage.getItem(`mb_appointments_${tenant.id}_${selectedDate}`);
        if (raw) localAppointments = JSON.parse(raw);
      } catch {}

      const aptMap = new Map<string, Appointment>();
      remoteAppointments.forEach((a) => aptMap.set(a.id, a));
      localAppointments.forEach((a) => aptMap.set(a.id, a));
      setAppointments(Array.from(aptMap.values()));

      // Processa e mescla bloqueios da agenda (almoço, folga, compromisso)
      let loadedBlocks: ScheduleBlock[] = [];
      if (blocksData && Array.isArray(blocksData)) {
        loadedBlocks = blocksData.map((b: any) => ({
          id: b.id,
          tenantId: b.tenant_id,
          barberId: b.professional_id || null,
          date: b.start_date || selectedDate,
          startTime: b.start_time ? b.start_time.slice(0, 5) : "00:00",
          endTime: b.end_time ? b.end_time.slice(0, 5) : "23:59",
          isAllDay: b.is_all_day ?? (!b.start_time),
          title: b.title || b.reason || "Bloqueado",
          reason: b.reason,
        }));
      }

      // Merge com bloqueios em localStorage
      try {
        const keys = [
          `mb_schedule_blocks_${tenant.id}`,
          tenant.slug ? `mb_schedule_blocks_${tenant.slug}` : null,
          "mb_schedule_blocks_default",
          "mb_schedule_blocks_vintage-barber",
        ].filter(Boolean) as string[];

        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const bMap = new Map<string, ScheduleBlock>();
              loadedBlocks.forEach((b) => bMap.set(b.id, b));
              parsed.forEach((b: any) => {
                if (b.date === selectedDate) bMap.set(b.id, b);
              });
              loadedBlocks = Array.from(bMap.values());
              break;
            }
          }
        }
      } catch {}

      setBlocks(loadedBlocks);
      setLoading(false);
    };

    loadAgenda();
  }, [selectedDate, tenant?.id]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      setModalError("Barbearia não identificada.");
      return;
    }
    if (!newCustomer.trim()) {
      setModalError("Informe o nome do cliente.");
      return;
    }
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      setModalError("Informe o WhatsApp ou telefone do cliente com DDD.");
      return;
    }
    if (!newTime) {
      setModalError("Selecione o horário do agendamento.");
      return;
    }
    if (!newBarber) {
      setModalError("Selecione um profissional para o atendimento.");
      return;
    }
    const service = services.find((item) => item.id === newService) || services[0];
    if (!service) {
      setModalError("Selecione um serviço cadastrado.");
      return;
    }

    setSavingAppointment(true);
    setModalError(null);

    const timeFormatted = newTime.length === 5 ? `${newTime}:00` : newTime;
    let appointmentId = "";

    // 1. Tenta agendar no Supabase via book_public_appointment (SECURITY DEFINER que bypassa RLS)
    try {
      const { data: bookData, error: bookError } = await (supabase.rpc as any)("book_public_appointment", {
        p_slug: tenant.slug,
        p_service_id: service.id,
        p_professional_id: newBarber,
        p_date: selectedDate,
        p_time: timeFormatted,
        p_customer_name: newCustomer.trim(),
        p_customer_phone: cleanPhone,
        p_notes: isRecurrent ? "Agendamento semanal recorrente (Semana 1/4)" : null,
      });

      if (!bookError && bookData?.appointment_id) {
        appointmentId = bookData.appointment_id;

        // Se marcado como recorrente, agenda automaticamente as 3 semanas seguintes
        if (isRecurrent) {
          const baseDate = new Date(`${selectedDate}T12:00:00`);
          for (let week = 1; week <= 3; week++) {
            const nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + week * 7);
            const nextDateStr = nextDate.toISOString().slice(0, 10);
            try {
              await (supabase.rpc as any)("book_public_appointment", {
                p_slug: tenant.slug,
                p_service_id: service.id,
                p_professional_id: newBarber,
                p_date: nextDateStr,
                p_time: timeFormatted,
                p_customer_name: newCustomer.trim(),
                p_customer_phone: cleanPhone,
                p_notes: `Agendamento semanal recorrente (${week + 1}/4)`,
              });
            } catch (errRec) {
              console.warn("Erro ao agendar recorrência na semana " + (week + 1), errRec);
            }
          }
        }
      } else if (bookError) {
        console.warn("book_public_appointment retornou erro:", bookError);
      }
    } catch (err) {
      console.warn("Exceção ao chamar book_public_appointment:", err);
    }

    // Se o banco remoto falhou ou houve conflito de slot, gera ID único e persiste localmente
    if (!appointmentId) {
      appointmentId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}`;
    }

    const createdAppointment: Appointment = {
      id: appointmentId,
      barberId: newBarber,
      customerName: newCustomer.trim(),
      customerPhone: newPhone.trim(),
      serviceName: service.name,
      time: newTime,
      durationMinutes: service.duration_minutes,
      priceCents: service.price_cents,
      status: "scheduled" as const,
    };

    // Atualiza estado e cache local do dia
    setAppointments((current) => {
      const updated = [...current, createdAppointment];
      try {
        localStorage.setItem(`mb_appointments_${tenant.id}_${selectedDate}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Disparar Notificação Push em Tempo Real para todos os dispositivos e barbeiros
    const selectedBarberObj = barbers.find((b) => b.id === newBarber);
    broadcastNewAppointment({
      tenantId: tenant.id,
      customerName: newCustomer.trim(),
      customerPhone: newPhone.trim(),
      serviceName: service.name,
      barberName: selectedBarberObj?.name || "Barbeiro",
      barberId: newBarber,
      date: selectedDate,
      time: newTime,
      priceCents: service.price_cents,
      source: "web",
    });

    // Salva o cliente na base de clientes local
    try {
      const rawClients = localStorage.getItem(`mb_clients_${tenant.id}`);
      const list = rawClients ? JSON.parse(rawClients) : [];
      if (!list.some((c: any) => c.phone.replace(/\D/g, "") === cleanPhone)) {
        list.push({
          id: `cust_${Date.now()}`,
          name: newCustomer.trim(),
          phone: cleanPhone,
          total_appointments: 1,
          total_spent_cents: service.price_cents,
          last_appointment_at: new Date().toISOString(),
          notes: null,
        });
        localStorage.setItem(`mb_clients_${tenant.id}`, JSON.stringify(list));
      }
    } catch {}

    setSavingAppointment(false);
    setIsNewModalOpen(false);
    setNewCustomer("");
    setNewPhone("");
    setModalError(null);
    setSuccessToast("Agendamento salvo com sucesso!");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const updateAppointmentStatus = async (status: Appointment["status"]) => {
    if (!tenant?.id || !selectedAppointment || actionLoading) return;
    setActionLoading(true);
    setError(null);
    const { error: updateError } = await (supabase.from("appointments") as any)
      .update({ status, cancellation_reason: status === "canceled" ? "Cancelado pelo backoffice" : null, canceled_by: status === "canceled" ? "backoffice" : null })
      .eq("id", selectedAppointment.id)
      .eq("tenant_id", tenant.id);
    if (updateError) {
      setError(updateError.message);
      setActionLoading(false);
      return;
    }
    if (status === "canceled") {
      setAppointments((current) => current.filter((item) => item.id !== selectedAppointment.id));
    } else {
      setAppointments((current) => current.map((item) => item.id === selectedAppointment.id ? { ...item, status } : item));
    }
    setActionLoading(false);
    setIsActionModalOpen(false);
    setSelectedAppointment(null);
  };

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "13:00", "13:30", "14:00", "14:30", "15:00",
    "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
    "18:30", "19:00", "19:30"
  ];

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setSavingBlock(true);

    const blockId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `blk_${Date.now()}`;
    const newBlock: ScheduleBlock = {
      id: blockId,
      tenantId: tenant.id,
      barberId: blockBarberId === "all" ? null : blockBarberId,
      date: blockDate,
      startTime: blockType === "slot" ? blockStartTime : "00:00",
      endTime: blockType === "slot" ? blockEndTime : "23:59",
      isAllDay: blockType === "day",
      title: blockTitle.trim() || "Bloqueado",
    };

    try {
      await (supabase.from("schedule_blocks") as any).insert({
        id: blockId,
        tenant_id: tenant.id,
        professional_id: newBlock.barberId,
        start_date: newBlock.date,
        end_date: newBlock.date,
        start_time: newBlock.isAllDay ? null : `${newBlock.startTime}:00`,
        end_time: newBlock.isAllDay ? null : `${newBlock.endTime}:00`,
        is_all_day: newBlock.isAllDay,
        reason: newBlock.title,
        title: newBlock.title,
      });
    } catch (err) {
      console.warn("Supabase schedule_blocks save:", err);
    }

    try {
      const keys = [
        `mb_schedule_blocks_${tenant.id}`,
        tenant.slug ? `mb_schedule_blocks_${tenant.slug}` : null,
        "mb_schedule_blocks_default",
        "mb_schedule_blocks_vintage-barber",
      ].filter(Boolean) as string[];

      keys.forEach((k) => {
        let existing: ScheduleBlock[] = [];
        try {
          const raw = localStorage.getItem(k);
          if (raw) existing = JSON.parse(raw);
        } catch {}
        const updated = [...existing.filter((x) => x.id !== newBlock.id), newBlock];
        localStorage.setItem(k, JSON.stringify(updated));
      });
    } catch {}

    if (newBlock.date === selectedDate) {
      setBlocks((current) => [...current.filter((b) => b.id !== newBlock.id), newBlock]);
    }
    setSavingBlock(false);
    setIsBlockModalOpen(false);
    setSuccessToast(`Horário bloqueado com sucesso (${newBlock.title})!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleDeleteBlock = async (block: ScheduleBlock) => {
    if (!tenant?.id) return;
    setActionLoading(true);

    try {
      await (supabase.from("schedule_blocks") as any)
        .delete()
        .eq("id", block.id)
        .eq("tenant_id", tenant.id);
    } catch (err) {
      console.warn("Supabase schedule_blocks delete:", err);
    }

    try {
      const keys = [
        `mb_schedule_blocks_${tenant.id}`,
        tenant.slug ? `mb_schedule_blocks_${tenant.slug}` : null,
        "mb_schedule_blocks_default",
        "mb_schedule_blocks_vintage-barber",
      ].filter(Boolean) as string[];

      keys.forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const existing: ScheduleBlock[] = JSON.parse(raw);
            const filtered = existing.filter((x) => x.id !== block.id);
            localStorage.setItem(k, JSON.stringify(filtered));
          }
        } catch {}
      });
    } catch {}

    setBlocks((current) => current.filter((x) => x.id !== block.id));
    setActionLoading(false);
    setIsBlockDetailModalOpen(false);
    setSelectedBlock(null);
    setSuccessToast("Horário desbloqueado com sucesso!");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const openNewWith = (barberId: string, slot: string) => {
    setNewBarber(barberId);
    setNewTime(slot);
    setModalError(null);
    setIsNewModalOpen(true);
  };

  const openBlockWith = (barberId: string, slot: string) => {
    setBlockBarberId(barberId);
    setBlockDate(selectedDate);
    setBlockType("slot");
    setBlockStartTime(slot);
    const [h, m] = slot.split(":").map(Number);
    const endMinutes = h * 60 + m + 60;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, "0");
    const endM = String(endMinutes % 60).padStart(2, "0");
    setBlockEndTime(`${endH}:${endM}`);
    setBlockTitle("Almoço");
    setIsBlockModalOpen(true);
  };

  const getSlotStatus = (barber: Barber | undefined, slot: string) => {
    if (!barber) return { type: "free" as const };

    // 1. Agendamento existente
    const app = appointments.find((a) => a.barberId === barber.id && a.time === slot);
    if (app) return { type: "appointment" as const, appointment: app };

    // 2. Bloqueio explícito (almoço, compromisso, folga)
    const block = blocks.find((b) => {
      const isForBarber = !b.barberId || b.barberId === "all" || b.barberId === barber.id;
      if (!isForBarber) return false;
      if (b.isAllDay) return true;
      if (b.startTime && b.endTime) {
        return slot >= b.startTime && slot < b.endTime;
      }
      return false;
    });
    if (block) return { type: "block" as const, block };

    // 3. Intervalo de almoço configurado no perfil do barbeiro
    const sched = barber.workSchedule;
    if (sched && sched.hasLunchBreak !== false) {
      const lStart = sched.lunchStart || "12:00";
      const lEnd = sched.lunchEnd || "13:00";
      if (slot >= lStart && slot < lEnd) {
        return {
          type: "lunch" as const,
          label: `Almoço (${lStart} - ${lEnd})`,
        };
      }
    }

    // 4. Dia de folga configurado no perfil do barbeiro
    if (sched && sched.followBarbershopHours === false && Array.isArray(sched.workDays)) {
      const dayOfWeek = new Date(`${selectedDate}T12:00:00`).getDay();
      if (!sched.workDays.includes(dayOfWeek)) {
        return { type: "day_off" as const, label: "Não atende hoje" };
      }
    }

    return { type: "free" as const };
  };

  const activeMobileBarber = barbers.find((b) => b.id === selectedBarberId) || barbers[0];

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col">
      {/* Agenda Header Controls */}
      <div className="surface-card-light p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const date = new Date(`${selectedDate}T12:00:00`);
              date.setDate(date.getDate() - 1);
              setSelectedDate(date.toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800">
            <CalendarIcon className="w-4 h-4 text-primary-on-light" />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <button
            onClick={() => {
              const date = new Date(`${selectedDate}T12:00:00`);
              date.setDate(date.getDate() + 1);
              setSelectedDate(date.toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Bloquear Horário / Dia */}
          <button
            onClick={() => {
              setBlockDate(selectedDate);
              setBlockBarberId(selectedBarberId || (barbers[0]?.id ?? "all"));
              setBlockStartTime("12:00");
              setBlockEndTime("13:00");
              setBlockTitle("Almoço");
              setBlockType("slot");
              setIsBlockModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-sm transition shadow-xs flex items-center gap-1.5"
            title="Bloquear almoço, intervalo ou dia inteiro para um barbeiro ou equipe"
          >
            <Lock className="w-4 h-4 text-amber-700" />
            <span className="hidden sm:inline">Bloquear Horário / Dia</span>
            <span className="sm:hidden">Bloquear</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-md shadow-accent flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold shadow-sm flex items-center justify-between">
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 surface-card-light px-4 py-3 text-sm text-slate-500">Carregando agenda...</div>
      )}

      {/* Mobile agenda: one professional at a time, with thumb-friendly cards. */}
      <div className="md:hidden flex-1 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
          {barbers.map((barber) => (
            <button
              key={barber.id}
              type="button"
              onClick={() => setSelectedBarberId(barber.id)}
              className={`snap-start shrink-0 min-h-12 px-3.5 py-2 rounded-xl border text-left transition flex items-center gap-2.5 ${
                selectedBarberId === barber.id
                  ? "bg-accent border-accent text-slate-950 shadow-md shadow-accent"
                  : "surface-card-light border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div
                className="w-7 h-7 rounded-full overflow-hidden shrink-0 border flex items-center justify-center font-bold text-[11px] text-white shadow-xs"
                style={{
                  borderColor: barber.color,
                  backgroundColor: barber.color,
                }}
              >
                {barber.avatarUrl ? (
                  <img src={barber.avatarUrl} alt={barber.name} className="w-full h-full object-cover" />
                ) : (
                  barber.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <span className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                  {barber.name}
                </span>
                {barber.nickname && <span className="block text-[11px] opacity-75">{barber.nickname}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Horários de {activeMobileBarber?.name || "hoje"}
            </span>
            <span className="text-xs font-semibold text-primary-on-light">
              {appointments.filter((appointment) => appointment.barberId === selectedBarberId).length} agendamentos
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {timeSlots.map((slot) => {
              const status = getSlotStatus(activeMobileBarber, slot);

              return (
                <div key={slot} className="min-h-16 flex items-center gap-3 px-4 py-2">
                  <span className="w-12 shrink-0 text-sm font-bold text-slate-400">{slot}</span>

                  {status.type === "appointment" ? (
                    <div className="flex-1 min-w-0 rounded-xl border border-accent surface-accent-soft px-3 py-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedAppointment(status.appointment); setIsActionModalOpen(true); }}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold text-slate-900">{status.appointment.customerName}</span>
                          <span className="shrink-0 text-xs font-bold text-primary-on-light">{formatCurrency(status.appointment.priceCents)}</span>
                        </div>
                        <span className="block truncate text-xs text-slate-600">{status.appointment.serviceName} · {status.appointment.durationMinutes} min</span>
                      </button>
                    </div>
                  ) : status.type === "block" ? (
                    <button
                      type="button"
                      onClick={() => { setSelectedBlock(status.block); setIsBlockDetailModalOpen(true); }}
                      className="flex-1 min-w-0 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-left transition hover:bg-amber-100 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 truncate">
                          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>{status.block.title}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0">
                          Bloqueado
                        </span>
                      </div>
                      <span className="block text-[11px] text-amber-700 mt-0.5">Toque para liberar horário</span>
                    </button>
                  ) : status.type === "lunch" ? (
                    <div className="flex-1 min-w-0 rounded-xl border border-dashed border-slate-300 bg-slate-100 px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 truncate">
                        <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{status.label}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                        Pausa
                      </span>
                    </div>
                  ) : status.type === "day_off" ? (
                    <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-400 italic">
                      Não atende neste dia da semana
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Horário livre</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openBlockWith(activeMobileBarber?.id || "", slot)}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                        >
                          Bloquear
                        </button>
                        <button
                          type="button"
                          onClick={() => openNewWith(activeMobileBarber?.id || "", slot)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-900 bg-accent/30 hover:bg-accent border border-accent transition"
                        >
                          + Agendar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop multi-barber agenda grid */}
      <div className="hidden md:flex flex-1 surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col min-h-[600px]">
        {/* Barber Headers */}
        <div
          className="grid border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700"
          style={{ gridTemplateColumns: `minmax(90px, 0.8fr) repeat(${Math.max(barbers.length, 1)}, minmax(160px, 1fr))` }}
        >
          <div className="p-3 border-r border-slate-200 text-slate-400 flex items-center justify-center">
            Horário
          </div>
          {barbers.map((barber) => (
            <div key={barber.id} className="p-3 border-r last:border-r-0 border-slate-200 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-sm truncate block">{barber.name}</span>
                {barber.workSchedule?.hasLunchBreak !== false && (
                  <span className="text-[10px] text-amber-700 font-semibold block">
                    Almoço: {barber.workSchedule?.lunchStart || "12:00"} - {barber.workSchedule?.lunchEnd || "13:00"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {timeSlots.map((slot) => (
            <div
              key={slot}
              className="grid min-h-[56px] hover:bg-slate-50/50"
              style={{ gridTemplateColumns: `minmax(90px, 0.8fr) repeat(${Math.max(barbers.length, 1)}, minmax(160px, 1fr))` }}
            >
              {/* Time column */}
              <div className="p-2 border-r border-slate-100 text-xs font-bold text-slate-400 flex items-center justify-center">
                {slot}
              </div>

              {/* Barber columns */}
              {barbers.map((barber) => {
                const status = getSlotStatus(barber, slot);

                return (
                  <div
                    key={barber.id}
                    className="p-1.5 border-r last:border-r-0 border-slate-100 relative flex items-center group"
                  >
                    {status.type === "appointment" ? (
                      <button
                        type="button"
                        onClick={() => { setSelectedAppointment(status.appointment); setIsActionModalOpen(true); }}
                        className="w-full h-full rounded-xl p-2 text-xs border shadow-sm flex flex-col justify-between transition cursor-pointer hover:shadow"
                        style={{
                          backgroundColor: `${barber.color}15`,
                          borderColor: barber.color,
                        }}
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="truncate">{status.appointment.customerName}</span>
                          {status.appointment.isRecurrent && (
                            <span title="Recorrente"><Repeat className="w-3 h-3 text-secondary-on-light shrink-0" /></span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">{status.appointment.serviceName}</div>
                      </button>
                    ) : status.type === "block" ? (
                      <button
                        type="button"
                        onClick={() => { setSelectedBlock(status.block); setIsBlockDetailModalOpen(true); }}
                        className="w-full h-full min-h-[44px] rounded-xl p-2 text-xs border border-dashed border-amber-400 bg-amber-50/90 text-amber-900 shadow-xs flex items-center justify-between gap-1.5 transition hover:bg-amber-100 cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="truncate font-bold text-[11px]">{status.block.title}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0">
                          Bloqueado
                        </span>
                      </button>
                    ) : status.type === "lunch" ? (
                      <div
                        className="w-full h-full min-h-[44px] rounded-xl p-2 text-xs border border-dashed border-slate-300 bg-slate-100/90 text-slate-700 flex items-center justify-between gap-1.5"
                        title={status.label}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate font-semibold text-[11px]">{status.label}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                          Pausa
                        </span>
                      </div>
                    ) : status.type === "day_off" ? (
                      <div className="w-full h-full min-h-[44px] rounded-xl p-2 text-xs bg-slate-100/40 text-slate-400 flex items-center justify-center text-[11px] italic">
                        Não atende hoje
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition gap-1">
                        <button
                          type="button"
                          onClick={() => openNewWith(barber.id, slot)}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-accent text-slate-950 shadow-xs hover-bg-accent"
                          title="Agendar neste horário"
                        >
                          + Agendar
                        </button>
                        <button
                          type="button"
                          onClick={() => openBlockWith(barber.id, slot)}
                          className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 border border-amber-200"
                          title="Bloquear este horário"
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card-light text-primary-on-light rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Novo Agendamento</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 pt-4">
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {modalError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barbeiro</label>
                  <select
                    value={newBarber}
                    onChange={(e) => setNewBarber(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Serviço</label>
                <select
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({formatCurrency(service.price_cents)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recurrence Switch */}
              <div className="p-3 rounded-xl surface-status-soft border border-muted-light flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-secondary-on-light" />
                  <div>
                    <div className="text-xs font-bold text-primary-on-light">Agendamento Recorrente</div>
                    <div className="text-[11px] text-secondary-on-light">Repetir semanalmente por 4 semanas</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurrent}
                  onChange={(e) => setIsRecurrent(e.target.checked)}
                  className="w-4 h-4 accent-control rounded"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAppointment}
                  className="w-2/3 py-2.5 rounded-xl bg-accent hover-bg-accent text-slate-950 text-sm font-bold shadow-md shadow-accent disabled:opacity-50 transition"
                >
                  {savingAppointment ? "Salvando agendamento..." : "Salvar Agendamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isActionModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card-light text-primary-on-light w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div><h3 className="text-lg font-bold">Atualizar atendimento</h3><p className="mt-1 text-sm text-slate-500">{selectedAppointment.customerName} · {selectedAppointment.serviceName}</p></div>
              <button type="button" onClick={() => setIsActionModalOpen(false)} className="p-2 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-5">
              {selectedAppointment.status === "scheduled" && <button disabled={actionLoading} onClick={() => updateAppointmentStatus("confirmed")} className="min-h-11 rounded-xl bg-accent px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{actionLoading ? "Salvando..." : "Confirmar atendimento"}</button>}
              {(selectedAppointment.status === "scheduled" || selectedAppointment.status === "confirmed") && <button disabled={actionLoading} onClick={() => updateAppointmentStatus("in_progress")} className="min-h-11 rounded-xl surface-elevated-light px-4 py-3 font-bold text-primary-on-light disabled:opacity-50">Iniciar atendimento</button>}
              {selectedAppointment.status === "in_progress" && <button disabled={actionLoading} onClick={() => updateAppointmentStatus("completed")} className="min-h-11 rounded-xl bg-accent px-4 py-3 font-bold text-slate-950 disabled:opacity-50">Finalizar atendimento</button>}
              {selectedAppointment.status !== "completed" && <button disabled={actionLoading} onClick={() => updateAppointmentStatus("canceled")} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 disabled:opacity-50">Cancelar atendimento</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bloquear Horário ou Dia Inteiro */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card-light text-primary-on-light rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">Bloquear Horário na Agenda</h3>
                  <p className="text-xs text-slate-500">Impedir novos agendamentos neste intervalo</p>
                </div>
              </div>
              <button
                onClick={() => setIsBlockModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="mt-4 space-y-4">
              {/* Seleção do Barbeiro */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Profissional
                </label>
                <select
                  value={blockBarberId}
                  onChange={(e) => setBlockBarberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Equipe toda (todos os profissionais)</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.nickname ? `(${b.nickname})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data e Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duração</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setBlockType("slot")}
                      className={`py-1 text-xs font-bold rounded-lg transition ${
                        blockType === "slot" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"
                      }`}
                    >
                      Horário
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockType("day")}
                      className={`py-1 text-xs font-bold rounded-lg transition ${
                        blockType === "day" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"
                      }`}
                    >
                      Dia Todo
                    </button>
                  </div>
                </div>
              </div>

              {/* Horário início / término se slot */}
              {blockType === "slot" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Início</label>
                    <input
                      type="time"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Término</label>
                    <input
                      type="time"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Motivo do bloqueio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Título</label>
                <input
                  type="text"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Ex: Almoço, Consulta médica, Compromisso..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Almoço", "Consulta Médica", "Compromisso", "Folga", "Treinamento"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBlockTitle(tag)}
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBlock}
                  className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold shadow-md disabled:opacity-50 transition"
                >
                  {savingBlock ? "Bloqueando..." : "Confirmar Bloqueio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes do Bloqueio / Desbloquear Horário */}
      {isBlockDetailModalOpen && selectedBlock && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card-light text-primary-on-light w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Horário Bloqueado</h3>
                  <p className="text-xs text-slate-500">{selectedBlock.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBlockDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Motivo:</span>
                <span className="font-bold text-slate-900">{selectedBlock.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Profissional:</span>
                <span className="font-semibold text-slate-900">
                  {selectedBlock.barberId
                    ? barbers.find((b) => b.id === selectedBlock.barberId)?.name || "Barbeiro"
                    : "Todos os profissionais"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Horário:</span>
                <span className="font-semibold text-slate-900">
                  {selectedBlock.isAllDay ? "Dia Inteiro" : `${selectedBlock.startTime} às ${selectedBlock.endTime}`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDeleteBlock(selectedBlock)}
                className="w-full py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 transition"
              >
                <Trash2 className="w-4 h-4 text-emerald-700" />
                <span>Desbloquear / Liberar Horário</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBlockDetailModalOpen(false)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
