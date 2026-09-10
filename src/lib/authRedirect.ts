import type { UserProfile, TenantInfo, TenantMembership } from "@/types/auth";

export const RESERVED_SLUGS = [
  "admin",
  "auth",
  "dashboard",
  "agenda",
  "clientes",
  "servicos",
  "profissionais",
  "financeiro",
  "estoque",
  "relatorios",
  "configuracoes",
  "onboarding",
  "api",
  "login",
  "register",
  "reset-password",
  "app",
  "mbarber",
  "public",
  "home",
  "terms",
  "privacy",
  "suporte",
  "planos",
  "demo",
  "static",
  "assets",
  "v1",
  "webhook",
];

/**
 * Normaliza e gera um slug limpo a partir de uma string
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validação síncrona preliminar do slug
 */
export function validateSlugSyntax(slug: string): { valid: boolean; error?: string } {
  const clean = slug.trim().toLowerCase();

  if (!clean) {
    return { valid: false, error: "O slug não pode ser vazio." };
  }

  if (clean.length < 3) {
    return { valid: false, error: "O link deve ter no mínimo 3 caracteres." };
  }

  if (clean.length > 60) {
    return { valid: false, error: "O link deve ter no máximo 60 caracteres." };
  }

  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(clean)) {
    return {
      valid: false,
      error: "O link deve conter apenas letras minúsculas, números e hífens (não pode iniciar ou terminar com hífen).",
    };
  }

  if (RESERVED_SLUGS.includes(clean)) {
    return {
      valid: false,
      error: "Este termo é reservado pelo sistema e não pode ser usado como link público.",
    };
  }

  return { valid: true };
}

/**
 * Verifica se o perfil do usuário possui todos os campos obrigatórios preenchidos
 * Obrigatórios: Nome completo e Telefone/WhatsApp
 */
export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.full_name && profile.full_name.trim().length >= 2);
  const rawPhone = profile.phone ? profile.phone.replace(/\D/g, "") : "";
  const hasPhone = rawPhone.length >= 10;
  return hasName && hasPhone;
}

/**
 * Verifica se a barbearia possui dados mínimos configurados
 * Obrigatórios: Nome, Slug e Telefone comercial
 */
export function isTenantComplete(tenant: TenantInfo | null | undefined): boolean {
  if (!tenant) return false;
  const hasName = Boolean(tenant.name && tenant.name.trim().length >= 2);
  const hasSlug = Boolean(tenant.slug && tenant.slug.trim().length >= 3 && !RESERVED_SLUGS.includes(tenant.slug));
  const rawPhone = tenant.phone ? tenant.phone.replace(/\D/g, "") : "";
  const hasPhone = rawPhone.length >= 10;
  return hasName && hasSlug && hasPhone;
}

/**
 * Determina a rota de destino do usuário após autenticação (Google ou e-mail/senha),
 * respeitando o estado do perfil, memberships, barbearia e rota original ("from").
 *
 * NUNCA retorna "/" para usuários autenticados.
 */
export function determineNextRoute({
  profile,
  memberships,
  activeTenant,
  intendedDestination,
}: {
  profile: UserProfile | null;
  memberships: TenantMembership[];
  activeTenant: TenantInfo | null;
  intendedDestination?: string | null;
}): string {
  // 1. Super Admin tem acesso prioritário ao painel do SaaS
  if (profile?.is_platform_admin) {
    if (intendedDestination && intendedDestination.startsWith("/admin")) {
      return intendedDestination;
    }
    return "/admin/dashboard";
  }

  // 2. Regra A: Usuário sem perfil completo → onboarding de perfil
  if (!isProfileComplete(profile)) {
    return "/onboarding/perfil";
  }

  // 3. Regra D e B: Verificar memberships ativos
  const activeMemberships = (memberships || []).filter((m) => m.is_active);

  // Se não possuir nenhum membership ativo:
  // Usuário é novo dono que precisa configurar a barbearia inicial
  if (activeMemberships.length === 0) {
    return "/onboarding/barbearia";
  }

  // Determinar o membership em uso
  const currentMembership =
    activeMemberships.find((m) => m.tenant_id === activeTenant?.id) || activeMemberships[0];

  // Regra B: Se for dono (owner) e a barbearia não estiver com dados completos
  if (currentMembership.role === "owner") {
    const targetTenant = activeTenant || currentMembership.tenant || null;
    if (!isTenantComplete(targetTenant)) {
      return "/onboarding/barbearia";
    }
  }

  // Regra C e D: Perfil + Barbearia configurados OU profissional convidado com perfil completo
  // Preservar 'from' se válido e não for rota pública/auth
  if (
    intendedDestination &&
    !intendedDestination.startsWith("/auth") &&
    !intendedDestination.startsWith("/onboarding") &&
    intendedDestination !== "/"
  ) {
    return intendedDestination;
  }

  return "/dashboard";
}
