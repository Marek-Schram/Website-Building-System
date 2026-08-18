# lodging-prospects

Find bookable lodging (hotels, hostels, cabins, B&Bs, vacation rentals) in a city and score who's
**missing from the top-5 booking platforms** (Airbnb, Vrbo, Booking.com, Expedia, Hotels.com) so you can
pitch "I'll get you listed where guests already search."

## What it does
1. **Find** bookable properties via Google Places (per property type).
2. **Check presence** on each of the 5 platforms with a keyless web search (DuckDuckGo, falls back to Bing).
3. **Scan each property's own site** for booking links and the booking system in use (Cloudbeds, Lodgify,
   Freetobook, SiteMinder, Little Hotelier, Hostaway, Guesty, Checkfront, BookingKit, ResNexus, Bookeo,
   RegiFox, TravelClick…).
4. **Score** HOT / WARM / COOL + opportunity score (0–100) and write JSON + `memory/leads/` markdown.

## Usage
```
# city-wide lead scan (needs GOOGLE_PLACES_API_KEY in .env)
node packages/lodging-prospects/src/find-booking-leads.mjs "Pigeon Forge" --json
node packages/lodging-prospects/src/find-booking-leads.mjs "Branson" --types cabin,vacation-rental --max 15
node packages/lodging-prospects/src/find-booking-leads.mjs "Estes Park" --csv

# single-property check (keyless — no Places key needed)
node packages/lodging-prospects/src/find-booking-leads.mjs --url "https://www.treehousecabin.com" --name "The Treehouse Cabin" --city "Gold Hill" --json
```

## Options
| Flag | Meaning |
|---|---|
| `--types hotel,hostel,cabin,bed-and-breakfast,vacation-rental` | limit property types |
| `--max N` | max results per type (default 20) |
| `--json` / `--csv` | machine-readable output |
| `--skip-site-scan` | skip fetching each property's website (faster) |
| `--url <site> --name "<name>"` | check a single property without the Places key |

## Output
- `lodging-prospects/out/<city>.json` — full lead detail incl. presence evidence URLs + detected systems.
- `memory/leads/lodging-<city>.md` — one-line table per lead for outreach tracking (gitignored data stays out; leads are public info).
- Console: HOT 🔥 / WARM ☀️ / COOL ❄️ list with score + why.

Presence checks are best-effort keyless signals — **verify evidence before outreach** (each hit includes the
URL it came from). Own-site scans are the reliable signal: they tell you exactly what booking system each
property already runs, which the proposal then references ("works with your current setup").

## Going deeper on one property: lodging-opportunities.mjs

`find-booking-leads.mjs` finds and scores many properties at once. Once you've picked one, run
`lodging-opportunities.mjs` (the lodging analog of `packages/opportunities`) to turn it into a client-ready,
severity-tagged report — see `.claude/skills/find-booking-opportunities/SKILL.md`.

```
node packages/lodging-prospects/src/lodging-opportunities.mjs "The Treehouse Cabin" --url "https://www.treehousecabin.com" --city "Gold Hill" --reviews 4 --rating 4.8
```

Writes `lodging-opportunities/<slug>/report.md` — platform-presence findings + direct-booking/booking-system
findings + (if `--url` given) the FULL website-quality report from `packages/opportunities`, reused as-is
(now industry-aware for hotel/hostel/cabin/bedandbreakfast/vacationrental — see that package's `SHOULD_HAVE`
map). Shared scan logic lives in `src/scan.mjs` so nothing is duplicated between the two scripts.
