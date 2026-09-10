import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  !envUrl.includes("your-project") &&
  !envUrl.includes("dummy") &&
  !envAnonKey.includes("your-anon-key") &&
  !envAnonKey.includes("dummy")
);

if (!isSupabaseConfigured) {
  console.warn(
    "[MetricBarber] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas. O app funcionará com dados de demonstração em memória até que as credenciais do Supabase sejam fornecidas no painel de configurações."
  );
}

// Use a safe placeholder format when credentials are not yet defined to prevent runtime startup exceptions
const resolvedUrl = isSupabaseConfigured ? envUrl : "https://demo-preview-project.supabase.co";
const resolvedKey = isSupabaseConfigured
  ? envAnonKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0MjkyMDB9.dummy_preview_signature_token";

export const supabase = createClient<Database>(resolvedUrl, resolvedKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
