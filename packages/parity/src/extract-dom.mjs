// Runs INSIDE a real browser page via Playwright's page.evaluate(extractDomSignals) — deliberately a
// single, self-contained, zero-import function (browser globals only: document/window/getComputedStyle)
// since it's serialized and executed in the page's own JS context, not Node's.
//
// This is the fix for capture.mjs's proven blind spot: regex-on-raw-server-HTML can't see anything
// rendered by client-side JS (React/Vue SPAs, Wix/Squarespace/Webflow editor widgets). Confirmed on a real
// Wix site (parity/repair-it-roofing/baseline.json): the fast path mistook a Wix analytics ID for the
// phone number and a Sentry tracking-pixel address for the business email, and missed the logo entirely
// (rendered via CSS background-image, invisible to a plain <img src> regex). Real computed styles and real
// visible text/images fix all three.
//
// Deliberately does NOT duplicate feature detection (detectFeatures from classify.mjs) — that's a regex
// function over an HTML *string*, and capture-browser.mjs already has the final rendered HTML (page.content())
// on the Node side, so it reuses the one canonical detectFeatures() against that string instead of a second,
// browser-context reimplementation. This function only returns what genuinely needs a live, rendered page:
// computed colors/fonts, real contact links, real visible body copy, and real images.
export function extractDomSignals() {
  const px = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const rgbToHex = (rgb) => {
    const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    const h = n => Number(n).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  };
  const isNeutral = hex => hex === '#ffffff' || hex === '#000000' || hex === null;

  // ---- style: colors from real rendered elements, not raw-source hex frequency ----
  const headerEl = document.querySelector('header, [role="banner"], nav') || document.body;
  const btnEl = document.querySelector('button, .btn, [class*="btn" i], a[class*="button" i]');
  const bodyStyle = getComputedStyle(document.body);
  const colors = {
    primary: rgbToHex(btnEl ? getComputedStyle(btnEl).backgroundColor : null) || rgbToHex(getComputedStyle(headerEl).backgroundColor) || null,
    accent: rgbToHex(btnEl ? getComputedStyle(btnEl).color : null) || null,
    background: rgbToHex(bodyStyle.backgroundColor) || '#ffffff',
    text: rgbToHex(bodyStyle.color) || '#0f172a',
  };
  const linkEl = document.querySelector('a');
  if (isNeutral(colors.primary)) colors.primary = rgbToHex(linkEl ? getComputedStyle(linkEl).color : null);

  const fonts = [];
  for (const el of [document.querySelector('h1'), document.body]) {
    if (!el) continue;
    const f = getComputedStyle(el).fontFamily;
    const first = (f || '').split(',')[0].replace(/["']/g, '').trim();
    if (first && !fonts.includes(first)) fonts.push(first);
  }

  // ---- contact: from real <a href="tel:"/"mailto:"> elements, immune to text/analytics-string confusion ----
  const telEl = document.querySelector('a[href^="tel:"]');
  const mailEl = document.querySelector('a[href^="mailto:"]');
  const contact = {
    phone: telEl ? decodeURIComponent(telEl.getAttribute('href').replace(/^tel:/i, '')) : null,
    email: mailEl ? decodeURIComponent(mailEl.getAttribute('href').replace(/^mailto:/i, '').split('?')[0]) : null,
    address: null, // address stays regex-based (extract-static.mjs's extractContact) — real DOM offers no better signal here
  };

  // ---- business identity ----
  const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
  const h1Text = document.querySelector('h1')?.innerText?.trim();
  const business = {
    name: ogSiteName || h1Text || document.title.split(/[|\-–—]/)[0].trim() || null,
    description: document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || null,
    title: document.title || '',
  };

  // ---- body copy: real visible text, not just h1/h2 (capture.mjs today captures zero paragraph text) ----
  const headings = [...document.querySelectorAll('h1, h2, h3')].map(el => ({ level: el.tagName.toLowerCase(), text: el.innerText.trim() })).filter(h => h.text).slice(0, 20);
  const paragraphs = [...document.querySelectorAll('p')].map(el => el.innerText.trim()).filter(t => t.length > 20).slice(0, 15);

  // ---- photos: real rendered images, role-classified by size/position (heuristic) ----
  const vh = window.innerHeight || 800;
  const photos = [...document.querySelectorAll('img')]
    .map(img => {
      const r = img.getBoundingClientRect();
      return { src: img.src, alt: img.alt || '', width: img.naturalWidth || px(r.width) || 0, height: img.naturalHeight || px(r.height) || 0, top: r.top, area: (img.naturalWidth || r.width || 0) * (img.naturalHeight || r.height || 0) };
    })
    .filter(p => p.src && p.width > 40 && p.height > 40)
    .sort((a, b) => b.area - a.area);
  for (const p of photos) {
    p.role = p.top < vh && p.area === photos[0]?.area ? 'hero' : /logo/i.test(p.alt) || /logo/i.test(p.src) ? 'logo' : 'gallery';
    delete p.top; delete p.area;
  }
  // CSS background-image logo fallback (defeats the static <img src> regex — logo rendered via background-image
  // on the header or one of its descendants, a common Wix/Squarespace pattern).
  let logoSvgMarkup = null;
  if (!photos.some(p => p.role === 'logo') && headerEl) {
    const candidates = [headerEl, ...headerEl.querySelectorAll('*')];
    for (const el of candidates) {
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) { photos.unshift({ src: m[1], alt: '', width: 0, height: 0, role: 'logo' }); break; }
    }
  }
  // Inline <svg> logo fallback — no background-image and no <img>, the logo is markup, not a fetchable
  // URL at all (also common on Wix). Naively grabbing "the first <svg> in the header" is unreliable — on
  // a real test site that picked up a 10×10 nav-dropdown chevron icon, not the logo (the header had no
  // logo-labeled element at all — likely a plain-text logotype). Require a size floor (rules out tiny UI
  // icons) and prefer an explicitly logo-labeled one; otherwise leave null rather than guess wrong — an
  // honestly-empty logo is far less harmful to a demo than a chevron icon mislabeled as the brand mark.
  if (!photos.some(p => p.role === 'logo') && headerEl) {
    const svgs = [...headerEl.querySelectorAll('svg')].map(svg => ({ svg, rect: svg.getBoundingClientRect(), labeled: !!svg.closest('[class*="logo" i], [id*="logo" i], [aria-label*="logo" i]') }));
    const candidates = svgs.filter(s => s.rect.width >= 40 && s.rect.height >= 16);
    const pick = candidates.find(s => s.labeled) || candidates.sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
    if (pick) logoSvgMarkup = pick.svg.outerHTML;
  }

  // ---- servicesCandidate: best-effort repeated-card-block heuristic — explicitly never trusted verbatim ----
  const cardSelectors = ['[class*="service" i]', '[class*="card" i]', 'article'];
  let cards = [];
  for (const sel of cardSelectors) {
    const found = [...document.querySelectorAll(sel)];
    if (found.length >= 2) { cards = found; break; }
  }
  const servicesCandidate = cards.slice(0, 8).map(el => {
    const heading = el.querySelector('h2, h3, h4, strong')?.innerText?.trim();
    const text = el.innerText?.trim().split('\n')[0];
    return { heading: heading || null, text: (text || '').slice(0, 200) };
  }).filter(c => c.heading || c.text);

  return { style: { colors, fonts }, contact, business, bodyCopy: { headings, paragraphs }, photos: photos.slice(0, 12), logoSvgMarkup, servicesCandidate };
}
