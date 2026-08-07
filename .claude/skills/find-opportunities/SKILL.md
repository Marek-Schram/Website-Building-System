---
name: find-opportunities
description: Auto-detect weak points and missing features on a small business's CURRENT website so Marek can pitch specific fixes. Use when Marek gives a prospect's site URL and asks "what's wrong with their site", "what can we improve", "find weak points", or is preparing outreach for a lead.
---
# Find Opportunities (what's wrong with their current site)

Turns a prospect's existing website into a prioritized, business-impact-framed list of weak points +
missing features — the credible "here's what you're losing and how I'd fix it" pitch.

## How to run
`node packages/opportunities/src/opportunities.mjs <url-or-html> [--industry <type>] [--md|--json] [--slug name]`
- Auto-guesses the industry (or pass `--industry restaurant` etc.).
- Set `PAGESPEED_API_KEY` to include real mobile speed numbers (otherwise it skips speed but still checks
  HTTPS, mobile viewport, security headers, structure, and missing features).
- Saves `opportunities/<slug>/report.md` — a client-ready doc you can attach to outreach.

## What it detects (three lenses)
1. **Missing functionality** — features the industry SHOULD have but the site lacks. Restaurant → online
   ordering (keep 15–30% vs DoorDash), HTML menu (not PDF), reservations. Salon/dentist/etc → online booking
   (~40% of bookings are after-hours). Each mapped to a SiteWright add-on you can drop in.
2. **Technical** — no HTTPS, no mobile viewport, slow PageSpeed, missing security headers, exposed server
   version, PDF menu, images without alt text.
3. **Trust / SEO** — no title/meta description, no contact method, no reviews, stale copyright year, no favicon.
Each item has severity (🔴 high / 🟡 medium / ⚪ low), a plain-English business impact, and the exact fix.

## How Marek uses it
1. From a lead (`/find-leads`), run this on their site → get the report.
2. Lead outreach with the top 1–2 🔴 items ("You're a restaurant with no online ordering — that's 15–30% to
   DoorDash you could keep"). Attach `report.md`.
3. Pair with `/demo-site` + `/add-feature` to SHOW the fix, and `/match-site` if replacing their site
   (parity + opportunities together = "I keep everything good, fix everything weak, for less").
4. Log notable scans in `memory/leads/<city>-<niche>.md`.

## Notes
- A strong site correctly returns few/zero opportunities — keep it credible, don't over-alarm.
- Only scan sites of real prospects (public HTML only). Frame findings as help, not criticism.
- Feature detection is kept in sync with `packages/parity/` so the two agree on what a site already has.
