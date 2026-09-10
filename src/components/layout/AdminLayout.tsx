import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  ShieldAlert,
  Building2,
  CreditCard,
  Layers,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ArrowLeft,
} from "lucide-react";

export const AdminLayout: React.FC = () => {
  const location = useLocation();

  const adminNav = [
    { label: "Visão Geral", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Barbearias", href: "/admin/tenants", icon: Building2 },
    { label: "Planos & Preços", href: "/admin/plans", icon: Layers },
    { label: "Assinaturas & Stripe", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Auditoria & Logs", href: "/admin/audit", icon: FileText },
    { label: "Suporte", href: "/admin/support", icon: HelpCircle },
  ];
  const mobileNavItems = adminNav.slice(0, 5);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar Admin */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <div>
              <div className="font-bold text-sm tracking-wide text-white uppercase">SaaS Admin</div>
              <div className="text-xs text-slate-500">MetricBarber Platform</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-red-500 text-white font-bold"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à Barbearia</span>
          </Link>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-950/80 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-300">
            Painel de Controle da Plataforma SaaS MetricBarber
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Produção / Supabase RLS Ativo
          </div>
        </header>

        <main className="admin-main flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 bg-slate-900">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`min-h-12 flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
                  isActive ? "bg-accent text-slate-950" : "text-slate-400 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
