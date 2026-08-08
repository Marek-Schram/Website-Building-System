# Client folder = raw materials. Fill brand/ + content/ (or seed from parity/<slug>/brand.seed.json). Then /build-site → /add-feature → /test-site → /security-gate → /deploy-site.

## content/*.md format
- `home.md` (required) — frontmatter: `hero_heading`, `hero_sub`, `cta_label`, `cta_href`; body = intro text.
- `about.md` — frontmatter: `title`; body = the business's story (plain paragraphs, blank-line separated).
- `services.md` — frontmatter: `title`; body = a list: `- name: "X"` / `  description: "Y"` / `  price: "$Z"` (optional).
- `contact.md` — frontmatter: `title`, `form: true|false`; body = short intro above the contact info.
- `testimonials.md`, `faq.md`, `gallery.md` (all optional) — same list format as services. **Only fill these
  in with REAL quotes/photos/answers from the client** — leave empty to skip the section. The builder never
  invents testimonials, FAQ answers, or photos for a real client's live site.

## brand/brand.config.json
- `addons` — ids from `packages/addons/catalog.json` to auto-apply at build time (native ones need no extra
  config; embeds like `online-ordering`/`booking`/`payments` need `addonConfig.<id>` with the provider's
  real URL/key — the builder skips them with a clear "needs config" note otherwise instead of guessing).
