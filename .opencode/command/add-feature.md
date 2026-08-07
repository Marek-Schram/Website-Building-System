---
description: Add a commonly-requested feature (chatbot, menu, online ordering, booking, contact form, map, hours, reviews, gallery, faq, social, click-to-call, reservations, newsletter, WhatsApp, live chat, payments, store) to a site HTML file from the add-ons library. Use when Marek says "/add-feature" or asks to add a feature.
agent: build
---

Add the requested SiteWright add-on to a site HTML file from the add-ons library.

## Steps
1. See what's available:
   `node packages/addons/src/addons.mjs list` (optionally `recommend --industry <type>`).
2. Generate a starter site first if the target doesn't exist yet:
   `node packages/demo-gen/src/demo.mjs --name "<Business>" --type <type> --city "<city>" --phone "<phone>" --address "<address>" --slug <slug>`
   (output: `demos/<slug>/index.html`).
3. Add the feature to `--out <html>`:
   - Chatbot (free, no API): `node packages/addons/src/addons.mjs make chatbot --name "<Business>" --phone "<phone>" --faq '<faq-json>' --out <html>`
     - Custom answers: pass `--faq` as JSON, e.g. `'[{"q":["emergency","24"],"a":"Yes, we offer 24/7 emergency service!"}]'`.
     - Optional AI (Cloudflare Workers AI, free 10k/day): add `--aiEndpoint https://<worker>.workers.dev`. Re-running replaces the old widget (idempotent).
   - Embeds (booking/ordering/store/etc.): `node packages/addons/src/addons.mjs make <id> --url "<provider-url>" --out <html>`.
4. Verify: `node packages/testing/harness/human-test.mjs <html>` must report 0 failures.

For $ARGUMENTS, interpret natural language into the above flags. If no `--out` target is given, use `demos/<slug>/index.html`.
