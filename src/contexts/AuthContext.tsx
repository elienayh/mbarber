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
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ redirectTo: string }>;
  signOut: () => Promise<void>;
  /**
   * Determines the correct redirect path based on the authenticated user's
   * profile and tenant membership. Used after login and for route guards.
   *
   * Logic:
   * 1. If `is_platform_admin === true` → `/admin/dashboard`
   * 2. If the user has an active `tenant_users` record → `/dashboard`
   * 3. Fallback → `/` (landing page)
   *
   * Prepared for future subdomain split:
   *   - admin.mbarber.com.br → admin panel only
   *   - app.mbarber.com.br   → tenant panel only
   */
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
    loading: true,
    error: null,
  });

  /**
   * Fetches the user's profile from the `profiles` table and their
   * tenant membership from `tenant_users`. These two queries determine
   * whether the user is a platform admin or a barbershop owner/staff.
   */
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile (contains is_platform_admin flag)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, is_platform_admin, platform_role")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return { profile: null, tenantMembership: null };
      }

      // Fetch the user's active tenant membership (first active one)
      const { data: tenantUsers, error: tenantError } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      if (tenantError) {
        console.error("Error fetching tenant membership:", tenantError);
      }

      const tenantMembership = tenantUsers && tenantUsers.length > 0
        ? tenantUsers[0] as TenantMembership
        : null;

      return {
        profile: profile as UserProfile,
        tenantMembership,
      };
    } catch (err) {
      console.error("Unexpected error fetching user data:", err);
      return { profile: null, tenantMembership: null };
    }
  }, []);

  /**
   * Determines the correct redirect based on the user's role.
   * Prepared for future subdomain separation (admin.mbarber.com.br).
   */
  const getRedirectPath = useCallback((): string => {
    // Future: detect subdomain for routing
    // const hostname = window.location.hostname;
    // const isAdminSubdomain = hostname.startsWith("admin.");

    if (state.profile?.is_platform_admin) {
      return "/admin/dashboard";
    }

    if (state.tenantMembership?.is_active) {
      return "/dashboard";
    }

    // User exists but has no tenant and is not admin → landing
    return "/";
  }, [state.profile, state.tenantMembership]);

  /**
   * Sign in with email and password via Supabase Auth.
   * After authentication, fetches the user's profile and tenant data
   * to determine the correct redirect destination.
   */
  const signIn = useCallback(async (email: string, password: string): Promise<{ redirectTo: string }> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      throw error;
    }

    if (data.user) {
      const { profile, tenantMembership } = await fetchUserData(data.user.id);

      setState({
        user: data.user,
        session: data.session,
        profile,
        tenantMembership,
        loading: false,
        error: null,
      });

      // Determine redirect based on fetched data (not state, which hasn't updated yet)
      if (profile?.is_platform_admin) {
        return { redirectTo: "/admin/dashboard" };
      }
      if (tenantMembership?.is_active) {
        return { redirectTo: "/dashboard" };
      }
      return { redirectTo: "/" };
    }

    setState(prev => ({ ...prev, loading: false }));
    return { redirectTo: "/" };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      tenantMembership: null,
      loading: false,
      error: null,
    });
  }, []);

  // Initialize: check for existing session and listen for auth changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && mounted) {
        const { profile, tenantMembership } = await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
          tenantMembership,
          loading: false,
          error: null,
        });
      } else if (mounted) {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initializeAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT" || !session) {
          setState({
            user: null,
            session: null,
            profile: null,
            tenantMembership: null,
            loading: false,
            error: null,
          });
          return;
        }

        if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          const { profile, tenantMembership } = await fetchUserData(session.user.id);
          setState({
            user: session.user,
            session,
            profile,
            tenantMembership,
            loading: false,
            error: null,
          });
        }
      }
    );

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
