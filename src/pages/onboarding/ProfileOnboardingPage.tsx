import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { User, Mail, Phone, FileText, Camera, ArrowRight, Loader2, AlertCircle, LogOut } from "lucide-react";
import { determineNextRoute } from "@/lib/authRedirect";

export const ProfileOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, memberships, tenant, refreshUserData, signOut } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar dados existentes do perfil ou do OAuth
  useEffect(() => {
    if (profile) {
      if (profile.full_name && !fullName) setFullName(profile.full_name);
      if (profile.phone && !phone) setPhone(profile.phone);
      if (profile.cpf && !cpf) setCpf(profile.cpf);
      if (profile.avatar_url && !avatarUrl) setAvatarUrl(profile.avatar_url);
    } else if (user) {
      const meta = user.user_metadata || {};
      if ((meta.full_name || meta.name) && !fullName) {
        setFullName(meta.full_name || meta.name);
      }
      if (meta.phone && !phone) {
        setPhone(meta.phone);
      }
      if ((meta.avatar_url || meta.picture) && !avatarUrl) {
        setAvatarUrl(meta.avatar_url || meta.picture);
      }
    }
  }, [profile, user]);

  // Aplicar máscara de telefone brasileiro
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

  // Aplicar máscara de CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    setCpf(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Por favor, preencha seu nome completo.");
      return;
    }

    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      setError("Por favor, informe um número de telefone/WhatsApp válido com DDD.");
      return;
    }

    setLoading(true);

    try {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      const updatedProfileData = {
        id: user.id,
        email: user.email || "",
        full_name: cleanName,
        phone: phone.trim(),
        cpf: cpf.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // 1. Atualizar metadados de autenticação do usuário no Supabase Auth
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: cleanName,
            phone: phone.trim(),
            cpf: cpf.trim() || null,
            avatar_url: avatarUrl.trim() || null,
          },
        });
      } catch (authUpdateErr) {
        console.warn("Aviso ao atualizar metadados do auth:", authUpdateErr);
      }

      // 2. Atualizar perfil na tabela public.profiles
      const { error: profileError } = await (supabase.from("profiles") as any).upsert({
        id: user.id,
        email: user.email || "",
        full_name: cleanName,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.warn("Aviso ao sincronizar profiles:", profileError);
      }

      // Recarregar dados de autenticação
      await refreshUserData();

      // Recuperar rota original 'from' se existir
      const fromParam = (location.state as any)?.from?.pathname || sessionStorage.getItem("mb_auth_from") || undefined;
      sessionStorage.removeItem("mb_auth_from");

      // Calcular próximo destino
      const updatedProfileObj = {
        ...(profile || {}),
        ...updatedProfileData,
        is_platform_admin: profile?.is_platform_admin || false,
        platform_role: profile?.platform_role || null,
      };

      const nextRoute = determineNextRoute({
        profile: updatedProfileObj,
        memberships,
        activeTenant: tenant,
        intendedDestination: fromParam,
      });

      navigate(nextRoute, { replace: true });
    } catch (err: any) {
      console.error("Erro ao salvar perfil:", err);
      setError(err?.message || "Não foi possível salvar os dados do perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-accent">
            MB
          </div>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold mb-2">
            Etapa Obrigatória • Cadastro Pessoal
          </div>
          <h2 className="text-2xl font-black text-white">Complete seu Perfil</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Preencha seus dados de contato para liberar seu acesso ao painel do MetricBarber
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-300 leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-2">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || "Avatar"}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-700 shadow"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                  <User className="w-7 h-7" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Foto / Avatar (Opcional)</label>
              <input
                type="url"
                placeholder="Link da imagem ou foto"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="Ex: Carlos Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
          </div>

          {/* E-mail (Read-only) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-200">E-mail de Acesso</label>
              <span className="text-[11px] text-slate-500 font-medium">Vinculado ao Auth</span>
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                disabled
                value={user?.email || profile?.email || ""}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-400 cursor-not-allowed opacity-80"
              />
            </div>
          </div>

          {/* Telefone/WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Telefone / WhatsApp <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                required
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Utilizado para notificações e contato do sistema.
            </span>
          </div>

          {/* CPF (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              CPF <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCpfChange}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando Perfil...</span>
              </>
            ) : (
              <>
                <span>Salvar e Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair desta conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
