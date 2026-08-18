---
name: audit-site
description: Run the Instant Audit on any URL — speed, mobile, SEO, HTTPS, security headers.
---
# Instant Audit
node packages/audit/src/audit.mjs <url> [--md|--json]. PageSpeed (set PAGESPEED_API_KEY) + header fetch.
Log the score to `memory/leads/<niche>-<city>.md` (or the client's note) — memory-log convention.
