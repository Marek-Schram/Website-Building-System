# Command Center

A local pipeline board that unifies SiteWright (website clients) and Pixelreach (lodging listings) into one
place: find a lead, prove the pitch, win the deal, ship the site, get paid — without leaving the browser.
It doesn't reimplement any of the tools in `packages/*` — it spawns them exactly as `/find-leads`,
`/build-site`, etc. already do, and streams their output live.

## Run it
1. Set `COMMAND_CENTER_PASSWORD` in `.env` (see `.env.example`) — this is the only login credential.
2. `npm run command-center` → opens on `http://127.0.0.1:4700` (binds to localhost only, by design).
3. Sign in with that password.

## What it is
- **Board**: Lead → Contacted → Proposal Sent → Won → Delivered → Invoiced, one shared pipeline tagged
  `website` or `lodging`.
- **Database**: `command-center/data/pipeline.db` (SQLite, gitignored — local to your machine, restarting the
  server logs you out but never touches this data).
- **Server**: `command-center/server/` — Express, spawns the real scripts as child processes and streams
  progress back over Server-Sent Events (`GET /api/jobs/:id/stream`).
- **Frontend**: `command-center/public/` — plain HTML/CSS/JS, no build step, no framework.

## What each card can do (website deals)
Scan opportunities → generate a demo → generate a pitch packet → Start client (scaffolds `clients/<slug>`,
pre-filled from the deal) → edit brand/content through forms instead of hand-editing JSON/markdown → toggle
add-ons → Build → Run tests → flag for `/security-gate` (a judgment call made by the security-reviewer and
pentester agents in this chat, not a script — the board can only flag it, not finish it) → Deploy.

## What each card can do (lodging deals)
Import/add a lead → Check booking presence (keyless — re-runs find-booking-leads against just this property,
no Google API key needed) → the board remembers which platforms they're missing and what booking system
they already run → Generate proposal (pick platforms/tier/booking-system in a form — no more silently
defaulting to Airbnb+Vrbo) → Generate listing kit (reuses whatever was picked for the proposal unless you
change it) → Won, tracked to Delivered/Invoiced like everything else.

## Parity checks (website deals replacing an existing site)
If a deal's "website" field is the client's *current* site (the one you're replacing), the drawer gets a
**Parity vs. old site** section: **Capture old site** runs `packages/parity/capture.mjs` and stores a style +
functionality baseline (`parity/<slug>/`). Once you've built (or deployed) the new site, **Run parity check**
compares the new site against that baseline and stores pass/fail + the exact regression list — same
`packages/parity/parity-check.mjs` the `/match-site` skill uses, just spawned from the board instead of chat.
A fail doesn't block Deploy (same soft-flag pattern as the security gate) — it's evidence, not a lock.

## Invoicing
Once a deal reaches Won/Delivered/Invoiced, the drawer gets an **Invoice** section: **Create invoice…** opens
a line-item form (prefilled from the deal value where there is one) and generates a branded, print-ready
invoice via `packages/invoicing` — `SiteWright` branding for website deals, the same `Pixelreach Digital`
identity already used for lodging proposals (one theme file each, `packages/invoicing/themes/sitewright.json`
/ `packages/proposals/themes/pixelreach.json`, to rebrand). **Mark sent** / **Mark paid** track status;
marking paid moves the deal to **Invoiced** and fills in `invoiced_amount` from the line items automatically.

## Marketing kit
`/marketing-kit` is a chat-driven skill (it reads docs/MARKETING.md + marketing-toolkit/ and writes tailored
copy — there's no deterministic script to spawn), so the board can only flag it and detect the result — the
same pattern as the security gate. **Flag for /marketing-kit** logs the exact slug to run in Claude Code
chat; once you have, **Check for marketing kit** looks for `marketing-toolkit/<slug>/` and, if found, lists
every file generated there with an open-in-browser link.

## Follow-ups
The topbar's **Follow-ups** button (badge = overdue count) opens every deal with a follow-up date set across
both business lines, grouped Overdue / Next 14 days / Later — so a date doesn't just sit quietly on a card
in whatever column it's in. Click a row to jump straight into that deal's drawer.

## Notes
- Nothing here is exposed to the network beyond `127.0.0.1` — there's no reason to change that for a tool
  built around a single shared password.
- Sessions live in server memory only; restarting the server requires signing in again.
- Build phases: Phase 1 covered the website-client funnel end to end. Phase 2 extended the same board to
  lodging listings — presence detection, a real proposal/listing-kit config flow, and the add-ons section
  correctly staying website-only (it needs a `clients/<slug>` folder lodging deals don't have). Phase 3
  (done) adds the polish: parity checks, real invoicing, marketing-kit flag/detect, and follow-up reminders.
- `find-booking-leads`' presence checks scrape DuckDuckGo/Bing (keyless, best-effort) — repeated rapid checks
  can slow down or get rate-limited; it's bounded by the tool's own timeouts either way, never hangs forever.
