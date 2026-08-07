---
description: Constraints for secrets, payments, headers, deploy config, API keys, add-on embeds, parity captures, opportunity scans.
globs: ["**/.env*","**/public/_headers","**/api/**","**/*stripe*","**/*payment*","**/wrangler*","**/*.config.*","**/prospecting/**","**/audit/**","**/demo-gen/**","**/addons/**","**/parity/**","**/opportunities/**"]
---
# Security-Sensitive Rules
- Never hardcode secrets (Stripe sk_, GOOGLE_PLACES_API_KEY, PAGESPEED_API_KEY, tokens) → .env, server env only.
- Add-on embeds: provider scripts direct (PCI-safe); URLs/keys via config; payments=Tier4.
- Server routes: validate+sanitize; authz server-side; deny by default.
- Headers: keep full _headers; add a CSP origin only (never wildcard).
- Parity/opportunities/prospecting: only capture/scan sites the business owns/authorizes; public HTML only; CAN-SPAM.
- After changes: /test-site then /security-gate.
