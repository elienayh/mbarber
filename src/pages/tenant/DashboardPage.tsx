import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatPhone } from "@/lib/utils";

interface DashboardAppointment {
  id: string;
  start_time: string;
  status: string;
  price_cents: number;
  customers: { name: string; phone: string } | null;
  services: { name: string } | null;
  professionals: { name: string } | null;
}

export const DashboardPage: React.FC = () => {
  const { tenant } = useAuth();
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const loadAppointments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, status, price_cents, customers(name, phone), services(name), professionals(name)")
        .eq("tenant_id", tenant.id)
        .gte("start_time", startOfDay)
        .lt("start_time", endOfDay)
        .order("start_time", { ascending: true });

      if (!error) {
        setAppointments((data || []) as DashboardAppointment[]);
      }
      setLoading(false);
    };

    loadAppointments();
  }, [tenant?.id]);

  const stats = useMemo(() => {
    const totalAppointments = appointments.length;
    const completed = appointments.filter((a) => a.status === "completed").length;
    const projectedRevenue = appointments
      .filter((a) => !["canceled", "no_show"].includes(a.status))
      .reduce((sum, a) => sum + Number(a.price_cents || 0), 0);
    const occupancyRate = totalAppointments > 0 ? `${Math.min(100, Math.round((completed / totalAppointments) * 100))}%` : "0%";

    return { totalAppointments, completed, occupancyRate, projectedRevenue };
  }, [appointments]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Operação de Hoje</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} • Agenda em tempo real
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Atendimentos Hoje</div>
            <div className="text-2xl font-black text-slate-900">{loading ? "..." : stats.totalAppointments}</div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">{stats.totalAppointments > 0 ? `${stats.totalAppointments} compromissos no dia` : "Nenhum agendamento encontrado"}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Faturamento Previsto</div>
            <div className="text-2xl font-black text-slate-900">{formatCurrency(stats.projectedRevenue)}</div>
            <div className="text-xs text-slate-400 mt-0.5">Baseado nos agendamentos do dia</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Ocupação das Cadeiras</div>
            <div className="text-2xl font-black text-slate-900">{stats.occupancyRate}</div>
            <div className="text-xs text-amber-600 font-medium mt-0.5">{stats.totalAppointments > 0 ? "Atualizado em tempo real" : "Sem dados de ocupação"}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Finalizados</div>
            <div className="text-2xl font-black text-slate-900">{loading ? "..." : `${stats.completed} de ${stats.totalAppointments}`}</div>
            <div className="text-xs text-purple-600 font-medium mt-0.5">{stats.completed === 0 ? "Nenhum atendimento concluído hoje" : "Hoje"}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">Próximos Clientes do Dia</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">{loading ? "Carregando..." : "Sincronização em tempo real ativa"}</span>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    Nenhum agendamento encontrado para hoje.
                  </td>
                </tr>
              ) : (
                appointments.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-base">
                      {new Date(app.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{app.customers?.name || "Cliente"}</div>
                      <div className="text-xs text-slate-400">{formatPhone(app.customers?.phone || "")}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{app.services?.name || "Serviço"}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {app.professionals?.name || "Profissional"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(Number(app.price_cents || 0))}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(app.status)}</td>
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
