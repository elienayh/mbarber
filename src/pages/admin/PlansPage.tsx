import React from "react";
import { Layers, Plus, Check, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const PlansPage: React.FC = () => {
  const plans = [
    {
      id: "p1",
      name: "Plano Solo",
      slug: "solo",
      price_cents: 3900,
      cycle: "Mensal",
      max_professionals: 1,
      stripe_price_id: "price_1OvXx...",
      features: ["1 Barbeiro / Cadeira", "Chat Conversacional Ilimitado", "Financeiro Básico", "Relatórios do Mês"],
    },
    {
      id: "p2",
      name: "Plano Barbearia Pro",
      slug: "pro",
      price_cents: 7900,
      cycle: "Mensal",
      max_professionals: 5,
      stripe_price_id: "price_1OvYy...",
      features: [
        "Até 5 Barbeiros / Cadeiras",
        "Chat Conversacional Ilimitado",
        "Controle de Estoque Completo",
        "Cálculo Automático de Comissões",
        "Agendamentos Recorrentes",
      ],
      is_popular: true,
    },
    {
      id: "p3",
      name: "Plano Rede / Enterprise",
      slug: "enterprise",
      price_cents: 14900,
      cycle: "Mensal",
      max_professionals: 15,
      stripe_price_id: "price_1OvZz...",
      features: [
        "Até 15 Barbeiros",
        "Todos os recursos liberados",
        "Suporte Prioritário WhatsApp",
        "Múltiplas Unidades (Em breve)",
      ],
    },
  ];

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
        {plans.map((p) => (
          <div
            key={p.id}
            className={`bg-slate-950 rounded-2xl p-6 border flex flex-col justify-between ${
              p.is_popular ? "border-amber-500 shadow-lg shadow-amber-500/10" : "border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-white">{p.name}</h3>
                {p.is_popular && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase">
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
                {p.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                <Edit2 className="w-3.5 h-3.5" /> Editar no Stripe
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
