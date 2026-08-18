#!/usr/bin/env node
// Site Capture (real rendered path). Usage: capture-browser.mjs <url> --slug <slug>
//   → parity/<slug>/{baseline.json, brand.seed.json, baseline.md, rendered.html, screenshots/*.png, assets/*}
// Launches a real headless Chromium (via @playwright/test, uses its default browser resolution — respects
// PLAYWRIGHT_BROWSERS_PATH if set, no hardcoded install path), renders the page for real, then extracts
// signals from the live DOM (extract-dom.mjs) instead of raw server HTML — this is what fixes capture.mjs's
// proven blind spot against JS-heavy/platform-builder sites (Wix, Squarespace, Webflow, React SPAs; see
// parity/repair-it-roofing/baseline.json for the documented garbled-data failure this replaces).
//
// Feature detection and nav-link extraction are reused as-is (extract-static.mjs / classify.mjs) run
// against the final rendered HTML (page.content()) rather than a second live fetch — no duplicated logic.
//
// Prerequisite (one-time): `npx playwright install chromium` if it isn't already installed locally.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { extractDomSignals } from './extract-dom.mjs';
import { extractNav, extractContact } from './extract-static.mjs';
import { detectFeatures } from '../../opportunities/src/classify.mjs';
import { writeParityOutput } from './output.mjs';

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const asJson = args.includes('--json');
if (!target || !/^https?:\/\//i.test(target)) { console.error('Usage: capture-browser.mjs <url> --slug <slug> [--json]'); process.exit(1); }

const slugify = s => String(s || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function downloadAsset(url, destPath) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return false;
    writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch { return false; }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(target, { waitUntil: 'load', timeout: 30000 }));
  } catch (e) {
    await browser.close();
    console.error('Could not load ' + target + ': ' + e.message);
    process.exit(1);
  }

  const dom = await page.evaluate(extractDomSignals);
  const renderedHtml = await page.content();
  const baseUrl = new URL(target);

  const slug = slugify(opt('slug') || dom.business.name || baseUrl.hostname);
  const dir = resolve(process.cwd(), 'parity', slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(resolve(dir, 'screenshots'), { recursive: true });
  mkdirSync(resolve(dir, 'assets'), { recursive: true });

  writeFileSync(resolve(dir, 'rendered.html'), renderedHtml);
  await page.screenshot({ path: resolve(dir, 'screenshots', 'desktop-above-fold.png') });
  await page.screenshot({ path: resolve(dir, 'screenshots', 'desktop-full.png'), fullPage: true });
  await browser.close();

  // Download real photos/logo for reuse in the demo (Phase 4) — these are the prospect's own business
  // photos, used only as temporary pitch material shown privately to that same business.
  const downloaded = [];
  for (const p of dom.photos.slice(0, 6)) {
    const ext = (p.src.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
    const filename = `${p.role}-${downloaded.filter(d => d.role === p.role).length + 1}.${ext}`;
    const ok = await downloadAsset(p.src, resolve(dir, 'assets', filename));
    if (ok) downloaded.push({ ...p, savedAs: `assets/${filename}` });
  }
  // Inline-<svg> logo (no fetchable URL at all — common on Wix/Squarespace) — write the markup directly.
  if (!downloaded.some(d => d.role === 'logo') && dom.logoSvgMarkup) {
    writeFileSync(resolve(dir, 'assets', 'logo.svg'), dom.logoSvgMarkup);
    downloaded.push({ role: 'logo', savedAs: 'assets/logo.svg', src: '(inline svg)' });
  }

  const featureSet = detectFeatures(renderedHtml);
  const features = [...featureSet];
  const staticContact = extractContact(renderedHtml);
  // Email: DOM mailto: link (reliable) → a literal mailto: href in the rendered HTML (reliable) → stop.
  // Deliberately does NOT fall back to extractContact()'s loose bare "x@y.z" text-pattern match here —
  // confirmed on this exact site that fallback grabs a Sentry tracking-pixel address (no @ pattern on a
  // rendered page reliably means "the business's email," it just as often means analytics/widget noise).
  const mailtoHref = renderedHtml.match(/href\s*=\s*["']mailto:([^"']+)["']/i);
  const contact = {
    phone: dom.contact.phone || staticContact.phone,
    email: dom.contact.email || (mailtoHref ? decodeURIComponent(mailtoHref[1].split('?')[0]) : null),
    address: staticContact.address,
  };
  const pages = extractNav(renderedHtml, baseUrl);
  const colorsAll = [dom.style.colors.primary, dom.style.colors.accent, dom.style.colors.background, dom.style.colors.text].filter(Boolean);

  const baseline = writeParityOutput(dir, {
    target, slug,
    name: dom.business.name || 'Business', desc: dom.business.description || '',
    colors: { primary: dom.style.colors.primary || '#1d4ed8', accent: dom.style.colors.accent || '#0369a1', background: dom.style.colors.background, text: dom.style.colors.text, all: colorsAll },
    fonts: dom.style.fonts, logo: downloaded.find(d => d.role === 'logo')?.savedAs || null,
    title: dom.business.title, pages,
    headings: { h1: dom.bodyCopy.headings.filter(h => h.level === 'h1').map(h => h.text).slice(0, 5), h2: dom.bodyCopy.headings.filter(h => h.level === 'h2').map(h => h.text).slice(0, 12) },
    features, providers: {}, contact, capturedAt: new Date().toISOString(),
    extra: { bodyCopy: dom.bodyCopy, photos: downloaded, servicesCandidate: dom.servicesCandidate, screenshots: { aboveFold: 'screenshots/desktop-above-fold.png', full: 'screenshots/desktop-full.png' }, renderedHtmlPath: 'rendered.html' },
  });

  if (asJson) { console.log(JSON.stringify(baseline, null, 2)); return; }
  console.log(`\n📸 Captured (rendered) "${baseline.business.name}" → parity/${slug}/`);
  console.log(`   Style: primary ${baseline.style.colors.primary} · accent ${baseline.style.colors.accent} · fonts ${baseline.style.fonts.slice(0, 2).join(', ') || '—'}`);
  console.log(`   Preserve: ${features.join(', ') || '(none)'}`);
  console.log(`   Photos downloaded: ${downloaded.length} (${downloaded.map(d => d.role).join(', ') || 'none'})`);
  console.log(`   Files: baseline.json · baseline.md · brand.seed.json · rendered.html · screenshots/*.png · assets/*`);
  console.log(`\n   Next: Read the screenshots for visual judgment, then continue the /demo-site flow.\n`);
})().catch(e => { console.error('Capture failed:', e.message); process.exit(1); });
