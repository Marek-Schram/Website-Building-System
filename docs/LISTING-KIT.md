# LISTING-KIT — onboarding a won property

Once the owner replies "I accept", this packet collects the materials, drafts the copy, walks through each
platform's setup, and tracks the listings to verified-live so Marek can invoice.

## What `/listing-kit` produces → `listing-kit/out/<slug>/`
| File | Purpose |
|---|---|
| `materials-checklist.md` | The 5-minute questionnaire (name, type, rooms, title, description, highlights, amenities, house rules, times, price, min-stay, photos, contact, current system) |
| `request-email.txt` | Ready-to-send email that introduces the checklist (with the questionnaire pasted in) |
| `listing-copy.md` | Drafted SEO title, description, amenities pick-list, house rules, policies — polish once materials arrive |
| `setup-guide.md` | Step-by-step creation steps per selected platform + calendar-sync section (channel manager or iCal) |
| `tracking.md` | Platform / URL / status table + the verification checklist to run BEFORE asking for payment |
| `kit.json` | Data bundle (property, platforms, booking system, files) |

## The handoff loop (keep it tight)
1. **Send** `request-email.txt` + `materials-checklist.md`.
2. **Collect** answers → fill `listing-copy.md` → create the listings per `setup-guide.md`.
3. **Track** in `tracking.md` (created → verified → live). Fill in the actual listing URLs.
4. **Verify** all of the checklist items in `tracking.md` (public searchable listing, photos+copy approved,
   calendar connected, price+min-stay set, rules+policies visible, host account confirmed).
5. **Invoice** only after verified-live, then hand off the public URLs + a short "you're live 🎉" note.

## Calendar wiring (the no-double-booking promise)
- If the property runs a channel manager/PMS (Cloudbeds, Lodgify, SiteMinder…), the setup guide points at
  their channel-connection tab — new platforms become channels, rates + availability sync automatically.
- Otherwise it uses **iCal sync**: one master calendar imported into each platform. Simpler, $0, but refresh
  is not instant — fine for low-volume; recommend a channel manager for busy properties.
- The `booking-link` add-on (for sites we build/rebuild) drops in a "Book on <platform>" button and can carry
  the iCal URL so the site and the platforms stay in sync. See docs/BOOKING-INTEGRATION.md.
