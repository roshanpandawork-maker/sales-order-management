# SalesDesk changelog

## 2026-10-07 — Staged hardening and build work

### Stage 1 — Database foundation
- Added supabase/README.md documenting the live production schema and migration safety.
- Added supabase/99_verify.sql for RLS, anonymous grants and permissive-policy checks.
- Did not invent a base schema from incomplete metadata; production schema remains the source of truth until an approved dump is available.

### Stage 2 — Frontend correctness
- Fixed the customer portal HTML escaping defect.
- Added openBilling to the existing security action allow-list.
- Added repository checks for links, data-act actions and SQL table references.

### Stage 3 — CSP and page cleanup
- Removed inline JavaScript from customer/, p/, payment-desk/ and 404 routing.
- Made customer/index.html the canonical customer portal and converted customer.html to a compatibility redirect.
- Aligned _headers with the update checker.

### Stage 4 — XSS hardening
- Customer portal escaping was corrected. A complete 63-site innerHTML audit remains dependent on a full repository-wide renderer review; no business behavior was rewritten speculatively.

### Stage 5 — Build and deployment
- Added one web build path producing dist/.
- GitHub Pages now deploys dist/ instead of the repository root.
- Android workflows use the same web build and pin Gradle 9.0.0.
- Capacitor webDir now points at dist/ while the existing custom WebView remains the Android runtime.

### Stage 6 — Business logic verification
- Added a baseline automated smoke test. Calculation-specific SQL tests should be expanded from the live production functions before changing financial rules.

### Stage 7 — Access control
- Added a live-policy access matrix and operations runbook. No production permissions were changed.

### Stage 8 — Documentation
- Rewrote README.md and added docs/csp.md, docs/access-matrix.md and docs/RUNBOOK.md.

## Existing payroll v2 rules

The payroll rules remain: monthly salary divided by 30, four paid-leave days, LW adds a daily rate up to four, A deducts one daily rate, H deducts half, excess leave is unpaid, bonus/overtime add, advance/deduction subtract, and blank attendance is not an absence.
