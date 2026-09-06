import React, { useEffect, useState } from "react";
import { Settings, Globe, CreditCard, Sparkles, Clock, ShieldCheck, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const SettingsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [tradeName, setTradeName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [defaultPlan, setDefaultPlan] = useState<any>(null);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadSettings = async () => {
      const [{ data }, { data: subscriptionData }, { data: defaultPlanData }] = await Promise.all([
        (supabase.from("tenants") as any)
        .select("trade_name, slug, phone, address_street, address_number, address_neighborhood, address_city, address_state")
        .eq("id", tenant.id)
        .single(),
        (supabase.from("subscriptions") as any)
          .select("status, current_period_end, cancel_at_period_end, plans(name, price_cents, billing_cycle)")
          .eq("tenant_id", tenant.id)
          .maybeSingle(),
        (supabase.from("plans") as any)
          .select("name, price_cents, billing_cycle")
          .eq("slug", "pro")
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (data) {
        setTradeName(data.trade_name || "");
        setSlug(data.slug || "");
        setPhone(data.phone || "");
        setAddress([data.address_street, data.address_number, data.address_neighborhood, data.address_city, data.address_state].filter(Boolean).join(", "));
      }
      setSubscription(subscriptionData || null);
      setDefaultPlan(defaultPlanData || null);
      setLoading(false);
    };

    loadSettings();
  }, [tenant?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    const { error } = await (supabase.from("tenants") as any)
      .update({ trade_name: tradeName, slug, phone })
      .eq("id", tenant.id);
    if (error) return;
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const openStripeCheckout = async () => {
    if (!tenant?.id) return;
    setStripeLoading(true);
    setStripeError(null);
    const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
      body: { tenant_id: tenant.id, plan_slug: "pro", origin: window.location.origin },
    });
    setStripeLoading(false);
    if (error || !data?.url) {
      setStripeError(error?.message || "Não foi possível abrir o checkout Stripe.");
      return;
    }
    window.location.assign(data.url);
  };

  const openStripePortal = async () => {
    if (!tenant?.id) return;
    setStripeLoading(true);
    setStripeError(null);
    const { data, error } = await supabase.functions.invoke("stripe-create-portal-session", {
      body: { tenant_id: tenant.id, origin: window.location.origin },
    });
    setStripeLoading(false);
    if (error || !data?.url) {
      setStripeError(error?.message || "Nenhuma assinatura Stripe ativa foi encontrada.");
      return;
    }
    window.location.assign(data.url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">Configurações da Barbearia</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Identidade da barbearia, link público e faturamento da assinatura Stripe
        </p>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <h3 className="font-bold text-slate-900 text-base pb-2 border-b border-slate-100">
          Dados Gerais & Link Público
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nome Fantasia da Barbearia</label>
            <input
              type="text"
              disabled={loading}
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
            />
              </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Slug do Link Público</label>
            <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:border-amber-500">
              <span className="bg-slate-100 px-3 py-2.5 text-xs text-slate-500 font-mono border-r border-slate-300">
                metricbarber.com.br/
              </span>
              <input
                type="text"
                disabled={loading}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp de Contato</label>
            <input
              type="text"
              disabled={loading}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Endereço Completo</label>
            <input
              type="text"
              disabled={loading}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {isSaved ? (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Alterações salvas com sucesso!
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20"
          >
            Salvar Alterações
          </button>
        </div>
      </form>

      {/* Stripe Subscription Management */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Assinatura do MetricBarber (Stripe)</h3>
            <p className="text-xs text-slate-500">Gerenciamento de faturas e planos</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${subscription?.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {subscription?.status === "active" ? "Assinatura ativa" : subscription?.status || "Período de Testes (Trial)"}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-slate-900 text-sm">{subscription?.plans?.name || defaultPlan?.name || "Plano não configurado"}</div>
            <div className="text-xs text-slate-500 mt-0.5">Assinatura gerenciada pelo Stripe</div>
            <div className="text-base font-black text-slate-900 mt-2">{formatCurrency(subscription?.plans?.price_cents || defaultPlan?.price_cents || 0)} / {(subscription?.plans?.billing_cycle || defaultPlan?.billing_cycle) === "yearly" ? "ano" : (subscription?.plans?.billing_cycle || defaultPlan?.billing_cycle) === "quarterly" ? "trimestre" : "mês"}</div>
            {subscription?.current_period_end && <div className="text-xs text-slate-500 mt-1">Próxima renovação: {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openStripeCheckout}
            disabled={stripeLoading}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>{stripeLoading ? "Abrindo Stripe..." : "Assinar via Stripe"}</span>
          </button>
          <button
            type="button"
            onClick={openStripePortal}
            disabled={stripeLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-white transition disabled:opacity-50"
          >
            Faturas e assinatura
          </button>
          </div>
        </div>
        {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
      </div>
    </div>
  );
};
