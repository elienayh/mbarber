import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
  platform_role: string | null;
}

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  trade_name: string;
  phone: string | null;
  status: string;
  trial_ends_at: string | null;
  primary_color: string | null;
}

interface TenantMembership {
  tenant_id: string;
  role: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  tenantMembership: TenantMembership | null;
  tenant: TenantInfo | null;
  tenantRole: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ redirectTo: string }>;
  signOut: () => Promise<void>;
  getRedirectPath: () => string;
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
    tenantMembership: null,
    tenant: null,
    tenantRole: null,
    loading: true,
    error: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
        .select("id, email, full_name, avatar_url, is_platform_admin, platform_role")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return { profile: null, tenantMembership: null, tenant: null, tenantRole: null, error: "profile_error" };
      }

      if (!profile) {
        return { profile: null, tenantMembership: null, tenant: null, tenantRole: null, error: "profile_missing" };
      }

      const { data: tenantMembership, error: tenantError } = await (supabase.from("tenant_users") as any)
        .select("tenant_id, role, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (tenantError) {
        console.error("Error fetching tenant membership:", tenantError);
      }

      let tenant: TenantInfo | null = null;
      let tenantRole: string | null = null;

      if (tenantMembership) {
        tenantRole = tenantMembership.role;
        const { data: tenantData, error: tenantFetchError } = await (supabase.from("tenants") as any)
          .select("id, slug, name, trade_name, phone, status, trial_ends_at, primary_color")
          .eq("id", tenantMembership.tenant_id)
          .maybeSingle();

        if (tenantFetchError) {
          console.error("Error fetching tenant:", tenantFetchError);
        }

        tenant = tenantData as TenantInfo | null;
      }

      return {
        profile: profile as UserProfile,
        tenantMembership: tenantMembership as TenantMembership | null,
        tenant,
        tenantRole,
        error: null,
      };
    } catch (err) {
      console.error("Unexpected error fetching user data:", err);
      return { profile: null, tenantMembership: null, tenant: null, tenantRole: null, error: "unexpected_auth_error" };
    }
  }, []);

  const getRedirectPath = useCallback((): string => {
    if (state.profile?.is_platform_admin) {
      return "/admin";
    }

    if (state.tenantMembership?.is_active) {
      return "/dashboard";
    }

    return "/";
  }, [state.profile, state.tenantMembership]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ redirectTo: string }> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }

    if (data.user) {
      const { profile, tenantMembership, tenant, tenantRole, error: fetchError } = await fetchUserData(data.user.id);

      setState({
        user: data.user,
        session: data.session,
        profile,
        tenantMembership,
        tenant,
        tenantRole,
        loading: false,
        error: fetchError ?? null,
      });

      if (profile?.is_platform_admin) {
        return { redirectTo: "/admin" };
      }

      if (tenantMembership?.is_active) {
        return { redirectTo: "/dashboard" };
      }

      return { redirectTo: "/auth/login" };
    }

    setState((prev) => ({ ...prev, loading: false }));
    return { redirectTo: "/auth/login" };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
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
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && mounted) {
        const { profile, tenantMembership, tenant, tenantRole, error: fetchError } = await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
          tenantMembership,
          tenant,
          tenantRole,
          loading: false,
          error: fetchError ?? null,
        });
      } else if (mounted) {
        setState((prev) => ({ ...prev, loading: false }));
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
          tenantMembership: null,
          tenant: null,
          tenantRole: null,
          loading: false,
          error: null,
        });
        return;
      }

      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const { profile, tenantMembership, tenant, tenantRole, error: fetchError } = await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
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

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, getRedirectPath }}>
      {children}
    </AuthContext.Provider>
  );
};
