import React, { useState } from "react";
import { Users, Search, Phone, Calendar, Plus, MessageSquare, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";

export const ClientsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const [clients, setClients] = useState([
    {
      id: "c1",
      name: "Rodrigo Almeida",
      phone: "11988887777",
      totalAppointments: 18,
      totalSpentCents: 89000,
      lastAppointment: "Hoje às 09:30",
      notes: "Prefere máquina 1 na lateral e navalha na barba.",
    },
    {
      id: "c2",
      name: "Felipe Rodrigues",
      phone: "11977776666",
      totalAppointments: 9,
      totalSpentCents: 38500,
      lastAppointment: "Hoje às 11:00",
      notes: "Cliente de agendamento recorrente quinzenal.",
    },
    {
      id: "c3",
      name: "Guilherme Santos",
      phone: "11966665555",
      totalAppointments: 12,
      totalSpentCents: 62000,
      lastAppointment: "Ontem às 16:00",
      notes: "Corta sempre com Carlos Barbeiro.",
    },
    {
      id: "c4",
      name: "Eduardo Lima",
      phone: "11955554444",
      totalAppointments: 4,
      totalSpentCents: 18000,
      lastAppointment: "28/08/2026",
      notes: "",
    },
    {
      id: "c5",
      name: "André Souza",
      phone: "11944443333",
      totalAppointments: 24,
      totalSpentCents: 115000,
      lastAppointment: "15/08/2026",
      notes: "Cliente VIP, gosta de café expresso ao chegar.",
    },
  ]);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm.replace(/\D/g, ""))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
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

      {/* Clients Table */}
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
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{client.name}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {formatPhone(client.phone)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
                      {client.totalAppointments} atendimentos
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {formatCurrency(client.totalSpentCents)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">{client.lastAppointment}</td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs max-w-xs truncate">
                    {client.notes || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`https://wa.me/55${client.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
