import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, memberships, tenant, loading, getRedirectPath, refreshUserData } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: any = null;

    const checkSessionAndRedirect = async () => {
      try {
        // Se ainda estiver carregando no AuthContext, aguardar
        if (loading) return;

        // Se houver usuário carregado
        if (user) {
          const savedFrom = sessionStorage.getItem("mb_auth_from") || undefined;
          sessionStorage.removeItem("mb_auth_from");

          const nextRoute = getRedirectPath(savedFrom);
          navigate(nextRoute, { replace: true });
          return;
        }

        // Se não houver usuário no AuthContext, verificar diretamente na API do Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setErrorMsg(error.message || "Erro ao processar autenticação com Google.");
          return;
        }

        if (session?.user) {
          // Sessão estabelecida no Supabase! Atualizar AuthContext para que user seja populado
          await refreshUserData();
          return;
        }

        if (!session) {
          // Dar uma janela de tolerância para o Supabase processar o hash de fragmento (#access_token)
          timeoutId = setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user) {
              await refreshUserData();
            } else {
              setErrorMsg("Não foi possível confirmar a sessão de login. Tente novamente.");
            }
          }, 3000);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Ocorreu um erro inesperado na autenticação.");
      }
    };

    checkSessionAndRedirect();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, profile, memberships, tenant, loading, navigate, getRedirectPath, refreshUserData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent">
          MB
        </div>

        {errorMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-xs text-red-300 leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate("/auth/login", { replace: true })}
              className="w-full py-3 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              <span>Voltar para o Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">Validando seu Acesso</h2>
            <p className="text-xs text-slate-400">
              Conectando com o Google e verificando seus dados no MetricBarber...
            </p>
            <div className="flex items-center justify-center gap-2 pt-4 text-accent text-sm font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Redirecionando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
