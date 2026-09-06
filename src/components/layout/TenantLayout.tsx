import React, { useMemo, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar,
  Users,
  Scissors,
  UserCheck,
  DollarSign,
  Package,
  BarChart3,
  Settings,
  LayoutDashboard,
  ExternalLink,
  Menu,
  X,
  Bell,
  Sparkles,
} from "lucide-react";

export const TenantLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { tenant, tenantRole, profile } = useAuth();

  const trialDaysLeft = useMemo(() => {
    if (!tenant?.trial_ends_at) return 0;
    const end = new Date(tenant.trial_ends_at);
    const today = new Date();
    const diffMs = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [tenant?.trial_ends_at]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Agenda", href: "/agenda", icon: Calendar },
    { label: "Clientes", href: "/clientes", icon: Users },
    { label: "Serviços", href: "/servicos", icon: Scissors },
    { label: "Profissionais", href: "/profissionais", icon: UserCheck },
    { label: "Financeiro", href: "/financeiro", icon: DollarSign },
    { label: "Estoque", href: "/estoque", icon: Package },
    { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ];

  const displayUserName = profile?.full_name || "Usuário";
  const displayRole = tenantRole ? tenantRole.charAt(0).toUpperCase() + tenantRole.slice(1) : "Membro";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              MB
            </div>
            <div>
              <div className="font-bold text-base leading-tight tracking-tight text-white">MetricBarber</div>
              <div className="text-xs text-slate-400 truncate max-w-[140px]">{tenant?.trade_name || "Barbearia"}</div>
            </div>
          </Link>
        </div>

        {tenant?.status === "trial" && (
          <div className="mx-3 my-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Sparkles className="w-4 h-4" />
              Período de Testes
            </div>
            <p className="text-slate-300 mt-1">Restam {trialDaysLeft} dias de Trial gratuito.</p>
            <Link
              to="/configuracoes/assinatura"
              className="mt-2 block w-full text-center py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition"
            >
              Assinar Plano
            </Link>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-bold shadow"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          {tenant?.slug && (
            <Link
              to={`/${tenant.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              <span>Ver Chat de Agendamento</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg md:text-xl font-bold text-slate-800 capitalize">
              {navItems.find((i) => i.href === location.pathname)?.label || "MetricBarber"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {tenant?.slug && (
              <Link
                to={`/${tenant.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
              >
                <span>Link do Chat</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}

            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500"></span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center">
                {displayUserName.slice(0, 2).toUpperCase() || "MB"}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <div className="font-semibold text-slate-800">{displayUserName}</div>
                <div className="text-slate-400">{displayRole}</div>
              </div>
            </div>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-sm flex">
            <div className="w-64 bg-slate-900 text-white h-full flex flex-col p-4 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="font-bold text-lg text-amber-400">MetricBarber</div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <item.icon className="w-5 h-5 text-slate-400" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
