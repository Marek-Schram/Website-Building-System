#!/usr/bin/env node
// Demo Generator (fast, UNATTENDED batch mode — for scanning many leads at once).
// Usage: demo.mjs --name "Biz" --type plumber [--url <site>] [...] | --from leads.json [--max N]
//
// For a real prospect worth a serious pitch, use the interactive /demo-site skill instead — it screenshots
// the prospect's actual site, has Claude look at it and write real paraphrased copy, and renders through
// packages/site-builder (the same real-content pipeline paying clients get). This script stays fast and
// unattended by design (no Claude authoring loop), so it can't do that — but it's no longer purely
// hardcoded either: when a real URL is available (--url, or a lead's website field), it does a quick
// fetch+regex extraction (packages/parity/src/extract-static.mjs — fast, no browser) for REAL colors/
// fonts/nav-derived service names, falling back to a generic per-industry persona only when no real data
// could be fetched. Industry classification now uses the full shared classifier (packages/opportunities/
// src/classify.mjs) instead of a private 8-bucket list, so verticals like roofing no longer silently fall
// to a generic "default" persona (see memory/lessons-learned.md for the real bug this fixes).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guessIndustry } from '../../opportunities/src/classify.mjs';
import { loadStatic, extractCss, extractColors, extractFonts, extractNav } from '../../parity/src/extract-static.mjs';

const av = process.argv.slice(2);
const opt = (k, d = null) => { const i = av.indexOf('--' + k); return i >= 0 && av[i + 1] && !av[i + 1].startsWith('--') ? av[i + 1] : d; };
const OUT = resolve(process.cwd(), opt('out', 'demos'));
const MAX = parseInt(opt('max', '10')) || 10;

