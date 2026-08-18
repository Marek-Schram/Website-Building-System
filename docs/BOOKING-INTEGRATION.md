# BOOKING-INTEGRATION — getting a property's "Book" button to actually take bookings

This is the reference for the booking side of the lodging business. Two jobs: **(A) list the property on
marketplaces** (Airbnb/Vrbo/Booking.com…) and **(B) wire up a direct "Book" button on the site** the client
already has or the one we build. (A) is our listing-builder service; (B) is the upgrade that turns
"inquiries" into confirmed reservations. Decision tree below.

## The 2-minute decision tree

```
Does the property already accept bookings?
├─ YES — via a booking platform (Airbnb/Vrbo/Booking.com…)  → it already has listings.
│     → Find which ones (packages/lodging-prospects checks all 5). Pitch = add missing platforms.
├─ YES — via a channel manager / PMS (Cloudbeds, Lodgify, SiteMinder, Hostaway…)
│     → Integrate the site's Book button WITH their existing system (no double-booking).
│     → Decision: use their official booking-widget/API, or iCal sync (below).
└─ NO — manual only (phone/email/text)  → no booking system at all.
      → Recommend a channel manager (Cloudbeds/Lodgify) OR simple iCal sync, then a Book button.
```

## Route 1 — native widget / API of their booking system (recommended when they have one)

| System | How to add a Book button on their site | Notes |
|---|---|---|
| **Cloudbeds** | Booking Engine widget (iframe/embed) from Cloudbeds dashboard | Full booking flow, channels sync; free widget with account |
| **Lodgify** | Lodgify provides embeddable booking widget / "Book now" link to their hosted booking page | Also builds whole sites; widget is the cheap path |
| **SiteMinder** | SiteMinder iQ / channel manager: they usually sync to a booking engine | Use the engine's embed, not SiteMinder directly |
| **Guesty** | Guesty gives each property a booking page URL + embeddable widget | Good for vacation-rental managers |
| **Hostaway** | Hostaway channel manager → recommends an engine (e.g. their built-in booking engine) | Check the included engine's embed |
| **Freetobook** | Freetobook gives a "Book now" link/button for the property | Simple, works for small B&Bs |
| **No system** | Cloudbeds (free tier) or Lodgify — create account, use their widget | Cheapest robust path |

Rule: **if they have a system, embed ITS widget** — never build a separate booking flow that could
double-book. The widget talks to their calendar automatically.

## Route 2 — iCal sync (the no-code fallback)

Works for any property, no vendor accounts beyond the platforms. Perfect when the owner manages bookings
from one calendar (Google Calendar / iPhone / Outlook) and just wants everything mirrored.

```
Owner's master calendar (single source of truth)
   └── export .ics URL
          ├──→ import into Airbnb   (Calendar sync → import URL)
          ├──→ import into Vrbo     (Calendar → iCal)
          └──→ import into Booking.com (extranet → rates & availability → iCal)
```

- **One master calendar** (the owner updates) → imported everywhere. Bookings arrive → owner adds blocks to
  the master → every platform updates. No double-booking.
- **Caveat:** sync is not instant (each platform refreshes on its own schedule, minutes–hours) and can drift.
  Good enough for low-volume properties; for busier places recommend Route 1 or a channel manager.
- Implement with a plain `text/calendar` file served from the site (static, free, no server) — the platforms
  fetch it. See the `booking-link` add-on wiring in Phase 5.

## Route 3 — fully custom booking engine (our site) — NOT recommended

A custom engine means inventing inventory/rates/conflict logic and re-wiring to their calendar. High effort,
high risk, and the property already has platform-managed availability. Skip unless a client explicitly pays
for it (then build on top of their PMS API, not from scratch).

## Vendors & cost table (2026, free-first)

| Vendor | What it gives | Cost at small-business volume |
|---|---|---|
| Cloudbeds | PMS + channel manager + booking engine | Free to start; ~$/mo later tiers |
| Lodgify | Site + booking widget + channel sync | Free/cheap tiers; paid to scale |
| SiteMinder | Channel manager only | Per-channel fee; start with direct engines instead |
| Hostaway / Guesty | Vacation-rental channel manager | Free trial, then monthly |
| FreeToBook | Light booking engine for B&Bs | Free tier exists |
| Airbnb/Vrbo/Booking.com | Marketplaces (the traffic!) | ~3–15% commission per booking |

**Recommendation for Marek's clients:** Cloudbeds or Lodgify widget if they want a real system; iCal sync if
they want zero extra cost and already use one calendar. The proposal/kit already ask which system they run
(`--booking-system`), so the integration route is chosen per client, not per codebase.

## Testing the integration (RED → GREEN)

For every property where we add a booking button:
1. **Calendar contract:** the exported `.ics` returns 200, `Content-Type: text/calendar`, and contains
   `VEVENT` blocks (test with `curl` + a parser).
2. **Platform import:** after importing the iCal URL into the target platform, confirm a block placed on the
   master calendar appears as "unavailable" on the platform (can take up to an hour on some).
3. **Widget path (Route 1):** load the embedded widget, run the human-like test (packages/testing harness),
   and do a real guest-flow click-through (dates → availability → confirm) on a test booking.
4. **No double-booking smoke test:** book a date on the platform, then try to book the same date through the
   other channel — the second should be rejected.
5. **SEO/a11y:** the Book button has real link text ("Book now"), is keyboard-accessible, and passes the axe
   run that human-test does.

## How this fits the packages
- **Basic ($50):** one platform listing. Integration = the platform's own calendar; site Book button optional.
- **Standard ($90):** two platforms + calendar sync (Route 2 iCal or Route 1 widget if a system exists).
- **Pro ($150):** three platforms + verified sync + setup guide + tracking sheet (listing-kit) + support.

The deliverables that make this real: `packages/lodging-prospects` (find who's missing — `find-booking-leads.mjs`
for the batch scan, `lodging-opportunities.mjs` for a polished per-property report, see
`.claude/skills/find-booking-opportunities/SKILL.md`), `packages/proposals` (win the deal), `packages/listing-kit`
(onboard + track). Docs: `docs/PROPOSALS.md`, `docs/LISTING-KIT.md`.
