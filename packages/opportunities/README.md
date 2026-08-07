# Opportunities — auto-detect weak points on a prospect's current site

Give it a business's current website; it returns a prioritized, business-impact-framed list of weak points +
missing features so you can pitch specific fixes. Skill: `/find-opportunities`. Agent: `opportunity-scout`.

## Run
`node packages/opportunities/src/opportunities.mjs <url-or-html> [--industry X] [--md|--json] [--slug name]`
→ `opportunities/<slug>/report.md` (client-ready) + `report.json`. Set `PAGESPEED_API_KEY` for real speed.

## Three lenses
1. **Missing functionality** (from the add-ons "should-have per industry" map): e.g. restaurant → online
   ordering (keep 15–30% vs DoorDash), HTML menu (not PDF), reservations; salon/dentist → booking (~40%
   after-hours). Each maps to an add-on you can drop in.
2. **Technical**: HTTPS, mobile viewport, PageSpeed, security headers, server-version leak, PDF menu, image alt.
3. **Trust/SEO**: title, meta description, contact method, reviews, stale year, favicon.

Each opportunity → severity (🔴/🟡/⚪) + plain-English impact + the exact fix. A strong site returns few/zero
(so it stays credible). Feature detection is kept in sync with `packages/parity/`. See docs/OPPORTUNITIES.md.

## Fits the client engine
`/find-leads` → **`/find-opportunities`** (what's wrong) → `/demo-site` + `/add-feature` (show the fix) →
outreach the top weak points → `/match-site` if replacing (keep the good, fix the weak). Public HTML only.
