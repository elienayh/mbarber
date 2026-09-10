import React, { useEffect, useState } from "react";
import { Layers, Plus, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await (supabase.from("plans") as any)
        .select("id, name, slug, price_cents, billing_cycle, max_professionals, stripe_price_id, features, is_active")
        .eq("is_active", true)
        .order("price_cents");
      setPlans((data || []).map((plan: any) => ({
        ...plan,
        cycle: plan.billing_cycle === "yearly" ? "Anual" : plan.billing_cycle === "quarterly" ? "Trimestral" : "Mensal",
        features: Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => feature),
        is_popular: plan.slug === "pro",
      })));
      setLoading(false);
    };

    loadPlans();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Planos do MetricBarber (Stripe)</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Preços, limites de profissionais e sincronização com Stripe Products
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && <div className="md:col-span-3 text-sm text-slate-400">Carregando planos...</div>}
        {!loading && plans.map((p) => (
          <div
            key={p.id}
            className={`bg-slate-950 rounded-2xl p-6 border flex flex-col justify-between ${
              p.is_popular ? "border-accent shadow-lg shadow-accent" : "border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-white">{p.name}</h3>
                {p.is_popular && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent text-slate-950 uppercase">
                    Mais Assinado
                  </span>
                )}
              </div>

              <div className="text-2xl font-black text-white mt-3">
                {formatCurrency(p.price_cents)}{" "}
                <span className="text-xs font-normal text-slate-400">/{p.cycle.toLowerCase()}</span>
              </div>

              <div className="text-xs font-mono text-slate-500 mt-1 truncate">
                Stripe Price: {p.stripe_price_id}
              </div>

              <div className="space-y-2 mt-6 text-xs text-slate-300">
                {p.features.map((f: string) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
