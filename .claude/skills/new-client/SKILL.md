---
name: new-client
description: Onboard a new client — scaffold, materials, theme + add-ons. Seeds from demos/<slug>/_source/ if a full /demo-site was already built for them, else parity/<slug>/brand.seed.json if replacing an old site.
---
# New Client
1. `node scripts/new-client.mjs "$ARGUMENTS"` — scaffolds `clients/<slug>/`, with this precedence (handled
   automatically by the script, `scaffoldClient()` in `scripts/new-client.mjs`):
   - **`demos/<slug>/_source/` exists** (a full interactive `/demo-site` was already built for them) → seeds
     `brand/` + `content/` + `public/` directly from it. This is real, already-authored brand config and
     content — richer than a bare `brand.seed.json` (which has no content files at all) — a converted demo
     often needs little more than a review pass, not a rewrite.
   - **Else, `parity/<slug>/brand.seed.json` exists** → read it and copy colors/fonts/contact/addons into
     `brand.config.json` yourself (the script doesn't do this merge — it's still a manual/agent step).
   - **Else** → blank template; ask: name, logo, colors, services, hours, address, phone, tagline;
     `/add-feature recommend`.
2. Write/finish `brand.config.json` + `content/*.md` per whichever path above applied.
3. Create `memory/clients/<slug>.md` from `templates/client-note.md` — memory-log convention.
4. Next: /build-site → /add-feature → /test-site → /security-gate → /marketing-kit → /deploy-site.
