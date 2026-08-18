# SiteWright — Claude Code Operating Manual

> Kept lean: only ~200 lines / 25KB of a CLAUDE.md load per session. Detailed procedures live in on-demand
> **skills** (`.claude/skills/`), **rules** (`.claude/rules/`), and **subagents** (`.claude/agents/`).

## What this business is
Build cheap, fast, trustworthy websites for local small businesses at scale (3–15 sites), bundle a
free-marketing kit, and keep per-site effort + tokens LOW by reusing components + add-ons. Find prospects,
show them what's weak on their current site, then rebuild it cheaper — matching the look, keeping every
feature, fixing the weak points. Owner: **Marek** — smart, NOT a strong programmer, so **you (Claude) do the
fixing/debugging** and explain it plainly.

## The 6 golden rules (always)
1. **REUSE, DON'T REBUILD.** New client = `brand.config.json` + content + theme + add-ons. Check
   `packages/components/` and `packages/addons/` first.
2. **STATIC BY DEFAULT.** Ship static unless a feature (payments/booking) needs a server.
3. **SECURITY IS A GATE.** No site goes live until `/security-gate` passes; you patch + explain.
4. **TOKEN DISCIPLINE.** Load only what a task needs; use the memory vault.
5. **WRITE IT DOWN.** Log decisions, lessons, leads, add-ons, parity + opportunity findings to `memory/`.
6. **ASK BEFORE DESTROYING.** Never delete a client folder / overwrite live content without confirming.

## How the system is steered
| Layer | Lives in | Loads | Use for |
|-------|----------|-------|---------|
| CLAUDE.md | this file | always | always-true facts |
| Rules | `.claude/rules/` | matching files | security/testing constraints |
| Skills | `.claude/skills/<n>/SKILL.md` | on demand / `/n` | procedures (workflows) |
| Subagents | `.claude/agents/` | when called | security-reviewer, pentester, visual-qa, qa-debugger, blind-reviewer, parity-reviewer, opportunity-scout |
| Hooks | `.claude/settings.json` + `.claude/hooks/` | lifecycle | block dangerous cmds, flush memory |
| MCP | `.mcp.json` | tool search | Context7, Playwright, Filesystem, Fetch, Sequential-Thinking |

## Repo map
```
CLAUDE.md · SETUP.md · README.md · .mcp.json · .github/workflows/
.claude/{agents,skills,rules,hooks,settings.json}
packages/site-builder/ ← assembles brand+content+theme+add-ons → REAL client site → /build-site
packages/components/  ← shared UI reference   packages/themes/  ← portfolio (colors/fonts/sections)
packages/addons/      ← common add-ons (ordering, booking, menu…) → /add-feature
packages/parity/      ← capture an old site + prove parity → /match-site
packages/opportunities/ ← detect weak points on a prospect's site → /find-opportunities
packages/prospect-brief/ ← one emailable doc: opportunities+audit+demo → /prospect-brief
packages/security/    packages/audit/ → /audit-site   packages/prospecting/ → /find-leads
packages/invoicing/   ← branded invoice.html for a won deal (from Command Center) → `npm run invoice`
packages/demo-gen/ → /demo-site   packages/testing/ → /test-site, /blind-review
packages/lodging-prospects/ → /find-booking-leads + /find-booking-opportunities   packages/proposals/ → /propose-lodging   packages/listing-kit/ → /listing-kit
command-center/ ← local GUI: one pipeline board driving every skill above → `npm run command-center`
clients/  demos/  parity/  opportunities/  memory/  marketing-toolkit/  scripts/  docs/
```

## Tech stack
Static HTML/CSS/JS, zero build step (packages/site-builder assembles brand+content+theme+add-ons into
plain HTML — no framework/toolchain, so it stays fast, cheap, and directly testable) · Cloudflare Pages
(#1 security: free DDoS+WAF, auto-SSL). Client engine: Google Places + PageSpeed (free tiers). Add-ons:
native HTML or provider embeds. Demos, add-ons, parity capture, and opportunity scans need NO keys
(PageSpeed key optional for speed numbers). Payments later: Stripe/Snipcart/Paddle.

**Revenue ladder:** brochure → + contact form → + booking → + payments → + store. Add-ons make each rung fast.

## Workflows
### A) Get clients (docs/CLIENT-ENGINE.md)
`/find-leads` → `/find-opportunities` (what's weak on their site) → `/demo-site` + `/add-feature` (show the
fix) → `/audit-site` → outreach the top weak points.

### B) Deliver a site (per won client)
1. `/new-client "<slug>"` — scaffold + materials + theme.
2. `/build-site <slug>` — assemble brand.config + content/*.md + theme + add-ons → dist/<slug> (site-builder).
3. `/add-feature <id>` — drop in requested features from the add-ons library.
4. `/test-site <slug>` — human-like + E2E + unit + dead-code; `qa-debugger` fixes failures.
5. `/security-gate <slug>` — reviewer patches + pentester breaks in, until clean.
6. `/marketing-kit` → 7. `/deploy-site` → 8. `/memory-log`.

### C) Replace an existing site (docs/PARITY.md)
`/find-opportunities` (weak points) + `/match-site` (capture style + functionality) → build to match →
`parity-check` proves nothing lost + lists improvements. "Keep what's good, fix what's weak, for less."

### D) Booking line of business (lodging, docs/BOOKING-INTEGRATION.md)
`/find-booking-leads "<city>"` (who's missing from Airbnb/Vrbo/Booking.com/Expedia/Hotels.com + their current
booking system) → `/find-booking-opportunities "<name>"` (deep dive on ONE property — platform gaps, direct-
booking, booking system, + full website-quality report; the lodging analog of `/find-opportunities`) →
`/propose-lodging` (branded proposal, one theme file) → `/listing-kit` (onboard + track → verified live →
invoice). Add-on: `booking-link` ("Book on <platform>" button + optional iCal sync).
Free checklist: Basic $50/1 platform, Standard $90/2, Pro $150/3 — no deposit, pay when live.

### Debugging & cleanup (hand off)
`/test-site` → `qa-debugger`. `/blind-review` → `blind-reviewer` (context-free dead-code cleanup).

## Memory
`memory/` IS an Obsidian vault (open it in the Obsidian app; optional live MCP connection). Read
`clients/<slug>.md` + `conventions.md` at start; every skill writes here as a normal last step, not on
request. Keys: conventions, decisions-log, lessons-learned, clients/, leads/, snippets/. See docs/MEMORY.md.

## First time here?
Read `SETUP.md` (one-time setup vs. repeatable loops). Then `/find-leads`, `/find-opportunities`, `/demo-site`,
`/new-client`, or `/match-site`.
