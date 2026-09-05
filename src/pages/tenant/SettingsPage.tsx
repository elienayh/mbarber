import React, { useState } from "react";
import { Settings, Globe, CreditCard, Sparkles, Clock, ShieldCheck, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const SettingsPage: React.FC = () => {
  const [tradeName, setTradeName] = useState("Barbearia Vintage Club");
  const [slug, setSlug] = useState("vintage-barber");
  const [phone, setPhone] = useState("(11) 98765-4321");
  const [address, setAddress] = useState("Rua Augusta, 1420 - Consolação, São Paulo - SP");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Endereço Completo</label>
            <input
              type="text"
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
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            Período de Testes (Trial)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-slate-900 text-sm">Plano Barbearia Pro</div>
            <div className="text-xs text-slate-500 mt-0.5">Até 5 barbeiros • Módulos completos liberados</div>
            <div className="text-base font-black text-slate-900 mt-2">{formatCurrency(7900)} / mês</div>
          </div>
          <button className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-md shadow-emerald-600/20 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Assinar via Stripe</span>
          </button>
        </div>
      </div>
    </div>
  );
};
