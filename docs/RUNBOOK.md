# SalesDesk operations runbook

## Validate the repository

- `npm run check`
- `npm test`
- `npm run build:web`
- `npm run version:check`

## Supabase security checks

Run these read-only checks in SQL Editor:

    select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;
    select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
    select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') order by table_name,grantee,privilege_type;

## Add a user

Create the user in Supabase Authentication first, then add the matching auth.users.id to public.app_users with the required role. Never put a service-role key in the browser.

## Add a table

Create an idempotent migration, enable RLS, add explicit policies, review grants, update the access matrix, and add a schema-reference test if browser code accesses it.

## Key rotation

Rotate publishable/anon keys from Supabase Project Settings → API when required. Never commit a service-role or secret key.

## Backup / restore

Use Backup JSON for application-level exports. For disaster recovery use Supabase backups/PITR and test a restore before relying on it.

## Deployment

GitHub Pages deploys only dist/. Cloudflare/Netlify can additionally consume _headers for server-side security headers.
