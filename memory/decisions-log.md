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
