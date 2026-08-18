// Shared network-dependent scan helpers for the lodging pipeline (fetch-based, not unit-tested —
// same convention as opportunities.mjs's inline pageSpeed/checkHeaders). Pure logic lives in
// packages/testing/unit/booking.mjs instead. Used by find-booking-leads.mjs and lodging-opportunities.mjs.
import { domMatch, detectSystems, hasBookingLink } from '../../testing/unit/booking.mjs';

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

// A plain AbortSignal.timeout() isn't reliable against a connection that's blackholed at the raw TCP level
// (no RST, no response at all — seen against html.duckduckgo.com from WSL): the OS connect() can outlive the
// signal, so a single stuck request can hang the whole scan far past the intended timeout. Race the fetch
// against our own timer instead, so this function always settles on time regardless of what the socket does.
function fetchTimed(url, opts, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const hardTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout (blocked/unreachable)')), ms + 1000));
  return Promise.race([fetch(url, { ...opts, signal: controller.signal }), hardTimeout]).finally(() => clearTimeout(timer));
}

// Keyless web search → array of result URLs (first ~12). Tries DuckDuckGo, falls back to Bing.
async function ddg(q) {
  // Shorter timeout than bing()/scanOwnSite() — when DDG is blocking/down (not uncommon for this kind of
  // scraping) it doesn't respond at all, so waiting the full 15s per query before falling back to Bing would
  // needlessly multiply the cost of a whole city scan. A real, working DDG response normally lands in <2s.
  const res = await fetchTimed('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } }, 6000);
  if (!res.ok) return null;
  const html = await res.text();
  const urls = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) { let u = m[1].replace('&amp;', '&'); try { u = decodeURIComponent(u.split('uddg=')[1]?.split('&rut=')[0] ?? u); } catch {} urls.push(u); }
  return urls.slice(0, 12);
}
async function bing(q) {
  const res = await fetchTimed('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&count=12', { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' } }, 15000);
  if (!res.ok) return null;
  const html = await res.text();
  if (!html.includes('b_algo')) return null;
  const urls = [...html.matchAll(/https?:\/\/(?!r\.bing|th\.bing|www\.bing|www\.w3\.org|schemas\.live\.com)[a-z0-9.-]+\.[a-z]{2,}[^"< )]*/g)].map(x => x[0]).filter(u => !u.includes('bing.com') && !u.includes('w3.org') && !u.includes('schemas.live.com'));
  return [...new Set(urls)].slice(0, 12);
}
// Each provider can fail two ways: a bad HTTP status (handled inside ddg/bing, returns null) or fetch()
// throwing outright (DNS/network failure — common for one provider while the other is fine). Catch both
// here so one provider being down falls through to the other instead of crashing the whole scan.
async function safe(fn, q) { try { return await fn(q); } catch { return null; } }
export async function searchWeb(q) { const d = await safe(ddg, q); if (d && d.length) return d; const b = await safe(bing, q); return b && b.length ? b : []; }

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
  let html = ''; try { const res = await fetchTimed(url, { redirect: 'follow' }, 15000); if (res.ok) html = await res.text(); } catch { return r; }
  r.hasBookingLink = hasBookingLink(html);
  for (const n of detectSystems(html)) { r.systems.push(n); r.evidence.push(n + ' referenced on site'); }
  for (const p of platforms) { const re = new RegExp(p.domains.map(d => d.replace('.', '\\.')).join('|')); if (re.test(html)) { r.systems.push(p.label + ' link'); r.evidence.push('Links to ' + p.label); r.hasBookingLink = true; } }
  r.systems = [...new Set(r.systems)]; r.evidence = [...new Set(r.evidence)].slice(0, 6);
  return r;
}
