import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If true, requires the user to be a platform admin */
  requireAdmin?: boolean;
}

/**
 * Route guard that checks authentication state and role.
 *
 * - Unauthenticated users → redirected to /auth/login
 * - requireAdmin=true but user is not admin → redirected to /dashboard
 * - Otherwise → renders children
 *
 * While auth is loading, shows a minimal loading spinner
 * that matches the app's dark theme.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, profile, tenantMembership, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg animate-pulse">
            MB
          </div>
          <span className="text-xs text-slate-400 font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !profile?.is_platform_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requireAdmin && !profile?.is_platform_admin && !tenantMembership?.is_active) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
};
