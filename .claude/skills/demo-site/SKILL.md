---
name: demo-site
description: Generate a free demo website for a prospect — either a fast unattended batch pass (many leads at once, generic but improved from real captured colors/services when available) or a high-quality interactive pass (Claude looks at a real screenshot of the prospect's own site, writes real paraphrased copy, picks one high-impact feature, renders through the same real-content pipeline paying clients get).
---
# Demo Site

Two tiers, pick based on what the moment calls for:

| | **Quick** (batch) | **Full** (interactive) |
|---|---|---|
| Use for | Scanning many leads at once, unattended | A specific prospect worth a serious pitch |
| Speed | Seconds, no Claude judgment needed | Minutes — Claude looks at the site and writes real copy |
| Quality | Generic per-industry template; real colors/services *when a URL fetch succeeds* | Genuinely customized: real photos, real colors/fonts, real paraphrased copy, one chosen feature |
| Command | `node packages/demo-gen/src/demo.mjs ...` | Follow the step-by-step procedure below |

Both write to `demos/<slug>/index.html` — the same path, so anything downstream (`/prospect-brief`,
Command Center) works with either. Re-running Quick over an existing Full demo overwrites it — Command
Center's "Generate Demo" button confirms before doing that; from the CLI, just be aware.

## Quick (batch) mode
```
node packages/demo-gen/src/demo.mjs --name "Biz" --type plumber [--url <site>] [--city --phone --email --address --slug --theme] | --from leads.json [--max N]
```
- `--from leads.json` sorts by `opportunityScore` and builds the top `--max` (default 10) unattended —
  the right tool right after `/find-leads`.
- Pass `--url` (or a lead's own `website` field, used automatically) to pull real colors/fonts/service
  names from the prospect's actual site via a quick fetch (no browser, ~7s timeout, fails gracefully to
  the generic per-industry fallback). Industry classification uses the full ~24-category classifier
  (`packages/opportunities/src/classify.mjs`) — pass `--type` explicitly when you have it (e.g. from
  Google Places' `primaryType`), since it's more reliable than guessing from page text alone.
- Output: `demos/<slug>/{index.html, README.md}` (README has the ready-to-send outreach line).

## Full (interactive) mode — you do these steps yourself, in this chat
Use when Marek gives you a specific prospect's URL and wants a real pitch-quality demo, not a batch scan.

1. **Capture** — `node packages/parity/src/capture-browser.mjs <old-url> --slug <slug>` → writes
   `parity/<slug>/{baseline.json, brand.seed.json, baseline.md, rendered.html, screenshots/*.png, assets/*}`.
   This renders the page in a real browser (fixes what a plain fetch can't see — JS-rendered content, CSS
   custom-property colors, inline-SVG/background-image logos) and downloads the business's own real photos.
2. **Look** — `Read` `parity/<slug>/screenshots/desktop-full.png` (and `desktop-above-fold.png`). This is
   the actual judgment step: what's the layout feel (image-heavy vs. text-heavy, single-column vs. split),
   what photos are worth reusing, what would "modernized but still recognizably theirs" look like.
3. **Find the one feature** — `node packages/opportunities/src/opportunities.mjs parity/<slug>/rendered.html --slug <slug> --industry <guessed-from-baseline.json> --json`
   (points at the rendered HTML snapshot from step 1, not a second live fetch). Take the top
   `category:'functionality'` finding (already severity-sorted) as the one feature to add. Cross-reference
   `packages/addons/src/addons.mjs`'s `REC[industry]` for the matching add-on id and what config it needs.
   **A genuinely well-built site may have zero functionality findings** (confirmed on a real site during
   testing — score 4/100, every should-have feature already present) — that's a correct, expected outcome,
   not a bug. When that happens: take the top finding of ANY category instead (technical/trust/seo — even a
   low-severity one like a stale copyright year), or if the report is essentially empty, skip step 4's
   `addons` array and frame the demo around modernized execution/speed/cost rather than a missing feature.
   Never force a feature onto a site that doesn't need one just to have something to add.
4. **Write brand config** — `demos/<slug>/_source/brand/brand.config.json`, seeded from
   `parity/<slug>/brand.seed.json` (real colors/fonts/logo/contact — don't invent these). Pick a theme by
   feel: `harvest` (warm/artisan, image-hero) for something photo-led, `summit` (bold/modern, split-hero)
   for something punchier, `beacon` (clean/professional, plain hero) as the safe default when no strong
   hero photo exists. Set `addons: ["<the one chosen id>"]` with any required `addonConfig`.
5. **Write content** — `demos/<slug>/_source/content/{home,about,services,contact}.md` (add
   `testimonials.md`/`faq.md`/`gallery.md` if real material exists). Copy must be **genuinely paraphrased
   from `parity/<slug>/baseline.json`'s `bodyCopy`/`servicesCandidate`** — read what they actually say and
   write it fresh in your own words, lightly modernized. Never copy verbatim (plagiarism), never invent
   facts not implied by the real capture (services, credentials, years in business). If a real hero photo
   was captured, copy it: `cp parity/<slug>/assets/hero-1.jpg demos/<slug>/_source/public/assets/hero.jpg`
   and set `hero_image: assets/hero.jpg` in `home.md`'s frontmatter.
6. **Build** —
   ```
   node packages/site-builder/src/build.mjs "<slug>" --out demos --client-dir "demos/<slug>/_source"
   ```
   This is the exact same real-content-only renderer/addon system paying clients get (never fabricates a
   section it doesn't have real content for) — writes `demos/<slug>/index.html` directly, no copy step.
7. **Log** — per memory-log convention, `memory/leads/<niche>-<city>.md`.
8. Boundary: public HTML only, sites Marek owns or is actively pitching (`.claude/rules/testing.md` /
   `security-sensitive.md`).

### Before sending it — a real checklist, not a formality
Open `demos/<slug>/index.html` next to `parity/<slug>/screenshots/desktop-full.png` and honestly ask:
- Does the color/font/layout genuinely feel drawn from their real site, not a generic template?
- Is every fact in the copy something their real site actually said (paraphrased, not invented)?
- Is the one added feature obviously the right pick — the thing most likely to actually move the needle?
- Would the business owner look at this and think "someone looked at MY site," not "this is AI slop"?
If any answer is no, fix it before sending — that's the entire point of the Full tier over the Quick one.
