# lodging-prospects

Find bookable lodging (hotels, hostels, cabins, B&Bs, vacation rentals) in a city and score who needs help
getting more direct bookings — "you're losing bookings to phone tag" or "you don't even have a way to book
online" — so you can pitch fixing it, with a "get listed where guests search" upsell as supporting evidence.

## What it does
1. **Find** bookable properties via Google Places (per property type).
2. **Scan each property's own site** for a direct booking link and the booking system in use (Cloudbeds,
   Lodgify, Freetobook, SiteMinder, Little Hotelier, Hostaway, Guesty, Checkfront, BookingKit, ResNexus,
   Bookeo, RegiFox, TravelClick…) — fetched directly, this is the reliable signal.
3. **Check presence** on the top-5 platforms (Airbnb, Vrbo, Booking.com, Expedia, Hotels.com) with a keyless
   web search (DuckDuckGo, falls back to Bing) — **best-effort and UNVERIFIED, see caveat below**.
4. **Score** HOT / WARM / COOL + opportunity score (0–100), from the reliable signals only, and write JSON +
   `memory/leads/` markdown.

## Accuracy caveat — platform presence is not reliable enough to score or claim as fact
Verified 2026-08-18: scraping Bing/DuckDuckGo result pages for "is property X on platform Y" produces mostly
false negatives. Bing wraps its real organic results in undocumented `bing.com/ck/a?...&u=<base64>` tracking
redirects rather than linking directly; a naive regex scrape either matches nothing real or (worse) latches
onto unrelated domains mentioned elsewhere on the page. Confirmed hotel chains that are definitely listed on
Expedia (verified independently) scored "0/5 platforms" from this scraper. Because of this, **platform
presence is surfaced as unscored, clearly-labeled "unverified" evidence only** — `scoreLead()` in
`packages/testing/unit/booking.mjs` does not take it as an input at all. "No evidence found" means "our
keyless search didn't confirm it," never "confirmed absent" — always verify manually before telling a
prospect they're missing from a platform. Full investigation: `memory/lessons-learned.md` (2026-08-18).

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
- `lodging-prospects/out/<city>.json` — full lead detail incl. unverified presence evidence URLs + detected systems.
- `memory/leads/lodging-<city>.md` — one-line table per lead for outreach tracking (gitignored data stays out; leads are public info).
- Console: HOT 🔥 / WARM ☀️ / COOL ❄️ list with score + why (score is never based on platform presence — see caveat above).

Own-site scans are the reliable signal: they tell you exactly what booking system each property already
runs, which the proposal then references ("works with your current setup").

## Going deeper on one property: lodging-opportunities.mjs

`find-booking-leads.mjs` finds and scores many properties at once. Once you've picked one, run
`lodging-opportunities.mjs` (the lodging analog of `packages/opportunities`) to turn it into a client-ready,
severity-tagged report — see `.claude/skills/find-booking-opportunities/SKILL.md`.

```
node packages/lodging-prospects/src/lodging-opportunities.mjs "The Treehouse Cabin" --url "https://www.treehousecabin.com" --city "Gold Hill" --reviews 4 --rating 4.8
```

Writes `lodging-opportunities/<slug>/report.md` — direct-booking/booking-system findings (scored) + the FULL
website-quality report from `packages/opportunities` if `--url` given (scored, reused as-is, now
industry-aware for hotel/hostel/cabin/bedandbreakfast/vacationrental — see that package's `SHOULD_HAVE` map)
+ platform-presence evidence (unscored, unverified — see caveat above). Shared scan logic lives in
`src/scan.mjs` so nothing is duplicated between the two scripts.
