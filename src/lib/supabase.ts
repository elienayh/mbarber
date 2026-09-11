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

/**
 * Extrai a mensagem de erro detalhada retornada por uma Supabase Edge Function,
 * evitando a exibição da mensagem genérica "Edge Function returned a non-2xx status code".
 */
export async function extractFunctionErrorMessage(
  error: any,
  fallback = "Não foi possível concluir a operação com o servidor de pagamentos."
): Promise<string> {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  if (error.context) {
    try {
      if (typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error && typeof body.error === "string") return body.error;
        if (body?.message && typeof body.message === "string") return body.message;
      } else if (typeof error.context.text === "function") {
        const text = await error.context.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error && typeof parsed.error === "string") return parsed.error;
          if (parsed?.message && typeof parsed.message === "string") return parsed.message;
        } catch {
          if (text && text.length < 200) return text;
        }
      }
    } catch {
      // Ignora erro de parsing do stream
    }
  }

  if (error.message && !error.message.includes("non-2xx status code")) {
    return error.message;
  }

  return fallback;
}
