# SalesDesk – secure setup

```
salesdesk/
├─ index.html            page shell (strict CSP, no inline scripts)
├─ css/styles.css
├─ js/config.js          Supabase URL + publishable key (public by design)
├─ js/security.js        click whitelist, 30-min idle logout
├─ js/app.js             app logic (escaped output, validated import, delete guard)
├─ vendor/supabase.js    supabase-js 2.45.4 hosted locally (no CDN supply-chain risk)
├─ supabase/01_security_rls.sql   RLS, roles, audit log   <-- MOST IMPORTANT
├─ supabase/02_verify.sql         checks that it worked
├─ _headers              security headers (Cloudflare Pages / Netlify)
└─ .gitignore
```

## Setup (in this order)
1. **Supabase → SQL Editor:** paste and run `supabase/01_security_rls.sql`.
2. **Authentication → Users → Add user** (your email + a strong password), then run the commented `insert into app_users…` at the bottom of the SQL with your email (role `admin`). Add other staff the same way with role `staff`.
3. **Authentication settings:**
   - Providers → Email: turn **off "Allow new users to sign up"**
   - Password: minimum length 12, enable leaked-password protection
   - Turn on MFA (TOTP) for your admin account
   - Sessions: set JWT expiry to 3600 s or less
   - Backups: enable daily backups / PITR (Project settings → Database)
4. Run `supabase/02_verify.sql` and compare with the comments.
5. **Test as an attacker** (logged-out browser or `curl`):
   `GET https://noldgjtoqhwefqdzdpzs.supabase.co/rest/v1/parties?select=*` with header `apikey: <publishable key>` → must return `[]` or a permission error, never your data.
6. Upload the whole folder. **Best:** Cloudflare Pages or Netlify (they apply `_headers`, including clickjacking protection). GitHub Pages also works but only the `<meta>` CSP applies.

## What is protected
| Threat | Protection |
|---|---|
| Anyone calling the API directly | RLS + allow-list (`app_users`); `anon` has no rights |
| Random signups | Signups disabled; allow-list required even if a user exists |
| Staff deleting records | Delete = admin only |
| XSS / script injection | All values escaped, no inline handlers, CSP `script-src 'self'` |
| Malicious/bad backup file | Schema validation, 5 MB cap, type `REPLACE`, auto-download of current data first |
| Mass accidental delete | Confirmation when >10 records would be removed |
| CDN tampering | Library hosted in `vendor/`, no external scripts |
| Unattended screen | Auto-logout after 30 min idle |
| Password guessing | 5 tries then 30 s lock (client) + Supabase server rate limits |
| "Who changed what?" | `audit_log` table (admin readable) |

## Rules to keep it safe
- Never put the `service_role` / secret key in any file in this folder.
- Keep the GitHub repo **private**, enable 2FA on GitHub and Supabase, protect the `main` branch.
- If you edit the app and add tables, enable RLS on them and add policies.
- Staff role cannot delete; if a staff member must delete, make them `admin`.
- Rotate keys (Project settings → API) if you ever suspect exposure.

## Limitation
The schema (column names) was not provided, so the SQL secures tables without changing them. The app logic runs in the browser; enforcement lives in the database policies above.
