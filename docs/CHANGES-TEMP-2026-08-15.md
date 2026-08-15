# SiteWright — Change Summary (2026-08-15) — what went into the GitHub repo

> **⚠️ TEMPORARY FILE — DELETE AFTER PROCESSING.**
> This is a handoff doc so the AI/system on another computer can quickly understand the 7 commits pushed to
> `https://github.com/Marek-Schram/Website-Building-System.git` (branch `main`) on 2026-08-15. Once you've
> read it and know what changed, **delete this file** (it's committed on purpose so it travels to the other
> machine, but it should not stay in the repo). A copy also lives at `/tmp/opencode/sitewright-changes-2026-08-15.md`.

## What was done in this session (one sentence)
Set up the agent/AI layer (oh-my-openagent + consolidated provider config), then built and shipped a complete
**lodging booking line of business** for SiteWright: find properties missing from the big booking platforms →
generate a branded Pixelreach proposal → onboard them with a listing kit — all tested (RED→GREEN) and committed.

---

## Commit list (newest → oldest), 7 commits on top of `a3f0df8`

| Commit | Message (descriptive) | What it contains |
|---|---|---|
| `6be009f` | **Phase 6: unit tests for booking pipeline (shared booking.mjs logic), npm scripts, dedupe via shared module, knip clean; + lessons-learned OpenRouter notes** | New `packages/testing/unit/booking.mjs` (shared pure logic) + `booking.test.mjs` (14 tests; total 21/21 pass), new npm scripts (`booking-leads`, `propose`, `listing-kit`), all scripts now import slugify/score from the shared module (single source of truth), knip dead-code clean; uncommitted Phase-0e lessons-learned notes committed here |
| `6d5816d` | **Wire lodging pipeline: booking-link add-on, skills (find-booking-leads, propose-lodging, listing-kit), docs (PROPOSALS, LISTING-KIT, TOOLING/ADDONS/CLAUDE), memory leads template** | New `booking-link` add-on in `packages/addons/src/addons.mjs`; 3 new skills `.claude/skills/{find-booking-leads,propose-lodging,listing-kit}/SKILL.md`; new `docs/PROPOSALS.md`, `docs/LISTING-KIT.md`; TOOLING/ADDONS/CLAUDE.md updated with the booking flow; `memory/leads/README.md` extended |
| `8cfc598` | **Add docs/BOOKING-INTEGRATION: decision tree (system widget vs iCal vs custom), vendor table, test plan** | `docs/BOOKING-INTEGRATION.md` — the reference for wiring a property's "Book" button: Route 1 (native widget/API of their PMS/channel manager), Route 2 (iCal sync), Route 3 (custom engine — not recommended); vendor+cost table; RED→GREEN test plan |
| `67f0f24` | **Add listing-kit: materials checklist, request email, listing-copy draft, per-platform setup guide, tracking sheet** | `packages/listing-kit/` — data (`questionnaire.json`, `setup-guides.json`) + `src/kit.mjs` generating `materials-checklist.md`, `request-email.txt`, `listing-copy.md`, `setup-guide.md`, `tracking.md`, `kit.json` → `listing-kit/out/<slug>/` |
| `043c6ea` | **Add proposals: themeable Pixelreach proposal generator (blue/white, tiers, booking-system hook), human-test GREEN** | `packages/proposals/` — `themes/pixelreach.json` (ONE file to rebrand: name/colors/tiers/contact) + `src/proposal.mjs` → `proposal.html` (print→PDF), `proposal.json`, `outreach-email.txt` → `proposals/out/<slug>/`. Tiers: Basic $50/1 platform, Standard $90/2, Pro $150/3. Human-test: 10 pass / 0 warn |
| `c7e0889` | **lodging-prospects: README, gitignore out dirs** | `packages/lodging-prospects/README.md`; `.gitignore` now excludes generated dirs: `prospect-briefs/`, `lodging-prospects/out/`, `proposals/out/`, `listing-kit/out/` |
| `f0a1c72` | **Add lodging-prospects: find bookable lodging, check booking-platform presence + own-site booking systems (keyless DDG/Bing + site scan)** | `packages/lodging-prospects/` — `data/platforms.json` (top-5 platforms + domains), `src/find-booking-leads.mjs` (Places-based city scan OR keyless single-property check via `--url/--name`), presence checks via DDG→Bing fallback, own-site scan detects booking systems (Cloudbeds/Lodgify/SiteMinder/ResNexus/TravelClick…), HOT/WARM/COOL scoring → JSON + `memory/leads/lodging-<city>.md` |

