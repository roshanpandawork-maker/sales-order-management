# SalesDesk CSP

The application uses `script-src 'self'` and no inline JavaScript. Inline CSS remains allowed on legacy portal pages because those pages currently contain inline style blocks.

| Page | script-src | connect-src | Notes |
|---|---|---|---|
| index.html | 'self' | Supabase + raw.githubusercontent.com | update checker |
| customer/index.html | 'self' | Supabase | clock moved to js/customer-clock.js |
| p/index.html | 'self' | Supabase | public balance logic moved to js/public-party.js |
| party.html | 'self' | Supabase | existing external scripts |
| payment-desk/index.html | 'self' | Supabase | application script moved to js/payment-desk.js |
| 404.html | 'self' | none | route logic moved to js/route-404.js |

`_headers` contains frame-ancestors; meta CSPs omit it because meta CSP does not support that directive.
