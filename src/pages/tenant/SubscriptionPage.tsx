import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  ShieldCheck,
  Plus,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
  HelpCircle,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, extractFunctionErrorMessage } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  max_professionals: number;
  features: Record<string, boolean>;
  is_active: boolean;
}

interface SubscriptionData {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: "active" | "trial" | "past_due" | "canceled" | "unpaid" | "incomplete";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plans?: PlanItem;
}

export const SubscriptionPage: React.FC = () => {
  const { tenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activeProfessionalsCount, setActiveProfessionalsCount] = useState<number>(0);

  // Modal para Adicionar Barbeiro
  const [isAddBarberModalOpen, setIsAddBarberModalOpen] = useState(false);
  const [targetBarberCount, setTargetBarberCount] = useState<number>(2);

  // Status de retorno do checkout via query param
  const checkoutStatus = searchParams.get("checkout");

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Carregar planos ativos
      const { data: plansData, error: plansError } = await (supabase.from("plans") as any)
        .select("id, name, slug, description, price_cents, billing_cycle, max_professionals, features, is_active")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      if (plansError) {
        console.error("Erro ao carregar planos:", plansError);
      } else {
        setPlans(plansData || []);
      }

      // 2. Carregar assinatura da barbearia
      const { data: subData, error: subError } = await (supabase.from("subscriptions") as any)
        .select(`
          id,
          tenant_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          plans (
            id, name, slug, description, price_cents, billing_cycle, max_professionals, features, is_active
          )
        `)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        console.error("Erro ao carregar assinatura:", subError);
      } else {
        setSubscription(subData || null);
      }

      // 3. Contar profissionais ativos cadastrados
      const { count, error: countError } = await (supabase.from("professionals") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);

      if (!countError && count !== null) {
        setActiveProfessionalsCount(count);
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados de assinatura:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // Constante comercial unificada: R$ 29,90 por profissional/mês (2990 centavos)
  const PRICE_PER_PROFESSIONAL_CENTS = 2990;

  // Plano atual identificado
  const currentPlan = useMemo(() => {
    if (subscription?.plans) return subscription.plans;
    return null;
  }, [subscription]);

  // Limite de profissionais do plano atual
  const maxAllowedProfessionals = useMemo(() => {
    if (currentPlan?.max_professionals) return currentPlan.max_professionals;
    return 1;
  }, [currentPlan]);

  // Sincronizar targetBarberCount ao abrir o modal
  useEffect(() => {
    setTargetBarberCount(Math.max(1, maxAllowedProfessionals + 1));
  }, [maxAllowedProfessionals, isAddBarberModalOpen]);

  // Próximo plano para a ação de Adicionar Barbeiro
  const nextTierPlan = useMemo(() => {
    if (!plans.length) return null;
    const sorted = [...plans].sort((a, b) => a.max_professionals - b.max_professionals);
    if (!currentPlan) {
      return sorted.find((p) => p.slug === "pro") || sorted[0];
    }
    const higher = sorted.find((p) => p.max_professionals > currentPlan.max_professionals);
    return higher || null;
  }, [plans, currentPlan]);

  // Status visual da assinatura
  const currentStatus = useMemo(() => {
    if (subscription?.status === "active") {
      return {
        label: "Ativa",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        description: "Seu plano está ativo e com todos os recursos liberados.",
        color: "emerald",
      };
    }
    if (subscription?.status === "past_due") {
      return {
        label: "Pagamento pendente",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        description: "Houve uma pendência na última cobrança. Atualize sua forma de pagamento para evitar o bloqueio.",
        color: "amber",
      };
    }
    if (subscription?.status === "canceled") {
      return {
        label: "Cancelada",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        description: "A assinatura foi cancelada. Assine novamente para continuar utilizando o sistema.",
        color: "rose",
      };
    }
    if (tenant?.status === "trial") {
      return {
        label: "Em período de teste (35 dias)",
        badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
        description: "Você está no período de avaliação gratuita de 35 dias do MetricBarber.",
        color: "amber",
      };
    }
    return {
      label: "Nenhum plano ativo",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      description: "Escolha a quantidade de barbeiros para ativar os recursos completos da barbearia.",
      color: "slate",
    };
  }, [subscription, tenant]);

  // Iniciar checkout de assinatura proporcional (R$ 29,90 por profissional/mês)
  const handleStartSubscription = async (targetSlug = "solo", seatsCount?: number) => {
    if (!tenant?.id) return;
    setActionLoading(true);
    setErrorMessage(null);

    const professionalsCount = seatsCount || (targetSlug === "pro" ? 2 : targetSlug === "enterprise" ? 3 : 1);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
        body: {
          tenant_id: tenant.id,
          plan_slug: targetSlug,
          professionals_count: professionalsCount,
          origin: window.location.origin,
        },
      });

      if (error || !data?.url) {
        const message = await extractFunctionErrorMessage(
          error,
          "Não foi possível iniciar o pagamento. Verifique a conexão e tente novamente."
        );
        setErrorMessage(message);
        return;
      }

      // Redireciona diretamente para a tela de pagamento seguro
      window.location.href = data.url;
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocorreu um erro ao processar o checkout.");
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir portal de gerenciamento de faturas e cartões
  const handleOpenBillingPortal = async () => {
    if (!tenant?.id) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-portal-session", {
        body: {
          tenant_id: tenant.id,
          origin: window.location.origin,
        },
      });

      if (error || !data?.url) {
        const message = await extractFunctionErrorMessage(
          error,
          "Nenhuma assinatura ativa encontrada para gerenciar. Assine um plano para liberar essa função."
        );
        setErrorMessage(message);
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocorreu um erro ao abrir o painel de faturas.");
    } finally {
      setActionLoading(false);
    }
  };

  const clearQueryStatus = () => {
    searchParams.delete("checkout");
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Alerta de Retorno do Checkout */}
      {checkoutStatus === "success" && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Assinatura realizada com sucesso!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                Obrigado por assinar o MetricBarber. O status do seu plano foi atualizado e seus recursos estão liberados.
              </p>
            </div>
          </div>
          <button
            onClick={clearQueryStatus}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {checkoutStatus === "cancelled" && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Processo não concluído</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                O pagamento foi cancelado ou fechado antes da conclusão. Nenhuma cobrança foi efetuada. Você pode tentar novamente a qualquer momento.
              </p>
            </div>
          </div>
          <button
            onClick={clearQueryStatus}
            className="text-amber-700 hover:text-amber-900 text-xs font-semibold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-accent" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Assinatura</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie seu plano, capacidade de profissionais e informações de faturamento da sua barbearia.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          title="Atualizar dados"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Mensagem de Erro Geral */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CARD PRINCIPAL: DETALHES DA ASSINATURA */}
      <div className="surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plano Atual</span>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {currentPlan?.name || "Nenhum plano ativo"}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${currentStatus.badgeClass}`}
              >
                {currentStatus.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">{currentStatus.description}</p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 font-medium block">Valor</span>
            <div className="text-2xl font-black text-slate-900">
              {subscription?.status === "active"
                ? formatCurrency(currentPlan?.price_cents || maxAllowedProfessionals * PRICE_PER_PROFESSIONAL_CENTS)
                : tenant?.status === "trial"
                ? `${formatCurrency(maxAllowedProfessionals * PRICE_PER_PROFESSIONAL_CENTS)}`
                : `${formatCurrency(PRICE_PER_PROFESSIONAL_CENTS)}`}
              <span className="text-xs font-normal text-slate-500">
                {subscription?.status === "active"
                  ? `/${currentPlan?.billing_cycle === "yearly" ? "ano" : "mês"}`
                  : tenant?.status === "trial"
                  ? `/mês (${maxAllowedProfessionals} barbeiro${maxAllowedProfessionals > 1 ? "s" : ""})`
                  : "/mês por barbeiro"}
              </span>
            </div>
            {tenant?.status === "trial" && (
              <span className="text-[11px] font-semibold text-amber-700 block mt-0.5">
                Teste gratuito por 35 dias
              </span>
            )}
          </div>
        </div>

        {/* Grade de Informações Chave */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50">
          {/* Periodicidade */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Periodicidade
            </span>
            <span className="text-sm font-bold text-slate-900 capitalize">
              {currentPlan?.billing_cycle === "yearly" ? "Anual" : "Mensal"}
            </span>
          </div>

          {/* Data de Início */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Data de Início
            </span>
            <span className="text-sm font-bold text-slate-900">
              {subscription?.current_period_start
                ? new Date(subscription.current_period_start).toLocaleDateString("pt-BR")
                : "—"}
            </span>
          </div>

          {/* Próxima Renovação */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Próxima Renovação
            </span>
            <span className="text-sm font-bold text-slate-900">
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
                : tenant?.trial_ends_at
                ? `Fim do teste: ${new Date(tenant.trial_ends_at).toLocaleDateString("pt-BR")}`
                : "—"}
            </span>
          </div>

          {/* Profissionais Cadastrados vs Permitidos */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Profissionais
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {activeProfessionalsCount} de {maxAllowedProfessionals}
              </span>
              <span className="text-[11px] text-slate-500">
                ({maxAllowedProfessionals - activeProfessionalsCount >= 0 ? `${maxAllowedProfessionals - activeProfessionalsCount} vagas` : "limite excedido"})
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Progresso de Profissionais */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 bg-white">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between mb-1 text-[11px] font-semibold text-slate-700">
              <span>Capacidade da Equipe</span>
              <span>
                {Math.min(100, Math.round((activeProfessionalsCount / (maxAllowedProfessionals || 1)) * 100))}% utilizado
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  activeProfessionalsCount >= maxAllowedProfessionals ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, Math.max(5, (activeProfessionalsCount / (maxAllowedProfessionals || 1)) * 100))}%`,
                }}
              />
            </div>
          </div>

          <div className="text-slate-500 text-[11px]">
            {activeProfessionalsCount >= maxAllowedProfessionals ? (
              <span className="text-amber-700 font-semibold">
                Você atingiu o limite de barbeiros do plano. Adicione outro barbeiro para contratar mais profissionais.
              </span>
            ) : (
              <span>Você pode cadastrar mais {maxAllowedProfessionals - activeProfessionalsCount} profissional(is).</span>
            )}
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Cobrança segura com cancelamento facilitado a qualquer momento.</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {subscription?.status === "active" ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddBarberModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar barbeiro</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenBillingPortal}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-white transition flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{actionLoading ? "Carregando..." : "Gerenciar assinatura"}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleStartSubscription("pro")}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition flex items-center gap-2 shadow-md shadow-accent/20 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{actionLoading ? "Processando..." : "Assinar plano"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PLANOS DISPONÍVEIS DO METRICBARBER */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Planos & Capacidade da Barbearia</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Regra simples e transparente: <strong className="text-slate-800">R$ 29,90 por barbeiro/profissional por mês</strong> com <strong className="text-slate-800">35 dias de teste grátis</strong>.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>35 dias de teste • Sem fidelidade</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => {
            const seats = p.max_professionals || 1;
            const isCurrent = (currentPlan?.slug === p.slug || maxAllowedProfessionals === seats) && subscription?.status === "active";
            const isPopular = p.slug === "pro" || seats === 2;
            const priceCents = seats * PRICE_PER_PROFESSIONAL_CENTS;

            return (
              <div
                key={p.id}
                className={`surface-card-light rounded-2xl p-6 border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : isPopular
                    ? "border-accent shadow-md shadow-accent/5"
                    : "border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-base text-slate-900">{p.name}</h4>
                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        Plano Atual
                      </span>
                    ) : isPopular ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-slate-950 uppercase">
                        Mais Escolhido
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-500 mb-4 min-h-[32px]">
                    {seats === 1
                      ? "1 barbeiro • R$ 29,90/mês"
                      : `${seats} barbeiros • R$ 29,90 por barbeiro (${formatCurrency(priceCents)}/mês)`}
                  </p>

                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {formatCurrency(priceCents)}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      /mês
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent mb-5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{seats} profissional{seats > 1 ? "is" : ""} (R$ 29,90/cada)</span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>35 dias de teste gratuito</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Agenda inteligente e chat público</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Controle financeiro e comissões</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Lembretes e notificações automáticas</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {isCurrent ? (
                    <button
                      type="button"
                      onClick={handleOpenBillingPortal}
                      disabled={actionLoading}
                      className="w-full py-2.5 rounded-xl border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-50 transition"
                    >
                      Plano Ativo • Ver Faturas
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartSubscription(p.slug, seats)}
                      disabled={actionLoading}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${
                        isPopular
                          ? "bg-accent hover-bg-accent text-slate-950"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      } disabled:opacity-50`}
                    >
                      {actionLoading ? "Carregando..." : subscription?.status === "active" ? "Mudar para este plano" : `Assinar (${formatCurrency(priceCents)}/mês)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: ADICIONAR BARBEIRO / PROFISSIONAL */}
      {isAddBarberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-900" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Adicionar Barbeiro</h3>
                  <p className="text-xs text-slate-500">R$ 29,90 por barbeiro/profissional por mês</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddBarberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Cada novo barbeiro contratado possui agenda individual, cálculo automático de comissões e acesso ao sistema. O valor é de <strong>R$ 29,90 por profissional/mês</strong>.
              </p>

              {/* Seletor Interativo de Cadeiras/Barbeiros */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Nova quantidade de barbeiros:</span>
                  <span className="text-[11px] text-slate-500">
                    Atualmente você possui {maxAllowedProfessionals} cadeira(s)
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    disabled={targetBarberCount <= maxAllowedProfessionals}
                    onClick={() => setTargetBarberCount((prev) => Math.max(maxAllowedProfessionals, prev - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 font-black disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-black text-base text-slate-900">
                    {targetBarberCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTargetBarberCount((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 bg-accent hover-bg-accent font-black"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Tabela de Comparação de Quantidade e Preço */}
              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                <div className="grid grid-cols-2 bg-slate-50 p-3 font-semibold text-slate-500 border-b border-slate-200">
                  <span>Configuração Atual</span>
                  <span className="text-accent font-bold">Após a Alteração</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Quantidade de Profissionais */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 font-medium">Capacidade de profissionais:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700 font-semibold">{maxAllowedProfessionals} barbeiro(s)</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-accent">
                        {targetBarberCount} barbeiro(s)
                      </span>
                    </div>
                  </div>

                  {/* Preço Unitário */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 font-medium">Preço por profissional:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700">R$ 29,90/mês</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900">R$ 29,90/mês</span>
                    </div>
                  </div>

                  {/* Valor Atual vs Novo Valor */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 font-medium">Total mensal da assinatura:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700 font-semibold">
                        {formatCurrency(maxAllowedProfessionals * PRICE_PER_PROFESSIONAL_CENTS)}/mês
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-black text-emerald-600 text-sm">
                        {formatCurrency(targetBarberCount * PRICE_PER_PROFESSIONAL_CENTS)}/mês
                      </span>
                    </div>
                  </div>

                  {/* Diferença */}
                  {targetBarberCount > maxAllowedProfessionals && (
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-semibold flex items-center justify-between">
                      <span>Acréscimo mensal (+{targetBarberCount - maxAllowedProfessionals} barbeiro{targetBarberCount - maxAllowedProfessionals > 1 ? "s" : ""}):</span>
                      <span>+{formatCurrency((targetBarberCount - maxAllowedProfessionals) * PRICE_PER_PROFESSIONAL_CENTS)}/mês</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Referência da Regra Comercial */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">Exemplo de valores proporcionais:</span>
                <div className="grid grid-cols-3 gap-1 pt-1 text-slate-600">
                  <div>• 1 barbeiro: <strong>R$ 29,90/mês</strong></div>
                  <div>• 2 barbeiros: <strong>R$ 59,80/mês</strong></div>
                  <div>• 3 barbeiros: <strong>R$ 89,70/mês</strong></div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  O valor é proporcional e cobrado no ciclo mensal da sua assinatura. Você será redirecionado para o checkout seguro para confirmar a adição de barbeiros.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddBarberModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-white transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  setIsAddBarberModalOpen(false);
                  const targetSlug = targetBarberCount === 1 ? "solo" : targetBarberCount === 2 ? "pro" : "enterprise";
                  await handleStartSubscription(targetSlug, targetBarberCount);
                }}
                className="px-5 py-2 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-xs transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Confirmar e Contratar ({formatCurrency(targetBarberCount * PRICE_PER_PROFESSIONAL_CENTS)}/mês)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
