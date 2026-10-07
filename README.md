# SalesDesk

SalesDesk is a plain HTML/JavaScript business application backed by Supabase, with a custom Android WebView wrapper. The browser application remains the source of truth; authentication and database enforcement stay in Supabase.

## Main layout

- index.html — authenticated application shell
- customer/index.html — canonical customer portal
- customer.html — compatibility redirect to customer/
- p/index.html — public party balance page
- party.html — legacy public balance page
- payment-desk/index.html — payment follow-up application
- js/ — application modules
- css/ — application styles
- vendor/ — locally hosted Supabase client
- supabase/ — database migrations and verification SQL
- scripts/ — repository checks and web build
- tests/ — automated smoke tests
- dist/ — generated deployable web site; never edit manually
- android/ — custom WebView Android wrapper
- reference/ — engineering and UI/UX reference repositories

## Validation

Run:

    npm run check
    npm test
    npm run version:check
    npm run build:web

The web build copies only the files required by the website into dist/. Supabase SQL, Android source, GitHub workflows and Markdown files are not deployed to Pages.

## Deployment

GitHub Pages builds dist/ and deploys only dist/. Cloudflare Pages or Netlify can also serve the same dist/ output and apply _headers.

## Android

The current Android implementation uses the existing custom MainActivity WebView approach. It is intentionally not mixed with a second Capacitor runtime. CI uses the same dist/ web build as the website, copies it to android/app/src/main/assets/www, pins Gradle 9.0.0 and fails if app-debug.apk is missing.

## Database

Use the existing SQL files under supabase/ in their documented dependency order. Run supabase/99_verify.sql after changes. Do not invent or rename production columns. A complete clean-schema rebuild should be generated from an approved production schema snapshot before replacing the current migration set.

## Security rules

- Never commit service-role or secret keys.
- Keep authentication enabled and controlled by Supabase.
- Keep RLS enabled on public application tables.
- Customer links must expose only their intended party through dedicated RPC functions.
- Staff must not gain delete access through UI changes; database RLS remains authoritative.
- Keep script-src self and avoid inline JavaScript.
- Review docs/access-matrix.md after permission changes.

## UI/UX references

The SalesDesk UI uses the existing HTML/CSS architecture while drawing design patterns from shadcn/ui, shadcn-admin, shadcn-admin-kit, Tremor, TailAdmin, UI/UX Pro Max references and the supplied dashboard examples. These are references, not copied application code.
