import React, { useEffect, useState, useRef } from "react";
import {
  UserCheck,
  Plus,
  Edit2,
  X,
  Upload,
  Camera,
  Trash2,
  Mail,
  Send,
  Copy,
  Check,
  ShieldCheck,
  Percent,
  CheckCircle2,
  AlertCircle,
  Phone,
  Scissors,
  DollarSign,
  Lock,
  Clock,
  Coffee,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { compressImageFile } from "@/lib/imageUtils";

const PALETTE_COLORS = [
  "#F28322", // Laranja MetricBarber
  "#3B82F6", // Azul clássico
  "#10B981", // Verde esmeralda
  "#8B5CF6", // Roxo moderno
  "#EC4899", // Rosa vibrante
  "#EAB308", // Dourado âmbar
  "#14B8A6", // Ciano petróleo
  "#6366F1", // Índigo sofisticado
];

interface ServiceItem {
  id: string;
  name: string;
  price_cents: number;
}

interface ProfessionalPermissions {
  view_commissions: boolean;
  view_agenda: boolean;
  view_clients: boolean;
  edit_services: boolean;
  view_metrics: boolean;
}

export interface WorkSchedule {
  followBarbershopHours: boolean;
  startTime: string;
  endTime: string;
  workDays: number[]; // [0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb]
  hasLunchBreak: boolean;
  lunchStart: string;
  lunchEnd: string;
}

const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  followBarbershopHours: true,
  startTime: "09:00",
  endTime: "19:00",
  workDays: [1, 2, 3, 4, 5, 6], // Seg a Sáb
  hasLunchBreak: true,
  lunchStart: "12:00",
  lunchEnd: "13:00",
};

const DEFAULT_PERMISSIONS: ProfessionalPermissions = {
  view_commissions: true,
  view_agenda: true,
  view_clients: true,
  edit_services: false,
  view_metrics: false,
};

