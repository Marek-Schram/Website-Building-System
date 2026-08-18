#!/usr/bin/env node
/**
 * SiteWright Opportunity Detector
 * ------------------------------------------------------------------
 * Point this at a small business's CURRENT website and it auto-detects
 * weak points + missing features — so Marek can tell a prospect exactly
 * what's wrong and what he'd fix. e.g. "You're a restaurant with no
 * online ordering — you're paying DoorDash 15-30% you could keep."
 *
 * It combines three lenses:
 *   1. TECHNICAL — HTTPS, mobile viewport, page speed (PageSpeed if key),
 *      security headers, broken/placeholder bits, PDF menus, image bloat.
 *   2. FUNCTIONALITY — features an industry SHOULD have (from the add-ons
 *      catalog's recommendations) that are MISSING on the current site.
 *   3. TRUST/SEO — title, meta description, reviews, social, favicon,
 *      copyright year, contact method, Google Business signals.
 *
 * Each opportunity is framed by BUSINESS IMPACT (with $ where possible),
 * severity, and the exact SiteWright fix (which add-on / change).
 *
 * Usage:
 *   node packages/opportunities/src/opportunities.mjs <url-or-html> [--industry restaurant] [--md|--json] [--slug name]
 *
 * Writes opportunities/<slug>/report.md (+ report.json) — a client-ready
 * "here's what your current site is missing" document.
 */
import '../../../env.mjs';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectFeatures, SHOULD_HAVE, guessIndustry } from './classify.mjs';

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');
const asMd = args.includes('--md');
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
if (!target) { console.error('Usage: opportunities.mjs <url-or-html> [--industry X] [--md|--json] [--slug name]'); process.exit(1); }

const slugify = s => String(s || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function load(t) {
  if (/^https?:\/\//i.test(t)) {
    const res = await fetch(t, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'SiteWrightOpp/1.0' } });
    return { html: await res.text(), url: t, status: res.status, isUrl: true, finalUrl: res.url };
  }
  if (!existsSync(t)) { console.error('Not found: ' + t); process.exit(1); }
  return { html: readFileSync(t, 'utf8'), url: null, status: 200, isUrl: false };
}

