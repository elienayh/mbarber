import React, { useMemo, useState, useEffect } from "react";
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
  ShieldAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  LogOut,
} from "lucide-react";
import { LogoIcon } from "@/components/common/Logo";

export const TenantLayout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("metricbarber_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const { tenant, tenantRole, profile, signOut, memberships, switchTenant } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("metricbarber_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer upon navigating
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const trialDaysLeft = useMemo(() => {
    if (!tenant?.trial_ends_at) return 0;
    const end = new Date(tenant.trial_ends_at);
    const today = new Date();
    const diffMs = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [tenant?.trial_ends_at]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, category: "Atendimento" },
    { label: "Agenda", href: "/agenda", icon: Calendar, category: "Atendimento" },
    { label: "Horários", href: "/horarios", icon: Clock, category: "Atendimento" },
    { label: "Clientes", href: "/clientes", icon: Users, category: "Atendimento" },
    { label: "Serviços", href: "/servicos", icon: Scissors, category: "Operação" },
    { label: "Profissionais", href: "/profissionais", icon: UserCheck, category: "Operação" },
    { label: "Produtos", href: "/estoque", icon: Package, category: "Operação" },
    { label: "Financeiro", href: "/financeiro", icon: DollarSign, category: "Gestão" },
    { label: "Relatórios", href: "/relatorios", icon: BarChart3, category: "Gestão" },
    { label: "Assinatura", href: "/assinatura", icon: CreditCard, category: "Gestão" },
    { label: "Auditoria", href: "/auditoria", icon: ShieldAlert, category: "Gestão" },
    { label: "Configurações", href: "/configuracoes", icon: Settings, category: "Gestão" },
  ];

  const visibleNavItems = tenantRole === "professional"
    ? navItems.filter((item) => ["/dashboard", "/agenda", "/clientes"].includes(item.href))
    : tenantRole === "receptionist"
      ? navItems.filter((item) => ["/dashboard", "/agenda", "/horarios", "/clientes", "/servicos", "/estoque"].includes(item.href))
      : navItems;

  // The 4 main bottom items on mobile; the 5th is "Menu/Mais"
  const primaryMobileHrefs = ["/dashboard", "/agenda", "/horarios", "/clientes"];
  const isSecondaryActiveOnMobile = !primaryMobileHrefs.includes(location.pathname);

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
      {/* Sidebar Desktop / Tablet: Recolhível & Expansível */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-white border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 select-none ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between min-h-[65px]">
          {!isSidebarCollapsed ? (
            <>
              <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
                {tenant?.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.trade_name || tenant.name || "Barbearia"}
                    className="w-9 h-9 rounded-lg object-cover border border-accent/40 shadow-md shrink-0"
                  />
                ) : (
                  <LogoIcon size="sm" className="w-9 h-9 rounded-lg shadow-md shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-tight tracking-tight text-white truncate">
                    {tenant?.trade_name || tenant?.name || "MetricBarber"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                    {tenant?.trade_name ? "Barbearia Ativa" : "Painel da Barbearia"}
                  </div>
                </div>
              </Link>

              {/* Botão de Recolher Sidebar */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 ml-1"
                title="Recolher menu lateral"
                aria-label="Recolher menu lateral"
              >
                <PanelLeftClose className="w-5 h-5 text-accent" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <Link to="/dashboard" title={tenant?.trade_name || "MetricBarber"}>
                {tenant?.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.trade_name || tenant.name || "Barbearia"}
                    className="w-9 h-9 rounded-lg object-cover border border-accent/40 shadow-md"
                  />
                ) : (
                  <LogoIcon size="sm" className="w-9 h-9 rounded-lg shadow-md" />
                )}
              </Link>
              {/* Botão de Expandir Sidebar */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Expandir menu lateral"
                aria-label="Expandir menu lateral"
              >
                <PanelLeftOpen className="w-5 h-5 text-accent" />
              </button>
            </div>
          )}
        </div>

        {/* Troca de Barbearia / Unidade (se houver mais de uma) */}
        {memberships.length > 1 && (
          <div className="px-3 pt-3">
            {!isSidebarCollapsed ? (
              <>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                  Trocar Unidade
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
              </>
            ) : (
              <div className="flex justify-center" title="Trocar Unidade">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  title="Trocar unidade (clique para expandir)"
                >
                  <Building2 className="w-4 h-4 text-accent" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alerta de Período de Teste */}
        {tenant?.status === "trial" && (
          <div className="px-3 py-2">
            {!isSidebarCollapsed ? (
              <Link
                to="/assinatura"
                className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs hover:bg-amber-500/20 transition group"
              >
                <div className="flex items-center gap-2 text-amber-400 font-semibold min-w-0">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-accent" />
                  <span className="truncate">{trialDaysLeft > 0 ? `${trialDaysLeft}d de teste` : "Expirado"}</span>
                </div>
                <span className="text-[10px] text-accent font-bold group-hover:underline shrink-0">Plano →</span>
              </Link>
            ) : (
              <Link
                to="/assinatura"
                className="flex items-center justify-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition"
                title={`${trialDaysLeft}d de teste restante`}
              >
                <Sparkles className="w-4 h-4 text-accent" />
              </Link>
            )}
          </div>
        )}

        {/* Lista de Navegação Principal */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
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
                    ? "bg-accent text-slate-950 font-bold shadow-md shadow-accent/25"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon
                  className={`shrink-0 ${
                    isSidebarCollapsed ? "w-5 h-5" : "w-5 h-5"
                  } ${isActive ? "text-slate-950" : "text-slate-400 group-hover:text-accent transition-colors"}`}
                />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip flutuante discreto em modo recolhido */}
                {isSidebarCollapsed && (
                  <span className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-slate-950 text-white text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Barra Lateral */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {tenant?.slug && (
            <Link
              to={`/${tenant.slug}`}
              target="_blank"
              title="Abrir Chat de Agendamento Online"
              className={`flex items-center rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition ${
                isSidebarCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"
              }`}
            >
              {!isSidebarCollapsed && <span>Chat de Agendamento</span>}
              <ExternalLink className="w-4 h-4 text-accent shrink-0" />
            </Link>
          )}

          {/* Botão de rodapé para alternar recolher / expandir */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition ${
              isSidebarCollapsed ? "justify-center p-2" : "justify-between px-3 py-2"
            }`}
            title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {!isSidebarCollapsed ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Recolher Menu</span>
                <ChevronLeft className="w-4 h-4 text-accent" />
              </>
            ) : (
              <ChevronRight className="w-5 h-5 text-accent" />
            )}
          </button>
        </div>
      </aside>

      {/* Área Central / Conteúdo */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Floating Realtime Notification Toast */}
        <NotificationToast />

        {/* Top Header */}
        <header className="h-16 surface-card-light border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão de Hambúrguer no Celular (Touch-friendly 44px+) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-800" /> : <Menu className="w-6 h-6 text-slate-800" />}
            </button>

            {/* Botão de Toggle da Sidebar em Desktop/Tablet */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-accent" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              )}
            </button>

            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 capitalize truncate">
              {navItems.find((i) => i.href === location.pathname)?.label || "MetricBarber"}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Sino de Notificações Push & Alertas em Tempo Real */}
            <NotificationBellDropdown />

            {/* Link do Chat Público */}
            {tenant?.slug && (
              <Link
                to={`/${tenant.slug}`}
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 surface-accent-soft text-primary-on-light border border-accent rounded-lg hover-surface-accent-soft transition"
                title="Abrir página pública de agendamento"
              >
                <span>Link do Chat</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}

            {/* Informações do Usuário e Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div
                className="w-8 h-8 rounded-full bg-slate-800 text-accent font-bold text-xs flex items-center justify-center shrink-0 shadow-xs"
                title={displayUserName}
              >
                {displayUserName.slice(0, 2).toUpperCase() || "MB"}
              </div>

              <button
                type="button"
                onClick={() => void signOut()}
                className="min-h-[44px] px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5 md:hidden" />
                <span className="hidden sm:inline">Sair</span>
              </button>

              <div className="hidden lg:block text-left text-xs">
                <div className="font-semibold text-slate-800 truncate max-w-[120px]">{displayUserName}</div>
                <div className="text-slate-400 text-[10px]">{displayRole}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Menu Lateral no Celular (Slide-over Drawer com Botão de Recolher e Agrupamento) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/75 backdrop-blur-xs flex animate-fadeIn">
            <div className="w-72 max-w-[85vw] bg-slate-900 text-white h-full flex flex-col p-4 shadow-2xl overflow-y-auto">
              {/* Header do Drawer no Celular */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {tenant?.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt={tenant.trade_name || tenant.name || "Barbearia"}
                      className="w-8 h-8 rounded-lg object-cover border border-accent/40 shrink-0"
                    />
                  ) : (
                    <LogoIcon size="sm" className="w-8 h-8 rounded-lg shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {tenant?.trade_name || tenant?.name || "MetricBarber"}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Menu de Navegação</div>
                  </div>
                </div>

                {/* Botão Explícito para Recolher / Fechar o Menu */}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 active:scale-95"
                  title="Recolher menu lateral"
                  aria-label="Recolher menu lateral"
                >
                  <ChevronLeft className="w-4 h-4 text-accent" />
                  <span>Recolher</span>
                </button>
              </div>

              {/* Seletor de Unidades se houver várias */}
              {memberships.length > 1 && (
                <div className="pt-3 pb-1 border-b border-slate-800/80">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Trocar Barbearia
                  </label>
                  <select
                    value={tenant?.id || ""}
                    onChange={(e) => {
                      switchTenant(e.target.value);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-accent"
                  >
                    {memberships.map((m) => (
                      <option key={m.tenant_id} value={m.tenant_id}>
                        {m.tenant?.trade_name || m.tenant?.name || "Barbearia"} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lista Completa de Menus no Celular */}
              <nav className="flex-1 py-3 space-y-4">
                {["Atendimento", "Operação", "Gestão"].map((cat) => {
                  const itemsInCat = visibleNavItems.filter((i) => i.category === cat);
                  if (itemsInCat.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                        {cat}
                      </div>
                      {itemsInCat.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                              isActive
                                ? "bg-accent text-slate-950 font-bold shadow-md shadow-accent/20"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              {/* Botões de Rodapé no Menu Mobile */}
              <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
                {tenant?.slug && (
                  <Link
                    to={`/${tenant.slug}`}
                    target="_blank"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs hover:bg-accent/25 transition"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Chat de Agendamento
                    </span>
                    <span>Abrir →</span>
                  </Link>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs">
                    <div className="font-semibold text-white truncate max-w-[140px]">{displayUserName}</div>
                    <div className="text-slate-400 text-[10px]">{displayRole}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      void signOut();
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Backdrop clicável para fechar */}
            <div
              className="flex-1"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Fechar menu lateral"
            />
          </div>
        )}

        {/* Conteúdo Principal da Página */}
        <main className="tenant-main flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-24 md:pb-6 bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* Barra de Navegação Inferior para Celular (Mobile Bottom Bar) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-slate-900/98 border-t border-slate-800 backdrop-blur-lg px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="grid grid-cols-5 gap-1">
          {/* 1. Dashboard */}
          <Link
            to="/dashboard"
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              location.pathname === "/dashboard"
                ? "bg-accent text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Painel</span>
          </Link>

          {/* 2. Agenda */}
          <Link
            to="/agenda"
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              location.pathname === "/agenda"
                ? "bg-accent text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>Agenda</span>
          </Link>

          {/* 3. Horários */}
          <Link
            to="/horarios"
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              location.pathname === "/horarios"
                ? "bg-accent text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>Horários</span>
          </Link>

          {/* 4. Clientes */}
          <Link
            to="/clientes"
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              location.pathname === "/clientes"
                ? "bg-accent text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Clientes</span>
          </Link>

          {/* 5. Menu / Mais (Abre o Drawer Completo no Celular com todas as outras opções) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              isSecondaryActiveOnMobile
                ? "bg-accent text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:bg-slate-800"
            }`}
            title="Expandir todas as opções do menu"
            aria-label="Expandir todas as opções do menu"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
