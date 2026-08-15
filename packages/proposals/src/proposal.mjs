#!/usr/bin/env node
/**
 * Pixelreach Digital — Booking Listing Proposal Generator
 * ------------------------------------------------------------------
 * Produces a branded, print-ready proposal.html for a lodging property
 * so you can win the "get you listed where guests search" deal.
 *
 * Branding (name, colors, contact, tiers) comes ENTIRELY from a theme
 * file — default packages/proposals/themes/pixelreach.json. To rebrand,
 * edit that one file (or pass --theme <file>).
 *
 * Usage:
 *   node packages/proposals/src/proposal.mjs "<Property Name>" \
 *       [--city "Pigeon Forge"] [--contact "Jane"] [--platforms airbnb,vrbo] \
 *       [--booking-system "TravelClick"] [--tier standard] [--theme pixelreach] \
 *       [--package-json <file>] [--property-type cabin]
 *
 * Output → proposals/out/<slug>/{proposal.html, proposal.json, outreach-email.txt}
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const property = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
if (!property) { console.error('Usage: proposal.mjs "<Property Name>" [--city --contact --platforms --booking-system --tier --theme --property-type]'); process.exit(1); }

const themeName = opt('theme', 'pixelreach');
const theme = JSON.parse(readFileSync(resolve(ROOT, 'packages/proposals/themes', themeName + '.json'), 'utf8'));
const brand = theme.brand, C = theme.colors;
let tiers = theme.tiers;
if (opt('package-json')) tiers = JSON.parse(readFileSync(resolve(ROOT, opt('package-json')), 'utf8'));

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

const city = opt('city', '');
const contact = opt('contact', '');
const platformsRaw = (opt('platforms', 'airbnb,vrbo') || '').split(',').map(s => s.trim()).filter(Boolean);
const PLATFORM_LABEL = { airbnb: 'Airbnb', vrbo: 'Vrbo', 'booking.com': 'Booking.com', expedia: 'Expedia', 'hotels.com': 'Hotels.com' };
const platforms = platformsRaw.map(p => PLATFORM_LABEL[p] || p);
const bookingSystem = opt('booking-system', '');
const tierId = opt('tier', 'standard');
const tier = tiers.find(t => t.id === tierId) || tiers.find(t => t.featured) || tiers[0];
const propertyType = opt('property-type', 'property');

const tierCards = tiers.map(t => `
    <div class="tier${t.featured ? ' featured' : ''}">
      <div class="tname">${esc(t.name)}</div>
      <div class="tprice">$${t.price}</div>
      <div class="tplats">${t.platforms} booking platform${t.platforms > 1 ? 's' : ''}</div>
      <ul>${t.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="tpick">${t.featured ? '← most popular' : '&nbsp;'}</div>
    </div>`).join('');

const systemLine = bookingSystem
  ? `You're already running <b>${esc(bookingSystem)}</b> to manage bookings. We hook into that — the new listings on ${platforms.join(' and ')} push into the same calendar, so no double-bookings and nothing extra for you to learn.`
  : `If you already manage bookings through a system or a calendar, we connect the new listings to it. No double-bookings, no re-typing — the reservations land in one place.`;

const props = {
  property, city, contact, platforms, bookingSystem, tier, propertyType,
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Proposal to get ${esc(property)} listed on ${esc(platforms.join(' + '))}${city ? ` in ${esc(city)}` : ''} — packages from $${tier.price}.">
<title>Proposal — ${esc(property)} | ${esc(brand.name)}</title>
<style>
  :root{--brand:${C.primary};--brand-dark:${C.primaryDark};--accent:${C.accent};--bg:${C.bg};--ink:${C.ink};--muted:${C.muted};--light:${C.lightBg};--border:${C.border}}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#eef2f7}
  .page{max-width:820px;margin:24px auto;background:var(--bg);box-shadow:0 8px 40px #0000001a;border-radius:14px;overflow:hidden}
  .cover{background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;padding:2.6rem 2.4rem}
  .cover .logo{font-weight:800;letter-spacing:.05em;font-size:1.1rem;opacity:.95}
  .cover h1{margin:.4rem 0 .2rem;font-size:2rem;line-height:1.15}
  .cover .sub{opacity:.92}
  .cover .meta{margin-top:1rem;font-size:.85rem;opacity:.85}
  section{padding:1.8rem 2.4rem;border-top:1px solid #0000000d}
  h2{color:var(--brand);font-size:1.3rem;margin:0 0 .6rem}
  p{margin:.4rem 0}
  .tiers{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}
  .tier{flex:1;min-width:220px;border:1px solid var(--border);border-radius:10px;padding:1.1rem;background:#fff}
  .tier.featured{border:2px solid var(--brand);background:var(--light)}
  .tname{font-weight:800;color:var(--brand-dark)}
  .tprice{font-size:2rem;font-weight:800;color:var(--brand);margin:.1rem 0}
  .tplats{font-size:.85rem;color:var(--muted);margin-bottom:.5rem}
  .tier ul{margin:.3rem 0 0;padding-left:1.1rem}
  .tier li{margin:.2rem 0;font-size:.92rem}
  .tpick{font-size:.8rem;color:var(--brand);font-weight:700;margin-top:.6rem}
  .next ol{margin:.4rem 0 0 1.2rem}
  .next li{margin:.3rem 0}
  .accept{background:var(--light);border:1px solid var(--border);border-radius:10px;padding:1.3rem 1.4rem;margin-top:1rem}
  .accept .line{margin:.5rem 0;font-size:1rem}
  .sign{display:flex;gap:2rem;margin-top:1.4rem;font-size:.85rem;color:var(--muted)}
  .sign .box{flex:1;border-top:1px solid var(--muted);padding-top:.3rem}
  .foot{padding:1.2rem 2.4rem;color:var(--muted);font-size:.8rem;text-align:center}
  .foot a{color:var(--brand)}
  @media print{body{background:#fff}.page{box-shadow:none;margin:0;border-radius:0}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <div class="logo">${esc(brand.name)}</div>
    <h1>Proposal — ${esc(property)}</h1>
    <div class="sub">Get your ${esc(propertyType)} listed where guests already search${city ? ` — ${esc(city)}` : ''}.</div>
    <div class="meta">Prepared ${today}${contact ? ` · for ${esc(contact)}` : ''} · from ${esc(brand.name)}</div>
  </div>

  <section>
    <h2>The opportunity</h2>
    <p>Most travelers start on <b>${platforms.join('</b>, <b>')}</b>. Right now guests who'd love your place
    can't find you there — they find your competition instead. We create your listing on the platforms that
    matter, connect it to your calendar, and get you live fast. You only pay when it's live and verified.</p>
  </section>

  <section>
    <h2>Packages</h2>
    <div class="tiers">${tierCards}</div>
    <p style="margin-top:.8rem;font-size:.88rem;color:var(--muted)">Add a platform? Each extra platform is
    $50. Prefer <b>${esc(tier.name)} — $${tier.price}</b>? Just say the word.</p>
  </section>

  <section>
    <h2>Works with your current setup</h2>
    <p>${systemLine}</p>
  </section>

  <section>
    <h2>What you need to do</h2>
    <p>A 5-minute checklist: your photos, room details, amenities and house rules. We send it, you fill it
    in — that's it. We handle creation, calendar setup, and verification.</p>
  </section>

  <section class="next">
    <h2>Next steps</h2>
    <ol>${theme.nextSteps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="accept">
      <div class="line"><b>I accept</b> the <b>${esc(tier.name)}</b> package — <b>$${tier.price}</b> for
      listing on <b>${platforms.join('</b> + <b>')}</b>${city ? ` (${esc(city)})` : ''}.</div>
      <div class="line">Reply “I accept” to this email to get started. No deposit — you pay after we verify
      your listings are live.</div>
      <div class="sign">
        <div class="box">Owner / manager signature</div>
        <div class="box">${esc(brand.name)} — ${esc(brand.website)}</div>
      </div>
    </div>
    ${theme.upsell.enabled ? `<p style="margin-top:1rem;font-size:.88rem;color:var(--muted)">${esc(theme.upsell.blurb)}</p>` : ''}
  </section>

  <div class="foot">
    ${esc(brand.name)} · <a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a>
    ${brand.phone ? ` · <a href="tel:${esc(brand.phone)}">${esc(brand.phone)}</a>` : ''}
  </div>
</div>
</body>
</html>`;

const slug = slugify(property);
const outDir = resolve(ROOT, 'proposals/out', slug);
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'proposal.html'), html);
writeFileSync(resolve(outDir, 'proposal.json'), JSON.stringify({ generatedAt: new Date().toISOString(), brand, ...props }, null, 2));

const first = String(contact || property).split(/\s|'/)[0];
writeFileSync(resolve(outDir, 'outreach-email.txt'),
`Subject: Proposal — get ${property} listed on ${platforms.join(' & ')}

Hi ${first},

Guests looking for a place like yours in ${city || 'your area'} start on ${platforms.join(' and ')} —
but right now they can't find you there.

I put together a proposal (attached — open proposal.html): we create your listing on
${platforms.join(' + ')}${bookingSystem ? `, connected to the ${bookingSystem} system you already use` : ''},
for $${tier.price} (the ${tier.name} package). You pay only once your listings are live and verified.

Want me to get started? Reply "I accept" and I'll send the 5-minute checklist.

Best,
${brand.name} · ${brand.email} · ${brand.phone}
`);
console.log(`\n✅ Proposal for "${property}" → proposals/out/${slug}/`);
console.log(`   • proposal.html      (open in browser → File ▸ Print ▸ Save as PDF to email)`);
console.log(`   • proposal.json      (data)`);
console.log(`   • outreach-email.txt (ready-to-send message)`);
console.log(`\n   ${esc(tier.name)} · $${tier.price} · platforms: ${platforms.join(', ')}${bookingSystem ? ` · hooks into ${bookingSystem}` : ''}`);
