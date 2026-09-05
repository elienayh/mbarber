import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Scissors,
  Phone,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";

export const DashboardPage: React.FC = () => {
  const [appointments, setAppointments] = useState([
    {
      id: "a1",
      time: "09:30",
      customer: "Marcos Vinicius",
      phone: "11988887777",
      service: "Corte Degradê",
      barber: "João Silva",
      price_cents: 4500,
      status: "completed",
    },
    {
      id: "a2",
      time: "10:30",
      customer: "Guilherme Santos",
      phone: "11977776666",
      service: "Combo Cabelo + Barba",
      barber: "Carlos Barbeiro",
      price_cents: 7000,
      status: "in_progress",
    },
    {
      id: "a3",
      time: "11:15",
      customer: "Felipe Rodrigues",
      phone: "11966665555",
      service: "Barboterapia",
      barber: "João Silva",
      price_cents: 3500,
      status: "confirmed",
    },
    {
      id: "a4",
      time: "13:00",
      customer: "Eduardo Lima",
      phone: "11955554444",
      service: "Corte Tradicional",
      barber: "Lucas Ferreira",
      price_cents: 4500,
      status: "scheduled",
    },
    {
      id: "a5",
      time: "14:00",
      customer: "André Souza",
      phone: "11944443333",
      service: "Corte Degradê",
      barber: "Carlos Barbeiro",
      price_cents: 4500,
      status: "scheduled",
    },
  ]);

  const handleUpdateStatus = (id: string, newStatus: string) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );
  };

  const stats = {
    totalAppointments: 14,
    completed: appointments.filter((a) => a.status === "completed").length,
    occupancyRate: "78%",
    projectedRevenue: 72000,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Concluído</span>;
      case "in_progress":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 animate-pulse">Na Cadeira</span>;
      case "confirmed":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Confirmado</span>;
      case "scheduled":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Agendado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Operação de Hoje</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Quinta-feira, 5 de Setembro • Agenda em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/agenda"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20 flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>Abrir Agenda Completa</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Atendimentos Hoje</div>
            <div className="text-2xl font-black text-slate-900">{stats.totalAppointments}</div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">5 confirmados pelo chat</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Faturamento Previsto</div>
            <div className="text-2xl font-black text-slate-900">{formatCurrency(stats.projectedRevenue)}</div>
            <div className="text-xs text-slate-400 mt-0.5">Média de R$ 51,40 / cliente</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Ocupação das Cadeiras</div>
            <div className="text-2xl font-black text-slate-900">{stats.occupancyRate}</div>
            <div className="text-xs text-amber-600 font-medium mt-0.5">3 barbeiros em escala</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Finalizados</div>
            <div className="text-2xl font-black text-slate-900">{stats.completed} de {stats.totalAppointments}</div>
            <div className="text-xs text-purple-600 font-medium mt-0.5">Sem faltas registradas</div>
          </div>
        </div>
      </div>

      {/* Main Table: Next Appointments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">Próximos Clientes do Dia</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Sincronização em tempo real ativa</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Horário</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Serviço</th>
                <th className="py-3.5 px-4">Barbeiro</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {appointments.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 text-base">{app.time}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{app.customer}</div>
                    <div className="text-xs text-slate-400">{formatPhone(app.phone)}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium">{app.service}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                      {app.barber}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(app.price_cents)}</td>
                  <td className="py-3.5 px-4">{getStatusBadge(app.status)}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {app.status === "scheduled" && (
                      <button
                        onClick={() => handleUpdateStatus(app.id, "confirmed")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                      >
                        Confirmar
                      </button>
                    )}
                    {app.status === "confirmed" && (
                      <button
                        onClick={() => handleUpdateStatus(app.id, "in_progress")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                      >
                        Iniciar Corte
                      </button>
                    )}
                    {app.status === "in_progress" && (
                      <button
                        onClick={() => handleUpdateStatus(app.id, "completed")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        Finalizar & Caixa
                      </button>
                    )}
                    <a
                      href={`https://wa.me/55${app.phone}?text=${encodeURIComponent(
                        `Olá ${app.customer}! Confirmamos seu horário às ${app.time} na Barbearia Vintage Club.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 inline-flex rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                      title="Abrir WhatsApp"
                    >
                      <Phone className="w-4 h-4" />
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
