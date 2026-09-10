import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, Chrome, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signInWithGoogle, getRedirectPath } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Recuperar parâmetro de redirecionamento original 'from'
  const fromParam =
    (location.state as any)?.from?.pathname ||
    new URLSearchParams(location.search).get("from") ||
    undefined;

  // Se o usuário já estiver autenticado, redireciona diretamente para a rota apropriada
  useEffect(() => {
    if (user) {
      const nextRoute = getRedirectPath(fromParam);
      navigate(nextRoute, { replace: true });
    }
  }, [user, getRedirectPath, fromParam, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { redirectTo } = await signIn(email, password, fromParam);
      if (redirectTo === "/auth/login") {
        setError("A conta foi autenticada, mas não possui um acesso ativo.");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const message = err?.message || "";
      if (message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos. Verifique seus dados e tente novamente.");
      } else if (message.includes("Email not confirmed")) {
        setError("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.");
      } else if (message.includes("Too many requests")) {
        setError("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Não foi possível realizar o login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setError(null);
    setForgotLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setForgotLoading(false);

    if (resetError) {
      setError("Não foi possível enviar o link de recuperação. Tente novamente.");
      return;
    }

    setForgotSent(true);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle(fromParam);
    } catch {
      setError("Não foi possível iniciar o login com Google. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="auth-card w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-accent">
            MB
          </div>
          <h2 className="text-2xl font-black text-white">Acesse o MetricBarber</h2>
          <p className="text-xs text-slate-400 mt-1">
            Entre no painel de gestão da sua barbearia
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-300 mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Modo Demonstração Interativo</span>
            </div>
            <p className="text-xs text-amber-200/80 mb-3 leading-relaxed">
              Credenciais do Supabase não configuradas no momento. Use os acessos rápidos abaixo para testar todos os módulos:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setEmail("vintage@metricbarber.com");
                  setPassword("demo1234");
                  setLoading(true);
                  const res = await signIn("vintage@metricbarber.com", "demo1234", fromParam);
                  navigate(res.redirectTo);
                }}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition text-left"
              >
                🏪 Barbearia (Tenant)
              </button>
              <button
                type="button"
                onClick={async () => {
                  setEmail("admin@metricbarber.com");
                  setPassword("admin1234");
                  setLoading(true);
                  const res = await signIn("admin@metricbarber.com", "admin1234", fromParam);
                  navigate(res.redirectTo);
                }}
                className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-semibold transition text-left"
              >
                🛡️ Super Admin SaaS
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-300 leading-relaxed">{error}</span>
          </div>
        )}

        {forgotSent && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            Enviamos um link de recuperação para este e-mail. Verifique sua caixa de entrada.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition shadow-inner"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-200">Senha</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="text-xs text-accent hover:underline disabled:opacity-50 font-medium"
              >
                {forgotLoading ? "Enviando..." : "Esqueceu?"}
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Entrando...</span>
              </>
            ) : (
              <>
                <span>Entrar na Conta</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" /> ou <span className="h-px flex-1 bg-slate-800" />
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-900 transition"
        >
          <Chrome className="w-4 h-4" /> Continuar com Google
        </button>

        <div className="mt-6 text-center text-xs text-slate-400">
          Ainda não tem uma conta?{" "}
          <Link to="/auth/register" className="text-accent font-bold hover:underline">
            Criar barbearia (35 dias grátis)
          </Link>
        </div>
      </div>
    </div>
  );
};
