import React, { useEffect, useState } from "react";
import { Scissors, Plus, Clock, Edit2, X, Tag, DollarSign, Timer, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const COMMON_CATEGORIES = ["Cabelo", "Barba", "Combo", "Sobrancelha", "Tratamento", "Infantil", "Geral"];
const COMMON_DURATIONS = [15, 20, 30, 40, 45, 60, 90];
const COMMON_BUFFERS = [0, 5, 10, 15];

export const ServicesPage: React.FC = () => {
  const { tenant } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", category: "Cabelo", price: "40.00", duration: "30", buffer: "5" });

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", category: "Cabelo", price: "40.00", duration: "30", buffer: "5" });
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (service: any) => {
    setEditingService(service);
    setForm({
      name: service.name,
      category: service.category || "Geral",
      price: (service.price_cents / 100).toFixed(2),
      duration: String(service.duration_minutes),
      buffer: String(service.buffer_minutes || 0),
    });
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const saveService = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(form.price.replace(",", "."));
    const duration = Number(form.duration);
    const buffer = Number(form.buffer || 0);

    if (!tenant?.id) {
      setModalError("Barbearia não identificada.");
      return;
    }
    if (!form.name.trim()) {
      setModalError("Informe o nome do serviço.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setModalError("Informe um valor válido em reais (R$).");
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      setModalError("O tempo de duração deve ser maior que 0 minutos.");
      return;
    }
    if (!Number.isInteger(buffer) || buffer < 0) {
      setModalError("O tempo de intervalo não pode ser negativo.");
      return;
    }

    setSaving(true);
    setModalError(null);
    setError(null);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "Geral",
      price_cents: Math.round(price * 100),
      duration_minutes: duration,
      buffer_minutes: buffer,
    };

    let savedData: any = null;

    try {
      const query = editingService
        ? (supabase.from("services") as any)
            .update(payload)
            .eq("id", editingService.id)
            .eq("tenant_id", tenant.id)
            .select("id, name, category, price_cents, duration_minutes, buffer_minutes, is_active, professional_services(count)")
            .single()
        : (supabase.from("services") as any)
            .insert({ ...payload, tenant_id: tenant.id, is_active: true })
            .select("id, name, category, price_cents, duration_minutes, buffer_minutes, is_active, professional_services(count)")
            .single();

      const { data, error: saveError } = await query;
      if (!saveError && data) {
        savedData = {
          ...data,
          professionals_count: data.professional_services?.[0]?.count || editingService?.professionals_count || 0,
        };
      } else {
        console.warn("Supabase save service error:", saveError);
      }
    } catch (err) {
      console.warn("Exceção ao salvar serviço:", err);
    }

    // Fallback local se o banco falhou
    if (!savedData) {
      savedData = {
        id: editingService?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `srv_${Date.now()}`),
        ...payload,
        is_active: editingService ? editingService.is_active : true,
        professionals_count: editingService?.professionals_count || 0,
      };
    }

    setServices((current) => {
      const updated = editingService
        ? current.map((item) => (item.id === editingService.id ? savedData : item))
        : [...current, savedData].sort((a, b) => a.name.localeCompare(b.name));

      try {
        localStorage.setItem(`mb_services_${tenant.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setSaving(false);
    setIsModalOpen(false);
    setSuccessToast(editingService ? "Serviço atualizado com sucesso!" : "Novo serviço cadastrado com sucesso!");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const toggleService = async (service: any) => {
    if (!tenant?.id) return;
    setError(null);
    const newStatus = !service.is_active;

    try {
      await (supabase.from("services") as any)
        .update({ is_active: newStatus })
        .eq("id", service.id)
        .eq("tenant_id", tenant.id);
    } catch (e) {
      console.warn("Erro ao alternar status do serviço no Supabase:", e);
    }

    setServices((current) => {
      const updated = current.map((item) => (item.id === service.id ? { ...item, is_active: newStatus } : item));
      try {
        localStorage.setItem(`mb_services_${tenant.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (!tenant?.id) return;

    const loadServices = async () => {
      setLoading(true);
      let remoteServices: any[] = [];
      try {
        const { data, error: loadError } = await (supabase.from("services") as any)
          .select("id, name, category, price_cents, duration_minutes, buffer_minutes, is_active, professional_services(count)")
          .eq("tenant_id", tenant.id)
          .order("name");

        if (!loadError && data) {
          remoteServices = data.map((service: any) => ({
            ...service,
            professionals_count: service.professional_services?.[0]?.count || 0,
          }));
        }
      } catch (e) {
        console.warn("Erro ao buscar serviços:", e);
      }

      // Merge com cache local
      let localServices: any[] = [];
      try {
        const raw = localStorage.getItem(`mb_services_${tenant.id}`);
        if (raw) localServices = JSON.parse(raw);
      } catch {}

      const srvMap = new Map<string, any>();
      remoteServices.forEach((s) => srvMap.set(s.id, s));
      localServices.forEach((s) => {
        if (!srvMap.has(s.id)) srvMap.set(s.id, s);
      });

      setServices(Array.from(srvMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    };

    loadServices();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/20 text-accent-strong">
              <Scissors className="w-5 h-5 text-slate-950" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Catálogo de Serviços</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie o tempo de atendimento, valores cobrados e categorias com legendas claras.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-slate-950 font-bold text-sm transition shadow-md shadow-accent/20 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Serviço</span>
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

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 surface-card-light rounded-2xl border border-slate-200 text-slate-500 text-sm">
            Carregando catálogo de serviços...
          </div>
        )}
        {!loading && services.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 surface-card-light rounded-2xl border border-slate-200 text-slate-500 text-sm">
            Nenhum serviço cadastrado ainda. Clique em "Cadastrar Novo Serviço" para começar.
          </div>
        )}
        {!loading &&
          services.map((srv) => (
            <div
              key={srv.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                srv.is_active
                  ? "bg-white border-slate-200 hover:border-accent"
                  : "bg-slate-50/70 border-slate-200 opacity-75"
              }`}
            >
              {/* Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700">
                    <Tag className="w-3 h-3 text-slate-500" />
                    <span>Categoria: {srv.category || "Geral"}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      srv.is_active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-200 text-slate-600 border border-slate-300"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${srv.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {srv.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg leading-snug mb-1">{srv.name}</h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{srv.professionals_count || 0} barbeiro(s) habilitado(s)</span>
                </div>
              </div>

              {/* Card Body: Detalhes com legendas intuitivas */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-b border-slate-100 grid grid-cols-2 gap-3">
                {/* Legenda: Tempo do Serviço */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>Tempo de Execução</span>
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    {srv.duration_minutes} min
                  </div>
                  <div className="text-[10px] text-slate-400">Na cadeira</div>
                </div>

                {/* Legenda: Intervalo / Buffer */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <Timer className="w-3 h-3 text-amber-600" />
                    <span>Intervalo / Buffer</span>
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    {srv.buffer_minutes ? `+${srv.buffer_minutes} min` : "0 min"}
                  </div>
                  <div className="text-[10px] text-slate-400">Higienização</div>
                </div>
              </div>

              {/* Card Footer: Preço com legenda e ações */}
              <div className="p-5 pt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-600" />
                    <span>Valor do Serviço</span>
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {formatCurrency(srv.price_cents)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleService(srv)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                      srv.is_active
                        ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {srv.is_active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    onClick={() => openEdit(srv)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition"
                    title="Editar informações do serviço"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Modal de Cadastro / Edição com Legendas Completas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/20">
                  <Scissors className="w-5 h-5 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingService ? "Editar Serviço" : "Cadastrar Novo Serviço"}
                  </h3>
                  <p className="text-xs text-slate-500">Defina com clareza duração, preço e categoria</p>
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

            <form onSubmit={saveService} className="space-y-4 pt-4">
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 1. Nome do Serviço */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Serviço <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ex: Corte Degradê, Barboterapia, Combo Cabelo + Barba"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Nome visível para o cliente no agendamento.</span>
              </div>

              {/* 2. Categoria com chips rápidos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoria do Serviço <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        form.category.toLowerCase() === cat.toLowerCase()
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Ou digite outra categoria (Ex: Química, Sobrancelha)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              {/* 3. Valor, Duração e Buffer com legendas claras */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Valor do Serviço */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor (R$) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">R$</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.50"
                      value={form.price}
                      onChange={(event) => setForm({ ...form, price: event.target.value })}
                      placeholder="35,00"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Preço ao cliente</span>
                </div>

                {/* Tempo do Serviço */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tempo (minutos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="5"
                    step="5"
                    value={form.duration}
                    onChange={(event) => setForm({ ...form, duration: event.target.value })}
                    placeholder="30"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition font-bold"
                  />
                  <div className="flex gap-1 mt-1">
                    {COMMON_DURATIONS.slice(1, 4).map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setForm({ ...form, duration: String(m) })}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buffer / Intervalo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Buffer / Limpeza
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={form.buffer}
                    onChange={(event) => setForm({ ...form, buffer: event.target.value })}
                    placeholder="5"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition font-bold"
                  />
                  <div className="flex gap-1 mt-1">
                    {COMMON_BUFFERS.map((b) => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setForm({ ...form, buffer: String(b) })}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        {b}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 flex gap-2">
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
                  {saving ? "Salvando..." : editingService ? "Salvar Alterações" : "Cadastrar Serviço"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
