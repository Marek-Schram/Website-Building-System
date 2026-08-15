---
name: listing-kit
description: Generate the client onboarding packet for a newly-won lodging property: 5-minute materials checklist, ready-to-send request email, drafted listing copy, per-platform setup guide, and a listing-tracking sheet. Use when an owner accepts a proposal and Marek needs to collect materials and get them live.
---
# Listing Kit (onboarding packet for a won property)

The handoff packet once the owner says "I accept": everything needed to collect materials and get the
listings live + verified, with a tracking sheet so nothing slips.

## How to run
```
node packages/listing-kit/src/kit.mjs "<Property Name>" \
  [--city "Pigeon Forge"] [--platforms airbnb,vrbo,booking.com] \
  [--booking-system "TravelClick"] [--theme pixelreach]
```
- `--booking-system` — match what /find-booking-leads detected; the setup guide then shows the right
  channel-manager / iCal wiring for their exact system.
- `--theme` controls branding (same file as proposals).

## Output → `listing-kit/out/<slug>/`
- **materials-checklist.md** — the 5-minute questionnaire (name, type, rooms, title, description, amenities,
  house rules, pricing, photos, current system…).
- **request-email.txt** — email to send with the checklist attached.
- **listing-copy.md** — drafted SEO title, description, amenities list, house rules, policies.
- **setup-guide.md** — per-platform creation steps + calendar sync (channel manager or iCal) tailored to their system.
- **tracking.md** — platform/URL/status table + the verification checklist run BEFORE asking for payment.
- **kit.json** — data bundle.

## How Marek uses it
1. Won the deal → `/listing-kit "<name>" --platforms … --booking-system "<detected>"`.
2. Send request-email.txt + checklist, collect answers, fill listing-copy, create listings.
3. Work the setup-guide steps, mark tracking.md, verify each platform is live → then invoice.
See docs/LISTING-KIT.md and docs/BOOKING-INTEGRATION.md (the decision tree for the calendar wiring).
