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

Lodging deals get the equivalent lodging actions (`/find-booking-leads` import, generate proposal, generate
listing kit) on the same board and stages.

## Notes
- Nothing here is exposed to the network beyond `127.0.0.1` — there's no reason to change that for a tool
  built around a single shared password.
- Sessions live in server memory only; restarting the server requires signing in again.
- Build phases: Phase 1 (this) covers the website-client funnel end to end; Phase 2 extends the same board
  to lodging listings (the lodging actions are already wired in — find-booking-leads import, propose-lodging,
  listing-kit — but got less end-to-end testing than the website path); Phase 3 is polish (marketing-kit,
  parity checks, real invoicing, follow-up reminders).
