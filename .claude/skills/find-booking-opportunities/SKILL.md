---
name: find-booking-opportunities
description: Auto-detect weak points for ONE lodging property (no direct booking, no booking system, plus full website-quality checks — all scored) with a best-effort UNVERIFIED check of booking-platform presence as supporting evidence — the lodging analog of /find-opportunities. Use when Marek has a specific property in mind (from /find-booking-leads or given directly) and wants "what's wrong with their booking presence."
---
# Find Booking Opportunities (what's wrong with their booking setup)

Turns ONE lodging property into a prioritized, severity-tagged, business-impact-framed opportunity
report — the same kind of credible pitch document `/find-opportunities` produces for regular website
prospects, but for the booking side: whether guests can book directly, whether their own website is any
good, and (as unverified supporting evidence) which of the big platforms it does/doesn't turn up on.

## How to run
```
node packages/lodging-prospects/src/lodging-opportunities.mjs "<Property Name>" [--url <their-site>] [--city "..."] [--reviews N] [--rating N] [--md|--json] [--slug name]
```
- `--url` is optional but unlocks two extra lenses: direct-booking/booking-system detection, and a full
  `/find-opportunities` pass against their own site (HTTPS, mobile, security headers, missing features —
  reuses the exact same engine, now industry-aware for hotel/hostel/cabin/bedandbreakfast/vacationrental).
- `--reviews`/`--rating` are optional cheap trust signals (pull from the Google Places result if you have
  one from `/find-booking-leads`).
- Saves `lodging-opportunities/<slug>/report.md` — a client-ready doc you can attach to outreach.

## What it detects (scored findings, all from reliable directly-fetched signals)
1. **Direct booking** — no website at all (🔴), or a website with no "Book Now" (🔴 — guests have to call).
2. **Booking system** — no PMS/channel manager detected (🟡 — manual reservations risk double-booking).
3. **Website quality** — if `--url` is given, the FULL `/find-opportunities` technical/trust/functionality
   engine runs against it and gets merged in, so a bad website gets flagged exactly like any other prospect.
4. **Reviews/rating** (from Google Places, if passed) — thin review count or sub-4★ rating.
Each item has severity (🔴 high / 🟡 medium / ⚪ low), a plain-English business impact, and the exact fix.

## Platform presence — UNVERIFIED, shown but NOT scored
The report also lists which of the top-5 booking platforms (Airbnb/Vrbo/Booking.com/Expedia/Hotels.com)
turned up evidence via a keyless web search — but this is **not counted toward the opportunity score or
severity/counts**. Verified 2026-08-18: scraping Bing/DuckDuckGo result pages for this produces mostly false
negatives (Bing wraps real results in undocumented tracking redirects the scraper can't reliably follow), so
"no evidence found" means "our search didn't confirm it," never "confirmed absent." Never tell a prospect
they're "not listed" on a platform based on this alone — verify manually first. See
`memory/lessons-learned.md` (2026-08-18) and `packages/testing/unit/booking.mjs`'s `scoreLead` comment.

## How Marek uses it
1. From `/find-booking-leads` (batch scan or single-property `--url --name`), pick a HOT/WARM lead.
2. Run this on that specific property → get the report. (`--reviews`/`--rating` from the leads output.)
3. Lead outreach with the top 🔴 items (no direct booking, no booking system, weak website). Attach `report.md`.
   Only mention specific missing platforms after manually verifying — see the accuracy note above.
4. Follow with `/propose-lodging "<name>"` — the branded proposal/next-step doc, same as `/demo-site` follows
   `/find-opportunities` on the website side.
5. Log the scan in `memory/leads/lodging-<city>.md` — memory-log convention.

## How this relates to /find-booking-leads
`/find-booking-leads` finds and *scores* many properties across a city (HOT/WARM/COOL, short "why" reasons).
This skill goes deep on ONE already-identified property and produces the polished, attachable report —
exactly the find-leads → find-opportunities relationship on the website side. Both share the same platform
list (`packages/lodging-prospects/data/platforms.json`) and scan logic (`packages/lodging-prospects/src/scan.mjs`,
`packages/testing/unit/booking.mjs`) — nothing is duplicated between them.

## Notes
- A well-listed property with a good site correctly returns few/zero findings — keep it credible.
- Only scan properties Marek is actually prospecting/pitching (public info only, per `.claude/rules/testing.md`).
- Frame findings as help, not criticism, same as `/find-opportunities`.
