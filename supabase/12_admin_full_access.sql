-- SalesDesk Admin Access Policy
-- Admin users must have unrestricted access to every current ERP table.
-- This migration adds an authenticated-only admin policy to every RLS-enabled
-- public application table. It never grants anon/public access.
--
-- Future tables: include the same policy in their migration:
-- CREATE POLICY "admin_full_access" ON public.<table>
--   FOR ALL TO authenticated
--   USING (public.my_role() = 'admin')
--   WITH CHECK (public.my_role() = 'admin');

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'admin_full_access',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.my_role() = ''admin'') WITH CHECK (public.my_role() = ''admin'')',
      'admin_full_access',
      r.table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.has_permission(p text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.my_role() = 'admin'
     OR EXISTS (
       SELECT 1
       FROM public.role_permissions rp
       JOIN public.app_users u ON u.role = rp.role
       WHERE u.user_id = auth.uid()
         AND (rp.permission = '*' OR rp.permission = p)
         AND rp.allowed = true
     )
$function$;

REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
