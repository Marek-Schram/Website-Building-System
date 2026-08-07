---
name: prospect-brief
description: Build a single polished, emailable brief for a prospect that combines the opportunity scan (weak points), the instant audit (score), and a matching free demo site — one command. Use when Marek wants a ready-to-send pitch document for a lead.
---
# Prospect Brief (one polished doc to email a lead)

Runs three tools and assembles a branded, print-ready document you can email or turn into a PDF.

## Run
`node packages/prospect-brief/src/brief.mjs <url> [--name --type --city --phone --address --slug]`
- Works with just a URL (infers name/type). Pass flags for a nicer matching demo.
- Set `PAGESPEED_API_KEY` for real speed numbers (optional).

## What it produces → `prospect-briefs/<slug>/`
- **prospect-brief.html** — cover + stats band + prioritized weak points (with $ impact) + audit score + a
  "view your free demo" button. Open in a browser → File ▸ Print ▸ **Save as PDF** to email.
- **demo/index.html** — a free matching starter site for the prospect (from `/demo-site`).
- **outreach-email.txt** — a ready-to-send message pre-filled with the top 3 findings.
- **brief.json** — the data bundle.

## Under the hood (in order)
1. `/find-opportunities` → weak points on their current site (the credible hook).
2. `/audit-site` → 0–100 score (speed/SEO/HTTPS/headers).
3. `/demo-site` → a matching demo. Optionally `/add-feature` a headline fix (e.g. online-ordering) into the
   demo before sending, to make it pop.

## How Marek uses it
Pull a lead with `/find-leads`, run `/prospect-brief <their-url> --name "…" --type restaurant --city "…"`,
then email `prospect-brief.html` (as PDF) with the `outreach-email.txt` text. It's the whole pitch in one file:
"here's what's weak, here's your score, here's a site I already built — for less." Boundary: public sites only.
