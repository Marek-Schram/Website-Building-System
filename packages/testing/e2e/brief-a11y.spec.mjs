import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const BASE = process.env.SITE_URL || 'http://localhost:4321';
test('brief a11y', async ({ page }) => {
  const r = await page.goto(BASE + '/prospect-brief.html', { waitUntil: 'domcontentloaded' });
  test.skip(r?.status() === 404 || r?.status() === 403, 'no prospect-brief.html served at root');
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(res.violations.map(v => v.id)).toEqual([]);
});
