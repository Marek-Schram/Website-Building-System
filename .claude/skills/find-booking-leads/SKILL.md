---
name: find-booking-leads
description: Find bookable lodging (hotels, hostels, cabins, B&Bs, vacation rentals) in a city that are missing from the big booking platforms (Airbnb, Vrbo, Booking.com, Expedia, Hotels.com), detect each one's current booking system, and score leads HOT/WARM/COOL for the "get you listed where guests search" pitch. Use when Marek wants lodging leads or asks about hotels/cabins/rentals in an area.
---
# Find Booking Leads (lodging version of /find-leads)

Finds bookable lodging in a city and checks each against the top-5 booking platforms + the property's own
booking system, so the pitch writes itself: "guests can't find you on Airbnb/Booking.com — I'll get you listed."

## How to run
```
node packages/lodging-prospects/src/find-booking-leads.mjs "<city>" [--types hotel,hostel,cabin,bed-and-breakfast,vacation-rental] [--max N] [--json|--csv] [--skip-site-scan]
node packages/lodging-prospects/src/find-booking-leads.mjs --url "https://site.example" --name "Example Lodge" [--city "Town"]   # single-property check, NO key needed
```
- City mode needs `GOOGLE_PLACES_API_KEY` (same one /find-leads uses). Single-property mode is keyless.
- Presence checks use a keyless web search (DuckDuckGo → Bing fallback) — best-effort; verify evidence.
- Own-site scan detects the booking system they run (Cloudbeds, Lodgify, Freetobook, SiteMinder, ResNexus,
  TravelClick, Airbnb link, etc.) — that's the reliable signal.

## Scoring (0–100)
- HOT 🔥 (≥55): no presence on the platforms / no direct booking on their site → best pitch.
- WARM ☀️ (≥35): on 1–2 platforms or missing direct booking.
- COOL ❄️: already on most platforms. Reviews + rating add points (the good leads have reputation to move).
- Each lead keeps its evidence URL so outreach is honest.

## Output
- Console HOT/WARM/COOL list · `--json`/`--csv` for scripts.
- `lodging-prospects/out/<city>.json` — full detail incl. evidence URLs + detected booking systems.
- `memory/leads/lodging-<city>.md` — one-line table per lead for outreach tracking.

## How Marek uses it
1. Run for a vacation area (e.g. "Pigeon Forge", "Branson", "Estes Park") → pick HOT/WARM leads.
2. For a promising lead run `--url --name` to double-check its own site, then `/propose-lodging`.
3. Log the scan in `memory/leads/`. Only target real properties (public info only). Verify presence before outreach.
