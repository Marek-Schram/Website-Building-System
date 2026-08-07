---
description: Run the full SiteWright test gate on a site: human-like checks, instant audit (speed/SEO/security), unit tests, Playwright E2E (a11y, mobile), and dead-code scan. Use when Marek says "/test-site" or wants to verify a site before shipping.
agent: build
---

Run the full SiteWright test gate and fix anything that fails.

## Steps
1. Human-like test on the site file:
   `node packages/testing/harness/human-test.mjs <html>` (must report 0 failures).
2. Full gate against a live-served site (serves `demos/<slug>/` at root, runs audit + unit + E2E + dead-code):
   ```
   python3 -m http.server 8899 --directory demos/<slug> &
   node packages/testing/harness/run-all.mjs demos/<slug>/index.html --url http://localhost:8899
   ```
   Or with a deployed URL: `node packages/testing/harness/run-all.mjs <html> --url https://<deployed-url>`.
3. Every layer must be ✅ (dead-code may be ℹ️ as long as knip exits 0). If any fail, fix the root cause and re-run until green.

Notes: `PAGESPEED_API_KEY` enables real speed numbers in the audit. The E2E mobile project runs on Chromium (no WebKit system deps needed).
