# SalesDesk production-readiness review

Reviewed 2026-10-09 against the local source tree, the connected GitHub default branch, and the live Supabase project `sales-order-management` (`noldgjtoqhwefqdzdpzs`). The extracted local directory has no `.git` metadata; local edits do not change GitHub.

## Changes made

- `supabase/16_finance_role_access_hardening.sql` aligns `sales_invoices`, `payments`, and `company_profile` RLS with the application's finance/admin roles. Direct deletion is admin-only for invoice and payment records. It also removes unnecessary table privileges such as `TRUNCATE`, `TRIGGER`, and `REFERENCES` from the API roles.
- `supabase/17_security_definer_access_hardening.sql` revokes anonymous access to the admin-only party-link creation RPC and pins the admin-assignment trigger's search path.
- Both SQL migrations were applied to the connected Supabase project. No rows were changed.
- `server.cjs` now allows only GET/HEAD, checks canonical paths (including symlinks), and sets local development security headers.
- `_headers` now permits microphone access only to the app's own origin, which keeps the voice feature usable while denying camera/geolocation/payment access.
- The GitHub Pages workflow now runs repository checks, the existing test suite, version validation, and web build before deployment; pull requests to `main` run the quality gate without deploying.
- Generated `dist/` output is ignored so a deployment build is not mistaken for source code.
- Dependabot now checks GitHub Actions and Android Gradle dependencies weekly.
- `production-schema-contract.json` identifies `company_profile` as an existing production table whose base schema is not in this repository; the schema check no longer treats that known production-only table as missing.

## Remaining items

### High

- Supabase Auth's leaked-password protection is disabled. Enable it under the project's Auth password/security settings; this is an Auth configuration setting rather than a SQL migration.
- The deployment workflow uses GitHub Pages, which ignores `_headers`. As a result, the response headers in that file do not protect the deployed site. Deploy with a host that applies `_headers` (such as Cloudflare Pages/Netlify) or place a trusted proxy in front of GitHub Pages if full response-header enforcement is required.

### Medium

- Public customer portal functions intentionally remain callable without staff login and rely on an unguessable active link. Existing portal slugs were generated from 12 hex characters and tokens from 24 hex characters using `md5(random())`; plan a non-disruptive migration to cryptographically generated, longer slugs/tokens and rate limits. Existing links were not rotated, so customers are not logged out by this review.
- The Supabase advisor still reports 16 unindexed foreign keys, six row-security expressions that can be optimized with scalar subqueries, one duplicate notification index, and one pair of overlapping read policies for daily prices. Review query plans and usage before dropping or adding indexes.
- `app_users`, `number_sequences`, and `role_permissions` have RLS enabled with no direct policies. This is fail-closed and is intentional only while access continues through the restricted RPC/security-definer helpers; keep their direct API grants revoked.

## Current Supabase verification

After the migrations, finance tables use finance permission checks, payment and invoice deletion is admin-only, the anonymous admin-link RPC warning and mutable trigger search-path warning cleared, and the duplicate permissive payment policies cleared. Six anonymous security-definer RPC warnings remain for public customer portal operations; these are intentional capability-link endpoints and should stay tightly validated.

The SQL changes were policy/grant/function configuration only; no customer, order, payment, payroll, or other business rows were read or modified by the migrations.
