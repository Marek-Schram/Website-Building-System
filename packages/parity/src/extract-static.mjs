// Pure, fetch-based (no browser rendering) style/contact/nav extraction — the fast path used by
// capture.mjs (post-sale /match-site) and packages/demo-gen (batch demo generation). Fast and
// dependency-light, but regex-based against raw server HTML: it CANNOT see anything rendered by
// client-side JS (React/Vue SPAs, Wix/Squarespace/Webflow editor widgets). Confirmed on a real Wix site
// (parity/repair-it-roofing/baseline.json): garbled phone/email (grabbed a Wix analytics ID and a Sentry
// tracking-pixel address instead of the real contact info) and a missed logo. For a reliable capture
// against a JS-heavy site, use capture-browser.mjs instead, which renders the page for real.
import { readFileSync, existsSync } from 'node:fs';

export async function loadStatic(t, { timeoutMs = 20000 } = {}) {
  if (/^https?:\/\//i.test(t)) {
    const res = await fetch(t, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'SiteWright/1.0' } });
    return { html: await res.text(), base: new URL(t) };
  }
  if (!existsSync(t)) throw new Error('Not found: ' + t);
  return { html: readFileSync(t, 'utf8'), base: null };
}

export async function extractCss(html, base) {
  if (!base) return '';
  const hrefs = [...html.matchAll(/<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi)]
    .map(m => (m[0].match(/href\s*=\s*["']([^"']+)["']/i) || [])[1]).filter(Boolean).slice(0, 4);
  let c = '';
  for (const h of hrefs) {
    try { const res = await fetch(new URL(h, base).href, { signal: AbortSignal.timeout(10000) }); if (res.ok) c += '\n' + (await res.text()).slice(0, 200000); } catch {}
  }
  return c;
}

export function extractColors(t) {
  const hx = {};
  for (const m of t.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
    h = '#' + h.toLowerCase(); hx[h] = (hx[h] || 0) + 1;
  }
  const r = Object.entries(hx).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const neut = h => h === '#ffffff' || h === '#000000', viv = r.filter(h => !neut(h));
  return { all: r.slice(0, 12), primary: viv[0] || r[0] || '#1d4ed8', accent: viv[1] || viv[0] || '#f59e0b', background: r.find(h => /^#(f|e)/.test(h)) || '#ffffff', text: r.find(h => /^#(0|1|2|3)/.test(h)) || '#0f172a' };
}

export function extractFonts(t) {
  const f = new Set();
  for (const m of t.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) { const x = m[1].split(',')[0].replace(/["']/g, '').trim(); if (x && !/^(inherit|initial|var\()/i.test(x)) f.add(x); }
  for (const m of t.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)) f.add(decodeURIComponent(m[1]).split(':')[0].replace(/\+/g, ' '));
  return [...f].slice(0, 6);
}

const strip = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function extractContact(html) {
  const t = strip(html);
  return {
    phone: (t.match(/(\+?\d[\d\s().-]{7,}\d)/) || [])[0] || (html.match(/tel:([+\d]+)/i) || [])[1] || null,
    email: (html.match(/mailto:([^"'>\s]+)/i) || [])[1] || (t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || null,
    address: (t.match(/\d{1,5}\s+[A-Za-z0-9.\s]{3,40}(?:St|Street|Ave|Avenue|Blvd|Rd|Road|Dr|Drive|Ln|Way|Ct)\b[^,]*,?\s*[A-Za-z\s]*,?\s*[A-Z]{2}\s*\d{5}?/) || [])[0] || null,
  };
}

export function extractNav(html, base) {
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const internal = [];
  for (const m of links) {
    const href = m[1], label = strip(m[2]);
    if (!label || label.length > 30) continue;
    if (/^(https?:)?\/\//i.test(href)) { if (base && href.includes(base.host)) internal.push({ href, label }); }
    else internal.push({ href, label });
  }
  const seen = new Set();
  return internal.filter(l => { const k = l.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 15);
}

export function extractLogo(html) {
  return (html.match(/<img[^>]+src\s*=\s*["']([^"']*logo[^"']*)["']/i) || [])[1] || null;
}

// Provider sniffing for features detectFeatures() already flagged (parity-specific, not shared elsewhere).
export function detectProviders(html, features) {
  const h = html.toLowerCase();
  const dp = m => { for (const [k, v] of Object.entries(m)) if (h.includes(k)) return v; return null; };
  const providers = {};
  if (features.has('online-ordering')) providers['online-ordering'] = dp({ toasttab: 'Toast', chownow: 'ChowNow', gloriafood: 'GloriaFood', squareup: 'Square' });
  if (features.has('reservations')) providers.reservations = dp({ opentable: 'OpenTable', resy: 'Resy', exploretock: 'Tock' });
  if (features.has('booking')) providers.booking = dp({ calendly: 'Calendly', simplybook: 'SimplyBook.me', acuity: 'Acuity' });
  return providers;
}
