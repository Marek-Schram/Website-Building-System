# Site Builder
Assembles a REAL client site: clients/<slug>/brand/brand.config.json + content/*.md + packages/themes/<theme>.json
+ enabled add-ons (packages/addons) → dist/<slug>/ (static HTML + _headers). Never fabricates content — skips a
section if there's no real data for it. `node packages/site-builder/src/build.mjs "<slug>"` (also `npm run
build:client -- <slug>`) → /build-site.
