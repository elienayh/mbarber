import type { User, Session } from "@supabase/supabase-js";
import type { TenantRole, TenantStatus } from "./database";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
  platform_role: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  trade_name: string;
  phone: string | null;
  email?: string | null;
  status: TenantStatus | string;
  trial_ends_at: string | null;
  primary_color: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip_code?: string | null;
  settings?: any;
  created_at?: string;
  updated_at?: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  role: TenantRole | string;
  is_active: boolean;
  tenant?: TenantInfo;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: TenantMembership[];
  tenantMembership: TenantMembership | null;
  tenant: TenantInfo | null;
  tenantRole: string | null;
  loading: boolean;
  error: string | null;
}
