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

// ---- Feature detection (kept in sync with parity/capture) ----
function detectFeatures(html) {
  const h = html.toLowerCase(); const f = new Set(); const has = (...k) => k.some(x => h.includes(x));
  if (/<form\b/i.test(html)) f.add('contact-form');
  if (/href\s*=\s*["']tel:/i.test(html)) f.add('click-to-call');
  if (has('maps.google', 'google.com/maps', 'maps.googleapis')) f.add('map');
  if (has('instagram.com', 'facebook.com', 'youtube.com', 'tiktok.com')) f.add('social');
  if (has('toasttab', 'chownow', 'gloriafood', 'ontabee', 'order online', 'squareup.com/order', '/order')) f.add('online-ordering');
  if (has('opentable', 'resy.com', 'exploretock', 'reservation')) f.add('reservations');
  if (has('calendly', 'simplybook', 'acuity', 'appointments', 'book now', 'book appointment', 'schedule')) f.add('booking');
  if (has('menu') && (has('$') || /class\s*=\s*["'][^"']*menu/i.test(html))) f.add('menu');
  if (has('snipcart', 'add to cart', 'shopify', 'woocommerce', '/cart', 'shop now')) f.add('store');
  if (has('stripe', 'checkout', 'buy now', 'paypal', 'lemonsqueezy', 'paddle')) f.add('payments');
  if (has('mailchimp', 'brevo', 'newsletter', 'subscribe', 'emailoctopus')) f.add('newsletter');
  if (has('wa.me', 'whatsapp')) f.add('whatsapp');
  if (has('tawk.to', 'crisp.chat', 'intercom', 'livechat')) f.add('live-chat');
  if ((html.match(/<img\b/gi) || []).length >= 6 || has('gallery', 'lightbox')) f.add('gallery');
  if (has('faq', 'frequently asked')) f.add('faq');
  if (has('review', 'testimonial', '★', '⭐', 'stars')) f.add('reviews');
  return f;
}

// What each industry SHOULD have (mirrors addons recommendations). id → why it matters.
const SHOULD_HAVE = {
  restaurant: [['online-ordering', 'Take orders directly and keep the 15–30% DoorDash/Uber Eats charges — often $15k–$30k/yr on $100k delivery.'], ['menu', 'A real HTML menu (not a PDF) ranks on Google and works on phones; PDFs lose customers.'], ['reservations', 'Let guests book a table 24/7 and fill seats.'], ['map', 'Make it one tap to find you.'], ['reviews', 'Social proof drives choice between two restaurants.'], ['click-to-call', 'Most diners call from a phone.']],
  cafe: [['online-ordering', 'Mobile order-ahead grows ticket size and skips the line.'], ['menu', 'HTML menu ranks and reads on phones.'], ['map', 'One-tap directions.'], ['social', 'Cafes live on Instagram.']],
  bakery: [['online-ordering', 'Take custom cake / pre-orders online.'], ['menu', 'Showcase items with prices.'], ['gallery', 'Photos of the goods sell them.'], ['reviews', 'Trust for special orders.']],
  salon: [['booking', '~40% of bookings happen after hours; 24/7 self-booking cuts no-shows 30–50%.'], ['gallery', 'Before/after photos are the #1 salon selling tool.'], ['reviews', 'Trust for a new stylist.'], ['social', 'Instagram is the salon portfolio.']],
  barber: [['booking', 'Let clients book without calling; fill the chair.'], ['reviews', 'Trust for a first cut.'], ['click-to-call', 'Quick calls for walk-ins.']],
  dentist: [['booking', 'Online appointment requests capture patients after hours.'], ['reviews', 'Trust is everything in healthcare.'], ['faq', 'Answer insurance/first-visit questions and deflect calls.'], ['contact-form', 'New-patient intake.']],
  gym: [['booking', 'Class/trial sign-ups online.'], ['gallery', 'Show the space and results.'], ['newsletter', 'Retention and challenges.'], ['social', 'Community lives on social.']],
  plumber: [['click-to-call', 'Emergencies mean instant calls — a sticky call button converts.'], ['contact-form', 'Capture quote requests 24/7.'], ['reviews', 'Trust for letting someone into your home.'], ['faq', 'Answer "do you do X" and reduce time-wasters.']],
  electrician: [['click-to-call', 'Fast calls for urgent work.'], ['contact-form', 'Quote requests.'], ['reviews', 'Trust + licensing signals.']],
  lawyer: [['contact-form', 'Confidential intake form.'], ['booking', 'Free-consultation scheduling.'], ['faq', 'Answer practice-area questions.'], ['reviews', 'Case-result social proof.']],
  cleaning: [['booking', 'Instant quote/booking wins the job.'], ['reviews', 'Trust for home access.'], ['contact-form', 'Quote requests.']],
  autorepair: [['booking', 'Appointment requests online.'], ['reviews', 'Trust for fair pricing.'], ['map', 'Find the shop.'], ['click-to-call', 'Quick calls.']],
  retail: [['store', 'Sell online, not just in person.'], ['payments', 'Take payment on the site.'], ['gallery', 'Product photos.'], ['newsletter', 'Repeat sales.']],
  hotel: [['booking', 'A direct "Book Now" on your own site avoids the 15–25% commission Airbnb/Booking.com/Expedia take on every OTA booking.'], ['gallery', 'Room and property photos are the #1 driver of a booking decision.'], ['reviews', 'Travelers check reviews before booking a stay — none visible costs bookings.'], ['map', 'One-tap directions help guests actually arrive.']],
  hostel: [['booking', 'Direct bookings skip the OTA commission most hostels rely on Hostelworld/Booking.com for.'], ['reviews', 'Younger travelers lean heavily on reviews before booking a bed.'], ['gallery', 'Photos of the common areas and rooms sell the stay.'], ['social', 'Hostel guests check social before booking.']],
  cabin: [['booking', 'A direct "Book Now" avoids OTA commission on Airbnb/Vrbo.'], ['gallery', 'Photos of the cabin, view, and amenities sell the stay.'], ['reviews', 'Trust before booking a remote property.'], ['map', 'Guests need clear directions to find rural properties.']],
  bedandbreakfast: [['booking', 'Direct bookings avoid OTA commission and let you manage the relationship.'], ['gallery', 'Room and breakfast photos are the top decision driver.'], ['reviews', 'Trust matters for a personal, small-scale stay.'], ['contact-form', 'Guests often ask about pets, diet, or arrival time before booking.']],
  vacationrental: [['booking', 'A direct "Book Now" avoids the 15–25% commission Airbnb/Vrbo take on every booking.'], ['gallery', 'Photos of the property, view, and amenities sell the stay.'], ['reviews', 'Travelers check reviews before booking a rental.'], ['map', 'Guests need directions to find the property.']],
  default: [['contact-form', 'A way to capture leads 24/7.'], ['map', 'One-tap directions.'], ['reviews', 'Social proof to win trust.'], ['click-to-call', 'Easy phone contact.'], ['social', 'Where customers check you out.']],
};

function guessIndustry(html, override) {
  if (override) return override.toLowerCase();
  const h = strip(html).toLowerCase() + ' ' + (metaContent(html, 'description') || '').toLowerCase();
  const has = (...k) => k.some(x => h.includes(x));
  if (has('menu', 'restaurant', 'dine', 'reservation', 'entree', 'appetizer')) return 'restaurant';
  if (has('espresso', 'latte', 'coffee shop', 'cafe')) return 'cafe';
  if (has('bakery', 'pastry', 'cakes')) return 'bakery';
  if (has('salon', 'hair', 'stylist', 'balayage', 'blowout')) return 'salon';
  if (has('barber', 'fade', 'beard trim')) return 'barber';
  if (has('dentist', 'dental', 'orthodont', 'teeth')) return 'dentist';
  if (has('gym', 'fitness', 'personal training', 'crossfit')) return 'gym';
  if (has('plumber', 'plumbing', 'drain', 'water heater')) return 'plumber';
  if (has('electrician', 'electrical', 'wiring')) return 'electrician';
  if (has('law firm', 'attorney', 'lawyer', 'legal')) return 'lawyer';
  if (has('cleaning', 'maid', 'janitorial')) return 'cleaning';
  if (has('auto repair', 'mechanic', 'oil change', 'tires')) return 'autorepair';
  if (has('hostel', 'dorm bed', 'shared room')) return 'hostel';
  if (has('bed and breakfast', 'bed & breakfast', 'b&b')) return 'bedandbreakfast';
  if (has('cabin rental', 'cabin', 'chalet')) return 'cabin';
  if (has('vacation rental', 'short-term rental', 'vrbo')) return 'vacationrental';
  if (has('hotel', 'inn', 'lodge', 'resort', 'nightly rate', 'per night', 'check-in', 'check-out')) return 'hotel';
  if (has('shop', 'store', 'boutique', 'buy now', 'cart')) return 'retail';
  return 'default';
}

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
