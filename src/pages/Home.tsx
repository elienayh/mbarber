import React from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  MessageSquare,
  ShieldAlert,
  Building2,
  Scissors,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Lock,
} from "lucide-react";

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              MB
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white">MetricBarber</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SaaS Multi-Tenant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition"
            >
              Entrar
            </Link>
            <Link
              to="/dashboard"
              className="text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
            >
              <span>Acessar Barbearia</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-amber-400 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Engenharia inspirada no InBarber — Sem download de app pelo cliente
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight mb-6">
            A Plataforma Definitiva de Gestão para <span className="text-amber-500">Barbearias</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Agendamento conversacional via link público, controle total de agenda em tempo real,
            comissões de barbeiros, financeiro e faturamento SaaS integrado via Stripe.
          </p>
        </div>

        {/* 3 Interactive Exploration Portals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Nível 3: Chat Público */}
          <div className="group rounded-2xl p-6 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition relative overflow-hidden shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Nível 3 — Cliente Final</div>
            <h3 className="text-xl font-bold text-white mb-2">Chat Público Conversacional</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              O cliente abre o link da barbearia no celular e agenda em um fluxo conversacional guiado de 45 segundos, sem senhas.
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Cálculo de slots sem double-booking
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Identificação inteligente por WhatsApp
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Adicionar ao Google / Apple Calendar
              </div>
            </div>
            <Link
              to="/vintage-barber"
              className="inline-flex items-center justify-between w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20"
            >
              <span>Testar Chat do Cliente</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Nível 2: Backoffice da Barbearia */}
          <div className="group rounded-2xl p-6 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 hover:border-blue-500/50 transition relative overflow-hidden shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
              <Scissors className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Nível 2 — Barbearia (Tenant)</div>
            <h3 className="text-xl font-bold text-white mb-2">Backoffice Operacional</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Painel completo para o dono, recepcionista e barbeiros: agenda em colunas, financeiro, comissões e estoque.
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                Agenda realtime por profissional
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                Controle financeiro e comissões automáticas
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                Isolamento estrito de dados via Supabase RLS
              </div>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-between w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/20"
            >
              <span>Abrir Painel da Barbearia</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Nível 1: Plataforma SaaS Admin */}
          <div className="group rounded-2xl p-6 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 hover:border-red-500/50 transition relative overflow-hidden shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 border border-red-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Nível 1 — SaaS Admin</div>
            <h3 className="text-xl font-bold text-white mb-2">Administração Global</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Painel de controle do proprietário do MetricBarber: métricas de receita (MRR), gestão de barbearias, planos e auditoria.
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-red-400" />
                Métricas de faturamento e churn Stripe
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-red-400" />
                Bloqueio, suspensão e reativação de tenants
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-red-400" />
                Trilha de auditoria completa
              </div>
            </div>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center justify-between w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition shadow-lg shadow-red-600/20"
            >
              <span>Acessar Painel do SaaS</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        MetricBarber — Plataforma SaaS Multi-Tenant com Supabase PostgreSQL, RLS e Stripe.
      </footer>
    </div>
  );
};
