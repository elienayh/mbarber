import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Copy,
  ExternalLink,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Lock,
  Unlock,
  Search,
} from "lucide-react";
import { sanitizeSlug, validateSlugSyntax } from "@/lib/authRedirect";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const TenantOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, tenant, loading, refreshUserData, isTenantComplete } = useAuth();

  const [sessionChecking, setSessionChecking] = useState<boolean>(true);
  const [currentAuthUser, setCurrentAuthUser] = useState(user);

  // Redirecionamento idempotente: se o usuário já possui barbearia completa, navega direto ao dashboard
  useEffect(() => {
    if (!loading && !sessionChecking && isTenantComplete) {
      const fromParam = (location.state as any)?.from?.pathname || sessionStorage.getItem("mb_auth_from");
      sessionStorage.removeItem("mb_auth_from");
      if (fromParam && !fromParam.startsWith("/auth") && !fromParam.startsWith("/onboarding") && fromParam !== "/") {
        navigate(fromParam, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [loading, sessionChecking, isTenantComplete, navigate, location.state]);

  const [name, setName] = useState(tenant?.name || "");
  const [slug, setSlug] = useState(tenant?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(tenant?.slug));
  const [phone, setPhone] = useState(tenant?.phone || profile?.phone || "");
  const [email, setEmail] = useState(tenant?.email || user?.email || "");
  const [street, setStreet] = useState(tenant?.address_street || "");
  const [number, setNumber] = useState(tenant?.address_number || "");
  const [neighborhood, setNeighborhood] = useState(tenant?.address_neighborhood || "");
  const [city, setCity] = useState(tenant?.address_city || "");
  const [state, setState] = useState(tenant?.address_state || "");
  const [zipCode, setZipCode] = useState(tenant?.address_zip_code || "");
  const [cepLoading, setCepLoading] = useState(false);
  const [isAddressUnlocked, setIsAddressUnlocked] = useState<boolean>(
    Boolean(tenant?.address_zip_code && (tenant?.address_city || tenant?.address_street))
  );
  const [cepStatus, setCepStatus] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string | null;
  }>({
    status: tenant?.address_zip_code ? "success" : "idle",
    message: null,
  });

  // Monitorar e validar sessão ativa do Supabase Auth para prevenir condições de corrida
  useEffect(() => {
    let active = true;

    const verifyCurrentSession = async () => {
      if (user) {
        if (active) {
          setCurrentAuthUser(user);
          setSessionChecking(false);
        }
        return;
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          if (active) {
            setCurrentAuthUser(authUser);
            setSessionChecking(false);
          }
          await refreshUserData();
        } else if (!loading) {
          if (active) setSessionChecking(false);
        }
      } catch (err) {
        console.warn("Aviso ao validar sessão inicial do onboarding:", err);
        if (active) setSessionChecking(false);
      }
    };

    verifyCurrentSession();

    return () => {
      active = false;
    };
  }, [user, loading, refreshUserData]);

  // Sincronizar dados caso usuário/sessão seja restaurada após o mount
  useEffect(() => {
    const effectiveEmail = currentAuthUser?.email || user?.email;
    if (effectiveEmail && !email) {
      setEmail(effectiveEmail);
    }
    const effectivePhone = profile?.phone || currentAuthUser?.user_metadata?.phone;
    if (effectivePhone && !phone) {
      setPhone(effectivePhone);
    }
  }, [currentAuthUser, user, profile]);

  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string | null;
  }>({
    checking: false,
    available: null,
    message: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Se o usuário já possui barbearia cadastrada e ativa, redirecionar diretamente para o Dashboard
  useEffect(() => {
    if (!loading && !sessionChecking && tenant?.id && !submitting) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, sessionChecking, tenant?.id, submitting, navigate]);

  // Auto-gerar slug a partir do nome caso o usuário não tenha editado manualmente
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      const generated = sanitizeSlug(name);
      setSlug(generated);
    }
  }, [name, slugManuallyEdited]);

  // Busca automática de endereço por CEP (ViaCEP) e liberação dos campos
  const lookupCep = async (cleanCep: string) => {
    if (cleanCep.length !== 8) {
      setIsAddressUnlocked(false);
      setCepStatus({ status: "idle", message: null });
      return;
    }

    setCepLoading(true);
    setCepStatus({ status: "loading", message: "Buscando endereço pelo CEP..." });

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepStatus({
          status: "error",
          message: "CEP não localizado nos Correios. Verifique o número digitado.",
        });
        setIsAddressUnlocked(false);
      } else {
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);

        setIsAddressUnlocked(true);
        setCepStatus({
          status: "success",
          message: `Endereço localizado: ${data.localidade} - ${data.uf}. Campos liberados para preenchimento!`,
        });
      }
    } catch (err) {
      console.warn("Erro ao consultar ViaCEP:", err);
      setCepStatus({
        status: "error",
        message: "Não foi possível consultar os Correios automaticamente. Campos liberados para preenchimento manual.",
      });
      setIsAddressUnlocked(true);
    } finally {
      setCepLoading(false);
    }
  };

  // Verificar disponibilidade do slug
  const checkSlugAvailability = useCallback(
    async (candidateSlug: string) => {
      const syntax = validateSlugSyntax(candidateSlug);
      if (!syntax.valid) {
        setSlugStatus({
          checking: false,
          available: false,
          message: syntax.error || "Slug inválido",
        });
        return;
      }

      setSlugStatus({ checking: true, available: null, message: null });

      try {
        // Tenta chamar a RPC do Supabase se existir
        const { data, error: rpcError } = await (supabase.rpc as any)("check_slug_availability", {
          p_slug: candidateSlug,
          p_exclude_tenant_id: tenant?.id || null,
        });

        if (!rpcError && data) {
          setSlugStatus({
            checking: false,
            available: Boolean(data.available),
            message: data.available ? "Link público disponível!" : data.error || "Link já em uso.",
          });
          return;
        }

        // Fallback: consulta direta na tabela tenants
        const query = (supabase.from("tenants") as any).select("id").eq("slug", candidateSlug);
        if (tenant?.id) {
          query.neq("id", tenant.id);
        }
        const { data: existing } = await query.maybeSingle();

        if (existing) {
          setSlugStatus({
            checking: false,
            available: false,
            message: "Este link público já está sendo utilizado.",
          });
        } else {
          setSlugStatus({
            checking: false,
            available: true,
            message: "Link público disponível!",
          });
        }
      } catch {
        setSlugStatus({ checking: false, available: true, message: null });
      }
    },
    [tenant?.id]
  );

  useEffect(() => {
    if (!slug) {
      setSlugStatus({ checking: false, available: null, message: null });
      return;
    }

    const timer = setTimeout(() => {
      checkSlugAvailability(slug);
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, checkSlugAvailability]);

  // Máscara de telefone
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

  // Máscara de CEP com consulta automática de endereço
  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 8) return;

    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setZipCode(formatted);

    if (raw.length === 8) {
      lookupCep(raw);
    } else {
      setIsAddressUnlocked(false);
      setCepStatus({
        status: "idle",
        message: "Digite o CEP completo (8 dígitos) para buscar cidade e estado e liberar o restante do endereço.",
      });
    }
  };

  const handleSlugInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setSlug(sanitizeSlug(e.target.value));
  };

  const handleCopyLink = () => {
    const publicUrl = `https://www.mbarber.com.br/${createdSlug || slug}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Informe o nome da sua barbearia.");
      return;
    }

    const cleanSlug = sanitizeSlug(slug);
    const syntax = validateSlugSyntax(cleanSlug);
    if (!syntax.valid) {
      setError(syntax.error || "Link público inválido.");
      return;
    }

    if (slugStatus.available === false) {
      setError(slugStatus.message || "Este link público já está em uso.");
      return;
    }

    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      setError("Informe o WhatsApp comercial da barbearia.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Verificação obrigatória: garantir sessão válida do Supabase e obter o usuário com supabase.auth.getUser()
      const { data: authData, error: authError } = await supabase.auth.getUser();
      let authenticatedUser = authData?.user;

      if (authError || !authenticatedUser) {
        // Tentar verificar sessão ativa se o token estiver sendo atualizado
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          authenticatedUser = session.user;
        } else if (user) {
          authenticatedUser = user;
        } else {
          throw new Error("Sessão de autenticação não encontrada ou expirada. Faça login novamente.");
        }
      }

      if (!authenticatedUser?.id) {
        throw new Error("Não foi possível identificar o usuário autenticado. Faça login novamente.");
      }

      // 2. Garantir que o perfil do usuário exista em public.profiles para satisfazer a foreign key tenant_users_user_id_fkey
      try {
        await (supabase.from("profiles") as any).upsert(
          {
            id: authenticatedUser.id,
            email: authenticatedUser.email || email.trim() || "",
            full_name:
              authenticatedUser.user_metadata?.full_name ||
              authenticatedUser.user_metadata?.name ||
              profile?.full_name ||
              cleanName,
            phone: phone.trim() || profile?.phone || authenticatedUser.user_metadata?.phone || null,
            avatar_url:
              authenticatedUser.user_metadata?.avatar_url ||
              authenticatedUser.user_metadata?.picture ||
              profile?.avatar_url ||
              null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (profileSyncErr) {
        console.warn("Aviso ao sincronizar perfil pré-onboarding:", profileSyncErr);
      }

      // 3. Determinar se o usuário já possui um tenant para evitar duplicações
      let targetTenantId = tenant?.id || null;

      if (!targetTenantId) {
        // Verificar em tenant_users
        const { data: existingMemberships } = await (supabase.from("tenant_users") as any)
          .select("tenant_id, role")
          .eq("user_id", authenticatedUser.id)
          .limit(1);

        if (existingMemberships && existingMemberships.length > 0) {
          targetTenantId = existingMemberships[0].tenant_id;
        } else {
          // Verificar em professionals
          const { data: proRecord } = await (supabase.from("professionals") as any)
            .select("tenant_id")
            .eq("user_id", authenticatedUser.id)
            .limit(1)
            .maybeSingle();

          if (proRecord?.tenant_id) {
            targetTenantId = proRecord.tenant_id;
          }
        }
      }

      if (targetTenantId) {
        // Se o tenant já existir (atualização ou reaproveitamento), atualiza os dados
        const { error: updateError } = await (supabase.from("tenants") as any)
          .update({
            name: cleanName,
            trade_name: cleanName,
            slug: cleanSlug,
            phone: phone.trim(),
            email: email.trim() || null,
            address_street: street.trim() || null,
            address_number: number.trim() || null,
            address_neighborhood: neighborhood.trim() || null,
            address_city: city.trim() || null,
            address_state: state || null,
            address_zip_code: zipCode.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetTenantId);

        if (updateError) throw updateError;

        // Garantir vínculo explícito como owner em tenant_users
        await (supabase.from("tenant_users") as any).upsert(
          {
            tenant_id: targetTenantId,
            user_id: authenticatedUser.id,
            role: "owner",
            is_active: true,
          },
          { onConflict: "tenant_id,user_id" }
        );

        localStorage.setItem("mb_active_tenant_id", targetTenantId);
      } else {
        // Criar novo tenant via RPC atômica caso o usuário ainda não possua barbearia
        const { data: newTenantResult, error: rpcError } = await (supabase.rpc as any)(
          "create_tenant_for_current_user",
          {
            p_name: cleanName,
            p_trade_name: cleanName,
            p_slug: cleanSlug,
            p_phone: phone.trim(),
            p_email: email.trim() || null,
            p_address_street: street.trim() || null,
            p_address: street.trim() || null,
            p_address_number: number.trim() || null,
            p_address_neighborhood: neighborhood.trim() || null,
            p_address_city: city.trim() || null,
            p_address_state: state || null,
            p_address_zip_code: zipCode.trim() || null,
            p_logo_url: null,
          }
        );

        if (rpcError) throw rpcError;
        targetTenantId = typeof newTenantResult === "object" && newTenantResult !== null ? newTenantResult.id : newTenantResult;

        if (targetTenantId) {
          localStorage.setItem("mb_active_tenant_id", targetTenantId);

          // Garantir persistência do vínculo como owner em tenant_users
          await (supabase.from("tenant_users") as any).upsert(
            {
              tenant_id: targetTenantId,
              user_id: authenticatedUser.id,
              role: "owner",
              is_active: true,
            },
            { onConflict: "tenant_id,user_id" }
          );
        }
      }

      // Sincronizar metadados do auth para garantir que telefone esteja disponível em toda a sessão
      try {
        await supabase.auth.updateUser({
          data: { phone: phone.trim(), full_name: profile?.full_name || authenticatedUser.user_metadata?.full_name || cleanName },
        });
      } catch (authMetaErr) {
        console.warn("Aviso ao atualizar user_metadata:", authMetaErr);
      }

      // Atualizar o contexto global imediatamente com os novos dados
      const freshData = await refreshUserData(authenticatedUser.id);
      const activeId = freshData?.tenant?.id || targetTenantId;
      if (activeId) {
        localStorage.setItem("mb_active_tenant_id", activeId);
      }

      const fromParam = (location.state as any)?.from?.pathname || sessionStorage.getItem("mb_auth_from");
      sessionStorage.removeItem("mb_auth_from");

      setSubmitting(false);

      if (fromParam && !fromParam.startsWith("/auth") && !fromParam.startsWith("/onboarding") && fromParam !== "/") {
        navigate(fromParam, { replace: true });
      } else {
        navigate("/dashboard?welcome=true", { replace: true });
      }
    } catch (err: any) {
      console.error("Erro ao salvar barbearia:", err);
      setError(err?.message || "Não foi possível cadastrar a barbearia. Tente novamente.");
      setSubmitting(false);
    }
  };

  const handleFinishAndGoToDashboard = async () => {
    const fromParam = (location.state as any)?.from?.pathname || sessionStorage.getItem("mb_auth_from");
    sessionStorage.removeItem("mb_auth_from");

    if (user?.id) {
      await refreshUserData(user.id);
    }

    if (fromParam && !fromParam.startsWith("/auth") && !fromParam.startsWith("/onboarding") && fromParam !== "/") {
      navigate(fromParam, { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  // Se a sessão estiver sendo restaurada ou carregando, aguardar para evitar condição de corrida
  if (loading || (sessionChecking && !user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-xs text-slate-400">Verificando sessão de autenticação...</p>
        </div>
      </div>
    );
  }

  // TELA DE SUCESSO APÓS SALVAR
  if (createdSlug) {
    const publicUrl = `https://www.mbarber.com.br/${createdSlug}`;
    const localUrl = `${window.location.origin}/${createdSlug}`;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-2">
            Configuração Concluída com Sucesso
          </div>

          <h2 className="text-2xl font-black text-white">Sua Barbearia está no Ar!</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Seus clientes já podem agendar horários pelo chat inteligente utilizando seu link exclusivo.
          </p>

          <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
              Link Público de Agendamento
            </span>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900 border border-slate-700">
              <span className="font-mono text-sm text-accent font-semibold truncate">
                {publicUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Link local para testes:</span>
              <a
                href={localUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline flex items-center gap-1"
              >
                Abrir chat <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleFinishAndGoToDashboard}
              className="w-full py-3.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent flex items-center justify-center gap-2"
            >
              <span>Acessar Painel da Barbearia</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href={localUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <span>Visualizar Chat do Cliente</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl my-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-accent">
            MB
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Configuração da Barbearia • 35 Dias Grátis
          </div>
          <h2 className="text-2xl font-black text-white">Dados da sua Barbearia</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Configure o nome, link público e endereço do seu estabelecimento para começar a receber agendamentos.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-300 leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Seção 1: Identificação e Link Público */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Nome da Barbearia <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Barbearia Navalha & Estilo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
                />
              </div>
            </div>

            {/* Slug Público */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-200">
                  Link Público Exclusivo <span className="text-red-400">*</span>
                </label>
                {slugStatus.checking && (
                  <span className="text-[11px] text-accent flex items-center gap-1 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando link...
                  </span>
                )}
                {!slugStatus.checking && slugStatus.available === true && (
                  <span className="text-[11px] text-emerald-400 font-medium">✓ Disponível</span>
                )}
                {!slugStatus.checking && slugStatus.available === false && (
                  <span className="text-[11px] text-red-400 font-medium">✗ {slugStatus.message}</span>
                )}
              </div>

              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="minha-barbearia"
                  value={slug}
                  onChange={handleSlugInput}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
                />
              </div>

              <div className="mt-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Link oficial:</span>
                <span className="text-accent font-semibold truncate ml-2">
                  https://www.mbarber.com.br/{slug || "seu-link"}
                </span>
              </div>
            </div>
          </div>

          {/* Seção 2: Contatos Comerciais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                WhatsApp Comercial <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                E-mail da Barbearia
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="contato@barbearia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Endereço (CEP como primeira parte; libera rua, número, etc. ao localizar cidade e estado) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <MapPin className="w-4 h-4 text-accent" />
                <span>Localização do Estabelecimento</span>
              </div>
              {isAddressUnlocked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                  <Unlock className="w-3 h-3" />
                  <span>Campos Liberados</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold">
                  <Lock className="w-3 h-3" />
                  <span>Aguardando CEP</span>
                </span>
              )}
            </div>

            {/* 1. CEP COMO PRIMEIRA PARTE DA SEÇÃO DE ENDEREÇO */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200">
                  CEP do Estabelecimento <span className="text-red-400">*</span>
                </label>
                {cepLoading && (
                  <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando cidade e estado...
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={handleZipCodeChange}
                  disabled={submitting}
                  maxLength={9}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono tracking-wider text-white placeholder:text-slate-500 focus:outline-none transition shadow-inner ${
                    isAddressUnlocked
                      ? "bg-slate-950 border border-emerald-500/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                      : "bg-slate-950 border border-slate-700 focus:border-accent focus:ring-2 focus:ring-accent/30"
                  }`}
                />
              </div>

              {/* Status e feedback da validação do CEP */}
              {cepStatus.message && (
                <div
                  className={`text-[11px] flex items-center gap-1.5 pt-0.5 ${
                    cepStatus.status === "success"
                      ? "text-emerald-400"
                      : cepStatus.status === "error"
                      ? "text-red-300"
                      : "text-slate-400"
                  }`}
                >
                  {cepStatus.status === "success" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                  {cepStatus.status === "error" && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />}
                  {cepStatus.status === "loading" && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-accent" />}
                  <span>{cepStatus.message}</span>
                </div>
              )}

              {!isAddressUnlocked && !cepStatus.message && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Digite o CEP com 8 dígitos para consultar a cidade e estado automaticamente e liberar o preenchimento da rua, número e bairro.
                </p>
              )}
            </div>

            {/* 2. DEMAIS CAMPOS DE ENDEREÇO (LIBERADOS SOMENTE APÓS O CEP SER CONSULTADO) */}
            <div
              className={`space-y-3 transition-all duration-200 ${
                isAddressUnlocked
                  ? "opacity-100"
                  : "opacity-40 pointer-events-none select-none"
              }`}
            >
              {!isAddressUnlocked && (
                <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300/90 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Campos bloqueados. Informe o CEP acima para preencher cidade e estado.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddressUnlocked(true)}
                    className="text-[10px] text-accent underline shrink-0 hover:text-white pointer-events-auto"
                  >
                    Preencher sem CEP
                  </button>
                </div>
              )}

              {/* Cidade e UF */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Cidade <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required={isAddressUnlocked}
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!isAddressUnlocked || submitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    UF <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={!isAddressUnlocked || submitting}
                    className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">UF</option>
                    {BRAZILIAN_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rua e Número */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Rua / Avenida
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rua Augusta"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    disabled={!isAddressUnlocked || submitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    placeholder="1420"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    disabled={!isAddressUnlocked || submitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  placeholder="Ex: Consolação"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  disabled={!isAddressUnlocked || submitting}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || slugStatus.available === false}
            className="w-full mt-4 py-3.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Criando Barbearia...</span>
              </>
            ) : (
              <>
                <span>Finalizar e Ativar Barbearia</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
