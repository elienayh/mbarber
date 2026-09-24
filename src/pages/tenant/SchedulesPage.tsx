import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  Coffee,
  Calendar,
  Repeat,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Save,
  User,
  Scissors,
  DollarSign,
  Phone,
  Power,
  Info,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import {
  BusinessHourConfig,
  BarberLunchSchedule,
  RecurringBlockItem,
  RecurringClientItem,
  getBusinessHours,
  saveBusinessHours,
  getBarberLunchSchedules,
  saveBarberLunchSchedule,
  getRecurringBlocks,
  saveRecurringBlock,
  deleteRecurringBlock,
  getRecurringClients,
  saveRecurringClient,
  deleteRecurringClient,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/schedules";
import {
  DAYS_OF_WEEK_NAMES,
  DAYS_OF_WEEK_SHORT,
  WEEKS_OF_MONTH_OPTIONS,
  formatRecurrenceDescription,
  getNextOccurrences,
  RecurrenceRule,
} from "@/lib/recurrence";
import { supabase } from "@/lib/supabase";

export const SchedulesPage: React.FC = () => {
  const { tenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "business_hours";

  const [activeTab, setActiveTab] = useState<
    "business_hours" | "lunch_breaks" | "recurring_blocks" | "recurring_clients"
  >(
    ["business_hours", "lunch_breaks", "recurring_blocks", "recurring_clients"].includes(
      initialTab
    )
      ? (initialTab as any)
      : "business_hours"
  );

  // Estados dos dados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab 1: Expediente da Barbearia
  const [businessHours, setBusinessHours] = useState<BusinessHourConfig[]>(DEFAULT_BUSINESS_HOURS);

  // Tab 2: Almoço dos Barbeiros
  const [lunchSchedules, setLunchSchedules] = useState<BarberLunchSchedule[]>([]);

  // Tab 3: Bloqueios Recorrentes
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlockItem[]>([]);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RecurringBlockItem | null>(null);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockProfId, setBlockProfId] = useState<string>("all");
  const [blockRecurrenceType, setBlockRecurrenceType] = useState<
    "weekly" | "biweekly" | "fixed_day_of_month"
  >("weekly");
  const [blockDayOfWeek, setBlockDayOfWeek] = useState<number>(2); // Terça por padrão
  const [blockDayOfMonth, setBlockDayOfMonth] = useState<number>(15);
  const [blockStartTime, setBlockStartTime] = useState("13:00");
  const [blockEndTime, setBlockEndTime] = useState("14:00");
  const [blockIsAllDay, setBlockIsAllDay] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockEndDate, setBlockEndDate] = useState<string>("");
  const [blockNotes, setBlockNotes] = useState("");

  // Tab 4: Clientes Recorrentes
  const [recurringClients, setRecurringClients] = useState<RecurringClientItem[]>([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<RecurringClientItem | null>(null);
  const [rcClientName, setRcClientName] = useState("");
  const [rcClientPhone, setRcClientPhone] = useState("");
  const [rcProfId, setRcProfId] = useState("");
  const [rcServiceId, setRcServiceId] = useState("");
  const [rcPrice, setRcPrice] = useState("");
  const [rcRuleType, setRcRuleType] = useState<
    "fixed_day_of_month" | "relative_day_of_month" | "weekly" | "biweekly"
  >("fixed_day_of_month");
  const [rcDayOfMonth, setRcDayOfMonth] = useState<number>(15);
  const [rcWeekOfMonth, setRcWeekOfMonth] = useState<number>(-1); // Última por padrão
  const [rcDayOfWeek, setRcDayOfWeek] = useState<number>(5); // Sexta por padrão
  const [rcPreferredTime, setRcPreferredTime] = useState("10:00");
  const [rcStartDate, setRcStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [rcEndDate, setRcEndDate] = useState<string>("");
  const [rcNotes, setRcNotes] = useState("");

  // Dados auxiliares para selects
  const [professionalsList, setProfessionalsList] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [servicesList, setServicesList] = useState<
    Array<{ id: string; name: string; price_cents: number }>
  >([]);

  // Sincroniza URL com a aba ativa
  const handleTabChange = (
    tab: "business_hours" | "lunch_breaks" | "recurring_blocks" | "recurring_clients"
  ) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
  };

  // Carregamento inicial de todos os dados
  useEffect(() => {
    if (!tenant?.id) return;

    const loadAll = async () => {
      setLoading(true);
      try {
        // Carrega profissionais e serviços para os selects
        const [{ data: pros }, { data: servs }] = await Promise.all([
          (supabase.from("professionals") as any)
            .select("id, name, is_active")
            .eq("tenant_id", tenant.id)
            .eq("is_active", true)
            .order("name"),
          (supabase.from("services") as any)
            .select("id, name, price_cents, is_active")
            .eq("tenant_id", tenant.id)
            .eq("is_active", true)
            .order("name"),
        ]);

        const loadedPros = (pros || []).map((p: any) => ({ id: p.id, name: p.name }));
        const loadedServs = (servs || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          price_cents: s.price_cents,
        }));

        setProfessionalsList(loadedPros);
        setServicesList(loadedServs);
        if (loadedPros.length > 0 && !rcProfId) setRcProfId(loadedPros[0].id);
        if (loadedServs.length > 0 && !rcServiceId) {
          setRcServiceId(loadedServs[0].id);
          setRcPrice((loadedServs[0].price_cents / 100).toFixed(2));
        }

        // Carrega as 4 fontes de dados
        const [bh, lunches, blocks, clients] = await Promise.all([
          getBusinessHours(tenant.id),
          getBarberLunchSchedules(tenant.id),
          getRecurringBlocks(tenant.id),
          getRecurringClients(tenant.id),
        ]);

        setBusinessHours(bh);
        setLunchSchedules(lunches);
        setRecurringBlocks(blocks);
        setRecurringClients(clients);
      } catch (err) {
        console.error("Erro ao carregar dados de horários:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [tenant?.id]);

  // Ações da Tab 1: Expediente da Barbearia
  const handleSaveBusinessHours = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await saveBusinessHours(tenant.id, businessHours);
      showNotification("Horários de funcionamento da barbearia salvos com sucesso!");
    } catch {
      showNotification("Falha ao salvar horários de funcionamento.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMondayToWeek = () => {
    const monday = businessHours.find((h) => h.day_of_week === 1);
    if (!monday) return;
    setBusinessHours((prev) =>
      prev.map((h) => {
        if (h.day_of_week >= 2 && h.day_of_week <= 5) {
          return {
            ...h,
            open_time: monday.open_time,
            close_time: monday.close_time,
            break_start: monday.break_start,
            break_end: monday.break_end,
            is_closed: monday.is_closed,
          };
        }
        return h;
      })
    );
    showNotification("Horário de segunda-feira replicado para terça a sexta.");
  };

  // Ações da Tab 2: Almoço dos Barbeiros
  const handleSaveLunchSchedule = async (barberId: string) => {
    if (!tenant?.id) return;
    const schedule = lunchSchedules.find((s) => s.professionalId === barberId);
    if (!schedule) return;

    setSaving(true);
    try {
      await saveBarberLunchSchedule(tenant.id, barberId, {
        hasLunchBreak: schedule.hasLunchBreak,
        lunchStart: schedule.lunchStart,
        lunchEnd: schedule.lunchEnd,
      });
      showNotification(`Horário de almoço de ${schedule.professionalName} salvo!`);
    } catch {
      showNotification("Erro ao salvar horário de almoço.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllLunches = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      for (const item of lunchSchedules) {
        await saveBarberLunchSchedule(tenant.id, item.professionalId, {
          hasLunchBreak: item.hasLunchBreak,
          lunchStart: item.lunchStart,
          lunchEnd: item.lunchEnd,
        });
      }
      showNotification("Todos os horários de almoço foram atualizados!");
    } catch {
      showNotification("Erro ao salvar horários de almoço.", true);
    } finally {
      setSaving(false);
    }
  };

  // Ações da Tab 3: Bloqueios Recorrentes
  const handleOpenBlockModal = (blockToEdit?: RecurringBlockItem) => {
    if (blockToEdit) {
      setEditingBlock(blockToEdit);
      setBlockTitle(blockToEdit.title);
      setBlockProfId(blockToEdit.professional_id || "all");
      setBlockRecurrenceType(
        blockToEdit.recurrence_type === "fixed_day_of_month"
          ? "fixed_day_of_month"
          : blockToEdit.recurrence_type === "biweekly"
          ? "biweekly"
          : "weekly"
      );
      setBlockDayOfWeek(blockToEdit.day_of_week ?? 2);
      setBlockDayOfMonth(blockToEdit.day_of_month ?? 15);
      setBlockStartTime(blockToEdit.start_time);
      setBlockEndTime(blockToEdit.end_time);
      setBlockIsAllDay(blockToEdit.is_all_day);
      setBlockStartDate(blockToEdit.start_date || new Date().toISOString().slice(0, 10));
      setBlockEndDate(blockToEdit.end_date || "");
      setBlockNotes(blockToEdit.notes || "");
    } else {
      setEditingBlock(null);
      setBlockTitle("");
      setBlockProfId("all");
      setBlockRecurrenceType("weekly");
      setBlockDayOfWeek(2);
      setBlockDayOfMonth(15);
      setBlockStartTime("13:00");
      setBlockEndTime("14:00");
      setBlockIsAllDay(false);
      setBlockStartDate(new Date().toISOString().slice(0, 10));
      setBlockEndDate("");
      setBlockNotes("");
    }
    setIsBlockModalOpen(true);
  };

  const handleSaveBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!blockTitle.trim()) {
      showNotification("Informe um título ou motivo para o bloqueio recorrente.", true);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveRecurringBlock(tenant.id, {
        id: editingBlock ? editingBlock.id : undefined,
        tenant_id: tenant.id,
        professional_id: blockProfId === "all" ? null : blockProfId,
        title: blockTitle.trim(),
        recurrence_type: blockRecurrenceType,
        day_of_week: blockRecurrenceType === "fixed_day_of_month" ? null : blockDayOfWeek,
        day_of_month: blockRecurrenceType === "fixed_day_of_month" ? blockDayOfMonth : null,
        week_of_month: null,
        start_time: blockStartTime,
        end_time: blockEndTime,
        is_all_day: blockIsAllDay,
        start_date: blockStartDate,
        end_date: blockEndDate || null,
        is_active: editingBlock ? editingBlock.is_active : true,
        notes: blockNotes.trim() || null,
      });

      setRecurringBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setIsBlockModalOpen(false);
      showNotification("Bloqueio recorrente registrado com sucesso!");
    } catch {
      showNotification("Erro ao registrar bloqueio recorrente.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlockActive = async (block: RecurringBlockItem) => {
    if (!tenant?.id) return;
    try {
      const updated = { ...block, is_active: !block.is_active };
      await saveRecurringBlock(tenant.id, updated);
      setRecurringBlocks((prev) => prev.map((b) => (b.id === block.id ? updated : b)));
      showNotification(
        updated.is_active ? "Bloqueio ativado na agenda!" : "Bloqueio pausado temporariamente."
      );
    } catch {
      showNotification("Erro ao alterar status do bloqueio.", true);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!tenant?.id) return;
    if (!confirm("Tem certeza que deseja excluir permanentemente este bloqueio recorrente?")) return;
    try {
      await deleteRecurringBlock(tenant.id, blockId);
      setRecurringBlocks((prev) => prev.filter((b) => b.id !== blockId));
      showNotification("Bloqueio recorrente removido.");
    } catch {
      showNotification("Erro ao remover bloqueio recorrente.", true);
    }
  };

  // Ações da Tab 4: Clientes Recorrentes
  const handleOpenClientModal = (clientToEdit?: RecurringClientItem) => {
    if (clientToEdit) {
      setEditingClient(clientToEdit);
      setRcClientName(clientToEdit.client_name);
      setRcClientPhone(clientToEdit.client_phone);
      setRcProfId(clientToEdit.professional_id);
      setRcServiceId(clientToEdit.service_id);
      setRcPrice((clientToEdit.price_cents / 100).toFixed(2));
      setRcRuleType(clientToEdit.rule_type);
      setRcDayOfMonth(clientToEdit.day_of_month ?? 15);
      setRcWeekOfMonth(clientToEdit.week_of_month ?? -1);
      setRcDayOfWeek(clientToEdit.day_of_week ?? 5);
      setRcPreferredTime(clientToEdit.preferred_time);
      setRcStartDate(clientToEdit.start_date || new Date().toISOString().slice(0, 10));
      setRcEndDate(clientToEdit.end_date || "");
      setRcNotes(clientToEdit.notes || "");
    } else {
      setEditingClient(null);
      setRcClientName("");
      setRcClientPhone("");
      if (professionalsList.length > 0) setRcProfId(professionalsList[0].id);
      if (servicesList.length > 0) {
        setRcServiceId(servicesList[0].id);
        setRcPrice((servicesList[0].price_cents / 100).toFixed(2));
      }
      setRcRuleType("fixed_day_of_month");
      setRcDayOfMonth(15);
      setRcWeekOfMonth(-1);
      setRcDayOfWeek(5);
      setRcPreferredTime("10:00");
      setRcStartDate(new Date().toISOString().slice(0, 10));
      setRcEndDate("");
      setRcNotes("");
    }
    setIsClientModalOpen(true);
  };

  const handleSaveClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!rcClientName.trim()) {
      showNotification("Informe o nome do cliente.", true);
      return;
    }
    const cleanPhone = rcClientPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      showNotification("Informe o WhatsApp ou telefone do cliente com DDD.", true);
      return;
    }
    if (!rcProfId) {
      showNotification("Selecione o profissional preferido do cliente.", true);
      return;
    }
    if (!rcServiceId) {
      showNotification("Selecione o serviço.", true);
      return;
    }

    const priceCents = Math.round(parseFloat(rcPrice || "0") * 100);

    setSaving(true);
    try {
      const profObj = professionalsList.find((p) => p.id === rcProfId);
      const servObj = servicesList.find((s) => s.id === rcServiceId);

      const saved = await saveRecurringClient(tenant.id, {
        id: editingClient ? editingClient.id : undefined,
        tenant_id: tenant.id,
        client_name: rcClientName.trim(),
        client_phone: cleanPhone,
        professional_id: rcProfId,
        professional_name: profObj?.name || "Profissional",
        service_id: rcServiceId,
        service_name: servObj?.name || "Serviço",
        price_cents: priceCents > 0 ? priceCents : servObj?.price_cents || 0,
        rule_type: rcRuleType,
        day_of_month: rcRuleType === "fixed_day_of_month" ? rcDayOfMonth : null,
        day_of_week: rcRuleType !== "fixed_day_of_month" ? rcDayOfWeek : null,
        week_of_month: rcRuleType === "relative_day_of_month" ? rcWeekOfMonth : null,
        preferred_time: rcPreferredTime,
        start_date: rcStartDate,
        end_date: rcEndDate || null,
        is_active: editingClient ? editingClient.is_active : true,
        notes: rcNotes.trim() || null,
      });

      setRecurringClients((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setIsClientModalOpen(false);
      showNotification("Cliente recorrente configurado com sucesso!");
    } catch {
      showNotification("Erro ao registrar cliente recorrente.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleClientActive = async (client: RecurringClientItem) => {
    if (!tenant?.id) return;
    try {
      const updated = { ...client, is_active: !client.is_active };
      await saveRecurringClient(tenant.id, updated);
      setRecurringClients((prev) => prev.map((c) => (c.id === client.id ? updated : c)));
      showNotification(
        updated.is_active
          ? "Recorrência ativada na agenda!"
          : "Recorrência pausada temporariamente."
      );
    } catch {
      showNotification("Erro ao alterar status do cliente recorrente.", true);
    }
  };

  const handleDeleteClient = async (seriesId: string) => {
    if (!tenant?.id) return;
    if (!confirm("Tem certeza que deseja cancelar e excluir esta recorrência de cliente?")) return;
    try {
      await deleteRecurringClient(tenant.id, seriesId);
      setRecurringClients((prev) => prev.filter((c) => c.id !== seriesId));
      showNotification("Recorrência do cliente removida.");
    } catch {
      showNotification("Erro ao remover recorrência.", true);
    }
  };

  // Preview de próximas ocorrências para o formulário de cliente recorrente
  const clientRulePreview: RecurrenceRule = {
    recurrenceType: rcRuleType,
    dayOfMonth: rcDayOfMonth,
    dayOfWeek: rcDayOfWeek,
    weekOfMonth: rcWeekOfMonth,
    startDate: rcStartDate,
    startTime: rcPreferredTime,
  };
  const upcomingClientDates = getNextOccurrences(clientRulePreview, 4);

  // Preview de próximas ocorrências para o formulário de bloqueio
  const blockRulePreview: RecurrenceRule = {
    recurrenceType: blockRecurrenceType,
    dayOfWeek: blockDayOfWeek,
    dayOfMonth: blockDayOfMonth,
    startDate: blockStartDate,
    startTime: blockStartTime,
    endTime: blockEndTime,
  };
  const upcomingBlockDates = getNextOccurrences(blockRulePreview, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header com Identidade Visual */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-accent/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-2 border border-accent/30">
              <Clock className="w-3.5 h-3.5" />
              Gestão Centralizada de Horários
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white font-display tracking-tight">
              Horários & Recorrências
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Fonte única da verdade: configure o expediente geral da barbearia, os intervalos de almoço
              da equipe, bloqueios recorrentes e agendamentos fixos para alimentar a agenda e o chat online.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab === "recurring_blocks" && (
              <button
                type="button"
                onClick={() => handleOpenBlockModal()}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:brightness-110 active:scale-95 transition shadow-lg shadow-accent/25"
              >
                <Plus className="w-4 h-4" />
                Novo Bloqueio Recorrente
              </button>
            )}

            {activeTab === "recurring_clients" && (
              <button
                type="button"
                onClick={() => handleOpenClientModal()}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:brightness-110 active:scale-95 transition shadow-lg shadow-accent/25"
              >
                <Plus className="w-4 h-4" />
                Novo Cliente Recorrente
              </button>
            )}
          </div>
        </div>

        {/* Notificações Flutuantes */}
        {successMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Barra de Abas Responsiva */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mt-6 pt-6 border-t border-slate-800 pb-1.5 snap-x">
          <button
            type="button"
            onClick={() => handleTabChange("business_hours")}
            className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition active:scale-95 ${
              activeTab === "business_hours"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4" />
            Expediente da Barbearia
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("lunch_breaks")}
            className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition active:scale-95 ${
              activeTab === "lunch_breaks"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Coffee className="w-4 h-4" />
            Almoço dos Barbeiros
            {lunchSchedules.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] ml-1">
                {lunchSchedules.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("recurring_blocks")}
            className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition active:scale-95 ${
              activeTab === "recurring_blocks"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Bloqueios Recorrentes
            {recurringBlocks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] ml-1">
                {recurringBlocks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("recurring_clients")}
            className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition active:scale-95 ${
              activeTab === "recurring_clients"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Repeat className="w-4 h-4" />
            Clientes Recorrentes
            {recurringClients.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] ml-1">
                {recurringClients.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba 1: Expediente da Barbearia */}
      {activeTab === "business_hours" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Horário de Abertura & Fechamento Semanal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define a grade padrão de agendamentos exibida na agenda e liberada no chat de agendamento online.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyMondayToWeek}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                title="Aplica o horário configurado na segunda-feira para terça, quarta, quinta e sexta"
              >
                Copiar Seg para Ter-Sex
              </button>

              <button
                type="button"
                onClick={handleSaveBusinessHours}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white font-bold text-xs md:text-sm hover:brightness-110 active:scale-95 transition disabled:opacity-50 shadow-md shadow-accent/20"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar Horários"}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {businessHours.map((hour, idx) => {
              const dayName = DAYS_OF_WEEK_NAMES[hour.day_of_week];
              const isWeekend = hour.day_of_week === 0 || hour.day_of_week === 6;

              return (
                <div
                  key={hour.day_of_week}
                  className={`py-3.5 px-3 rounded-2xl transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    hour.is_closed ? "bg-slate-50/60 opacity-70" : "hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        hour.is_closed
                          ? "bg-slate-200 text-slate-500"
                          : isWeekend
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-900 text-white"
                      }`}
                    >
                      {DAYS_OF_WEEK_SHORT[hour.day_of_week]}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{dayName}</div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        {hour.is_closed ? "Fechado o dia todo" : "Expediente ativo"}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Aberto/Fechado */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hour.is_closed}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[idx] = { ...hour, is_closed: !e.target.checked };
                          setBusinessHours(updated);
                        }}
                        className="w-4 h-4 text-accent rounded border-slate-300 focus:ring-accent"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {!hour.is_closed ? "Aberto" : "Fechado"}
                      </span>
                    </label>

                    {/* Horários */}
                    {!hour.is_closed ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">De:</span>
                          <input
                            type="time"
                            value={hour.open_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx] = { ...hour, open_time: e.target.value };
                              setBusinessHours(updated);
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">Até:</span>
                          <input
                            type="time"
                            value={hour.close_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx] = { ...hour, close_time: e.target.value };
                              setBusinessHours(updated);
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">
                        Nenhum atendimento neste dia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Almoço dos Barbeiros */}
      {activeTab === "lunch_breaks" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <Coffee className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950">
              <span className="font-bold block text-sm mb-0.5">
                Intervalos de Almoço Centralizados
              </span>
              Conforme solicitado, a configuração de almoço foi unificada nesta tela e removida da ficha
              individual do barbeiro. Todos os horários definidos aqui bloqueiam automaticamente as vagas
              na agenda interna e no chat público.
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-accent" />
                  Pausas de Almoço da Equipe
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajuste o horário de início e retorno do almoço para cada profissional.
                </p>
              </div>

              {lunchSchedules.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveAllLunches}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:brightness-110 transition disabled:opacity-50 shadow-md shadow-accent/20"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar Todos"}
                </button>
              )}
            </div>

            {lunchSchedules.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Coffee className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                <p className="font-semibold text-sm">Nenhum profissional cadastrado na barbearia.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre barbeiros na aba Profissionais para gerenciar seus horários de almoço.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lunchSchedules.map((schedule, idx) => (
                  <div
                    key={schedule.professionalId}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {schedule.professionalName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {schedule.professionalName}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500">
                            {schedule.hasLunchBreak
                              ? `Almoço: ${schedule.lunchStart} às ${schedule.lunchEnd}`
                              : "Sem pausa de almoço"}
                          </div>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedule.hasLunchBreak}
                          onChange={(e) => {
                            const updated = [...lunchSchedules];
                            updated[idx] = { ...schedule, hasLunchBreak: e.target.checked };
                            setLunchSchedules(updated);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                      </label>
                    </div>

                    {schedule.hasLunchBreak ? (
                      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-3">
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Início
                            </label>
                            <input
                              type="time"
                              value={schedule.lunchStart}
                              onChange={(e) => {
                                const updated = [...lunchSchedules];
                                updated[idx] = { ...schedule, lunchStart: e.target.value };
                                setLunchSchedules(updated);
                              }}
                              className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Retorno
                            </label>
                            <input
                              type="time"
                              value={schedule.lunchEnd}
                              onChange={(e) => {
                                const updated = [...lunchSchedules];
                                updated[idx] = { ...schedule, lunchEnd: e.target.value };
                                setLunchSchedules(updated);
                              }}
                              className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveLunchSchedule(schedule.professionalId)}
                          disabled={saving}
                          className="self-end px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200/60 text-xs font-semibold text-slate-400 italic">
                        Este profissional atende direto sem intervalo fixo de almoço.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 3: Bloqueios Recorrentes */}
      {activeTab === "recurring_blocks" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-start gap-3">
            <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-950">
              <span className="font-bold block text-sm mb-0.5">
                Bloqueios Periódicos na Grade
              </span>
              Permite reservar intervalos regulares que se repetem automaticamente (ex: curso toda terça
              das 13h às 14h, reunião quinzenal ou treinamento mensal). Esses períodos não recebem
              agendamentos no chat online nem na agenda.
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-accent" />
                  Bloqueios Recorrentes Cadastrados
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gerencie compromissos fixos, estudos e treinamentos periódicos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenBlockModal()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs md:text-sm hover:brightness-110 transition shadow-md shadow-accent/20"
              >
                <Plus className="w-4 h-4" />
                Novo Bloqueio
              </button>
            </div>

            {recurringBlocks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShieldAlert className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                <p className="font-semibold text-sm">Nenhum bloqueio recorrente ativo.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Clique em &quot;Novo Bloqueio&quot; para reservar um horário fixo regular (ex: curso toda terça das 13h às 14h).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recurringBlocks.map((block) => {
                  const profObj = professionalsList.find((p) => p.id === block.professional_id);
                  const profName = profObj ? profObj.name : "Toda a Barbearia (Geral)";
                  const ruleObj: RecurrenceRule = {
                    recurrenceType: block.recurrence_type,
                    dayOfWeek: block.day_of_week ?? undefined,
                    dayOfMonth: block.day_of_month ?? undefined,
                    startDate: block.start_date,
                    startTime: block.start_time,
                    endTime: block.end_time,
                  };
                  const desc = formatRecurrenceDescription(ruleObj);
                  const upcoming = getNextOccurrences(ruleObj, 3);

                  return (
                    <div
                      key={block.id}
                      className={`p-5 rounded-2xl border transition space-y-3.5 ${
                        block.is_active
                          ? "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                          : "bg-slate-50/70 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-sm">{block.title}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                block.is_active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {block.is_active ? "Ativo" : "Pausado"}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-accent mt-0.5">{desc}</div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleBlockActive(block)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                              block.is_active
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={block.is_active ? "Pausar bloqueio" : "Ativar bloqueio"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBlockModal(block)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Editar bloqueio"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Excluir bloqueio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{profName}</span>
                      </div>

                      {block.notes && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-xl">
                          &quot;{block.notes}&quot;
                        </p>
                      )}

                      {/* Próximas datas calculadas */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium overflow-x-auto">
                        <span className="font-bold text-slate-700 shrink-0">Próximos:</span>
                        {upcoming.map((u, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0 font-semibold"
                          >
                            {u.formatted}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 4: Clientes Recorrentes */}
      {activeTab === "recurring_clients" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
            <Repeat className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950">
              <span className="font-bold block text-sm mb-0.5">
                Agendamentos Fixos e Fidelizados
              </span>
              Cadastre clientes que cortam em períodos fixos (ex: todo dia 15 do mês, toda última sexta-feira,
              ou toda semana). A agenda alimentará esses atendimentos automaticamente na data correspondente,
              com identificação visual de recorrência.
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-accent" />
                  Clientes com Horário Fixo
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agendamentos que se renovam automaticamente todo mês ou semana.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenClientModal()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs md:text-sm hover:brightness-110 transition shadow-md shadow-accent/20"
              >
                <Plus className="w-4 h-4" />
                Novo Cliente Recorrente
              </button>
            </div>

            {recurringClients.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Repeat className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                <p className="font-semibold text-sm">Nenhum cliente recorrente cadastrado.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Clique em &quot;Novo Cliente Recorrente&quot; para registrar clientes com dia específico (ex: todo dia 15 ou toda última sexta do mês).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recurringClients.map((client) => {
                  const ruleObj: RecurrenceRule = {
                    recurrenceType: client.rule_type,
                    dayOfMonth: client.day_of_month ?? undefined,
                    dayOfWeek: client.day_of_week ?? undefined,
                    weekOfMonth: client.week_of_month ?? undefined,
                    startDate: client.start_date,
                    startTime: client.preferred_time,
                  };
                  const desc = formatRecurrenceDescription(ruleObj);
                  const upcoming = getNextOccurrences(ruleObj, 3);

                  return (
                    <div
                      key={client.id}
                      className={`p-5 rounded-2xl border transition space-y-3.5 ${
                        client.is_active
                          ? "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                          : "bg-slate-50/70 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent font-black flex items-center justify-center text-sm">
                            {client.client_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-slate-900 text-sm">
                                {client.client_name}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  client.is_active
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {client.is_active ? "Ativo" : "Pausado"}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-accent mt-0.5">{desc}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleClientActive(client)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                              client.is_active
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={client.is_active ? "Pausar recorrência" : "Ativar recorrência"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenClientModal(client)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Editar cliente recorrente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Excluir recorrência"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          <Scissors className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold truncate">{client.service_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold truncate">{client.professional_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-900">
                            {formatCurrency(client.price_cents)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-slate-500">{client.client_phone}</span>
                        </div>
                      </div>

                      {client.notes && (
                        <p className="text-xs text-slate-500 italic bg-amber-50/60 border border-amber-200/50 p-2 rounded-xl">
                          &quot;{client.notes}&quot;
                        </p>
                      )}

                      {/* Próximas datas calculadas */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium overflow-x-auto">
                        <span className="font-bold text-slate-700 shrink-0">Próximos:</span>
                        {upcoming.map((u, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0 font-semibold"
                          >
                            {u.formatted}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Bloqueio Recorrente */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingBlock ? "Editar Bloqueio Recorrente" : "Novo Bloqueio Recorrente"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Reserve horários fixos periódicos na agenda e no chat online
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBlockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título / Motivo do Bloqueio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Curso de Corte, Reunião de Equipe, Treinamento..."
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Profissional Afetado
                </label>
                <select
                  value={blockProfId}
                  onChange={(e) => setBlockProfId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                >
                  <option value="all">Toda a Barbearia (Geral - Todos os Barbeiros)</option>
                  {professionalsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      Apenas {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frequência da Recorrência
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBlockRecurrenceType("weekly")}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                      blockRecurrenceType === "weekly"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Semanal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockRecurrenceType("biweekly")}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                      blockRecurrenceType === "biweekly"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Quinzenal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockRecurrenceType("fixed_day_of_month")}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
                      blockRecurrenceType === "fixed_day_of_month"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Dia do Mês
                  </button>
                </div>
              </div>

              {blockRecurrenceType !== "fixed_day_of_month" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dia da Semana
                  </label>
                  <select
                    value={blockDayOfWeek}
                    onChange={(e) => setBlockDayOfWeek(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                  >
                    {DAYS_OF_WEEK_NAMES.map((name, idx) => (
                      <option key={idx} value={idx}>
                        Toda {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dia Específico do Mês (1 a 31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={blockDayOfMonth}
                    onChange={(e) => setBlockDayOfMonth(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    required
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horário Fim
                  </label>
                  <input
                    type="time"
                    required
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Curso na academia de barbeiros..."
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              {/* Prévia de datas */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-accent" />
                  Próximas datas de bloqueio:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {upcomingBlockDates.map((u, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm"
                    >
                      {u.formatted}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:brightness-110 active:scale-95 transition disabled:opacity-50 shadow-md shadow-accent/20"
                >
                  {saving ? "Salvando..." : "Salvar Bloqueio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Cliente Recorrente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingClient ? "Editar Cliente Recorrente" : "Novo Cliente Recorrente"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Defina a regra para agendamentos periódicos automáticos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClientSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Silva"
                    value={rcClientName}
                    onChange={(e) => setRcClientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp (DDD + Número) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 98765-4321"
                    value={rcClientPhone}
                    onChange={(e) => setRcClientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Profissional Preferido *
                  </label>
                  <select
                    value={rcProfId}
                    onChange={(e) => setRcProfId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                  >
                    {professionalsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Serviço Contratado *
                  </label>
                  <select
                    value={rcServiceId}
                    onChange={(e) => {
                      setRcServiceId(e.target.value);
                      const serv = servicesList.find((s) => s.id === e.target.value);
                      if (serv) setRcPrice((serv.price_cents / 100).toFixed(2));
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white"
                  >
                    {servicesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.price_cents)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor Cobrado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rcPrice}
                    onChange={(e) => setRcPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horário de Atendimento
                  </label>
                  <input
                    type="time"
                    required
                    value={rcPreferredTime}
                    onChange={(e) => setRcPreferredTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* Seletor de Tipo de Recorrência */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Padrão de Recorrência
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setRcRuleType("fixed_day_of_month")}
                    className={`p-2 text-[11px] font-bold rounded-xl border text-center transition ${
                      rcRuleType === "fixed_day_of_month"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Dia Fixo (Ex: dia 15)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRcRuleType("relative_day_of_month")}
                    className={`p-2 text-[11px] font-bold rounded-xl border text-center transition ${
                      rcRuleType === "relative_day_of_month"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Dia Relativo (Ex: Última Sexta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRcRuleType("weekly")}
                    className={`p-2 text-[11px] font-bold rounded-xl border text-center transition ${
                      rcRuleType === "weekly"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Semanal
                  </button>
                  <button
                    type="button"
                    onClick={() => setRcRuleType("biweekly")}
                    className={`p-2 text-[11px] font-bold rounded-xl border text-center transition ${
                      rcRuleType === "biweekly"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Quinzenal
                  </button>
                </div>
              </div>

              {/* Detalhe da Regra */}
              {rcRuleType === "fixed_day_of_month" && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Todo dia fixo do mês:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-900">Todo dia</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={rcDayOfMonth}
                      onChange={(e) => setRcDayOfMonth(parseInt(e.target.value, 10))}
                      className="w-20 px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 text-emerald-950 bg-white"
                    />
                    <span className="text-xs font-semibold text-emerald-900">de cada mês</span>
                  </div>
                </div>
              )}

              {rcRuleType === "relative_day_of_month" && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      Qual semana do mês?
                    </label>
                    <select
                      value={rcWeekOfMonth}
                      onChange={(e) => setRcWeekOfMonth(parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 text-emerald-950 bg-white"
                    >
                      {WEEKS_OF_MONTH_OPTIONS.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      Dia da semana
                    </label>
                    <select
                      value={rcDayOfWeek}
                      onChange={(e) => setRcDayOfWeek(parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 text-emerald-950 bg-white"
                    >
                      {DAYS_OF_WEEK_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(rcRuleType === "weekly" || rcRuleType === "biweekly") && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Em qual dia da semana?
                  </label>
                  <select
                    value={rcDayOfWeek}
                    onChange={(e) => setRcDayOfWeek(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 text-emerald-950 bg-white"
                  >
                    {DAYS_OF_WEEK_NAMES.map((name, idx) => (
                      <option key={idx} value={idx}>
                        Toda {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Prévia de datas */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  Próximos agendamentos gerados na agenda:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {upcomingClientDates.map((u, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm"
                    >
                      {u.formatted}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas / Preferências do Cliente
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Cliente VIP, prefere degradê navalhado e café sem açúcar..."
                  value={rcNotes}
                  onChange={(e) => setRcNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:brightness-110 active:scale-95 transition disabled:opacity-50 shadow-md shadow-accent/20"
                >
                  {saving ? "Salvando..." : "Salvar Cliente Recorrente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;
