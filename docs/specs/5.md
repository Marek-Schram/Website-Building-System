# PROSPECT-BRIEF — one polished doc to email a lead

`/prospect-brief` (`packages/prospect-brief/`) runs three tools and assembles a single, branded, print-ready
document that makes the whole pitch in one file.

## Run
`node packages/prospect-brief/src/brief.mjs <url> [--name --type --city --phone --address --slug]`
→ `prospect-briefs/<slug>/`:
- **prospect-brief.html** — cover + stats (improvements found, high-priority count, current score) +
  prioritized weak points (with $ impact) + a "view your free demo" button. Open in a browser →
  File ▸ Print ▸ **Save as PDF** to email.
- **demo/index.html** — a free matching starter site for the prospect.
- **outreach-email.txt** — ready-to-send message pre-filled with the top 3 findings.
- **brief.json** — data bundle.

## What it chains (in order)
1. **Opportunities** — weak points on their current site (the credible hook).
2. **Audit** — 0–100 score (speed/SEO/HTTPS/headers; set PAGESPEED_API_KEY for real speed).
3. **Demo** — a matching starter site. Optionally `/add-feature` a headline fix (e.g. online-ordering, or the
   free chatbot) into `demo/index.html` before sending.

## The pitch it makes
"Here's what your current site is missing, here's your score, and here's a free starter site I already built —
I can do all this for less." It's the client engine's find→diagnose→prove→demo, packaged for one email.
Boundary: public sites only; impact figures are labeled estimates.
