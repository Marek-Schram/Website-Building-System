# SETUP — one-time setup vs. what Claude does every time

## PART A — One-time setup (~30-45 min)
- **Core:** Node 18+ · Claude Code · open the sitewright/ folder (auto-reads CLAUDE.md).
- **Hosting:** Cloudflare account → `npm i -g wrangler` → `wrangler login` → copy `.env.example` to `.env`, add CLOUDFLARE_API_TOKEN.
- **Client-engine keys (free):** GOOGLE_PLACES_API_KEY (/find-leads) · PAGESPEED_API_KEY (/audit-site, and speed numbers in /find-opportunities). Demos, add-ons, parity capture, and opportunity scans work WITHOUT keys.
- **Testing tools (optional):** `npm i -D @playwright/test @axe-core/playwright vitest @vitest/coverage-v8 knip && npx playwright install chromium`.
- **MCP:** `/mcp` to connect. **Memory (optional):** Obsidian → open memory/.

## PART B — Repeatable loops
### Get clients
| Step | Command | Claude does |
|---|---|---|
| 1 | `/find-leads "<niche>" "<city>" --audit` | scored HOT/WARM list |
| 2 | `/find-opportunities <their-site>` | weak points + missing features to pitch |
| 3 | `/demo-site --from leads.json` + `/add-feature` | free demo showing the fix |
| 4 | `/audit-site <url>` | client-ready report for outreach |
| 5 | `/prospect-brief <url>` | ONE emailable doc: weak points + score + a matching demo (PDF-ready) |
### Replace an existing site
`/find-opportunities` (weak points) + `/match-site <old-url>` (capture) → `/new-client` (seed the look) → `/build-site` + `/add-feature` → `parity-check` (prove nothing lost).
### Deliver a site (all)
`/new-client` → `/build-site` → `/add-feature` → `/test-site` (qa-debugger) → `/security-gate` → `/marketing-kit` → `/deploy-site` → `/memory-log`.

Guardrails: hooks block dangerous cmds + secret-writes + flush memory; rules enforce secret/header/testing/analysis constraints; CI re-runs security + tests. parity-check must show ZERO regressions before a rebuild launches.
