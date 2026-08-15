# PROPOSALS — the lodging listing pitch

Part of the booking business: after `/find-booking-leads` finds a property that's missing from the platforms
guests use, this turns it into a branded proposal the owner replies "I accept" to.

## The flow
```
/find-booking-leads "City"            → who's missing from Airbnb/Vrbo/Booking.com/Expedia/Hotels.com
                                        (also detects each one's current booking system)
   ↓ pick a HOT/WARM lead, note the detected booking system
/propose-lodging "<Property>" --platforms airbnb,vrbo --booking-system "<detected>"
   ↓
proposals/out/<slug>/proposal.html   (print → PDF to email)
proposals/out/<slug>/outreach-email.txt
   ↓ on "I accept"
/listing-kit                          → materials checklist + setup guide + tracking (onboarding)
```

## The package pricing (default theme — edit `packages/proposals/themes/pixelreach.json`)
| Tier | Price | Platforms | What's included |
|---|---|---|---|
| Basic | $50 | 1 | Listing created on 1 platform, SEO title + photos+description, calendar set up, launch + verification |
| Standard | $90 | 2 | 2 platforms, SEO title + photos+description, calendar set up + synced, rate/min-stay rules, launch + verification |
| Pro | $150 | 3 | 3 platforms, everything in Standard + photo/amenity refresh guidance + support |

- Extra platforms beyond the tier: $50 each.
- **No deposit** — the owner pays only after their listing is verified live. (Trust builder, matches the
  "no deposit, pay when live" positioning.)
- Website upsell is baked in (`upsell.blurb` in the theme): "Need a simple website too? We build fast,
  mobile-friendly sites with your Book button — ask for a quote." That's the bridge to the main SiteWright business.

## Why this wins (the honest pitch)
- The evidence is public: the property genuinely doesn't show up on the platform search the lead was run with
  (each hit in `/find-booking-leads` carries its evidence URL). Frame as "guests can't find you," not "your
  site is bad."
- The "works with your current setup" hook (from the detected booking system) removes the #1 objection:
  "won't this double-book?" No — we connect to the Cloudbeds/Lodgify/SiteMinder/calendar they already use.
- Paying only when it's live makes the close low-risk. See docs/BOOKING-INTEGRATION.md for the wiring details
  (system widget vs iCal sync).

## Branding / rebranding
Everything visual + contact lives in the ONE theme file `packages/proposals/themes/pixelreach.json`:
brand name/tagline/email/phone/website, colors (primary/accent/bg/ink…), tiers, upsell, next steps.
To rebrand the whole proposal + listing-kit, edit that file (or copy it to a new name and pass `--theme <name>`).
