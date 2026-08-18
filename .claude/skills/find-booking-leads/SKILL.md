---
name: find-booking-leads
description: Find bookable lodging (hotels, hostels, cabins, B&Bs, vacation rentals) in a city, detect each one's current booking setup (direct booking, booking system), and score leads HOT/WARM/COOL for the "you're leaving bookings on the table" pitch. Also does a best-effort, UNVERIFIED check of presence on the big booking platforms (Airbnb, Vrbo, Booking.com, Expedia, Hotels.com) as supporting evidence — not scored. Use when Marek wants lodging leads or asks about hotels/cabins/rentals in an area.
---
# Find Booking Leads (lodging version of /find-leads)

Finds bookable lodging in a city and checks each property's own site for direct booking + a real booking
system — the reliable signal the HOT/WARM/COOL score is based on. Also runs a best-effort keyless search for
presence on the top-5 booking platforms, shown as unverified supporting evidence (see Accuracy note below).

## How to run
```
node packages/lodging-prospects/src/find-booking-leads.mjs "<city>" [--types hotel,hostel,cabin,bed-and-breakfast,vacation-rental] [--max N] [--json|--csv] [--skip-site-scan]
node packages/lodging-prospects/src/find-booking-leads.mjs --url "https://site.example" --name "Example Lodge" [--city "Town"]   # single-property check, NO key needed
```
- City mode needs `GOOGLE_PLACES_API_KEY` (same one /find-leads uses). Single-property mode is keyless.
- Own-site scan detects the booking system they run (Cloudbeds, Lodgify, Freetobook, SiteMinder, ResNexus,
  TravelClick, Airbnb link, etc.) — this is the reliable signal, fetched directly from their site.

## Accuracy note — read before pitching (important)
Platform-presence checks (does the property show up on Airbnb/Vrbo/Booking.com/Expedia/Hotels.com) use a
keyless web search and are **NOT scored** and **NOT reliable enough to claim a property is "not listed"
anywhere**. Verified 2026-08-18: scraping Bing/DuckDuckGo result pages for this produces mostly false
negatives — Bing wraps its real results in undocumented tracking redirects the scraper can't reliably
follow, so "no evidence found" means "our search didn't confirm it," not "confirmed absent." Treat the
"Platforms detected" output as a lead, not a fact — verify manually on the platform itself before telling a
prospect they're missing from somewhere. See `memory/lessons-learned.md` (2026-08-18 entry) for the full
investigation.

## Scoring (0–100) — based ONLY on reliable, directly-fetched signals
- No website at all: +35 (strongest single signal — always worth the "you don't even have a site" pitch).
- Has a website but no direct "Book Now": +25. No booking-management system detected: +15 (manual
  reservations risk double-booking).
- Reviews/rating (from Google Places, reliable): 25+ reviews +15, 5+ reviews +8, rating ≥4★ +5.
- HOT 🔥 (≥35) · WARM ☀️ (≥15) · COOL ❄️ (<15, i.e. has direct booking + a real system already).

## Output
- Console HOT/WARM/COOL list · `--json`/`--csv` for scripts.
- `lodging-prospects/out/<city>.json` — full detail incl. evidence URLs + detected booking systems.
- `memory/leads/lodging-<city>.md` — one-line table per lead for outreach tracking.

## How Marek uses it
1. Run for a vacation area (e.g. "Pigeon Forge", "Branson", "Estes Park") → pick HOT/WARM leads.
2. For a promising lead run `--url --name` to double-check its own site, then `/propose-lodging`.
3. Log the scan in `memory/leads/`. Only target real properties (public info only). Manually verify any
   platform-presence claim before it goes into outreach — see Accuracy note above.
