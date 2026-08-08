---
name: build-site
description: Assemble and build a client's real static site from brand config, content, theme, and enabled add-ons.
---
# Build Site
`node scripts/build-client.mjs "<slug>"` (= `npm run build:client -- <slug>`) runs packages/site-builder,
which reads clients/<slug>/brand/brand.config.json + content/*.md + packages/themes/<theme>.json, renders
each theme section only from REAL content (never fabricates hours/menu/testimonials/FAQ/photos — skips a
section instead), applies brand.config's `addons` via packages/addons, and writes dist/<slug>/ (index.html +
_headers + robots.txt + sitemap.xml + public/ assets). It refuses to build while any field still says
"REPLACE" (`--force` overrides, printing a loud warning) and flags dangling `#anchor` links before they ship.
Preview dist/<slug>/index.html locally; visual-qa. Then /test-site + /security-gate before live.
