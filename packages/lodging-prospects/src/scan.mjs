// Shared network-dependent scan helpers for the lodging pipeline (fetch-based, not unit-tested —
// same convention as opportunities.mjs's inline pageSpeed/checkHeaders). Pure logic lives in
// packages/testing/unit/booking.mjs instead. Used by find-booking-leads.mjs and lodging-opportunities.mjs.
import { domMatch, detectSystems, hasBookingLink } from '../../testing/unit/booking.mjs';

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

// Keyless web search → array of result URLs (first ~12). Tries DuckDuckGo, falls back to Bing.
async function ddg(q) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const html = await res.text();
  const urls = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) { let u = m[1].replace('&amp;', '&'); try { u = decodeURIComponent(u.split('uddg=')[1]?.split('&rut=')[0] ?? u); } catch {} urls.push(u); }
  return urls.slice(0, 12);
}
async function bing(q) {
  const res = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&count=12', { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const html = await res.text();
  if (!html.includes('b_algo')) return null;
  const urls = [...html.matchAll(/https?:\/\/(?!r\.bing|th\.bing|www\.bing|www\.w3\.org|schemas\.live\.com)[a-z0-9.-]+\.[a-z]{2,}[^"< )]*/g)].map(x => x[0]).filter(u => !u.includes('bing.com') && !u.includes('w3.org') && !u.includes('schemas.live.com'));
  return [...new Set(urls)].slice(0, 12);
}
export async function searchWeb(q) { const d = await ddg(q); if (d && d.length) return d; const b = await bing(q); return b && b.length ? b : []; }

// Check one property against one platform. Returns {found, evidence}.
export async function checkPresence(name, platform, placeName) {
  const q = `"${name}" ${platform.label} ${placeName || ''}`.trim();
  const urls = await searchWeb(q);
  const hit = urls.find(u => domMatch(host(u), platform.domains));
  return { platform: platform.id, label: platform.label, found: !!hit, evidence: hit || '' };
}

// Scan a property's own website for booking links + booking systems.
export async function scanOwnSite(url, platforms) {
  const r = { site: url, hasBookingLink: false, systems: [], evidence: [] };
  if (!url) return r;
  let html = ''; try { const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' }); if (res.ok) html = await res.text(); } catch { return r; }
  r.hasBookingLink = hasBookingLink(html);
  for (const n of detectSystems(html)) { r.systems.push(n); r.evidence.push(n + ' referenced on site'); }
  for (const p of platforms) { const re = new RegExp(p.domains.map(d => d.replace('.', '\\.')).join('|')); if (re.test(html)) { r.systems.push(p.label + ' link'); r.evidence.push('Links to ' + p.label); r.hasBookingLink = true; } }
  r.systems = [...new Set(r.systems)]; r.evidence = [...new Set(r.evidence)].slice(0, 6);
  return r;
}
