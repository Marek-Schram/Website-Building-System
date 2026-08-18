import { test, expect } from '@playwright/test';
import { extractDomSignals } from '../src/extract-dom.mjs';

// A Wix-like fixture reproducing the exact documented failure in parity/repair-it-roofing/baseline.json:
// the fast regex path (extract-static.mjs) grabbed a platform analytics ID as the phone number and a
// Sentry tracking-pixel address as the email, and missed a CSS-background-image logo entirely. This proves
// extractDomSignals() (running against the real rendered DOM) recovers the correct values instead.
const WIX_LIKE_FIXTURE = `<!doctype html>
<html><head>
  <meta name="description" content="Quality roofing services">
  <style>
    header { background-image: url('https://static.example.com/logo.svg'); background-color: #116dff; }
    .btn { background-color: #ff4040; color: #ffffff; }
    body { background-color: #ffffff; color: #0f172a; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <header><a href="/">Home</a></header>
  <h1 style="font-family: Helvetica, sans-serif;">Repair It Roofing</h1>
  <p>We've been serving the St. Louis area for over 20 years with quality roof repair and replacement.</p>
  <a class="btn" href="tel:+13143284077">Call Now</a>
  <a href="mailto:contact@repairitroof.com">Email Us</a>
  <!-- Decoy: a tracking-pixel-style mailto elsewhere in the markup, must NOT be picked over the real one -->
  <img src="https://sentry-wixpress-decoy.example.com/pixel.gif" alt="" width="1" height="1">
  <div class="service-card"><h3>Attic Ventilation</h3><p>Keep your attic properly ventilated year-round.</p></div>
  <div class="service-card"><h3>Chimney Repairs</h3><p>Expert chimney repair and rebuilding services.</p></div>
  <img src="https://static.example.com/hero.jpg" width="1200" height="800" alt="A recently completed roof">
  <script>
    // Simulates a Wix analytics/pixel ID that regex phone-matching could mistake for a real number
    window.__wixAnalytics = { visitorId: '1.15432.0' };
  </script>
</body></html>`;

test('recovers real phone/email/logo from a Wix-like page a regex-only capture garbles', async ({ page }) => {
  await page.setContent(WIX_LIKE_FIXTURE, { waitUntil: 'load' });
  const result = await page.evaluate(extractDomSignals);

  expect(result.contact.phone).toBe('+13143284077');
  expect(result.contact.email).toBe('contact@repairitroof.com');
  expect(result.photos.some(p => p.role === 'logo' && p.src.includes('logo.svg'))).toBe(true);

  expect(result.style.colors.background).toBe('#ffffff');
  expect(result.style.fonts[0]).toBe('Helvetica');

  expect(result.business.name).toBe('Repair It Roofing');
  expect(result.bodyCopy.paragraphs[0]).toContain('St. Louis');
  expect(result.servicesCandidate.some(c => c.heading === 'Attic Ventilation')).toBe(true);
  expect(result.servicesCandidate.some(c => c.heading === 'Chimney Repairs')).toBe(true);
});

test('gracefully returns nulls (not a crash) on a page with no contact info at all', async ({ page }) => {
  await page.setContent('<html><body><h1>Bare Page</h1></body></html>', { waitUntil: 'load' });
  const result = await page.evaluate(extractDomSignals);
  expect(result.contact.phone).toBeNull();
  expect(result.contact.email).toBeNull();
  expect(result.photos).toEqual([]);
});

// Regression test for a real false positive caught while testing against the actual repairitroof.com (a
// Wix site): the header's only <svg> was a 10x10 nav-dropdown chevron icon, not the logo (that site's
// header had no logo-labeled element at all). A naive "grab the first svg in the header" heuristic
// wrongly captured the chevron as the brand logo.
test('does NOT mistake a small unlabeled UI icon svg for the logo', async ({ page }) => {
  await page.setContent(`<html><body>
    <header>
      <svg width="10" height="10" viewBox="0 0 16 11" aria-label="More pages"><path d="M8 10.5L16 1.86"></path></svg>
      <a href="/">Site</a>
    </header>
  </body></html>`, { waitUntil: 'load' });
  const result = await page.evaluate(extractDomSignals);
  expect(result.logoSvgMarkup).toBeNull();
  expect(result.photos.some(p => p.role === 'logo')).toBe(false);
});

test('DOES pick a properly-sized, logo-labeled inline svg', async ({ page }) => {
  await page.setContent(`<html><body>
    <header>
      <svg width="10" height="10" aria-label="menu icon"><path d="M0 0h10v10"></path></svg>
      <div class="site-logo"><svg width="140" height="40" viewBox="0 0 140 40"><text x="0" y="20">Acme</text></svg></div>
    </header>
  </body></html>`, { waitUntil: 'load' });
  const result = await page.evaluate(extractDomSignals);
  expect(result.logoSvgMarkup).toContain('Acme');
});
