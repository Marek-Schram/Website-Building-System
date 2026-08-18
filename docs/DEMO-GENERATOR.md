# DEMO-GENERATOR — free starter sites, two tiers

`/demo-site` → `demos/<slug>/index.html`, two modes (see `.claude/skills/demo-site/SKILL.md` for the full
procedure):

- **Quick (batch)** — `packages/demo-gen/src/demo.mjs`. Zero deps/keys, unattended, scans many leads at
  once (`--from leads.json`). Uses real captured colors/fonts/service names when a URL is available (a
  quick fetch+regex, `packages/parity/src/extract-static.mjs`), falling back to a generic per-industry
  template (`DISPLAY` map, ~24 categories via `packages/opportunities/src/classify.mjs`) when it isn't.
  Still generic-by-design — no Claude authoring, so it can run unattended.
- **Full (interactive)** — Claude looks at a real screenshot of the prospect's actual site
  (`packages/parity/src/capture-browser.mjs`, a real headless-browser capture — fixes real data-corruption
  bugs a plain fetch has against JS-heavy/platform-builder sites), writes real paraphrased copy, picks one
  high-impact missing feature, and renders through `packages/site-builder` — the exact same real-content,
  never-fabricate pipeline paying clients get (`buildSite()`'s `clientDir` override points it at
  `demos/<slug>/_source/` instead of `clients/<slug>/`). Slower, but genuinely customized, not templated.

Both write to the same `demos/<slug>/index.html` path. Enhance either with `/add-feature`.
