import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  mrrCents: number;
  churnRate: string;
  newThisMonth: number;
}

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats>({
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    suspendedTenants: 0,
    mrrCents: 0,
    churnRate: "0%",
    newThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlatformStats = async () => {
      const { data: tenantsData, error: tenantsError } = await (supabase.from("tenants") as any)
        .select("id, status, created_at");

      const { data: subscriptionsData, error: subscriptionsError } = await (supabase.from("subscriptions") as any)
        .select("tenant_id, status, plan_id, plans(price_cents)");

      if (tenantsError || subscriptionsError) {
        setError(tenantsError?.message || subscriptionsError?.message || "Não foi possível carregar as métricas.");
        setLoading(false);
        return;
      }
      if (tenantsData) {
        const totalTenants = tenantsData.length;
        const activeTenants = tenantsData.filter((tenant: any) => tenant.status === "active").length;
        const trialTenants = tenantsData.filter((tenant: any) => tenant.status === "trial").length;
        const suspendedTenants = tenantsData.filter((tenant: any) => tenant.status === "suspended").length;
        const newThisMonth = tenantsData.filter((tenant: any) => {
          const created = new Date(tenant.created_at);
          const now = new Date();
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length;

        const mrrCents = subscriptionsData?.reduce((sum: number, item: any) => {
          const price = Number(item?.plans?.price_cents || 0);
          return sum + (item.status === "active" ? price : 0);
        }, 0) ?? 0;

        setStats({
          totalTenants,
          activeTenants,
          trialTenants,
          suspendedTenants,
          mrrCents,
          churnRate: totalTenants > 0 ? `${(((suspendedTenants + Math.max(0, totalTenants - activeTenants - trialTenants)) / totalTenants) * 100).toFixed(1)}%` : "0%",
          newThisMonth,
        });
      }
      setLoading(false);
    };

    loadPlatformStats();
  }, []);

  const alertContent = useMemo(() => {
    if (stats.activeTenants === 0 && stats.trialTenants === 0) {
      return "Ainda não há tenants cadastrados na plataforma.";
    }
    return `${stats.activeTenants} contas ativas e ${stats.trialTenants} em trial.`;
  }, [stats.activeTenants, stats.trialTenants]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Métricas Globais da Plataforma</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Administração SaaS MetricBarber • Faturamento via Stripe & Supabase RLS
          </p>
        </div>
      </div>
      {loading && <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400">Carregando métricas...</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Receita Recorrente (MRR)</div>
          <div className="text-2xl font-black text-white mt-1">{formatCurrency(stats.mrrCents)}</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Baseado em assinaturas ativas
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Total de Barbearias</div>
          <div className="text-2xl font-black text-white mt-1">{stats.totalTenants}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.newThisMonth} novos cadastros</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Contas Ativas (Pagas)</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.activeTenants}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.trialTenants} barbearias em Trial</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="text-xs font-bold text-slate-400 uppercase">Taxa de Churn (Cancelamento)</div>
          <div className="text-2xl font-black text-accent mt-1">{stats.churnRate}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.suspendedTenants} suspensas</div>
        </div>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h3 className="font-bold text-white text-base">Alertas & Ações Críticas Recentes</h3>
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl surface-accent-soft border border-accent text-accent flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{alertContent}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dados da plataforma sincronizados com o Supabase.</span>
            </div>
            <span className="text-slate-400">Tempo real</span>
          </div>
        </div>
      </div>
    </div>
  );
};
