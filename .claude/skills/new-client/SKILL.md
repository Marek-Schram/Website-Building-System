---
name: new-client
description: Onboard a new client — scaffold, materials, theme + add-ons. If replacing an old site, seed from parity/<slug>/brand.seed.json.
---
# New Client
1. node scripts/new-client.mjs "$ARGUMENTS". 2. Read memory + any parity baseline; if parity/<slug>/brand.seed.json
exists, copy colors/fonts/contact/addons into brand.config. 3. Else ask: name, logo, colors, services, hours,
address, phone, tagline; /add-feature recommend. 4. Write brand.config.json + content. 5. Create `memory/clients/<slug>.md` from templates/client-note.md — memory-log convention.
6. Next: /build-site → /add-feature → /test-site → /security-gate → /marketing-kit → /deploy-site.
