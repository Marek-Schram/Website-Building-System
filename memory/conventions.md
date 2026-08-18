# Conventions
- Astro static-by-default; Tailwind; Cloudflare Pages. Reuse components+add-ons.
- Every site: HTTPS, _headers, contact, privacy, Lighthouse 90+. Secrets in .env only.
- Replacing a site: /find-opportunities (weak points) + /match-site (capture); parity-check must pass before launch.

## Memory vault (Obsidian) frontmatter
This folder IS the Obsidian vault (open it in the Obsidian app directly). Per-item notes (one business/client/
proposal per file — leads/, clients/, snippets/) start with frontmatter so Obsidian's tag pane, graph view, and
Dataview can filter/query them:
```yaml
---
type: lead|client|decision|lesson|addon|parity|opportunity|audit|deploy|proposal|listing
date: YYYY-MM-DD
tags: [niche-or-category, city-if-relevant]
status: hot|warm|cool|active|won|lost|live   # when it applies
---
```
Running logs (decisions-log.md, lessons-learned.md) stay plain dated bullets — one file, many entries, no
per-entry frontmatter. Link related notes with `[[wikilinks]]` (e.g. a lead note links `[[clients/<slug>]]`
once won; an opportunity/audit note links back to the lead). See docs/MEMORY.md for the full setup + the
live MCP connection that lets Claude read/write the vault directly through the Obsidian app.
