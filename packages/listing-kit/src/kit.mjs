#!/usr/bin/env node
/**
 * Pixelreach Digital — Listing Kit
 * ------------------------------------------------------------------
 * The client-facing packet we hand the owner after they say "I accept":
 *   1. materials-checklist.md  — the 5-minute questionnaire (fill in → send back)
 *   2. request-email.txt       — ready-to-send email that introduces the kit
 *   3. listing-copy.md         — drafted SEO title/description/amenities/rules
 *   4. setup-guide.md          — per-platform setup steps + calendar sync notes
 *   5. tracking.md             — list of platforms, URLs, status (created → verified)
 *
 * Usage:
 *   node packages/listing-kit/src/kit.mjs "<Property Name>" \
 *       [--city "Pigeon Forge"] [--platforms airbnb,vrbo,booking.com] \
 *       [--booking-system "TravelClick"] [--theme pixelreach]
 * Output → listing-kit/out/<slug>/
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const property = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
if (!property) { console.error('Usage: kit.mjs "<Property Name>" [--city --platforms --booking-system --theme]'); process.exit(1); }

const theme = JSON.parse(readFileSync(resolve(ROOT, 'packages/proposals/themes', opt('theme', 'pixelreach') + '.json'), 'utf8'));
const brand = theme.brand;
const questionnaire = JSON.parse(readFileSync(resolve(__dirname, '../data/questionnaire.json'), 'utf8')).questions;
const guides = JSON.parse(readFileSync(resolve(__dirname, '../data/setup-guides.json'), 'utf8'));
const PLATFORM_LABEL = { airbnb: 'Airbnb', vrbo: 'Vrbo', 'booking.com': 'Booking.com', expedia: 'Expedia', 'hotels.com': 'Hotels.com' };
const platforms = (opt('platforms', 'airbnb,vrbo') || '').split(',').map(s => s.trim()).filter(Boolean).map(p => PLATFORM_LABEL[p] || p);
const city = opt('city', '');
const system = opt('booking-system', '');
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = slugify(property);

// --- 1. Materials checklist ---
const checkRows = questionnaire.map((q, i) => `**${i + 1}. ${esc(q.label)}**\n   - ${esc(q.placeholder)}`).join('\n');
const checklist = `# Materials checklist — ${esc(property)}
Sent by ${esc(brand.name)} · just fill this in and reply. Takes ~5 minutes.

## Fill these in
${checkRows}

## How to send
Reply to this email (or paste into the shared doc). Photos: attach or share a Google Photos/Drive link.
That's everything we need — we'll draft your listing copy, create the listing(s), and send you a preview
before anything goes live.
`;

// --- 2. Request email ---
const requestEmail = `Subject: Quick checklist to get ${property} live on ${platforms.join(' & ')}

Hi there,

Thanks for saying yes — let's get you booked! Attached is the materials checklist (it's also pasted below).
Fill in the blanks and reply with the answers (photos can be a Drive link). That's the only thing I need
from you — I'll handle creating the listing(s), the copy, calendar setup, and verification.

Once it's live you'll get the public links. You pay after it's verified — no deposit.

Quick version:
${questionnaire.map((q, i) => `${i + 1}. ${q.label}: ${q.placeholder}`).join('\n')}

Best,
${brand.name} · ${brand.email} · ${brand.phone}
`;

// --- 3. Listing copy template ---
const listingCopy = `# Listing copy — ${esc(property)}${city ? ` (${esc(city)})` : ''}
Draft title / description to polish once materials come back.

## Title
Cozy ${property} near ${city || '[area]'} — hot tub, mountain views, close to town

## Description (draft)
Wake up to ${city ? `${esc(city)}` : '[area]'} in the beautiful [property type] you've been dreaming of.
Sleeps [guests] across [bedrooms] cozy bedrooms with everything you need for a perfect stay — [amenity],
[amenity], and [amenity]. Just [minutes] from [nearby attraction]. Thoughtful touches everywhere, spotless
cleaning, and a host who's a message away.

## Amenities (pick all that apply)
WiFi · Self check-in · Parking · Kitchen · Washer · Dryer · Air conditioning · Heating · Hot tub · Fire pit ·
BBQ grill · Pet friendly · EV charger · Mountain view · Lake view · Fireplace · Smart TV · Workspace

## House rules (draft)
- Quiet hours: 10 PM – 8 AM
- No smoking indoors
- Pets: [allowed / not allowed]
- Parties/events: [not allowed / allowed with approval]
- Check-in: [time] · Check-out: [time]

## Policies
Cancellation: [flexible / moderate / strict] · Min stay: [nights] nights · Cleaning fee: $[amount]
`;

// --- 4. Setup guide ---
const guideLines = platforms.map(p => {
  const g = Object.values(guides.guides).find(x => x.label === p);
  if (!g) return '';
  return `## ${g.label}
${g.signup}
${g.steps.map((s, i) => `${i + 1}. ${esc(s)}`).join('\n')}`;
}).filter(Boolean).join('\n\n');

const systemNote = system
  ? `## Calendar / channel manager note
You already run **${esc(system)}**. The ${esc(system)} channel manager (or its iCal sync) connects to
${platforms.join(', ')} so rates + availability stay in one place — no double-bookings. We'll wire this up
as part of the package: ${esc(guides.channel_managers[String(system).toLowerCase()] || guides.ical.import)}`
  : `## Calendar / iCal note
We'll keep all calendars in sync: ${esc(guides.ical.import)} ${esc(guides.ical.export)}`;

const setupGuide = `# Setup guide — get ${esc(property)} live
${guideLines}

${systemNote}
`;

// --- 5. Tracking sheet ---
const trackRows = platforms.map(p => `| ${esc(p)} | _not created_ | _pending_ | \`\``).join('\n');
const tracking = `# Listing tracking — ${esc(property)}
| Platform | Listing URL | Status (created → verified → live) | Notes |
|---|---|---|---|
${trackRows}

## Verification checklist (do this before asking for payment)
- [ ] Each platform shows a public, searchable listing
- [ ] Photos + copy match the approved draft
- [ ] Calendar is connected (channel manager or iCal) and accepting bookings
- [ ] Base price + minimum stay applied
- [ ] House rules + cancellation policy visible
- [ ] Owner confirmed the host account credentials

## Handoff
Send the owner: public listing URLs + a short "you're live 🎉" note (see docs/PROPOSALS.md).
`;

const outDir = resolve(ROOT, 'listing-kit/out', slug);
mkdirSync(outDir, { recursive: true });
const files = [
  ['materials-checklist.md', checklist],
  ['request-email.txt', requestEmail],
  ['listing-copy.md', listingCopy],
  ['setup-guide.md', setupGuide],
  ['tracking.md', tracking],
];
for (const [name, content] of files) writeFileSync(resolve(outDir, name), content);
writeFileSync(resolve(outDir, 'kit.json'), JSON.stringify({ property, city, platforms, bookingSystem: system, generatedAt: new Date().toISOString(), files: files.map(f => f[0]) }, null, 2));

console.log(`\n✅ Listing kit for "${property}" → listing-kit/out/${slug}/`);
files.forEach(([n]) => console.log('   • ' + n));
console.log(`\n   Platforms: ${platforms.join(', ')}${system ? ` · hooks into ${system}` : ''}`);
