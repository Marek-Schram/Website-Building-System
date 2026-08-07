---
name: build-site
description: Assemble and build a client's Astro site from brand config, content, theme, and enabled add-ons.
---
# Build Site
Load ONLY brand.config + content + theme. Assemble from packages/components/src; add add-ons via /add-feature.
Context7 for APIs. Copy headers.template → public/_headers. build-client.mjs; preview; visual-qa. /test-site +
/security-gate before live.
