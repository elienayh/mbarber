-- Promote the existing global profile and align authentication/RLS with the platform RBAC model.
-- This migration is idempotent and does not create a tenant association.

INSERT INTO public.profiles (id, email, full_name, is_platform_admin, platform_role)
SELECT
  id,
  email,
  COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1)),
  true,
  'super_admin'
FROM auth.users
WHERE lower(email) = 'elienayhemerson@gmail.com'
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  is_platform_admin = true,
  platform_role = 'super_admin',
  updated_at = now();

-- Keep the claim-based contract documented by the master plan in sync for new sessions.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('is_platform_admin', true, 'platform_role', 'super_admin')
WHERE lower(email) = 'elienayhemerson@gmail.com';

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_platform_admin = true
    ),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS tenant_users_select ON public.tenant_users;
CREATE POLICY tenant_users_select ON public.tenant_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());
