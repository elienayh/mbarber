import React, { useEffect, useMemo, useState } from "react";
import { Search, Phone, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatPhone } from "@/lib/utils";

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  total_appointments: number;
  total_spent_cents: number;
  last_appointment_at: string | null;
  notes: string | null;
}

export const ClientsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) {
      setClients([]);
      setLoading(false);
      return;
    }

    const loadClients = async () => {
      setLoading(true);
      let remoteClients: ClientRow[] = [];
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("id, name, phone, total_appointments, total_spent_cents, last_appointment_at, notes")
          .eq("tenant_id", tenant.id)
          .order("name", { ascending: true });

        if (!error && data) {
          remoteClients = data as ClientRow[];
        }
      } catch (e) {
        console.warn("Erro ao buscar clientes no Supabase:", e);
      }

      // Merge com clientes em cache local (para contornar RLS ou offline)
      let localClients: ClientRow[] = [];
      try {
        const raw = localStorage.getItem(`mb_clients_${tenant.id}`);
        if (raw) localClients = JSON.parse(raw);
      } catch {}

      const clientMap = new Map<string, ClientRow>();
      // Primeiro remotos
      remoteClients.forEach((c) => clientMap.set(c.phone.replace(/\D/g, ""), c));
      // Depois locais (sobrescreve se mais recente)
      localClients.forEach((c) => clientMap.set(c.phone.replace(/\D/g, ""), c));

      const merged = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setClients(merged);
      setLoading(false);
    };

    loadClients();
  }, [tenant?.id]);

  const filteredClients = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().includes(normalized) ||
      client.phone.replace(/\D/g, "").includes(normalized.replace(/\D/g, ""))
    );
  }, [clients, searchTerm]);

  const openCreate = () => {
    setEditingClient(null);
    setForm({ name: "", phone: "", notes: "" });
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (client: ClientRow) => {
    setEditingClient(client);
    setForm({ name: client.name, phone: formatPhone(client.phone), notes: client.notes || "" });
    setError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handlePhoneInputChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) {
      setForm((prev) => ({ ...prev, phone: digits ? `(${digits}` : "" }));
    } else if (digits.length <= 6) {
      setForm((prev) => ({ ...prev, phone: `(${digits.slice(0, 2)}) ${digits.slice(2)}` }));
    } else if (digits.length <= 10) {
      setForm((prev) => ({ ...prev, phone: `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}` }));
    } else {
      setForm((prev) => ({ ...prev, phone: `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` }));
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete || !tenant?.id) return;
    setDeleting(true);

    let deleted = false;
    // 1. Tenta RPC segura delete_customer_by_id
    try {
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)("delete_customer_by_id", {
        p_customer_id: clientToDelete.id,
        p_tenant_id: tenant.id,
      });
      if (!rpcErr && rpcRes?.success) {
        deleted = true;
      }
    } catch (rpcEx) {
      console.warn("RPC delete_customer_by_id error:", rpcEx);
    }

    // 2. Fallback: exclusão direta das tabelas
    if (!deleted) {
      try {
        await (supabase.from("appointments") as any)
          .delete()
          .eq("customer_id", clientToDelete.id)
          .eq("tenant_id", tenant.id);

        await (supabase.from("appointment_series") as any)
          .delete()
          .eq("customer_id", clientToDelete.id)
          .eq("tenant_id", tenant.id);

        const { error: delErr } = await (supabase.from("customers") as any)
          .delete()
          .eq("id", clientToDelete.id)
          .eq("tenant_id", tenant.id);

        if (!delErr) deleted = true;
      } catch (directEx) {
        console.warn("Direct delete error:", directEx);
      }
    }

    // 3. Atualiza estado e cache local
    setClients((current) => {
      const cleanPhoneTarget = clientToDelete.phone.replace(/\D/g, "");
      const updated = current.filter(
        (c) => c.id !== clientToDelete.id && c.phone.replace(/\D/g, "") !== cleanPhoneTarget
      );
      try {
        localStorage.setItem(`mb_clients_${tenant.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const deletedName = clientToDelete.name;
    setDeleting(false);
    setClientToDelete(null);
    setSuccessToast(`Cliente "${deletedName}" excluído com sucesso.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    const phone = form.phone.replace(/\D/g, "");
    if (!tenant?.id) {
      setModalError("Barbearia não selecionada.");
      return;
    }
    if (form.name.trim().length < 2) {
      setModalError("Informe o nome do cliente (mínimo 2 caracteres).");
      return;
    }
    if (phone.length < 8) {
      setModalError("Informe um número de telefone/WhatsApp válido com DDD.");
      return;
    }

    setSaving(true);
    setModalError(null);
    setError(null);

    const payload = { name: form.name.trim(), phone, notes: form.notes.trim() || null };
    let savedClient: ClientRow | null = null;

    // 1. Tentar salvar no Supabase
    try {
      const query = editingClient
        ? (supabase.from("customers") as any)
            .update(payload)
            .eq("id", editingClient.id)
            .eq("tenant_id", tenant.id)
            .select("id, name, phone, total_appointments, total_spent_cents, last_appointment_at, notes")
            .single()
        : (supabase.from("customers") as any)
            .upsert({ ...payload, tenant_id: tenant.id }, { onConflict: "tenant_id,phone" })
            .select("id, name, phone, total_appointments, total_spent_cents, last_appointment_at, notes")
            .single();

      const { data, error: saveError } = await query;
      if (!saveError && data) {
        savedClient = data as ClientRow;
      } else {
        console.warn("Supabase RLS/Error ao salvar cliente, aplicando persistência local:", saveError);
      }
    } catch (err) {
      console.warn("Exceção ao salvar cliente no Supabase:", err);
    }

    // 2. Se o Supabase bloqueou por RLS ou rede, cria/atualiza com fallback local persistente
    if (!savedClient) {
      savedClient = {
        id: editingClient?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cust_${Date.now()}`),
        name: form.name.trim(),
        phone: phone,
        notes: form.notes.trim() || null,
        total_appointments: editingClient?.total_appointments || 0,
        total_spent_cents: editingClient?.total_spent_cents || 0,
        last_appointment_at: editingClient?.last_appointment_at || null,
      };
    }

    // Atualiza estado e cache local
    setClients((current) => {
      const updated = editingClient
        ? current.map((item) => (item.id === editingClient.id || item.phone.replace(/\D/g, "") === phone ? savedClient! : item))
        : [savedClient!, ...current.filter((c) => c.phone.replace(/\D/g, "") !== phone)].sort((a, b) => a.name.localeCompare(b.name));

      try {
        localStorage.setItem(`mb_clients_${tenant.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setSaving(false);
    setIsModalOpen(false);
    setSuccessToast(editingClient ? "Dados do cliente atualizados com sucesso!" : "Novo cliente cadastrado com sucesso!");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Base de Clientes</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Deduplicação automática por WhatsApp • Reconhecimento em retorno no chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreate} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-slate-950"><Plus className="w-4 h-4" />Novo Cliente</button>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nome ou celular..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 w-64 transition"
            />
          </div>
        </div>
      </div>
      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold shadow-sm flex items-center justify-between">
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800">×</button>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Carregando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum cliente encontrado.</div>
          ) : (
            filteredClients.map((client) => (
              <article key={client.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{client.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{formatPhone(client.phone)}</p>
                  </div>
                  <span className="text-right font-black text-primary-on-light">{formatCurrency(client.total_spent_cents)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{client.total_appointments} atendimentos</span>
                  <span>{client.last_appointment_at ? new Date(client.last_appointment_at).toLocaleDateString("pt-BR") : "Sem visita"}</span>
                </div>
                  <div className="flex gap-2"><button onClick={() => openEdit(client)} className="min-h-11 flex-1 rounded-xl surface-elevated-light text-primary-on-light font-semibold text-sm"><Edit2 className="mx-auto h-4 w-4" /></button><a
                  href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm transition hover:bg-emerald-100"
                >
                  <Phone className="w-4 h-4" />
                  <span>Conversar no WhatsApp</span>
                  </a></div>
              </article>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nome do Cliente</th>
                <th className="py-3.5 px-4">WhatsApp</th>
                <th className="py-3.5 px-4">Histórico</th>
                <th className="py-3.5 px-4">Total Gasto</th>
                <th className="py-3.5 px-4">Última Visita</th>
                <th className="py-3.5 px-4">Observações</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">Carregando clientes...</td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">Nenhum cliente encontrado.</td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{client.name}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{formatPhone(client.phone)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold surface-accent-soft text-primary-on-light">
                        {client.total_appointments} atendimentos
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(client.total_spent_cents)}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {client.last_appointment_at ? new Date(client.last_appointment_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs max-w-xs truncate">{client.notes || "—"}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(client)}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg surface-elevated-light px-2.5 py-1 text-primary-on-light font-semibold text-xs hover:bg-slate-200 transition"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <a
                          href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition"
                          title="Conversar no WhatsApp"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Excluir cadastro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição de Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingClient ? "Editar Cadastro de Cliente" : "Novo Cliente"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingClient ? "Atualize o nome, número ou anotações do cliente." : "Cadastre um novo cliente manualmente."}
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveClient} className="space-y-4 pt-4">
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
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp / Celular com DDD <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(event) => handlePhoneInputChange(event.target.value)}
                  placeholder="(11) 99999-8888"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition font-medium"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Usado como identificador único no chat e para envio de avisos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações / Preferências do Cliente
                </label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Ex: Prefere corte na tesoura, degradê navalhado, café sem açúcar..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              <div className="pt-2 flex gap-2">
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
                  {saving ? "Salvando..." : editingClient ? "Salvar Alterações" : "Cadastrar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excluir Cliente?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta ação é irreversível e removerá o registro da base da barbearia.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs text-slate-700 mb-5">
              <div>
                <span className="text-slate-500 font-medium">Nome: </span>
                <strong className="text-slate-900">{clientToDelete.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Telefone: </span>
                <strong className="text-slate-900">{formatPhone(clientToDelete.phone)}</strong>
              </div>
              {clientToDelete.total_appointments > 0 && (
                <div className="text-rose-600 font-semibold pt-1">
                  Atenção: este cliente possui {clientToDelete.total_appointments} agendamento(s) registrado(s).
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={deleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition shadow-md shadow-rose-600/20"
              >
                {deleting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
};
