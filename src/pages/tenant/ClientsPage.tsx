import React, { useEffect, useMemo, useState } from "react";
import { Search, Phone } from "lucide-react";
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

  useEffect(() => {
    if (!tenant?.id) {
      setClients([]);
      setLoading(false);
      return;
    }

    const loadClients = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, total_appointments, total_spent_cents, last_appointment_at, notes")
        .eq("tenant_id", tenant.id)
        .order("name", { ascending: true });

      if (!error) setClients((data || []) as ClientRow[]);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Base de Clientes</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Deduplicação automática por WhatsApp • Reconhecimento em retorno no chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nome ou celular..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500 w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
                        {client.total_appointments} atendimentos
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(client.total_spent_cents)}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {client.last_appointment_at ? new Date(client.last_appointment_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs max-w-xs truncate">{client.notes || "—"}</td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
