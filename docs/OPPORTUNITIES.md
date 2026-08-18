# OPPORTUNITIES — auto-detect weak points on a prospect's current site

Point this at a small business's **current** website and it produces a prioritized, business-impact-framed
list of weak points + missing features — so you can tell the prospect exactly what's wrong and what you'd fix.
This is the pitch that turns a cold lead warm: *"You're a restaurant with no online ordering — that's 15–30%
you're handing DoorDash that you could keep."* Skill: `/find-opportunities`. Agent: `opportunity-scout`.

## Run
```
node packages/opportunities/src/opportunities.mjs <url-or-html> [--industry <type>] [--md|--json] [--slug name]
```
- Auto-detects the industry (or pass `--industry restaurant`).
- Set `PAGESPEED_API_KEY` to include real mobile speed numbers (otherwise it still checks HTTPS, mobile
  viewport, security headers, structure, and missing features — just skips the speed score).
- Writes `opportunities/<slug>/report.md` (client-ready) + `report.json`.

## The three lenses
1. **Missing functionality** — features the detected industry *should* have but the site lacks, taken from the
   add-ons "should-have per industry" map. Each maps to a SiteWright add-on you can drop in:
   - Restaurant → **online-ordering** (keep 15–30% vs DoorDash/Uber Eats), **HTML menu** (not a PDF),
     reservations.
   - Salon / barber / dentist / gym / cleaning / lawyer / auto → **booking** (~40% of bookings are after-hours;
     reminders cut no-shows 30–50%).
   - Plumber / electrician → click-to-call, contact form, reviews, FAQ.
   - Hotel / hostel / cabin / bed-and-breakfast / vacation-rental → **booking** (a direct "Book Now" avoids
     the 15–25% OTA commission), gallery, reviews.
2. **Technical** — no HTTPS, no mobile viewport, slow PageSpeed, missing security headers, exposed server
   version, **PDF menu**, images without alt text.
3. **Trust / SEO** — no title / meta description, no contact method, no reviews, stale copyright year, no favicon.

Each opportunity carries **severity** (🔴 high / 🟡 medium / ⚪ low), a plain-English **business impact** (with
$ where possible), and the exact **fix** (which add-on / change). Results are sorted worst-first, with an
**opportunity score** (0–100) summarizing how much upside there is to pitch.

## How Marek uses it
1. From a lead (`/find-leads`), run `/find-opportunities <their-site>`.
2. Lead outreach with the top 1–2 🔴 items and attach `report.md`.
3. Pair with `/demo-site` + `/add-feature` to *show* the fix (e.g. a demo of their site *with* online ordering),
   and `/match-site` if you're replacing the whole site (opportunities + parity together = "I keep everything
   that's good, fix everything that's weak, for less").
4. Log notable findings in `memory/leads/<city>-<niche>.md` and the client's `brand.config.json`
   (`opportunityReport` field) once won.

## Credibility (important)
A **strong** site correctly returns few or zero opportunities — the tool is calibrated so it isn't just
always-alarming. Feature detection is kept **in sync with `packages/parity/`** so the two agree on what a site
already has (both detect reviews, ordering, booking, etc.). Frame findings as **help, not criticism**, and
never invent numbers — the impact lines are framing, and any figure should be presented as an estimate.

## Boundary
Only scan sites of genuine prospects. It reads **public HTML only** (no logins, no probing). This is a
read-only analysis, not a security scan of someone else's property.

## Where it fits
`/find-leads` → **`/find-opportunities`** (what's weak) → `/demo-site` + `/add-feature` (show the fix) →
outreach the top weak points → win → `/new-client` … (or `/match-site` to replace their site). See
`docs/CLIENT-ENGINE.md`.

**Lodging/booking clients** get the same two-step pattern via a different pair: `/find-booking-leads` →
`/find-booking-opportunities` — the latter reuses this exact engine for website-quality findings and adds
booking-platform-presence + direct-booking findings on top. See `docs/BOOKING-INTEGRATION.md`.
