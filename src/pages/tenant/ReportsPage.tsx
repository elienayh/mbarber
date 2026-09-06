import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, Users, Scissors, Award, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const ReportsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadReports = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await (supabase.from("appointments") as any)
        .select("price_cents, commission_cents, service_id, professional_id, services(name), professionals(name, nickname)")
        .eq("tenant_id", tenant.id)
        .gte("start_time", since.toISOString())
        .neq("status", "canceled");
      setAppointments(data || []);
    };

    loadReports();
  }, [tenant?.id]);

  const reportData = useMemo(() => {
    const services = new Map<string, { name: string; count: number; revenue: number }>();
    const professionals = new Map<string, { name: string; nickname: string | null; appointments: number; revenue: number; commission: number }>();

    appointments.forEach((appointment) => {
      const serviceKey = appointment.service_id;
      const service = services.get(serviceKey) || { name: appointment.services?.name || "Serviço", count: 0, revenue: 0 };
      service.count += 1;
      service.revenue += Number(appointment.price_cents || 0);
      services.set(serviceKey, service);

      const professionalKey = appointment.professional_id;
      const professional = professionals.get(professionalKey) || {
        name: appointment.professionals?.name || "Profissional",
        nickname: appointment.professionals?.nickname || null,
        appointments: 0,
        revenue: 0,
        commission: 0,
      };
      professional.appointments += 1;
      professional.revenue += Number(appointment.price_cents || 0);
      professional.commission += Number(appointment.commission_cents || 0);
      professionals.set(professionalKey, professional);
    });

    const topServices = Array.from(services.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    const maxCount = Math.max(...topServices.map((service) => service.count), 1);
    return {
      topServices: topServices.map((service) => ({ ...service, share: Math.round((service.count / maxCount) * 100) })),
      professionals: Array.from(professionals.values()).sort((a, b) => b.revenue - a.revenue),
    };
  }, [appointments]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">Relatórios & Inteligência</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Desempenho por barbeiro, serviços mais lucrativos e retenção de clientes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Services */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Serviços Mais Vendidos</h3>
            <span className="text-xs text-slate-400">Últimos 30 dias</span>
          </div>

          <div className="space-y-3">
            {reportData.topServices.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800">{s.name} ({s.count}x)</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(s.revenue)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${s.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Barbers Productivity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Produtividade da Equipe</h3>
            <span className="text-xs text-slate-400">Atendimentos no Mês</span>
          </div>

          <div className="space-y-4">
            {reportData.professionals.map((b) => (
              <div key={b.name} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                  <div className="text-slate-500">{b.appointments} clientes atendidos</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{formatCurrency(b.revenue)}</div>
                  <div className="text-emerald-700 font-semibold">Comissão: {formatCurrency(b.commission)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
