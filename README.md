# SiteWright 🛠️
**A Claude Code base project that finds local clients, diagnoses what's weak on their current website, hands
them a free demo, and builds cheap/fast/secure small-business sites at scale — with a library of common add-ons
(online ordering, booking, menus…), website-parity (rebuild an existing site cheaper without losing anything),
an AI security + QA team that fixes its own findings, automated CI, and persistent memory.** Built for 3-15 sites.

## Start here
1. `SETUP.md` — one-time setup vs. the repeatable loops.
2. `CLAUDE.md` — the lean operating manual Claude reads automatically.
3. `docs/CLIENT-ENGINE.md`, `docs/OPPORTUNITIES.md`, `docs/ADDONS.md`, `docs/PARITY.md`, `docs/TESTING.md`.

## Loops
**Get clients:** `/find-leads` → `/find-opportunities` (weak points) → `/demo-site` + `/add-feature` → `/prospect-brief` (one emailable PDF) → outreach.
**Replace a site:** `/find-opportunities` + `/match-site` → `/new-client` → `/build-site` + `/add-feature` → `parity-check`.
**Deliver:** `/new-client` → `/build-site` → `/add-feature` → `/test-site` → `/security-gate` → `/marketing-kit` → `/deploy-site` → `/memory-log`.

## Inside
| Path | What |
|------|------|
| `packages/prospecting/` | Lead finder (Google Places) → `/find-leads` |
| `packages/opportunities/` | Detect weak points on a prospect's site → `/find-opportunities` |
| `packages/prospect-brief/` | **One emailable doc (opportunities+audit+demo) → `/prospect-brief`** |
| `packages/demo-gen/` | Instant demo-site generator → `/demo-site` |
| `packages/audit/` | Instant Audit (PageSpeed + headers) → `/audit-site` |
| `packages/addons/` | Common add-ons library (incl. **free chatbot**) → `/add-feature` |
| `packages/parity/` | Capture an old site + prove parity → `/match-site` |
| `packages/testing/` | Human-like + E2E + unit + dead-code → `/test-site`, `/blind-review` |
| `.claude/agents/` | security-reviewer, pentester, visual-qa, qa-debugger, blind-reviewer, parity-reviewer, **opportunity-scout** |
| `.claude/{skills,rules,hooks,settings.json}` | 15 skills + rules + deterministic guards |
| `.mcp.json` · `.github/workflows/` | free MCP servers · automated CI |
| `packages/{components,themes,security}` | factory + hardening |
| `clients/` · `demos/` · `parity/` · `opportunities/` | materials · demos · baselines · weak-point reports |
| `memory/` · `marketing-toolkit/` · `docs/` | brain · deliverables · 16 guides |

## Tech
Astro (static→hybrid) · Tailwind · Cloudflare Pages (WAF+DDoS+SSL) · Google Places + PageSpeed · self-contained
HTML demos + add-ons · parity capture + opportunity detector (no keys) · optional Stripe/Snipcart/Toast/Calendly.

---
*Scaffold for Claude Code. The audit, lead-finder, demo, add-ons, testing, parity, and opportunity scripts are real and runnable.*
