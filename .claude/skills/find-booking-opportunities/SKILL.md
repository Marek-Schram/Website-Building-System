---
name: find-booking-opportunities
description: Auto-detect weak points for ONE lodging property (missing booking platforms, no direct booking, no booking system, plus full website-quality checks) so Marek can pitch specific fixes — the lodging analog of /find-opportunities. Use when Marek has a specific property in mind (from /find-booking-leads or given directly) and wants "what's wrong with their booking presence."
---
# Find Booking Opportunities (what's wrong with their booking setup)

Turns ONE lodging property into a prioritized, severity-tagged, business-impact-framed opportunity
report — the same kind of credible pitch document `/find-opportunities` produces for regular website
prospects, but for the booking side: which platforms they're missing, whether guests can book directly,
and whether their own website is any good.

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

## What it detects (four lenses)
1. **Platform presence** — missing from the top-5 booking platforms (Airbnb/Vrbo/Booking.com = 🔴 high
   traffic loss, Expedia/Hotels.com = 🟡 medium). Each missing platform = travelers who never see them.
2. **Direct booking** — no website at all (🔴), or a website with no "Book Now" (🔴 — guests have to call).
3. **Booking system** — no PMS/channel manager detected (🟡 — manual reservations risk double-booking).
4. **Website quality** — if `--url` is given, the FULL `/find-opportunities` technical/trust/functionality
   engine runs against it and gets merged in, so a bad website gets flagged exactly like any other prospect.
Each item has severity (🔴 high / 🟡 medium / ⚪ low), a plain-English business impact, and the exact fix.

## How Marek uses it
1. From `/find-booking-leads` (batch scan or single-property `--url --name`), pick a HOT/WARM lead.
2. Run this on that specific property → get the report. (`--reviews`/`--rating` from the leads output.)
3. Lead outreach with the top 🔴 items ("You're not on Airbnb or Booking.com — that's most of your search
   demand you're missing"). Attach `report.md`.
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