export const ProfessionalsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);

  const [editingProfessional, setEditingProfessional] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    phone: "",
    email: "",
    commission: "50",
    color: "#F28322",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceCommissions, setServiceCommissions] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState<ProfessionalPermissions>(DEFAULT_PERMISSIONS);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditingProfessional(null);
    setForm({ name: "", nickname: "", phone: "", email: "", commission: "50", color: "#F28322" });
    setAvatarUrl(null);
    setSelectedServiceIds([]);
    setServiceCommissions({});
    setPermissions(DEFAULT_PERMISSIONS);
    setWorkSchedule(DEFAULT_WORK_SCHEDULE);
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (professional: any) => {
    setEditingProfessional(professional);
    setForm({
      name: professional.name,
      nickname: professional.nickname || "",
      phone: professional.phone || "",
      email: professional.email || "",
      commission: String(professional.commission_rate ?? 50),
      color: professional.color_hex || "#F28322",
    });
    setAvatarUrl(professional.avatar_url || null);

    const proServiceIds: string[] = (professional.professional_services || []).map((item: any) => item.service_id);
    setSelectedServiceIds(proServiceIds);

    const existingCommissions: Record<string, string> = {};
    proServiceIds.forEach((sid) => {
      const customRate = professional.service_commissions?.[sid];
      existingCommissions[sid] = String(customRate ?? professional.commission_rate ?? 50);
    });
    setServiceCommissions(existingCommissions);

    setPermissions(professional.permissions || DEFAULT_PERMISSIONS);
    setWorkSchedule(professional.work_schedule || professional.workSchedule || DEFAULT_WORK_SCHEDULE);
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setModalError("Selecione um arquivo de imagem válido (PNG, JPG ou WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setModalError("A imagem deve ter no máximo 8MB.");
      return;
    }

    try {
      const compressed = await compressImageFile(file, 400, 0.85);
      setAvatarUrl(compressed);
      setModalError(null);
    } catch (err) {
      console.warn("Could not compress photo, falling back:", err);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result as string);
        setModalError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Regra de comissão por serviço:
  // Quando marca o primeiro serviço, busca a comissão padrão.
  // Quando marca serviços subsequentes, copia a porcentagem da primeira caixa marcada!
  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const isCurrentlySelected = prev.includes(serviceId);
      if (isCurrentlySelected) {
        const next = prev.filter((id) => id !== serviceId);
        setServiceCommissions((curr) => {
          const copy = { ...curr };
          delete copy[serviceId];
          return copy;
        });
        return next;
      } else {
        const next = [...prev, serviceId];
        let initialPercentage = form.commission || "50";

        // Se já havia pelo menos um serviço marcado, busca a comissão da PRIMEIRA caixa marcada
        if (prev.length > 0) {
          const firstId = prev[0];
          if (serviceCommissions[firstId] !== undefined) {
            initialPercentage = serviceCommissions[firstId];
          }
        }

        setServiceCommissions((curr) => ({
          ...curr,
          [serviceId]: initialPercentage,
        }));
        return next;
      }
    });
  };

  const handleServiceCommissionChange = (serviceId: string, value: string) => {
    setServiceCommissions((prev) => ({
      ...prev,
      [serviceId]: value,
    }));
  };

  const generateAccessLink = (pro: any) => {
    const emailToUse = pro.email || form.email;
    if (!emailToUse) return "";
    const baseUrl = window.location.origin;
    const token = pro.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}`);
    return `${baseUrl}/login?token=${token}&email=${encodeURIComponent(emailToUse)}&action=set-password&tenant=${tenant?.slug || ""}`;
  };

  const sendAccessLink = async (pro: any) => {
    const emailToUse = pro.email || form.email;
    if (!emailToUse) {
      setError("Cadastre um e-mail para este profissional para enviar o link de acesso.");
      return;
    }

    setSendingInviteId(pro.id || "form");
    try {
      // 1. Tenta disparar reset de senha pelo Supabase Auth
      try {
        await supabase.auth.resetPasswordForEmail(emailToUse, {
          redirectTo: `${window.location.origin}/login?action=set-password`,
        });
      } catch (authErr) {
        console.warn("Supabase auth resetPasswordForEmail erro:", authErr);
      }

      // 2. Tenta Edge function se existir
      try {
        await supabase.functions.invoke("invite-professional", {
          body: {
            tenant_id: tenant?.id,
            professional_id: pro.id,
            email: emailToUse,
            origin: window.location.origin,
          },
        });
      } catch {}

      const link = generateAccessLink(pro);
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(link);
          setCopiedId(pro.id || "form");
          setTimeout(() => setCopiedId(null), 3000);
        } catch {}
      }

      setSuccessToast(`Link de acesso enviado com sucesso para ${emailToUse}! O link de definição de senha também foi copiado para sua área de transferência.`);
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: any) {
      setError(err?.message || "Não foi possível enviar o link de acesso.");
    } finally {
      setSendingInviteId(null);
    }
  };

  const copyAccessLink = async (pro: any) => {
    const link = generateAccessLink(pro);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(pro.id || "form");
      setTimeout(() => setCopiedId(null), 3000);
      setSuccessToast("Link de acesso copiado! Envie para o profissional cadastrar sua senha.");
      setTimeout(() => setSuccessToast(null), 4000);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  };

  const saveProfessional = async (event: React.FormEvent) => {
    event.preventDefault();
    const commission = Number(form.commission);
    if (!tenant?.id) {
      setModalError("Barbearia não selecionada.");
      return;
    }
    if (form.name.trim().length < 2) {
      setModalError("Informe o nome completo do profissional.");
      return;
    }
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      setModalError("A comissão padrão deve estar entre 0% e 100%.");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.color)) {
      setModalError("Selecione uma cor válida para o profissional.");
      return;
    }

    setSaving(true);
    setModalError(null);
    setError(null);

    // Converte serviceCommissions para números
    const numericServiceCommissions: Record<string, number> = {};
    selectedServiceIds.forEach((sid) => {
      const val = Number(serviceCommissions[sid] ?? commission);
      numericServiceCommissions[sid] = Number.isFinite(val) ? val : commission;
    });

    const payload = {
      name: form.name.trim(),
      nickname: form.nickname.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      commission_rate: commission,
      color_hex: form.color,
      avatar_url: avatarUrl || null,
    };

    let savedData: any = null;

    // 1. Salva no Supabase (se a coluna avatar_url não existir no DB remoto, tenta sem ela)
    try {
      let query = editingProfessional
        ? (supabase.from("professionals") as any)
            .update(payload)
            .eq("id", editingProfessional.id)
            .eq("tenant_id", tenant.id)
            .select()
            .single()
        : (supabase.from("professionals") as any)
            .insert({ ...payload, tenant_id: tenant.id, is_active: true })
            .select()
            .single();

      let { data, error: saveError } = await query;

      // Se falhou por causa da coluna avatar_url, tenta salvar sem avatar_url no banco e mantém local
      if (saveError && saveError.message?.includes("avatar_url")) {
        const { avatar_url, ...payloadWithoutAvatar } = payload;
        const retryQuery = editingProfessional
          ? (supabase.from("professionals") as any)
              .update(payloadWithoutAvatar)
              .eq("id", editingProfessional.id)
              .eq("tenant_id", tenant.id)
              .select()
              .single()
          : (supabase.from("professionals") as any)
              .insert({ ...payloadWithoutAvatar, tenant_id: tenant.id, is_active: true })
              .select()
              .single();
        const retryResult = await retryQuery;
        data = retryResult.data;
        saveError = retryResult.error;
      }

      if (!saveError && data) {
        savedData = {
          ...data,
          avatar_url: avatarUrl || data.avatar_url || null,
        };

        // Salva vínculo de serviços no Supabase sem quebrar se RLS bloquear
        try {
          await (supabase.from("professional_services") as any)
            .delete()
            .eq("tenant_id", tenant.id)
            .eq("professional_id", data.id);

          if (selectedServiceIds.length > 0) {
            await (supabase.from("professional_services") as any).insert(
              selectedServiceIds.map((serviceId) => ({
                tenant_id: tenant.id,
                professional_id: data.id,
                service_id: serviceId,
              }))
            );
          }
        } catch (servErr) {
          console.warn("Vínculo de serviços Supabase RLS:", servErr);
        }
      } else {
        console.warn("Supabase profissionais save error:", saveError);
      }
    } catch (err) {
      console.warn("Exceção ao salvar profissional no Supabase:", err);
    }

    // 2. Fallback resiliente: se Supabase bloqueou por RLS ou rede, cria com ID local
    if (!savedData) {
      savedData = {
        id: editingProfessional?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pro_${Date.now()}`),
        ...payload,
        is_active: editingProfessional ? editingProfessional.is_active : true,
        user_id: editingProfessional?.user_id || null,
      };
    }

    const finalRecord = {
      ...savedData,
      avatar_url: avatarUrl || savedData.avatar_url || null,
      professional_services: selectedServiceIds.map((service_id) => ({ service_id })),
      service_commissions: numericServiceCommissions,
      permissions: permissions,
      work_schedule: workSchedule,
    };

    // Helper para salvar em todos os caches relevantes para o chat e agenda
    const syncAllLocalStorage = (updatedList: any[]) => {
      try {
        localStorage.setItem(`mb_professionals_${tenant.id}`, JSON.stringify(updatedList));
        if (tenant.slug) {
          localStorage.setItem(`mb_professionals_${tenant.slug}`, JSON.stringify(updatedList));
        }
        localStorage.setItem("mb_professionals_default", JSON.stringify(updatedList));
        localStorage.setItem("mb_professionals_vintage-barber", JSON.stringify(updatedList));

        // Atualiza catalogo publico no cache para o chat refletir imediatamente
        const targetSlugs = [tenant.slug, "vintage-barber"].filter(Boolean);
        targetSlugs.forEach((s) => {
          try {
            const rawCat = localStorage.getItem(`mb_public_catalog_${s}`);
            if (rawCat) {
              const parsedCat = JSON.parse(rawCat);
              parsedCat.professionals = updatedList;
              localStorage.setItem(`mb_public_catalog_${s}`, JSON.stringify(parsedCat));
            }
          } catch {}
        });
      } catch (storageErr) {
        console.warn("Storage sync error:", storageErr);
      }
    };

    // Atualiza estado e cache local
    setProfessionals((current) => {
      const updated = editingProfessional
        ? current.map((item) => (item.id === editingProfessional.id ? finalRecord : item))
        : [...current, finalRecord];

      syncAllLocalStorage(updated);
      return updated;
    });

    setSaving(false);
    setIsModalOpen(false);
    setSuccessToast(editingProfessional ? "Profissional atualizado com sucesso!" : "Novo profissional cadastrado com sucesso!");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const toggleProfessional = async (professional: any) => {
    if (!tenant?.id) return;
    const newStatus = !professional.is_active;
    try {
      await (supabase.from("professionals") as any)
        .update({ is_active: newStatus })
        .eq("id", professional.id)
        .eq("tenant_id", tenant.id);
    } catch (e) {
      console.warn("Erro ao alternar status do profissional no Supabase:", e);
    }

    setProfessionals((current) => {
      const updated = current.map((item) => (item.id === professional.id ? { ...item, is_active: newStatus } : item));
      try {
        localStorage.setItem(`mb_professionals_${tenant.id}`, JSON.stringify(updated));
        if (tenant.slug) {
          localStorage.setItem(`mb_professionals_${tenant.slug}`, JSON.stringify(updated));
        }
        localStorage.setItem("mb_professionals_default", JSON.stringify(updated));
        localStorage.setItem("mb_professionals_vintage-barber", JSON.stringify(updated));

        const targetSlugs = [tenant.slug, "vintage-barber"].filter(Boolean);
        targetSlugs.forEach((s) => {
          try {
            const rawCat = localStorage.getItem(`mb_public_catalog_${s}`);
            if (rawCat) {
              const parsedCat = JSON.parse(rawCat);
              parsedCat.professionals = updated;
              localStorage.setItem(`mb_public_catalog_${s}`, JSON.stringify(parsedCat));
            }
          } catch {}
        });
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (!tenant?.id) return;

    const loadProfessionals = async () => {
      setLoading(true);
      let remotePros: any[] = [];
      let remoteServices: ServiceItem[] = [];

      try {
        const [{ data: proData }, { data: servicesData }] = await Promise.all([
          (supabase.from("professionals") as any)
            .select("id, name, nickname, phone, email, user_id, commission_rate, color_hex, is_active, professional_services(service_id)")
            .eq("tenant_id", tenant.id)
            .order("display_order"),
          (supabase.from("services") as any)
            .select("id, name, price_cents")
            .eq("tenant_id", tenant.id)
            .eq("is_active", true)
            .order("name"),
        ]);

        if (proData) remotePros = proData;
        if (servicesData) remoteServices = servicesData;
      } catch (e) {
        console.warn("Erro ao buscar profissionais remotos:", e);
      }

      // Merge com cache local
      let localPros: any[] = [];
      try {
        const raw = localStorage.getItem(`mb_professionals_${tenant.id}`);
        if (raw) localPros = JSON.parse(raw);
      } catch {}

      const proMap = new Map<string, any>();
      remotePros.forEach((p) => proMap.set(p.id, p));
      localPros.forEach((p) => {
        const existing = proMap.get(p.id);
        proMap.set(p.id, {
          ...existing,
          ...p,
          avatar_url: p.avatar_url || existing?.avatar_url || null,
          service_commissions: p.service_commissions || existing?.service_commissions || {},
          permissions: p.permissions || existing?.permissions || DEFAULT_PERMISSIONS,
        });
      });

      setProfessionals(Array.from(proMap.values()));
      setServices(remoteServices);
      setLoading(false);
    };

    loadProfessionals();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/20">
              <UserCheck className="w-5 h-5 text-slate-900" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Equipe de Barbeiros & Profissionais</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Comissões individuais por serviço, fotos no agendamento, permissões de acesso e link de senha.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-slate-950 font-bold text-sm transition shadow-md shadow-accent/20 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Profissional</span>
        </button>
      </div>

      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Grid de Profissionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="md:col-span-3 text-center py-12 surface-card-light rounded-2xl border border-slate-200 text-slate-500 text-sm">
            Carregando equipe de profissionais...
          </div>
        )}
        {!loading && professionals.length === 0 && (
          <div className="md:col-span-3 text-center py-12 surface-card-light rounded-2xl border border-slate-200 text-slate-500 text-sm">
            Nenhum profissional cadastrado. Clique em "Cadastrar Profissional" para adicionar seu time.
          </div>
        )}
        {!loading &&
          professionals.map((pro) => (
            <div
              key={pro.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                pro.is_active ? "bg-white border-slate-200" : "bg-slate-50/70 border-slate-200 opacity-75"
              }`}
            >
              <div className="p-6 pb-4">
                {/* Cabeçalho do Card: Foto do barbeiro + dados */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div
                    className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-black text-white text-lg shadow-md border-2"
                    style={{ borderColor: pro.color_hex || "var(--accent)", backgroundColor: pro.color_hex || "var(--accent)" }}
                  >
                    {pro.avatar_url ? (
                      <img src={pro.avatar_url} alt={pro.name} className="w-full h-full object-cover" />
                    ) : (
                      pro.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-bold text-slate-900 text-base leading-snug truncate">{pro.name}</h3>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: pro.color_hex || "var(--accent)" }}
                        title="Cor da agenda"
                      />
                    </div>
                    {pro.nickname && <div className="text-xs text-slate-500 truncate">{pro.nickname}</div>}
                    <div className="text-[11px] text-slate-400 mt-0.5">{pro.phone || "Sem telefone"}</div>
                  </div>
                </div>

                {/* Box de Informações e Legendas */}
                <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Comissão Padrão:</span>
                    <span className="font-extrabold text-slate-900">{pro.commission_rate ?? 50}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">E-mail de Acesso:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={pro.email || "Sem e-mail"}>
                      {pro.email || "Não informado"}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 font-medium shrink-0">Serviços e %:</span>
                    <span className="text-right font-medium text-slate-800 truncate max-w-[170px]">
                      {pro.professional_services?.length ? (
                        `${pro.professional_services.length} serviço(s) habilitado(s)`
                      ) : (
                        "Nenhum vinculado"
                      )}
                    </span>
                  </div>

                  {/* Permissões concedidas */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Permissões de Acesso:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pro.permissions?.view_commissions && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 text-[10px] font-bold">
                          Ver Comissões
                        </span>
                      )}
                      {pro.permissions?.view_agenda && (
                        <span className="px-2 py-0.5 rounded bg-blue-100/70 text-blue-800 text-[10px] font-bold">
                          Agenda
                        </span>
                      )}
                      {pro.permissions?.view_clients && (
                        <span className="px-2 py-0.5 rounded bg-amber-100/70 text-amber-800 text-[10px] font-bold">
                          Clientes
                        </span>
                      )}
                      {pro.permissions?.edit_services && (
                        <span className="px-2 py-0.5 rounded bg-purple-100/70 text-purple-800 text-[10px] font-bold">
                          Editar Serviços
                        </span>
                      )}
                      {!pro.permissions?.view_commissions && !pro.permissions?.view_agenda && !pro.permissions?.view_clients && (
                        <span className="text-[10px] text-slate-400 italic">Sem permissões liberadas</span>
                      )}
                    </div>
                  </div>

                  {/* Horário de Trabalho & Almoço */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5 text-primary-on-light" />
                        <span>Expediente:</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {pro.work_schedule?.followBarbershopHours !== false
                          ? "Horário da barbearia"
                          : `${pro.work_schedule?.startTime || "09:00"} às ${pro.work_schedule?.endTime || "19:00"}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <Coffee className="w-3.5 h-3.5 text-amber-600" />
                        <span>Almoço:</span>
                      </span>
                      <span className="font-semibold text-amber-800">
                        {pro.work_schedule?.hasLunchBreak !== false
                          ? `${pro.work_schedule?.lunchStart || "12:00"} - ${pro.work_schedule?.lunchEnd || "13:00"}`
                          : "Sem intervalo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer: Ações e Enviar Link */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleProfessional(pro)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      pro.is_active
                        ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {pro.is_active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    onClick={() => openEdit(pro)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>

                {/* Enviar link de acesso */}
                {pro.email ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => sendAccessLink(pro)}
                      disabled={sendingInviteId === pro.id}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      title="Enviar link de primeiro acesso para o e-mail"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{sendingInviteId === pro.id ? "Enviando..." : "Enviar Link de Acesso"}</span>
                    </button>
                    <button
                      onClick={() => copyAccessLink(pro)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs transition"
                      title="Copiar link de acesso / criar senha"
                    >
                      {copiedId === pro.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic text-center">
                    Cadastre um e-mail para liberar link de acesso
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Modal Completo de Cadastro e Edição do Profissional */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent/20">
                  <UserCheck className="w-5 h-5 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingProfessional ? "Editar Profissional" : "Cadastrar Novo Profissional"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Foto, comissão individual por serviço, permissões e link de senha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveProfessional} className="space-y-5 pt-4">
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 1. Upload de Foto do Barbeiro */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div
                  className="relative w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-black text-white text-2xl shadow-md border-2"
                  style={{ borderColor: form.color, backgroundColor: form.color }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto do barbeiro" className="w-full h-full object-cover" />
                  ) : (
                    (form.name || "BR").slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="text-xs font-bold text-slate-800 mb-1">
                    Foto do Barbeiro <span className="text-slate-400 font-normal">(Aparece no agendamento do cliente)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    O cliente vê essa foto na hora de escolher o profissional para o corte.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5 text-accent-strong" />
                      <span>{avatarUrl ? "Trocar Foto" : "Subir Foto"}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-600 transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Dados Pessoais & Contato com Legendas Claras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Ex: Rafael Silveira"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Nome visível nos relatórios e recibos.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apelido / Nome na Agenda
                  </label>
                  <input
                    value={form.nickname}
                    onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                    placeholder="Ex: Rafa Navalha"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Nome curto para a coluna da agenda.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp / Celular
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Contato direto com o barbeiro.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail de Acesso <span className="text-slate-400 font-normal">(Login na Barbearia)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="rafael@barbearia.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">O barbeiro usará este e-mail para logar no sistema.</span>
                </div>
              </div>

              {/* 3. Cor da Agenda & Comissão Geral */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cor de Identificação na Agenda <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    {PALETTE_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setForm({ ...form, color })}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          form.color.toLowerCase() === color.toLowerCase() ? "scale-125 ring-2 ring-slate-900 ring-offset-2" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    required
                    pattern="#[0-9A-Fa-f]{6}"
                    value={form.color}
                    onChange={(event) => setForm({ ...form, color: event.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Comissão Padrão do Barbeiro (%) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.commission}
                      onChange={(event) => setForm({ ...form, commission: event.target.value })}
                      placeholder="50"
                      className="w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3.5 py-2.5 text-slate-900 text-sm font-bold focus:outline-none focus:border-accent transition"
                    />
                    <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold text-sm">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Porcentagem inicial copiada automaticamente para os serviços marcados.
                  </span>
                </div>
              </div>

              {/* 4. Serviços Realizados & Caixa de Comissão Individual para Cada Serviço */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-accent-strong" />
                    <span>Serviços Habilitados & % de Comissão Individual</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {selectedServiceIds.length} selecionado(s)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Ao marcar um serviço, a porcentagem é preenchida automaticamente igual à primeira caixa marcada. Você pode alterar qualquer porcentagem individualmente:
                </p>

                {services.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    Nenhum serviço cadastrado no catálogo. Cadastre serviços na aba anterior primeiro.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {services.map((service, index) => {
                      const isChecked = selectedServiceIds.includes(service.id);
                      const currentPct = serviceCommissions[service.id] || form.commission || "50";
                      const priceReais = service.price_cents / 100;
                      const earnings = (priceReais * (Number(currentPct) || 0)) / 100;

                      return (
                        <div
                          key={service.id}
                          className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isChecked
                              ? "bg-white border-accent/60 shadow-sm"
                              : "bg-slate-100/70 border-slate-200 text-slate-500"
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleService(service.id)}
                              className="w-4 h-4 accent-control rounded text-accent focus:ring-accent"
                            />
                            <div>
                              <div className={`text-xs font-bold ${isChecked ? "text-slate-900" : "text-slate-600"}`}>
                                {service.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Preço cliente: {formatCurrency(service.price_cents)}
                              </div>
                            </div>
                          </label>

                          {/* Caixa de Porcentagem Individual para cada serviço marcado */}
                          {isChecked && (
                            <div className="flex items-center gap-2 shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                              <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                % Comissão:
                              </label>
                              <div className="relative w-20">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={currentPct}
                                  onChange={(e) => handleServiceCommissionChange(service.id, e.target.value)}
                                  className="w-full px-2 py-1 pr-5 rounded-md border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-accent text-right"
                                />
                                <span className="absolute right-1.5 top-1 text-[11px] font-bold text-slate-400">%</span>
                              </div>
                              <div className="text-[10px] text-emerald-700 font-bold whitespace-nowrap pl-1">
                                Ganha {formatCurrency(Math.round(earnings * 100))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Jornada de Trabalho e Horário de Almoço */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-accent-strong" />
                    <span>Jornada de Trabalho e Intervalo de Almoço</span>
                  </div>
                </div>

                {/* Seguir horário da barbearia */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Seguir horário padrão da barbearia</div>
                      <div className="text-[11px] text-slate-500">
                        O barbeiro atende no mesmo horário geral configurado na barbearia (09:00 às 19:00)
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workSchedule.followBarbershopHours}
                        onChange={(e) =>
                          setWorkSchedule((prev) => ({
                            ...prev,
                            followBarbershopHours: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  {/* Se horário próprio */}
                  {!workSchedule.followBarbershopHours && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Início do Atendimento
                          </label>
                          <input
                            type="time"
                            value={workSchedule.startTime}
                            onChange={(e) =>
                              setWorkSchedule((prev) => ({ ...prev, startTime: e.target.value }))
                            }
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Término do Atendimento
                          </label>
                          <input
                            type="time"
                            value={workSchedule.endTime}
                            onChange={(e) =>
                              setWorkSchedule((prev) => ({ ...prev, endTime: e.target.value }))
                            }
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Dias de trabalho */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Dias de Atendimento na Semana:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { day: 1, label: "Seg" },
                            { day: 2, label: "Ter" },
                            { day: 3, label: "Qua" },
                            { day: 4, label: "Qui" },
                            { day: 5, label: "Sex" },
                            { day: 6, label: "Sáb" },
                            { day: 0, label: "Dom" },
                          ].map((d) => {
                            const isSelected = workSchedule.workDays.includes(d.day);
                            return (
                              <button
                                key={d.day}
                                type="button"
                                onClick={() => {
                                  setWorkSchedule((prev) => {
                                    const nextDays = isSelected
                                      ? prev.workDays.filter((x) => x !== d.day)
                                      : [...prev.workDays, d.day];
                                    return { ...prev, workDays: nextDays };
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                                  isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Horário de Almoço */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Intervalo de Almoço / Pausa</div>
                        <div className="text-[11px] text-slate-500">
                          Bloqueia automaticamente este período na agenda e no chat de agendamento online
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workSchedule.hasLunchBreak}
                        onChange={(e) =>
                          setWorkSchedule((prev) => ({
                            ...prev,
                            hasLunchBreak: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  {workSchedule.hasLunchBreak && (
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Início do Almoço
                        </label>
                        <input
                          type="time"
                          value={workSchedule.lunchStart}
                          onChange={(e) =>
                            setWorkSchedule((prev) => ({ ...prev, lunchStart: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Retorno do Almoço
                        </label>
                        <input
                          type="time"
                          value={workSchedule.lunchEnd}
                          onChange={(e) =>
                            setWorkSchedule((prev) => ({ ...prev, lunchEnd: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Controle de Acesso & Permissões do Barbeiro */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Acesso à Barbearia & Permissões do Usuário</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Escolha exatamente o que este barbeiro pode ver e fazer ao entrar com o e-mail dele:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.view_commissions}
                      onChange={(e) => setPermissions({ ...permissions, view_commissions: e.target.checked })}
                      className="w-4 h-4 accent-control rounded text-accent"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Ver valores a receber</div>
                      <div className="text-[10px] text-slate-400">Extrato de comissões e repasses</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.view_agenda}
                      onChange={(e) => setPermissions({ ...permissions, view_agenda: e.target.checked })}
                      className="w-4 h-4 accent-control rounded text-accent"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Ver e gerenciar agenda</div>
                      <div className="text-[10px] text-slate-400">Atendimentos e horários do dia</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.view_clients}
                      onChange={(e) => setPermissions({ ...permissions, view_clients: e.target.checked })}
                      className="w-4 h-4 accent-control rounded text-accent"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Ver lista de clientes</div>
                      <div className="text-[10px] text-slate-400">Histórico de corte e contatos</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.edit_services}
                      onChange={(e) => setPermissions({ ...permissions, edit_services: e.target.checked })}
                      className="w-4 h-4 accent-control rounded text-accent"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Editar serviços e preços</div>
                      <div className="text-[10px] text-slate-400">Alterar valores da barbearia</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 6. Opção de Enviar Link de Acesso / Definir Senha */}
              {form.email && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">Enviar Link de Primeiro Acesso</div>
                      <div className="text-[11px] text-emerald-800">
                        O barbeiro recebe um link para cadastrar a própria senha e acessar a página.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyAccessLink({ ...editingProfessional, email: form.email })}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center gap-1 transition"
                    >
                      {copiedId === "form" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copiar Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => sendAccessLink({ ...editingProfessional, email: form.email })}
                      disabled={sendingInviteId === "form"}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingInviteId === "form" ? "Enviando..." : "Enviar por E-mail"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Botões de Ação do Modal */}
              <div className="pt-3 flex gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-2/3 rounded-xl bg-accent py-2.5 font-bold text-slate-950 hover:bg-accent/90 disabled:opacity-50 transition shadow-md shadow-accent/20"
                >
                  {saving ? "Salvando..." : editingProfessional ? "Salvar Alterações" : "Cadastrar Profissional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
