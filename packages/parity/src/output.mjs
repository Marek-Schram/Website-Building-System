// Shared parity/<slug>/{baseline.json, brand.seed.json, baseline.md} writer — same output shape for
// both capture.mjs (fast/regex) and capture-browser.mjs (real rendered/Playwright) so every downstream
// consumer (/match-site, /new-client, /demo-site, Command Center's capture route, parity-check.mjs) reads
// one consistent schema regardless of which capture path produced it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `data` shape: { target, slug, name, desc, colors:{primary,accent,background,text,all}, fonts, logo,
//   title, pages, headings:{h1,h2}, features, providers, contact:{phone,email,address}, capturedAt,
//   extra? (optional additional baseline.json fields — e.g. bodyCopy/photos from capture-browser.mjs) }
export function writeParityOutput(dir, data) {
  const { target, slug, name, desc, colors: c, fonts: ft, logo, title, pages, headings, features, providers, contact: ct, capturedAt, extra = {} } = data;

  const baseline = {
    source: target, capturedAt, slug,
    business: { name, description: desc },
    style: { colors: { primary: c.primary, accent: c.accent, background: c.background, text: c.text }, palette: c.all, fonts: ft, logo },
    structure: { title, pages, headings },
    functionality: { features, providers },
    contact: ct,
    ...extra,
  };

  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'baseline.json'), JSON.stringify(baseline, null, 2));

  const seed = {
    businessName: name, tagline: (desc || '').slice(0, 80),
    // logo: a real downloaded path (capture-browser.mjs) wins; capture.mjs's fast path never downloads a
    // logo file at all, so 'assets/logo.svg' there is a placeholder convention telling a human where to
    // put one — it used to be hardcoded unconditionally, silently discarding a real captured path when one
    // existed (found during Phase 4 validation testing, 2026-08-18).
    brand: { colors: { primary: c.primary, secondary: c.text, accent: c.accent }, font: { heading: ft[0] || 'Inter', body: ft[1] || ft[0] || 'Inter' }, logo: logo || 'assets/logo.svg' },
    contact: { phone: ct.phone || '', email: ct.email || '', address: ct.address || '', hours: 'Mon-Fri 9-5' },
    features: { contactForm: features.includes('contact-form'), booking: features.includes('booking'), payments: features.includes('payments'), store: features.includes('store') },
    addons: features,
  };
  writeFileSync(resolve(dir, 'brand.seed.json'), JSON.stringify(seed, null, 2));

  const md = `# Parity Brief — ${name}
_Captured from ${target} on ${new Date(capturedAt).toLocaleString()}_

## Goal
Rebuild cheaper, keep the visual style, preserve ALL functionality, improve quality.

## Visual style
- Primary ${c.primary} · Accent ${c.accent} · BG ${c.background} · Text ${c.text}
- Fonts: ${ft.join(', ') || '—'} · Logo: ${logo || '(ask client)'}

## Functionality to preserve
${features.length ? features.map(f => `- **${f}**${providers[f] ? ` (was: ${providers[f]})` : ''}`).join('\n') : '- (none detected)'}
${ct.phone ? `- Phone: ${ct.phone}` : ''}${ct.email ? `\n- Email: ${ct.email}` : ''}

## Pages
${pages.length ? pages.map(p => `- ${p.label} (${p.href})`).join('\n') : '- (none)'}

## Use
1. /new-client with brand.seed.json (matches the look). 2. /add-feature each item. 3. build → parity-check.
`;
  writeFileSync(resolve(dir, 'baseline.md'), md);

  return baseline;
}
