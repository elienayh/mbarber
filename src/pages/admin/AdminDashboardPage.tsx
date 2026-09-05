import React from "react";
import { Building2, CreditCard, Users, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const AdminDashboardPage: React.FC = () => {
  const platformStats = {
    totalTenants: 142,
    activeTenants: 118,
    trialTenants: 19,
    suspendedTenants: 5,
    mrrCents: 1121000, // R$ 11.210,00 MRR
    churnRate: "1.4%",
    newThisMonth: 16,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Métricas Globais da Plataforma</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Administração SaaS MetricBarber • Faturamento via Stripe & Supabase RLS
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Receita Recorrente (MRR)</div>
          <div className="text-2xl font-black text-white mt-1">
            {formatCurrency(platformStats.mrrCents)}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +14,2% neste mês
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Total de Barbearias</div>
          <div className="text-2xl font-black text-white mt-1">{platformStats.totalTenants}</div>
          <div className="text-xs text-slate-400 mt-1">{platformStats.newThisMonth} novos cadastros</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Contas Ativas (Pagas)</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{platformStats.activeTenants}</div>
          <div className="text-xs text-slate-400 mt-1">{platformStats.trialTenants} barbearias em Trial</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Taxa de Churn (Cancelamento)</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{platformStats.churnRate}</div>
          <div className="text-xs text-slate-400 mt-1">Abaixo da média de mercado</div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h3 className="font-bold text-white text-base">Alertas & Ações Críticas Recentes</h3>
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Barbearia Navalha Nobre entrou em Past Due (falha na cobrança Stripe). Período de tolerância ativo.</span>
            </div>
            <button className="font-bold underline hover:text-amber-300">Ver Tenant</button>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Barbearia Dom Pedro concluiu o Trial e assinou o Plano Pro (R$ 79,00/mês).</span>
            </div>
            <span className="text-slate-400">Há 2 horas</span>
          </div>
        </div>
      </div>
    </div>
  );
};
