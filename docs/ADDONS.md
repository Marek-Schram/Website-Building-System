# ADDONS — features SMBs ask for most (/add-feature)
🧩 native: contact-form, map, hours, reviews, gallery, faq, social, click-to-call, menu.
🔌 embed: online-ordering (Toast/Square/ChowNow — #1 restaurant ask, keeps 15-30% vs DoorDash), reservations
(OpenTable/Resy), booking (Calendly/SimplyBook/Square — #1 service ask, 40% after-hours), newsletter (Brevo),
whatsapp, live-chat (tawk.to), payments (Stripe/Snipcart), store, chatbot (free rule-based FAQ widget; optional AI via Cloudflare Workers AI free tier — see docs/CHATBOT.md). addons.mjs list|recommend|make <id> [--out].
Lodging: 🧩 booking-link (native "Book on Airbnb/Vrbo/Booking.com…" button + optional iCal sync — pairs with /find-booking-leads, /propose-lodging, /listing-kit; see docs/BOOKING-INTEGRATION.md).
Security tiers: ordering/payments/store=Tier4, booking=Tier3, contact/newsletter=Tier2. The same "should-have
per industry" map powers /find-opportunities (missing-feature detection).