// Per-industry fallback persona (emoji/tagline/services/reason/palette) — used only when no real data
// could be fetched from the business's actual site (or none was given/reachable). Real captured colors/
// fonts/services always win when available (see chooseColors/chooseServices below).
export const DISPLAY = {
  restaurant: { p: 'warm', e: '🍽️', t: 'Fresh, local, made with love', s: ['Dine-In & Takeout', 'Catering', 'Daily Specials'], r: 'made fresh and served with care' },
  cafe: { p: 'warm', e: '☕', t: 'Great coffee, welcoming space', s: ['Espresso', 'Pastries', 'Workspace'], r: 'crafted fresh, every cup' },
  bakery: { p: 'warm', e: '🥐', t: 'Baked fresh every morning', s: ['Daily Breads', 'Custom Cakes', 'Coffee'], r: 'baked fresh daily' },
  salon: { p: 'lux', e: '💇', t: 'Look your best', s: ['Cuts', 'Color', 'Treatments'], r: 'styled by experienced professionals' },
  barber: { p: 'trust', e: '💈', t: 'Sharp cuts, every time', s: ['Haircuts', 'Beard Trims', 'Hot Towel Shaves'], r: 'precision service, no appointment hassle' },
  dentist: { p: 'trust', e: '🦷', t: 'Healthy smiles', s: ['Checkups', 'Cosmetic', 'Emergency'], r: 'gentle, professional care' },
  gym: { p: 'bold', e: '💪', t: 'Stronger every day', s: ['Memberships', 'Training', 'Classes'], r: 'built around real results' },
  roofing: { p: 'trust', e: '🏠', t: 'Quality roofing, done right', s: ['Roof Repair', 'Roof Replacement', 'Storm Damage'], r: 'backed by years of local experience' },
  hvac: { p: 'trust', e: '🌡️', t: 'Reliable heating & cooling', s: ['AC Repair', 'Furnace Service', 'Maintenance Plans'], r: 'fast, licensed, and reliable' },
  landscaping: { p: 'warm', e: '🌿', t: 'Yards that stand out', s: ['Lawn Care', 'Landscape Design', 'Seasonal Cleanup'], r: 'cared for like it\'s our own yard' },
  painters: { p: 'warm', e: '🎨', t: 'A fresh coat, done right', s: ['Interior Painting', 'Exterior Painting', 'Cabinet Refinishing'], r: 'clean, precise work every time' },
  plumber: { p: 'trust', e: '🔧', t: 'Fast, reliable, licensed', s: ['Emergency Repairs', 'Drain Cleaning', 'Water Heaters'], r: 'fast, licensed, and reliable' },
  electrician: { p: 'trust', e: '⚡', t: 'Wired right, the first time', s: ['Panel Upgrades', 'Wiring', 'Emergency Repairs'], r: 'safe, code-compliant work' },
  lawyer: { p: 'trust', e: '⚖️', t: 'Trusted legal guidance', s: ['Consultations', 'Case Review', 'Representation'], r: 'clear guidance you can trust' },
  cleaning: { p: 'warm', e: '🧹', t: 'A spotless space, every time', s: ['Home Cleaning', 'Deep Cleaning', 'Recurring Service'], r: 'thorough, reliable, and trusted' },
  autorepair: { p: 'trust', e: '🚗', t: 'Honest, expert repair', s: ['Oil Changes', 'Brakes & Tires', 'Diagnostics'], r: 'fair pricing, honest work' },
  hostel: { p: 'bold', e: '🎒', t: 'A great stay, budget-friendly', s: ['Dorm Beds', 'Private Rooms', 'Common Spaces'], r: 'clean, social, and affordable' },
  bedandbreakfast: { p: 'warm', e: '🛏️', t: 'A home away from home', s: ['Cozy Rooms', 'Breakfast Included', 'Local Charm'], r: 'warm hospitality, real breakfast' },
  cabin: { p: 'warm', e: '🌲', t: 'Your getaway in the woods', s: ['Cozy Cabins', 'Scenic Views', 'Peaceful Stays'], r: 'a real escape, close to home' },
  vacationrental: { p: 'trust', e: '🏡', t: 'Your home away from home', s: ['Full Kitchen', 'Private Space', 'Prime Location'], r: 'everything you need for a great stay' },
  hotel: { p: 'trust', e: '🏨', t: 'A comfortable stay, every time', s: ['Comfortable Rooms', 'Prime Location', 'Guest Amenities'], r: 'comfort and convenience, every stay' },
  retail: { p: 'lux', e: '🛍️', t: 'Shop local, shop smart', s: ['New Arrivals', 'Best Sellers', 'Gift Ideas'], r: 'curated with care' },
  default: { p: 'trust', e: '⭐', t: 'Quality you can count on', s: ['Our Services', 'Why Choose Us', 'Get In Touch'], r: 'quality service you can count on' },
};
const PAL = { warm: { primary: '#b45309', accent: '#92400e', ink: '#3f2a1a', bg: '#fffaf3' }, trust: { primary: '#1d4ed8', accent: '#0369a1', ink: '#0f172a', bg: '#f6f9ff' }, lux: { primary: '#9d174d', accent: '#be185d', ink: '#3b0a24', bg: '#fff5f9' }, bold: { primary: '#c026d3', accent: '#9a3412', ink: '#1a1024', bg: '#fbf5ff' } };

// Explicit --type/lead type text always wins (matches the old rt() behavior — keyword-matched, not a
// literal category id); falls back to guessing from real fetched page text if available, else 'default'.
export function chooseIndustry(type, html) {
  if (type) return guessIndustry(type);
  if (html) return guessIndustry(html);
  return 'default';
}

// Real captured colors win when a fetch succeeded; otherwise the industry's fallback palette (or an
// explicit --theme override, which names one of the 4 fallback palette keys directly).
export function chooseColors(display, themeOverride, staticColors) {
  if (staticColors && staticColors.primary) return { primary: staticColors.primary, accent: staticColors.accent, ink: staticColors.text || '#0f172a', bg: staticColors.background || '#ffffff' };
  return PAL[themeOverride || display.p] || PAL.trust;
}

