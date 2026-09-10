import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, TenantInfo, TenantMembership, AuthState } from "@/types/auth";
import { determineNextRoute, isProfileComplete, isTenantComplete } from "@/lib/authRedirect";

export type { UserProfile, TenantInfo, TenantMembership };

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string, from?: string) => Promise<{ redirectTo: string }>;
  signInWithGoogle: (from?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getRedirectPath: (intendedDestination?: string) => string;
  switchTenant: (tenantId: string) => void;
  refreshUserData: () => Promise<void>;
  updateTenantState: (updated: Partial<TenantInfo>) => void;
  isProfileComplete: boolean;
  isTenantComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    memberships: [],
    tenantMembership: null,
    tenant: null,
    tenantRole: null,
    loading: true,
    error: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // 1. Buscar perfil da tabela public.profiles (utilizando colunas nativas existentes)
      const { data: profileData, error: profileError } = await (supabase.from("profiles") as any)
        .select("id, email, full_name, avatar_url, is_platform_admin, platform_role, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.warn("Aviso ao buscar perfil na tabela profiles:", profileError.message || profileError);
      }

      // Buscar metadados de auth.users (onde phone, cpf e nome são persistidos nativamente)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userMeta = (authUser && authUser.id === userId) ? (authUser.user_metadata || {}) : {};

      let profile: UserProfile | null = null;

      if (profileData) {
        profile = {
          id: profileData.id,
          email: profileData.email || authUser?.email || "",
          full_name: profileData.full_name || userMeta.full_name || userMeta.name || "",
          phone: userMeta.phone || null,
          cpf: userMeta.cpf || null,
          avatar_url: profileData.avatar_url || userMeta.avatar_url || userMeta.picture || null,
          is_platform_admin: !!profileData.is_platform_admin,
          platform_role: profileData.platform_role || null,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        };
      } else if (authUser && authUser.id === userId) {
        profile = {
          id: authUser.id,
          email: authUser.email || "",
          full_name: userMeta.full_name || userMeta.name || "",
          phone: userMeta.phone || null,
          cpf: userMeta.cpf || null,
          avatar_url: userMeta.avatar_url || userMeta.picture || null,
          is_platform_admin: false,
          platform_role: null,
        };

        try {
          await (supabase.from("profiles") as any).upsert({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          });
        } catch (upsertErr) {
          console.warn("Não foi possível sincronizar perfil inicial:", upsertErr);
        }
      }

      // 2. Buscar memberships (NÃO utilizar maybeSingle, pois o usuário pode ter mais de uma barbearia)
      const { data: rawMemberships, error: membershipsError } = await (supabase.from("tenant_users") as any)
        .select(`
          id,
          tenant_id,
          role,
          is_active,
          tenants:tenant_id (
            id, slug, name, trade_name, phone, email, status, trial_ends_at,
            primary_color, secondary_color, logo_url, address_street,
            address_number, address_neighborhood, address_city,
            address_state, address_zip_code, settings, created_at, updated_at
          )
        `)
        .eq("user_id", userId)
        .eq("is_active", true);

      if (membershipsError) {
        console.error("Erro ao carregar memberships:", membershipsError);
      }

      const memberships: TenantMembership[] = (rawMemberships || []).map((m: any) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        role: m.role,
        is_active: m.is_active,
        tenant: m.tenants as TenantInfo,
      }));

      // Selecionar barbearia ativa respeitando preferência armazenada
      const savedTenantId = localStorage.getItem("mb_active_tenant_id");
      const selectedMembership =
        memberships.find((m) => m.tenant_id === savedTenantId) ||
        memberships[0] ||
        null;

      const tenant = selectedMembership?.tenant || null;
      const tenantRole = selectedMembership?.role || null;

      if (tenant?.id) {
        localStorage.setItem("mb_active_tenant_id", tenant.id);
      }

      return {
        profile,
        memberships,
        tenantMembership: selectedMembership,
        tenant,
        tenantRole,
        error: null,
      };
    } catch (err) {
      console.error("Erro inesperado ao carregar dados do usuário:", err);
      return {
        profile: null,
        memberships: [],
        tenantMembership: null,
        tenant: null,
        tenantRole: null,
        error: "unexpected_auth_error",
      };
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!state.user) return;
    const { profile, memberships, tenantMembership, tenant, tenantRole } =
      await fetchUserData(state.user.id);
    setState((prev) => ({
      ...prev,
      profile,
      memberships,
      tenantMembership,
      tenant,
      tenantRole,
    }));
  }, [state.user, fetchUserData]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      const target = state.memberships.find((m) => m.tenant_id === tenantId);
      if (target) {
        localStorage.setItem("mb_active_tenant_id", tenantId);
        setState((prev) => ({
          ...prev,
          tenantMembership: target,
          tenant: target.tenant || null,
          tenantRole: target.role,
        }));
      }
    },
    [state.memberships]
  );

  const getRedirectPath = useCallback(
    (intendedDestination?: string): string => {
      return determineNextRoute({
        profile: state.profile,
        memberships: state.memberships,
        activeTenant: state.tenant,
        intendedDestination,
      });
    },
    [state.profile, state.memberships, state.tenant]
  );

  const signIn = useCallback(
    async (email: string, password: string, from?: string): Promise<{ redirectTo: string }> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      if (!isSupabaseConfigured) {
        // Fallback para modo demo local sem credenciais
        const isSuperAdmin = email.toLowerCase().includes("admin");
        const mockProfile: UserProfile = {
          id: "demo-user-123",
          email,
          full_name: isSuperAdmin ? "Administrador MetricBarber" : "Carlos Silveira",
          phone: "11987654321",
          cpf: null,
          avatar_url: null,
          is_platform_admin: isSuperAdmin,
          platform_role: isSuperAdmin ? "super_admin" : null,
        };
        const mockTenant: TenantInfo = {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          slug: "vintage-barber",
          name: "Barbearia Vintage Club",
          trade_name: "Barbearia Vintage Club",
          phone: "11987654321",
          status: "active",
          trial_ends_at: null,
          primary_color: "#F28322",
        };
        const mockMembership: TenantMembership = {
          id: "mem-1",
          tenant_id: mockTenant.id,
          role: "owner",
          is_active: true,
          tenant: mockTenant,
        };

        setState({
          user: { id: "demo-user-123", email } as User,
          session: { access_token: "demo", token_type: "bearer", user: {} as User } as Session,
          profile: mockProfile,
          memberships: isSuperAdmin ? [] : [mockMembership],
          tenantMembership: isSuperAdmin ? null : mockMembership,
          tenant: isSuperAdmin ? null : mockTenant,
          tenantRole: isSuperAdmin ? null : "owner",
          loading: false,
          error: null,
        });

        return { redirectTo: isSuperAdmin ? "/admin/dashboard" : "/dashboard" };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }));
        throw error;
      }

      if (data.user) {
        const { profile, memberships, tenantMembership, tenant, tenantRole, error: fetchError } =
          await fetchUserData(data.user.id);

        setState({
          user: data.user,
          session: data.session,
          profile,
          memberships,
          tenantMembership,
          tenant,
          tenantRole,
          loading: false,
          error: fetchError ?? null,
        });

        const targetRoute = determineNextRoute({
          profile,
          memberships,
          activeTenant: tenant,
          intendedDestination: from,
        });

        return { redirectTo: targetRoute };
      }

      setState((prev) => ({ ...prev, loading: false }));
      return { redirectTo: "/onboarding/perfil" };
    },
    [fetchUserData]
  );

  const signInWithGoogle = useCallback(async (from?: string) => {
    // Preservar 'from' se existir
    if (from && !from.startsWith("/auth") && from !== "/") {
      sessionStorage.setItem("mb_auth_from", from);
    } else {
      sessionStorage.removeItem("mb_auth_from");
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("mb_active_tenant_id");
    sessionStorage.removeItem("mb_auth_from");
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      memberships: [],
      tenantMembership: null,
      tenant: null,
      tenantRole: null,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          if (mounted) setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn("Session error:", sessionError);
        }

        if (session?.user && mounted) {
          const { profile, memberships, tenantMembership, tenant, tenantRole, error: fetchError } =
            await fetchUserData(session.user.id);
          setState({
            user: session.user,
            session,
            profile,
            memberships,
            tenantMembership,
            tenant,
            tenantRole,
            loading: false,
            error: fetchError ?? null,
          });
        } else if (mounted) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.warn("Erro ao inicializar sessão:", err);
        if (mounted) setState((prev) => ({ ...prev, loading: false }));
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setState({
          user: null,
          session: null,
          profile: null,
          memberships: [],
          tenantMembership: null,
          tenant: null,
          tenantRole: null,
          loading: false,
          error: null,
        });
        return;
      }

      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const { profile, memberships, tenantMembership, tenant, tenantRole, error: fetchError } =
          await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
          memberships,
          tenantMembership,
          tenant,
          tenantRole,
          loading: false,
          error: fetchError ?? null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const updateTenantState = useCallback((updated: Partial<TenantInfo>) => {
    setState((prev) => {
      if (!prev.tenant) return prev;
      const updatedTenant = {
        ...prev.tenant,
        ...updated,
      };

      const updatedMemberships = prev.memberships.map((m) =>
        m.tenant_id === updatedTenant.id ? { ...m, tenant: updatedTenant } : m
      );

      return {
        ...prev,
        tenant: updatedTenant,
        memberships: updatedMemberships,
        tenantMembership: prev.tenantMembership
          ? { ...prev.tenantMembership, tenant: updatedTenant }
          : null,
      };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signInWithGoogle,
        signOut,
        getRedirectPath,
        switchTenant,
        refreshUserData,
        updateTenantState,
        isProfileComplete: isProfileComplete(state.profile),
        isTenantComplete: isTenantComplete(state.tenant),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
