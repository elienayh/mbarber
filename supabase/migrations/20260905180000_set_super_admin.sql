-- =============================================================================
-- METRICBARBER - MIGRATION 04: DEFINIR SUPER‑ADMIN (E‑MAIL FIXO)
-- =============================================================================
-- Este script garante que o usuário com e‑mail elienayhemerson@gmail.com
-- possui permissão de super‑admin em toda a plataforma.
-- =============================================================================

-- 1️⃣  Busca o usuário já existente no catálogo de autenticação do Supabase.
--     Caso ele ainda não exista, a migração simplesmente não terá efeito;
--     a conta deve ser criada normalmente no painel do Supabase antes de
--     executar esta migração.
WITH target_user AS (
  SELECT id, email
  FROM auth.users
  WHERE email = 'elienayhemerson@gmail.com'
)

-- 2️⃣  Insere ou atualiza o registro em public.profiles.
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    is_platform_admin,
    platform_role,
    created_at,
    updated_at
)
SELECT
    u.id,                     -- id da conta de autenticação
    u.email,
    'Super Admin',            -- nome completo (pode ser alterado)
    true,                     -- concede privilégios de super‑admin
    'super_admin',            -- papel opcional para uso interno
    now(),
    now()
FROM target_user u
ON CONFLICT (id) DO UPDATE
  SET
    is_platform_admin = EXCLUDED.is_platform_admin,
    platform_role     = EXCLUDED.platform_role,
    updated_at         = now();