// Real nav-derived service labels (from the business's own site) win over the generic per-industry list —
// filtered to drop utility nav items (Home/Contact/etc.) that aren't real service names.
// Matched as substrings so "Our Services"/"Contact Us" variants are caught, not just exact matches.
const NAV_SKIP_WORDS = ['home', 'contact', 'about', 'service', 'menu', 'blog', 'gallery', 'faq', 'review', 'book', 'career', 'pay invoice', 'more'];
// A phone number rendered as clickable nav text is a real, observed false positive (see demo-gen.test.mjs).
const looksLikePhoneOrJunk = l => /^[\d\s()+.\-]{6,}$/.test(l) || l.length < 3;
export function chooseServices(display, explicitServices, navLinks) {
  if (explicitServices && explicitServices.length) return explicitServices.slice(0, 3);
  const real = (navLinks || []).map(l => l.label).filter(l => l && !looksLikePhoneOrJunk(l) && !NAV_SKIP_WORDS.some(w => l.toLowerCase().includes(w)));
  if (real.length >= 2) return real.slice(0, 3);
  return display.s;
}

const slug = s => String(s || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderDemoHtml(b, industry, display, c, services) {
  const name = esc(b.name || 'Your Business'), tag = esc(b.tagline || display.t), city = esc(b.city || '');
  const phone = esc(b.phone || ''), email = esc(b.email || ''), addr = esc(b.address || '');
  const tel = b.phone ? 'tel:' + String(b.phone).replace(/[^0-9+]/g, '') : '#contact';
  const mq = encodeURIComponent(b.address || b.name || ''), yr = new Date().getFullYear();
  const cards = services.map((s, i) => `<article class="card"><div class="ic">${['①', '②', '③'][i] || '•'}</div><h3>${esc(s)}</h3><p>${esc(s)} — ${esc(display.r)}.</p></article>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${name} — ${tag}${city ? ' in ' + city : ''}."><title>${name} — ${tag}</title>
<style>:root{--primary:${c.primary};--accent:${c.accent};--ink:${c.ink};--bg:${c.bg}}*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,sans-serif;color:var(--ink);background:var(--bg)}a{color:var(--primary)}.wrap{max-width:1040px;margin:0 auto;padding:0 20px}header{position:sticky;top:0;background:#fffffff2;border-bottom:1px solid #0000000f;z-index:10}.nav{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;max-width:1040px;margin:0 auto}.brand{font-weight:800;color:var(--primary);text-decoration:none}.nav a.link{margin-left:18px;text-decoration:none;color:var(--ink);font-weight:600}.btn{display:inline-block;background:var(--accent);color:#fff;padding:.8rem 1.4rem;border-radius:.6rem;text-decoration:none;font-weight:700}.btn.primary{background:var(--primary)}.hero{padding:5.5rem 0 4rem;text-align:center}.hero h1{font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0;color:var(--primary)}.hero .tag{font-size:1.2rem;opacity:.85;margin-bottom:1.6rem}.cta-row{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap}section{padding:3.2rem 0}h2{font-size:1.8rem;color:var(--primary);text-align:center;margin-bottom:1.4rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}.card{background:#fff;border:1px solid #0000000d;border-radius:.9rem;padding:1.4rem}.ic{width:40px;height:40px;border-radius:.6rem;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:800;margin-bottom:.6rem}.about{max-width:720px;margin:0 auto;text-align:center;opacity:.9}.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}.box{background:#fff;border:1px solid #0000000d;border-radius:.8rem;padding:1.1rem;text-align:center}.box b{display:block;color:var(--primary)}footer{padding:2.4rem 0;text-align:center;opacity:.75;border-top:1px solid #0000000f}.demo-badge{position:fixed;bottom:14px;right:14px;background:var(--ink);color:#fff;padding:.55rem .9rem;border-radius:2rem;font-size:.8rem;font-weight:700;z-index:20}@media(max-width:560px){.nav a.link{display:none}}</style></head>
<body><header><nav class="nav"><a class="brand" href="#top">${display.e} ${name}</a><div><a class="link" href="#services">Services</a><a class="link" href="#about">About</a><a class="link" href="#contact">Contact</a><a class="btn primary" href="${tel}">Call Now</a></div></nav></header>
<main id="top">
<section class="hero"><div class="wrap"><div style="font-size:3rem">${display.e}</div><h1>${name}</h1><p class="tag">${tag}${city ? ' · ' + city : ''}</p><div class="cta-row"><a class="btn primary" href="${tel}">${phone ? '📞 ' + phone : 'Get in Touch'}</a><a class="btn" href="#services">See What We Offer</a></div></div></section>
<section id="services"><div class="wrap"><h2>What We Offer</h2><div class="grid">${cards}</div></div></section>
<section id="about" style="background:#fff"><div class="wrap"><h2>About ${name}</h2><p class="about">A starter site showing how ${name} could look — fast, mobile-friendly, secure.</p></div></section>
<section id="contact"><div class="wrap"><h2>Get In Touch</h2><div class="info">${phone ? `<div class="box"><b>Call</b><a href="${tel}">${phone}</a></div>` : ''}${email ? `<div class="box"><b>Email</b><a href="mailto:${email}">${email}</a></div>` : ''}${addr ? `<div class="box"><b>Visit</b><a href="https://maps.google.com/?q=${mq}" target="_blank" rel="noopener">${addr}</a></div>` : ''}<div class="box"><b>Hours</b>Mon–Sat</div></div></div></section>
</main>
<footer><div class="wrap">© ${yr} ${name}.</div></footer>
<div class="demo-badge">✨ Free demo — built for you</div>
</body></html>`;
}

async function fetchRealData(url) {
  try {
    const { html, base } = await loadStatic(url, { timeoutMs: 7000 });
    const css = await extractCss(html, base);
    const style = css + '\n' + html;
    return { html, colors: extractColors(style), fonts: extractFonts(style), nav: extractNav(html, base) };
  } catch { return null; }
}

async function build(i) {
  const s = slug(i.slug || i.name);
  const d = resolve(OUT, s);
  mkdirSync(d, { recursive: true });
  const url = i.url || i.website || null;
  const real = url ? await fetchRealData(url) : null;
  const industry = chooseIndustry(opt('type') || i.type || i.primaryType, real?.html);
  const display = DISPLAY[industry] || DISPLAY.default;
  const colors = chooseColors(display, opt('theme') || i.theme, real?.colors);
  const services = chooseServices(display, i.services, real?.nav);
  const b = { name: i.name, tagline: i.tagline, city: i.city, phone: i.phone, email: i.email, address: i.address };
  writeFileSync(resolve(d, 'index.html'), renderDemoHtml(b, industry, display, colors, services), 'utf8');
  const f = i.name ? String(i.name).split(/\s|'/)[0] : 'there';
  writeFileSync(resolve(d, 'README.md'), `# Demo: ${i.name}\n- File: demos/${s}/index.html\n${url ? `- Real data fetched: ${real ? 'yes' : 'no (fetch failed — used generic fallback)'}\n` : ''}\n## Outreach\n"Hi ${f} — I built you a free starter site. Want the link?"\n`, 'utf8');
  return { slug: s, dir: d, name: i.name };
}

// isMain guard — lets the pure functions above be imported for unit testing (demo-gen.test.mjs) without
// also running the CLI. Compares real resolved paths, not raw strings (see build.mjs for why that matters).
const isMain = (() => { try { return fileURLToPath(import.meta.url) === resolve(process.argv[1]); } catch { return false; } })();
if (isMain) (async function () {
  const from = opt('from'), res = [];
  if (from) {
    if (!existsSync(from)) { console.error('--from not found'); process.exit(1); }
    let data;
    try { data = JSON.parse(readFileSync(from, 'utf8')); } catch { console.error('bad JSON'); process.exit(1); }
    const leads = (Array.isArray(data) ? data : data.leads || []).slice().sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0)).slice(0, MAX);
    for (const l of leads) res.push(await build(l));
  } else {
    const name = opt('name');
    if (!name) { console.error('Usage: demo.mjs --name "Biz" --type plumber [--url <site>] [...] | --from leads.json'); process.exit(1); }
    res.push(await build({ name, type: opt('type'), url: opt('url'), city: opt('city'), phone: opt('phone'), email: opt('email'), address: opt('address'), slug: opt('slug') }));
  }
  console.log(`\n✨ Built ${res.length} demo(s):`);
  res.forEach(r => console.log(`   • ${r.name} → ${r.dir}/index.html`));
  console.log('\nEnhance with /add-feature. For a real prospect, consider the higher-quality /demo-site skill instead.\n');
})();
