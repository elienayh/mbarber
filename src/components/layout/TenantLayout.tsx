import React, { useMemo, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBellDropdown } from "@/components/notifications/NotificationBellDropdown";
import { NotificationToast } from "@/components/notifications/NotificationToast";
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
  Sparkles,
  CreditCard,
} from "lucide-react";

export const TenantLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { tenant, tenantRole, profile, signOut, memberships, switchTenant } = useAuth();

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
    { label: "Assinatura", href: "/assinatura", icon: CreditCard },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ];
  const visibleNavItems = tenantRole === "professional"
    ? navItems.filter((item) => ["/dashboard", "/agenda", "/clientes"].includes(item.href))
    : tenantRole === "receptionist"
      ? navItems.filter((item) => ["/dashboard", "/agenda", "/clientes", "/servicos", "/estoque"].includes(item.href))
      : navItems;
  const mobileNavItems = visibleNavItems.slice(0, 5);

  const displayUserName = profile?.full_name || "Usuário";
  const roleTranslations: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    professional: "Barbeiro",
    receptionist: "Recepcionista",
    super_admin: "Super Admin",
  };
  const displayRole = profile?.is_platform_admin
    ? "Super Admin"
    : tenantRole
      ? (roleTranslations[tenantRole] || tenantRole.charAt(0).toUpperCase() + tenantRole.slice(1))
      : "Proprietário";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            {tenant?.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.trade_name || "Barbearia"}
                className="w-9 h-9 rounded-lg object-cover border border-accent/40 shadow-md shrink-0"
              />
            ) : (
              <img
                src="/favicon-32x32.png"
                alt="MetricBarber"
                className="w-9 h-9 rounded-lg object-contain shadow-lg shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight tracking-tight text-white truncate">
                {tenant?.trade_name || tenant?.name || "MetricBarber"}
              </div>
              <div className="text-xs text-slate-400 truncate max-w-[140px]">
                {tenant?.trade_name ? "Barbearia Ativa" : "Painel da Barbearia"}
              </div>
            </div>
          </Link>
        </div>

        {memberships.length > 1 && (
          <div className="px-3 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
              Trocar Unidade / Barbearia
            </label>
            <select
              value={tenant?.id || ""}
              onChange={(e) => switchTenant(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-accent"
            >
              {memberships.map((m) => (
                <option key={m.tenant_id} value={m.tenant_id}>
                  {m.tenant?.trade_name || m.tenant?.name || "Barbearia"} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {tenant?.status === "trial" && (
          <Link
            to="/assinatura"
            className="mx-3 my-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs hover:bg-amber-500/20 transition group"
          >
            <div className="flex items-center gap-2 text-amber-400 font-semibold min-w-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-accent" />
              <span className="truncate">{trialDaysLeft > 0 ? `${trialDaysLeft}d de teste restante` : "Teste expirado"}</span>
            </div>
            <span className="text-[10px] text-accent font-bold group-hover:underline shrink-0">Plano →</span>
          </Link>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-accent text-slate-950 font-bold shadow"
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
              <ExternalLink className="w-3.5 h-3.5 text-accent" />
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Floating In-App Realtime Notification Toast */}
        <NotificationToast />

        <header className="h-16 surface-card-light border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover-surface-elevated-light"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg md:text-xl font-bold text-slate-800 capitalize">
              {navItems.find((i) => i.href === location.pathname)?.label || "MetricBarber"}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sino de Notificações Push & Alertas em Tempo Real */}
            <NotificationBellDropdown />

            {tenant?.slug && (
              <Link
                to={`/${tenant.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 surface-accent-soft text-primary-on-light border border-accent rounded-lg hover-surface-accent-soft transition"
              >
                <span>Link do Chat</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-accent font-bold text-xs flex items-center justify-center">
                {displayUserName.slice(0, 2).toUpperCase() || "MB"}
              </div>
              <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-slate-600 hover-surface-elevated-light">Sair</button>
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
                <div className="flex items-center gap-2 min-w-0">
                  {tenant?.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt={tenant.trade_name || "Barbearia"}
                      className="w-8 h-8 rounded-lg object-cover border border-accent/40 shrink-0"
                    />
                  ) : (
                    <img
                      src="/favicon-32x32.png"
                      alt="MetricBarber"
                      className="w-8 h-8 rounded-lg object-contain shrink-0"
                    />
                  )}
                  <div className="font-bold text-sm text-white truncate">
                    {tenant?.trade_name || tenant?.name || "MetricBarber"}
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 py-4 space-y-1">
                {visibleNavItems.map((item) => (
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

        <main className="tenant-main flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 bg-slate-50">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-slate-900/95 border-t border-slate-800 backdrop-blur-lg px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`min-h-12 flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
                  isActive ? "bg-accent text-slate-950" : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
