---
name: propose-lodging
description: Generate a branded, print-ready Pixelreach Digital proposal to get a lodging property listed on booking platforms (Airbnb, Vrbo, Booking.com…), with tier packages, "works with your current system" hook, and a ready-to-send outreach email. Use after /find-booking-leads when Marek wants to pitch a property.
---
# Propose Lodging (listing proposal for a property)

Turns a lodging lead into a polished, branded proposal the owner can read and reply "I accept". Branding comes
from ONE theme file — rebrand by editing `packages/proposals/themes/pixelreach.json` (name, colors, tiers, contact).

## How to run
```
node packages/proposals/src/proposal.mjs "<Property Name>" \
  [--city "Pigeon Forge"] [--contact "Jane"] [--platforms airbnb,vrbo,booking.com] \
  [--booking-system "TravelClick"] [--tier basic|standard|pro] [--theme pixelreach] [--property-type cabin]
```
- `--booking-system` — pass what /find-booking-leads detected on their site; the proposal then says
  "we hook into the TravelClick you already use" (no double-booking). Omit for "manual / no system".
- `--tier` defaults to standard ($90, 2 platforms) — the featured card.
- Pass `--package-json <file>` to override pricing from a file (same shape as theme tiers).

## Output → `proposals/out/<slug>/`
- **proposal.html** — branded cover + opportunity + tier cards + "works with your setup" + next steps +
  acceptance block. Open in a browser → File ▸ Print ▸ **Save as PDF** to email.
- **outreach-email.txt** — ready-to-send message (platforms, tier, system hook).
- **proposal.json** — the data (property, platforms, tier, system).

## How Marek uses it
1. After `/find-booking-leads`, pick a HOT/WARM lead and note the detected booking system.
2. `/propose-lodging "<name>" --city "…" --contact "…" --platforms airbnb,vrbo --booking-system "<detected>"`.
3. Email the PDF with the outreach-email.txt text.
4. On "I accept" → `/listing-kit` for the onboarding packet. See docs/PROPOSALS.md, docs/BOOKING-INTEGRATION.md.
Log the proposal (tier, platforms, sent date) to `memory/leads/lodging-<city>.md` — memory-log convention.
