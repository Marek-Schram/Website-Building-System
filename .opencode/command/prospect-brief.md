---
description: Build a single polished, emailable prospect brief for a lead: opportunity scan (weak points on their current site) + instant audit (score) + a matching free demo site, packaged as prospect-brief.html + demo/ + outreach-email.txt + brief.json. Use when Marek wants a ready-to-send pitch for a prospect URL.
agent: build
---

Build a ready-to-email prospect brief for a lead using SiteWright.

## Run
`node packages/prospect-brief/src/brief.mjs <url> [--name "Business"] [--type <industry>] [--city "City, ST"] [--phone "..."] [--address "..."] [--slug name]`

- Works with just a URL (name/type are inferred). Pass flags for a nicer matching demo.
- `PAGESPEED_API_KEY` gives real speed numbers (optional; otherwise audit shows a score without speed).
- Output → `prospect-briefs/<slug>/`:
  - `prospect-brief.html` — cover + stats + prioritized weak points + audit score + "view your free demo" button (open in browser → File ▸ Print ▸ Save as PDF).
  - `demo/index.html` — the prospect's free matching starter site.
  - `outreach-email.txt` — ready-to-send message with the top 3 findings.
  - `brief.json` — the data bundle.

## Polish (optional but recommended)
Before sending, drop a headline fix into the demo:
`node packages/addons/src/addons.mjs make chatbot --name "<Business>" --phone "<phone>" --out prospect-briefs/<slug>/demo/index.html`
(chatbot is free; add `--aiEndpoint` for the AI upgrade).

## Verify
1. `node packages/testing/harness/human-test.mjs prospect-briefs/<slug>/demo/index.html` → 0 failures.
2. If a browser is available, open `prospect-brief.html` and check the layout, then save as PDF.

Interpret $ARGUMENTS into the flags above. Boundary: public sites only.
