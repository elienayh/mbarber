import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Building2, Mail, Lock, Phone, ArrowRight, Sparkles, Chrome, AlertCircle, Loader2 } from "lucide-react";
import { sanitizeSlug, validateSlugSyntax } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, getRedirectPath, refreshUserData } = useAuth();
  const [barberName, setBarberName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromParam =
    (location.state as any)?.from?.pathname ||
    new URLSearchParams(location.search).get("from") ||
    undefined;

  useEffect(() => {
    if (user) {
      const nextRoute = getRedirectPath(fromParam);
      navigate(nextRoute, { replace: true });
    }
  }, [user, getRedirectPath, fromParam, navigate]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setPhone(value);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanSlug = sanitizeSlug(barberName);
      const slugCheck = validateSlugSyntax(cleanSlug);
      if (!slugCheck.valid) {
        throw new Error(slugCheck.error || "Nome de barbearia inválido.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: barberName,
            phone,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!data.session) {
        setError("Cadastro criado! Verifique seu e-mail para confirmar a conta antes de acessar.");
        setLoading(false);
        return;
      }

      if (data.user) {
        // Criar tenant via RPC
        const { error: tenantError } = await (supabase.rpc as any)("create_tenant_for_current_user", {
          p_slug: cleanSlug,
          p_name: barberName.trim(),
          p_trade_name: barberName.trim(),
          p_phone: phone.trim(),
          p_email: email.trim(),
        });

        if (tenantError) {
          console.warn("Aviso ao criar tenant inicial:", tenantError);
        }

        await refreshUserData();
        navigate("/dashboard", { replace: true });
      }
    } catch (registerError: any) {
      setError(registerError?.message || "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle(fromParam);
    } catch {
      setError("Não foi possível iniciar o cadastro com Google. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="auth-card w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-accent">
            MB
          </div>
          <h2 className="text-2xl font-black text-white">Criar Nova Barbearia</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full surface-accent-soft text-accent text-xs font-bold mt-2 border border-accent">
            <Sparkles className="w-3.5 h-3.5" /> 35 dias de Trial Gratuito • Sem Cartão
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full py-3 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 mb-4 transition disabled:opacity-50"
        >
          <Chrome className="w-4 h-4" /> Cadastrar com Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" /> ou com e-mail <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Nome da Barbearia</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="Ex: Barbearia Navalha de Ouro"
                value={barberName}
                onChange={(e) => setBarberName(e.target.value)}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
            {barberName && (
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Link: mbarber.com.br/{sanitizeSlug(barberName)}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">WhatsApp Comercial</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                required
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">E-mail de Acesso</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="dono@barbearia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Criar Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ color: "#ffffff" }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Criando barbearia...</span>
              </>
            ) : (
              <>
                <span>Iniciar 35 Dias Grátis</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Já possui barbearia cadastrada?{" "}
          <Link to="/auth/login" className="text-accent font-bold hover:underline">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
};
