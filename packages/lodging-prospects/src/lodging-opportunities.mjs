#!/usr/bin/env node
/**
 * SiteWright Lodging Opportunity Detector (booking-side analog of packages/opportunities)
 * ------------------------------------------------------------------
 * Point this at ONE lodging property (name + optional own-site URL) and it produces the same
 * kind of client-ready, severity-tagged "here's what you're losing and how I'd fix it" report
 * that /find-opportunities produces for a regular business website — just for the booking side:
 *   1. PLATFORM PRESENCE — which of the top-5 booking platforms (Airbnb/Vrbo/Booking.com/Expedia/
 *      Hotels.com) the property is missing from. Each missing platform = travelers searching there
 *      who never see this property.
 *   2. DIRECT BOOKING — whether their own site lets a guest book instantly, and whether a real
 *      booking system is behind it (vs. manual phone/email, which risks double-booking).
 *   3. WEBSITE QUALITY — if they have a site, this reuses packages/opportunities' full engine
 *      (technical/trust/SEO + industry should-haves for hotel/cabin/vacation-rental/etc.) against
 *      it, so findings like "no HTTPS" or "no reviews shown" come from the exact same checks used
 *      for every other prospect — no separate logic to maintain.
 *
 * Usage:
 *   node packages/lodging-prospects/src/lodging-opportunities.mjs "<Property Name>" [--url <site>] [--city "..."] [--reviews N] [--rating N] [--md|--json] [--slug name]
 *
 * Writes lodging-opportunities/<slug>/report.md (+ report.json) — same shape/location convention
 * as opportunities/<slug>/report.md, so /prospect-brief-style tooling could compose it the same way.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { slugify, platformSeverity } from '../../testing/unit/booking.mjs';
import { checkPresence, scanOwnSite } from './scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const OPP = resolve(ROOT, 'packages/opportunities/src/opportunities.mjs');
const PLATFORMS = JSON.parse(readFileSync(resolve(__dirname, '../data/platforms.json'), 'utf8')).platforms;

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const asJson = args.includes('--json'), asMd = args.includes('--md');
if (!name) { console.error('Usage: lodging-opportunities.mjs "<Property Name>" [--url <site>] [--city "..."] [--reviews N] [--rating N] [--md|--json] [--slug name]'); process.exit(1); }

const url = opt('url', '') || '';
const city = opt('city', '') || '';
const reviews = parseInt(opt('reviews', '0')) || 0;
const rating = opt('rating') ? parseFloat(opt('rating')) : null;

const sevIcon = s => s === 'high' ? '🔴' : s === 'medium' ? '🟡' : '⚪';

(async () => {
  // ---------- 1) PLATFORM PRESENCE ----------
  const presence = [];
  for (const p of PLATFORMS) { presence.push(await checkPresence(name, p, city)); }
  const missing = presence.filter(p => !p.found);

  const findings = [];
  const add = o => findings.push({ category: 'booking', severity: 'medium', ...o });

  for (const p of missing) {
    add({ id: 'missing-' + p.platform, severity: platformSeverity(p.platform),
      finding: `Not listed on ${p.label}.`,
      impact: `Travelers who search ${p.label} directly never see this property — competitors who ARE listed capture that demand instead.`,
      fix: `List on ${p.label} (SiteWright listing service — Basic/Standard/Pro tier by platform count).` });
  }

  // ---------- 2) DIRECT BOOKING / OWN SITE ----------
  const own = url ? await scanOwnSite(url, PLATFORMS) : { site: '', hasBookingLink: false, systems: [], evidence: [] };
  if (!url) {
    add({ id: 'no-website', severity: 'high',
      finding: 'This property has no website of its own.',
      impact: 'No way for search engines or direct-booking guests to find or book the property outside the OTAs — 100% dependent on platform commission.',
      fix: 'Build a fast one-page site with a "Book on <platform>" button while getting listed on the missing platforms.' });
  } else if (!own.hasBookingLink) {
    add({ id: 'no-direct-booking', severity: 'high',
      finding: 'No "Book Now" / direct booking on the property\'s own website.',
      impact: 'Guests who find the site directly still have to call or email instead of booking instantly — most just leave and book a competitor on Airbnb/Booking.com instead.',
      fix: 'Add a "Book on <platform>" button (booking-link add-on) or a full booking-engine widget tied to the platforms they\'re listed on.' });
  }
  if (url && !own.systems.length) {
    add({ id: 'no-booking-system', severity: 'medium',
      finding: 'No booking-management system detected — reservations appear handled manually.',
      impact: 'Manual booking across phone/email/platforms risks double-booking the same date and costs staff time reconciling calendars.',
      fix: 'Recommend a channel manager/PMS (Cloudbeds, Lodgify, etc.) synced across every listed platform — see docs/BOOKING-INTEGRATION.md.' });
  }

  // ---------- 3) REVIEWS (cheap trust signal even without a full site scan) ----------
  if (reviews > 0 && reviews < 5) {
    add({ id: 'few-reviews', severity: 'low',
      finding: `Only ${reviews} review${reviews === 1 ? '' : 's'} visible.`,
      impact: '81% of travelers read reviews before booking a stay — a thin review count reads as unproven.',
      fix: 'Prompt recent guests for reviews on each listed platform; feature the best ones on the property\'s own site.' });
  }
  if (rating != null && rating < 4) {
    add({ id: 'low-rating', severity: 'medium',
      finding: `Average rating is ${rating}★.`,
      impact: 'Below 4★ meaningfully suppresses ranking/visibility in every platform\'s search algorithm, on top of scaring off travelers directly.',
      fix: 'Not a website fix — flag it, but the booking-listing pitch still stands: get onto the platforms guests already trust for reviews.' });
  }

  // ---------- 4) OWN-SITE WEBSITE QUALITY (reuse the full opportunities engine) ----------
  let siteOpp = null;
  if (url) {
    const r = spawnSync('node', [OPP, url, '--json'], { encoding: 'utf8', timeout: 60000 });
    if (r.status === 0 && r.stdout) { try { siteOpp = JSON.parse(r.stdout); } catch { /* skip */ } }
  }
  const siteFindings = (siteOpp?.opportunities || []).map(o => ({ ...o, category: 'website' }));
  findings.push(...siteFindings);

  // ---------- Score & sort ----------
  const weight = { high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => weight[b.severity] - weight[a.severity]);
  const counts = { high: findings.filter(f => f.severity === 'high').length, medium: findings.filter(f => f.severity === 'medium').length, low: findings.filter(f => f.severity === 'low').length };
  const oppScore = Math.min(100, counts.high * 20 + counts.medium * 10 + counts.low * 4);

  const slug = slugify(opt('slug') || name);
  const report = {
    name, source: url || null, city: city || null, generatedAt: new Date().toISOString(),
    platformsPresent: presence.filter(p => p.found).map(p => p.label),
    platformsMissing: missing.map(p => p.label),
    ownSite: { hasBookingLink: own.hasBookingLink, systems: own.systems },
    reviews, rating,
    opportunityScore: oppScore, counts, opportunities: findings,
  };

  const dir = resolve(process.cwd(), 'lodging-opportunities', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));

  const md = `# Lodging Opportunity Report — ${name}
_${city ? `${city} · ` : ''}${url ? `reviewed ${url} · ` : 'no own website found · '}${new Date(report.generatedAt).toLocaleString()}_

**${findings.length} improvement${findings.length === 1 ? '' : 's'} found** (${counts.high} high · ${counts.medium} medium · ${counts.low} low). Opportunity score: **${oppScore}/100**.

Platforms: listed on ${report.platformsPresent.join(', ') || 'none'} · missing from ${report.platformsMissing.join(', ') || 'none — fully listed'}.

${findings.map((o, i) => `### ${i + 1}. ${sevIcon(o.severity)} ${o.finding}
- **Why it matters:** ${o.impact}
- **The fix:** ${o.fix}`).join('\n\n')}

---
_Prepared by SiteWright. Next step: \`/propose-lodging "${name}"\` for a branded, ready-to-send proposal._
`;
  writeFileSync(resolve(dir, 'report.md'), md);

  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }
  if (asMd) { console.log(md); return; }

  console.log(`\n🏨 Lodging Opportunity Report — ${name}`);
  console.log(`   ${findings.length} improvements · ${counts.high} 🔴 high · ${counts.medium} 🟡 medium · ${counts.low} ⚪ low · score ${oppScore}/100\n`);
  findings.forEach((o, i) => { console.log(`  ${i + 1}. ${sevIcon(o.severity)} ${o.finding}`); console.log(`     → why: ${o.impact}`); console.log(`     → fix: ${o.fix}\n`); });
  console.log(`  Saved: lodging-opportunities/${slug}/report.md — a client-ready doc you can send.`);
  console.log(`  Tip: pitch the top 🔴 items, then run /propose-lodging "${name}" for a branded proposal.\n`);
})().catch(e => { console.error('Lodging opportunity scan failed:', e.message || e); process.exit(1); });