const strip = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (h, t) => { const m = h.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : null; };
const metaContent = (h, name) => { const m = h.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i')); return m ? m[1] : null; };

// PageSpeed (optional, if key present) for real speed numbers.
function pageSpeed(url) {
  if (!process.env.PAGESPEED_API_KEY || !url) return null;
  const auditPath = resolve(new URL('.', import.meta.url).pathname, '../../audit/src/audit.mjs');
  if (!existsSync(auditPath)) return null;
  const r = spawnSync('node', [auditPath, url, '--json'], { encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0 || !r.stdout) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

async function checkHeaders(url) {
  if (!url) return null;
  const wanted = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options'];
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    const missing = wanted.filter(h => !res.headers.get(h));
    const server = res.headers.get('server');
    return { missing, serverLeak: server && /\d/.test(server) ? server : null };
  } catch { return null; }
}

(async () => {
  const { html, url, status, isUrl, finalUrl } = await load(target);
  const industry = guessIndustry(html, opt('industry'));
  const present = detectFeatures(html);
  const name = metaContent(html, 'og:site_name') || strip(between(html, 'title')).split(/[|\-–—]/)[0].trim() || 'This business';
  const httpsFinal = isUrl ? (finalUrl || url).startsWith('https://') : /https:\/\//i.test(html);
  const psi = pageSpeed(url);
  const headers = await checkHeaders(url);

  const opps = [];
  const flagged = new Set(); // track which feature-gaps we've already reported (avoid duplicates)
  const add = (o) => opps.push({ severity: 'medium', category: 'general', ...o });

  // ---------- 1) MISSING FUNCTIONALITY (industry should-haves) ----------
  const shouldHave = SHOULD_HAVE[industry] || SHOULD_HAVE.default;
  for (const [feat, why] of shouldHave) {
    if (!present.has(feat)) {
      flagged.add(feat);
      const sev = ['online-ordering', 'booking', 'store'].includes(feat) ? 'high' : 'medium';
      add({ id: 'missing-' + feat, category: 'functionality', severity: sev,
        finding: `No ${feat.replaceAll('-', ' ')} on the current site.`,
        impact: why,
        fix: `Add the “${feat}” feature (SiteWright add-on) — I can drop it in.` });
    }
  }

  // ---------- 2) TECHNICAL ----------
  if (!httpsFinal) add({ id: 'no-https', category: 'technical', severity: 'high',
    finding: 'The site is not served over HTTPS.',
    impact: 'Browsers show a “Not Secure” warning that scares customers off, and Google ranks non-HTTPS sites lower.',
    fix: 'Rebuild on Cloudflare Pages — automatic HTTPS + free security firewall.' });

  if (!/name\s*=\s*["']viewport["']/i.test(html)) add({ id: 'no-viewport', category: 'technical', severity: 'high',
    finding: 'No mobile viewport tag — the site is not mobile-friendly.',
    impact: 'Over 60–80% of local traffic is on phones. A non-mobile site loses most visitors instantly.',
    fix: 'A mobile-first rebuild that looks perfect on any phone.' });

  if (psi && typeof psi.mobile?.performance === 'number' && psi.mobile.performance < 60)
    add({ id: 'slow', category: 'technical', severity: psi.mobile.performance < 40 ? 'high' : 'medium',
      finding: `Slow on mobile (PageSpeed ${psi.mobile.performance}/100).`,
      impact: 'Every extra second of load time loses customers before the page appears.',
      fix: 'A fast static build (near-instant loads) with optimized images.' });

  if (headers && headers.missing.length >= 2) add({ id: 'headers', category: 'technical', severity: 'medium',
    finding: `Missing ${headers.missing.length} security headers.`,
    impact: 'Leaves the site more exposed to common attacks and browser warnings.',
    fix: 'Add the standard security headers (free) during the rebuild.' });

  if (headers && headers.serverLeak) add({ id: 'server-leak', category: 'technical', severity: 'low',
    finding: `Server software/version is exposed (${headers.serverLeak}).`,
    impact: 'Tells attackers exactly what to target.',
    fix: 'Hide server details during the rebuild.' });

  // PDF menu detection (restaurant-specific but general)
  if (/href\s*=\s*["'][^"']+\.pdf/i.test(html) && /menu/i.test(html))
    add({ id: 'pdf-menu', category: 'functionality', severity: 'medium',
      finding: 'The menu appears to be a PDF.',
      impact: 'PDFs are hard to read on phones, invisible to Google, and inaccessible — costing customers and search traffic.',
      fix: 'Convert to a fast HTML menu (the “menu” add-on) with prices and dietary tags.' });

  // Heavy/broken images
  const imgs = (html.match(/<img\b[^>]*>/gi) || []);
  const noAlt = imgs.filter(t => !/alt\s*=/.test(t)).length;
  if (imgs.length && noAlt / imgs.length > 0.5) add({ id: 'img-alt', category: 'seo', severity: 'low',
    finding: `${noAlt} of ${imgs.length} images have no alt text.`,
    impact: 'Hurts SEO and accessibility (screen readers, ADA).',
    fix: 'Add descriptive alt text during the rebuild.' });

  // ---------- 3) TRUST / SEO ----------
  const title = strip(between(html, 'title'));
  if (!title) add({ id: 'no-title', category: 'seo', severity: 'high',
    finding: 'No page <title>.',
    impact: 'The browser tab and Google result are blank — terrible for search and trust.',
    fix: 'Proper titles + meta on every page.' });
  if (!metaContent(html, 'description')) add({ id: 'no-meta', category: 'seo', severity: 'medium',
    finding: 'No meta description.',
    impact: 'Google shows random text under your link instead of a compelling summary.',
    fix: 'Write meta descriptions that earn the click.' });
  if (!present.has('contact-form') && !flagged.has('contact-form') && !flagged.has('click-to-call') && !/href\s*=\s*["'](tel:|mailto:)/i.test(html))
    add({ id: 'no-contact', category: 'trust', severity: 'high',
      finding: 'No obvious way to make contact (no form, phone, or email link).',
      impact: 'Visitors who are ready to buy have no way to reach you — pure lost revenue.',
      fix: 'Add click-to-call + a contact form.' });
  if (!present.has('reviews') && !flagged.has('reviews') && !/review|testimonial|★|⭐/i.test(html))
    add({ id: 'no-reviews', category: 'trust', severity: 'medium',
      finding: 'No reviews or testimonials shown.',
      impact: '81% of people read reviews before choosing a local business.',
      fix: 'Add a reviews/testimonials section (pull in your Google reviews).' });
  const cy = (html.match(/©\s*(\d{4})|copyright\s*(\d{4})/i) || []);
  const year = +(cy[1] || cy[2] || 0);
  const now = new Date().getFullYear();
  if (year && now - year >= 2) add({ id: 'stale', category: 'trust', severity: 'low',
    finding: `Footer copyright says ${year} — the site looks abandoned.`,
    impact: 'A stale year signals “out of business” or neglect and erodes trust.',
    fix: 'A fresh, maintained site (auto-updating year).' });
  if (!/<link[^>]+rel\s*=\s*["'][^"']*icon/i.test(html)) add({ id: 'no-favicon', category: 'trust', severity: 'low',
    finding: 'No favicon.',
    impact: 'Looks unfinished in browser tabs and bookmarks.',
    fix: 'Add a branded favicon.' });

  // ---------- Score & sort ----------
  const weight = { high: 3, medium: 2, low: 1 };
  opps.sort((a, b) => weight[b.severity] - weight[a.severity]);
  const counts = { high: opps.filter(o => o.severity === 'high').length, medium: opps.filter(o => o.severity === 'medium').length, low: opps.filter(o => o.severity === 'low').length };
  // Opportunity score 0-100 (higher = more upside to pitch)
  const oppScore = Math.min(100, counts.high * 20 + counts.medium * 10 + counts.low * 4);

  const slug = slugify(opt('slug') || name);
  const report = { source: target, business: name, industry, generatedAt: new Date().toISOString(),
    opportunityScore: oppScore, counts, present: [...present], opportunities: opps };

  const dir = resolve(process.cwd(), 'opportunities', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));

  const sevIcon = s => s === 'high' ? '🔴' : s === 'medium' ? '🟡' : '⚪';
  const md = `# Website Opportunity Report — ${name}
_Reviewed ${target} on ${new Date(report.generatedAt).toLocaleString()} · detected industry: ${industry}_

**${opps.length} improvement${opps.length === 1 ? '' : 's'} found** (${counts.high} high · ${counts.medium} medium · ${counts.low} low). Opportunity score: **${oppScore}/100**.

> How to read this: each item is something on your **current** site that could be costing you customers, and
> exactly how I'd fix it in a faster, cheaper rebuild.

${opps.map((o, i) => `### ${i + 1}. ${sevIcon(o.severity)} ${o.finding}
- **Why it matters:** ${o.impact}
- **The fix:** ${o.fix}`).join('\n\n')}

## What's already good
${report.present.length ? report.present.map(f => `- ${f}`).join('\n') : '- (little detected — big upside)'}

---
_Prepared by SiteWright. I can rebuild this site to fix all of the above — faster, secure, mobile — for less than you'd expect._
`;
  writeFileSync(resolve(dir, 'report.md'), md);

  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }
  if (asMd) { console.log(md); return; }

  console.log(`\n🔎 Opportunity Report — ${name}  (${industry})`);
  console.log(`   ${target}`);
  console.log(`   ${opps.length} improvements · ${counts.high} 🔴 high · ${counts.medium} 🟡 medium · ${counts.low} ⚪ low · score ${oppScore}/100\n`);
  opps.forEach((o, i) => {
    console.log(`  ${i + 1}. ${sevIcon(o.severity)} ${o.finding}`);
    console.log(`     → why: ${o.impact}`);
    console.log(`     → fix: ${o.fix}\n`);
  });
  if (!psi && isUrl) console.log('  (tip: set PAGESPEED_API_KEY to include real mobile speed numbers)');
  console.log(`  Saved: opportunities/${slug}/report.md  — a client-ready doc you can send.\n`);
})().catch(e => { console.error('Opportunity scan failed:', e.message || e); process.exit(1); });
