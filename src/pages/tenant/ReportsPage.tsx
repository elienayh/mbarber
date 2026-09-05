import React from "react";
import { BarChart3, TrendingUp, Users, Scissors, Award, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const ReportsPage: React.FC = () => {
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
            {[
              { name: "Corte Tradicional / Degradê", count: 184, share: 58, revenue: 828000 },
              { name: "Combo Cabelo + Barba Completa", count: 76, share: 24, revenue: 532000 },
              { name: "Barba Terapia com Toalha Quente", count: 42, share: 13, revenue: 147000 },
              { name: "Acabamento / Sobrancelha", count: 16, share: 5, revenue: 32000 },
            ].map((s) => (
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
            {[
              { name: "João Silva", nickname: "Navalha", appointments: 138, revenue: 685000, commission: 342500 },
              { name: "Carlos Barbeiro", nickname: "Mestre", appointments: 112, revenue: 590000, commission: 295000 },
              { name: "Lucas Ferreira", nickname: "Freestyle", appointments: 68, revenue: 310000, commission: 139500 },
            ].map((b) => (
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
