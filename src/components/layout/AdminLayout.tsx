import React, { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { LogoIcon } from "@/components/common/Logo";

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("metricbarber_admin_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("metricbarber_admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const adminNav = [
    { label: "Visão Geral", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Barbearias", href: "/admin/tenants", icon: Building2 },
    { label: "Planos & Preços", href: "/admin/plans", icon: Layers },
    { label: "Assinaturas & Stripe", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Auditoria & Logs", href: "/admin/audit", icon: FileText },
    { label: "Suporte", href: "/admin/support", icon: HelpCircle },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar Admin: Recolhível & Expansível */}
      <aside
        className={`hidden md:flex flex-col bg-slate-950 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 select-none ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between min-h-[65px]">
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <LogoIcon size="sm" className="w-8 h-8 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-sm tracking-wide text-white uppercase truncate">SaaS Admin</div>
                  <div className="text-[11px] text-slate-500 truncate">MetricBarber Platform</div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition shrink-0 ml-1"
                title="Recolher menu lateral"
                aria-label="Recolher menu lateral"
              >
                <PanelLeftClose className="w-5 h-5 text-red-400" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <LogoIcon size="sm" className="w-8 h-8 shrink-0" />
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
                title="Expandir menu lateral"
                aria-label="Expandir menu lateral"
              >
                <PanelLeftOpen className="w-5 h-5 text-red-400" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition group relative ${
                  isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-red-500 text-white font-bold shadow-md shadow-red-500/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon className={`shrink-0 w-5 h-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-red-400 transition-colors"}`} />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip flutuante discreto em modo recolhido */}
                {isSidebarCollapsed && (
                  <span className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-slate-950 text-white text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 border border-slate-800">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <Link
            to="/dashboard"
            title="Voltar à Barbearia"
            className={`flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition ${
              isSidebarCollapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2.5"
            }`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0 text-accent" />
            {!isSidebarCollapsed && <span>Voltar à Barbearia</span>}
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white transition ${
              isSidebarCollapsed ? "justify-center p-2" : "justify-between px-3 py-2"
            }`}
            title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {!isSidebarCollapsed ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Recolher Menu</span>
                <ChevronLeft className="w-4 h-4 text-red-400" />
              </>
            ) : (
              <ChevronRight className="w-5 h-5 text-red-400" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-slate-950/90 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-slate-300 hover:bg-slate-800 transition"
              aria-label="Abrir menu admin"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-red-400" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-400" />
              )}
            </button>

            <div className="text-sm font-bold text-slate-200 truncate">
              {adminNav.find((i) => i.href === location.pathname)?.label || "Painel SaaS Admin"}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Supabase RLS Ativo</span>
            <span className="sm:hidden">Ativo</span>
          </div>
        </header>

        {/* Mobile Slide-Over Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-xs flex animate-fadeIn">
            <div className="w-72 max-w-[85vw] bg-slate-950 text-white h-full flex flex-col p-4 shadow-2xl overflow-y-auto border-r border-slate-800">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <LogoIcon size="sm" className="w-8 h-8" />
                  <div className="font-bold text-sm text-white">SaaS Admin</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-200 text-xs font-bold transition border border-slate-800"
                >
                  <ChevronLeft className="w-4 h-4 text-red-400" />
                  <span>Recolher</span>
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1">
                {adminNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                        isActive ? "bg-red-500 text-white font-bold" : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-slate-400" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-slate-800">
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-200 hover:bg-slate-800 transition"
                >
                  <ArrowLeft className="w-4 h-4 text-accent" />
                  <span>Voltar à Barbearia</span>
                </Link>
              </div>
            </div>

            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        <main className="admin-main flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-24 md:pb-6 bg-slate-900">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav for Admin */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-slate-950/98 border-t border-slate-800 backdrop-blur-lg px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="grid grid-cols-5 gap-1">
          {adminNav.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
                  isActive ? "bg-red-500 text-white" : "text-slate-400 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[55px]">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-400 hover:bg-slate-900 transition active:scale-95"
            aria-label="Abrir menu admin"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
