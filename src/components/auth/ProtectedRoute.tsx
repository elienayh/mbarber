import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Se true, exige privilégios de Super Admin do SaaS */
  requireAdmin?: boolean;
  /** Papéis de tenant permitidos (ex: ['owner', 'admin']) */
  allowedRoles?: string[];
  /** Se true, permite acesso mesmo com perfil incompleto (usado na própria rota de onboarding) */
  allowIncompleteProfile?: boolean;
  /** Se true, permite acesso mesmo sem barbearia configurada */
  allowIncompleteTenant?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  allowedRoles,
  allowIncompleteProfile = false,
  allowIncompleteTenant = false,
}) => {
  const { user, profile, tenantMembership, tenant, memberships, loading, isProfileComplete, isTenantComplete } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-slate-950 flex items-center justify-center font-black text-lg animate-pulse">
            MB
          </div>
          <span className="text-xs text-slate-400 font-medium">Carregando permissões...</span>
        </div>
      </div>
    );
  }

  // 1. Usuário não autenticado → Redireciona para login preservando a rota pretendida
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 2. Verificação de Super Admin
  if (requireAdmin) {
    if (!profile?.is_platform_admin) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // Super Admin tem acesso liberado aos módulos gerais
  if (profile?.is_platform_admin) {
    return <>{children}</>;
  }

  // 3. Regra A: Usuário sem perfil completo → Onboarding de Perfil
  if (!allowIncompleteProfile && !isProfileComplete) {
    if (location.pathname !== "/onboarding/perfil") {
      return <Navigate to="/onboarding/perfil" state={{ from: location }} replace />;
    }
  }

  // 4. Regra B: Usuário sem barbearia
  if (!allowIncompleteTenant) {
    const hasActiveTenant = Boolean(tenant?.id);
    const activeMemberships = (memberships || []).filter((m) => m.is_active);

    // Sem nenhuma barbearia vinculada e sem tenant ativo
    if (activeMemberships.length === 0 && !hasActiveTenant) {
      if (location.pathname !== "/onboarding/barbearia") {
        return <Navigate to="/onboarding/barbearia" state={{ from: location }} replace />;
      }
    }
  }

  // 5. Verificação de papéis permitidos dentro da barbearia
  if (allowedRoles && tenantMembership) {
    if (!allowedRoles.includes(tenantMembership.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
