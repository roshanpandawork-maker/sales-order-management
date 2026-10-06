# Engineering Reference Library

These pinned repositories are references for building SalesDesk safely and consistently.

## Design
- UI/UX Pro Max — product UI/UX patterns and design workflow.
- shadcn/ui — accessible, composable UI components and implementation patterns.
- awesome-design-systems — curated examples of mature design systems.

## Security
- OWASP ASVS — application security verification requirements.
- OWASP ZAP — dynamic web security testing/scanning.
- Semgrep — static analysis, security rules, secrets and supply-chain checks.

## Testing
- Playwright — end-to-end browser testing, regression coverage and cross-browser validation.

## Rules for this project
1. Treat these directories as reference material, not application dependencies.
2. Keep submodules pinned to reviewed commits; update deliberately.
3. Do not copy third-party code into production unless its license and compatibility have been reviewed.
4. Never commit Supabase service_role keys, passwords, tokens, or other secrets.
5. New features should add regression tests where practical.
6. Security-sensitive changes should be checked against OWASP ASVS and tested for access-control failures.
7. UI changes should preserve responsive behavior, keyboard accessibility, readable contrast, and consistent states.

## Official sources
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- https://github.com/shadcn-ui/ui
- https://github.com/alexpate/awesome-design-systems
- https://github.com/OWASP/ASVS
- https://github.com/zaproxy/zaproxy
- https://github.com/semgrep/semgrep
- https://github.com/microsoft/playwright