---

## Files changed/added in this session (summary)

**New packages (the core deliverable):**
- `packages/lodging-prospects/` — README, `data/platforms.json`, `src/find-booking-leads.mjs`
- `packages/proposals/` — `themes/pixelreach.json`, `src/proposal.mjs`
- `packages/listing-kit/` — `data/questionnaire.json`, `data/setup-guides.json`, `src/kit.mjs`

**New docs:**
- `docs/BOOKING-INTEGRATION.md` (the decision tree / reference)
- `docs/PROPOSALS.md`, `docs/LISTING-KIT.md`
- `docs/CHANGES-TEMP-2026-08-15.md` (THIS file — temporary handoff, delete after reading)

**New skills (slash commands for Claude Code):**
- `.claude/skills/find-booking-leads/SKILL.md` (`/find-booking-leads`)
- `.claude/skills/propose-lodging/SKILL.md` (`/propose-lodging`)
- `.claude/skills/listing-kit/SKILL.md` (`/listing-kit`)

**Modified:**
- `packages/addons/src/addons.mjs` — added `booking-link` add-on ("Book on <platform>" button + optional iCal sync)
- `packages/testing/unit/booking.mjs` + `booking.test.mjs` — NEW shared logic + tests (slugify, domMatch, presenceHit, detectSystems, hasBookingLink, scoreLead, platformLabels)
- `package.json` — new scripts: `booking-leads`, `propose`, `listing-kit`
- `.gitignore` — generated `out/` dirs ignored
- `CLAUDE.md` — repo map + Workflow D (booking line of business)
- `docs/TOOLING.md`, `docs/ADDONS.md`, `memory/leads/README.md`, `memory/lessons-learned.md` (OpenRouter notes)
- Removed: `memory/leads/lodging-https-www-dollywood-com.md` (test artifact)

## Business logic encoded (for future sessions)
- **The flow:** `/find-booking-leads "<city>"` → HOT/WARM/COOL leads with detected booking systems →
  `/propose-lodging "<name>" --platforms airbnb,vrbo --booking-system "<detected>"` → on "I accept" →
  `/listing-kit` → materials → create listings → verify live → invoice (no deposit, pay-when-live).
- **Pricing (default theme):** Basic $50/1 platform · Standard $90/2 · Pro $150/3; extra platform $50;
  website upsell blurb built in. Edit `packages/proposals/themes/pixelreach.json` to rebrand/repricing.
- **Presence checks are keyless best-effort** (DuckDuckGo → Bing fallback). Own-site scans are the reliable
  signal. Always verify evidence URLs before outreach.
- **Integration routes** (docs/BOOKING-INTEGRATION.md): if they run a system → embed ITS widget; if manual →
  iCal sync (one master calendar imported everywhere); custom engine = not recommended.

## Open items / caveats
- `GOOGLE_PLACES_API_KEY` in `sitewright/.env` is still a **placeholder** — city-wide scans need a real key.
  Single-property checks (`--url <site> --name "<name>"`) need NO key and already work live.
- OpenRouter free-tier: 50 req/day without credits, 1,000/day after a one-time $10 deposit (still $0 to use).
  If heavy coding volume is wanted, do the $10 deposit. All OpenRouter models in `~/.omo/omo.jsonc` are
  `:free` variants (never-bill enforced); Vercel is the paid-model fallback.
