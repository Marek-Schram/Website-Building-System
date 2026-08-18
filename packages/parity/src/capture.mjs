#!/usr/bin/env node
// Site Capture (fast/regex path). Usage: capture.mjs <url-or-html> [--slug X] [--json]
//   → parity/<slug>/{baseline.json,baseline.md,brand.seed.json}
// For a JS-heavy/platform-builder site (Wix/Squarespace/Webflow/React SPA), prefer capture-browser.mjs
// instead — this fast path only sees raw server HTML and can miss/garble contact info and logos rendered
// by client-side JS (see packages/parity/src/extract-static.mjs's header comment for a documented example).
import { resolve } from 'node:path';
import { loadStatic, extractCss, extractColors, extractFonts, extractContact, extractNav, extractLogo, detectProviders } from './extract-static.mjs';
import { detectFeatures } from '../../opportunities/src/classify.mjs';
import { writeParityOutput } from './output.mjs';

const args = process.argv.slice(2), target = args.find(a => !a.startsWith('--')), asJson = args.includes('--json');
const slugOpt = (i => i >= 0 ? args[i + 1] : null)(args.indexOf('--slug'));
if (!target) { console.error('Usage: capture.mjs <url-or-html> [--slug X] [--json]'); process.exit(1); }

const slugify = s => String(s || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const strip = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const btw = (h, t) => { const m = h.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : null; };
const allB = (h, t) => [...h.matchAll(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'gi'))].map(m => strip(m[1])).filter(Boolean);
const meta = (h, n) => { const m = h.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${n}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i')); return m ? m[1] : null; };

(async () => {
  const { html, base } = await loadStatic(target);
  const cssText = await extractCss(html, base);
  const style = cssText + '\n' + html;
  const c = extractColors(style), ft = extractFonts(style);
  const title = strip(btw(html, 'title')) || '';
  const name = meta(html, 'og:site_name') || allB(html, 'h1')[0] || title.split(/[|\-–—]/)[0].trim() || 'Business';
  const desc = meta(html, 'description') || meta(html, 'og:description') || '';
  const logo = extractLogo(html);
  const featureSet = detectFeatures(html);
  const features = [...featureSet];
  const providers = detectProviders(html, featureSet);
  const ct = extractContact(html);
  const pages = extractNav(html, base);

  const slug = slugify(slugOpt || name);
  const dir = resolve(process.cwd(), 'parity', slug);
  const baseline = writeParityOutput(dir, {
    target, slug, name, desc, colors: c, fonts: ft, logo, title, pages,
    headings: { h1: allB(html, 'h1').slice(0, 5), h2: allB(html, 'h2').slice(0, 12) },
    features, providers, contact: ct, capturedAt: new Date().toISOString(),
  });

  if (asJson) { console.log(JSON.stringify(baseline, null, 2)); return; }
  console.log(`\n📸 Captured "${name}" → parity/${slug}/`);
  console.log(`   Style: primary ${c.primary} · accent ${c.accent} · fonts ${ft.slice(0, 2).join(', ') || '—'}`);
  console.log(`   Preserve: ${features.join(', ') || '(none)'}`);
  console.log(`   Files: baseline.json · baseline.md · brand.seed.json\n   Next: /new-client (use brand.seed.json) → /add-feature each → build → parity-check ${slug} <new>\n`);
})().catch(e => { console.error('Capture failed:', e.message); process.exit(1); });
