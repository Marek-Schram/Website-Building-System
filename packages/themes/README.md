# Theme Portfolio

Each `<name>.json` is read by `packages/site-builder/src/build.mjs`'s `buildSite()` and controls:
- `defaultSections` — which sections render, in what order (same for all three themes today).
- `layout` — hero treatment: `text-hero` (plain, centered — beacon), `image-hero` (full-bleed background
  photo with overlay — harvest), `split-hero` (text left / photo right — summit). Only takes effect when a
  real photo is supplied (`brand.heroImage` in `brand.config.json`, or `hero_image:` frontmatter in
  `content/home.md`) — with no photo, every theme falls back to the plain `text-hero` look rather than
  fabricating a stock image.
- `cardStyle` — service-card treatment: `icon-circle` (numbered glyph, the original look) or `photo` (each
  service's own `image:` field, if `content/services.md` supplies one — falls back to `icon-circle` per-card
  when a given service has no image).
- `fonts.heading` / `fonts.body` / `fonts.googleFontsUrl` — the theme's default font pairing. Overridden by
  `brand.config.json`'s `brand.font.{heading,body,googleFontsUrl}` when a real one was captured from the
  client's/prospect's actual site (`packages/parity`) — the theme's pairing is only the fallback.

**Colors are NOT set here** — they always come from the client's own `brand.config.json` (`brand.colors`),
seeded from a real capture (`parity/<slug>/brand.seed.json`) when replacing/pitching an existing site.

Seed a new client from `parity/<slug>/brand.seed.json` (via `/match-site`) or `demos/<slug>/_source/` (via
`/demo-site`, once that demo has real authored content) when replacing/copying an existing site's look.
