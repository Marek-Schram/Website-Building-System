# Decisions Log
- 2026-08-07: Cloudflare Pages, Astro static→hybrid, local memory vault, CI security+tests.
- 2026-08-07: Client engine (Audit+Leads), demo generator, testing + qa-debugger + blind-reviewer.
- 2026-08-07: Add-Ons library (/add-feature). Parity feature (/match-site) — rebuild cheaper without losing anything.
- 2026-08-07: Opportunity Detector (packages/opportunities, /find-opportunities, opportunity-scout) — auto-detect
  weak points + missing features on a prospect's current site (e.g. restaurant with no online ordering) to pitch fixes.
- 2026-08-07: Added Prospect Brief (/prospect-brief) — one command chains opportunities+audit+demo into a single
  polished, print-ready prospect-brief.html + a ready outreach email. And a Chatbot add-on: free rule-based FAQ
  widget by default ($0, no API), with an OPTIONAL AI upgrade via Cloudflare Workers AI (free 10k neurons/day,
  same platform we host on) — worker in packages/addons/chatbot-worker/. Both keep cost at/near zero.
- 2026-08-07: Verified + hardened both features end-to-end. Chatbot `make` is now idempotent (re-running with a
  new --aiEndpoint replaces the old widget instead of duplicating). Demo/brief/accent palettes darkened to pass
  WCAG AA color contrast (axe/Playwright now green). security headers.template CSP allows 'unsafe-inline'
  script-src because all native add-ons (chatbot, forms) are self-contained inline HTML/JS; static sites only.
  Added e2e specs: chatbot.spec.mjs (widget interactions) + chatbot-ai.spec.mjs (AI call + auto-fallback).
  E2E mobile project now runs on Chromium (iPhone viewport) so tests run without WebKit system deps.
  demos/smoke regenerated with contact info so the CI human-test gate passes on every demo.
- 2026-08-18: Added `/find-booking-opportunities` (packages/lodging-prospects/src/lodging-opportunities.mjs) —
  the lodging analog of `/find-opportunities`, closing the gap where booking clients had find-leads
  (`/find-booking-leads`) but no per-property deep-dive report. Produces a severity-tagged, client-ready
  `lodging-opportunities/<slug>/report.md` covering platform-presence gaps (Airbnb/Vrbo/Booking.com/Expedia/
  Hotels.com), direct-booking + booking-system detection, and — reusing `packages/opportunities` as-is — the
  full website-quality report against the property's own site. Extended `opportunities.mjs`'s industry map
  with hotel/hostel/cabin/bedandbreakfast/vacationrental so `/find-opportunities` and `/prospect-brief` also
  classify lodging sites correctly on their own, not just through the new tool. Extracted shared network-scan
  helpers (`checkPresence`, `scanOwnSite`, `searchWeb`) from `find-booking-leads.mjs` into a new
  `packages/lodging-prospects/src/scan.mjs` so both scripts share one implementation. Full funnel is now
  `/find-booking-leads` → `/find-booking-opportunities` → `/propose-lodging` → `/listing-kit`, mirroring the
  website funnel's `/find-leads` → `/find-opportunities` → `/demo-site`/`/prospect-brief` → `/new-client`.
- 2026-08-18: Demo-generation overhaul (full plan: `.claude/plans/also-right-now-i-smooth-kazoo.md`).
  `/demo-site`'s old implementation (`packages/demo-gen`) was a single hardcoded 8-bucket/4-palette
  template that never fetched anything real from a prospect's actual site — Marek's assessment: "looks way
  too AI generated," "doesn't match the old website at all." Rebuilt as two tiers, both writing to the same
  `demos/<slug>/index.html`: **Quick** (batch, unattended, upgraded demo-gen with real captured colors/
  services when a URL is available) and **Full** (interactive — Claude screenshots the real site via a new
  real-browser capture, writes paraphrased copy, picks one feature, renders through `packages/site-builder`
  — the same real-content pipeline paying clients get, via a new `clientDir` override on `buildSite()`).
  New shared `packages/opportunities/src/classify.mjs` (industry classification + feature detection,
  previously duplicated 3x) adds roofing/HVAC/landscaping/painters. New `packages/parity/src/
  capture-browser.mjs` + `extract-dom.mjs` (real headless-browser capture, fixes proven data corruption a
  plain fetch has on JS-heavy sites — see lessons-learned). `packages/site-builder` gained real theme-level
  visual variety (photo heroes, real Google Fonts, 3 genuinely distinct layouts) — previously all 3 themes
  rendered identically. `scripts/new-client.mjs` now seeds from a completed Full demo's `_source/` when one
  exists. Command Center got a matching "Flag for /demo-site (full)" / "Check for full demo" pair (same
  flag+detect pattern as `/marketing-kit`), plus a confirm-before-overwrite guard since Quick and Full write
  to the same path. Deleted `packages/components/src/Hero.astro` (confirmed dead code, zero references, no
  Astro toolchain anywhere in this repo) after evaluating and rejecting introducing a real Astro toolchain —
  disproportionate to the problem and against this repo's explicit zero-build-step architecture.
  133 tests (vitest + Playwright), many new, all passing; validated end-to-end against a real business site.
