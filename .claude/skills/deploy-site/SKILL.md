---
name: deploy-site
description: Deploy to Cloudflare Pages. Only after /test-site + /security-gate (+ parity-check if replacing) pass.
---
# Deploy
Preconditions: tests+gate(+parity) passed; _headers exists; no secrets; CLOUDFLARE_API_TOKEN. 1) build-client.mjs. 2) deploy.mjs. 3) dashboard WAF+rate-limit+Turnstile. 4) append URL to memory.
