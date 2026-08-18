// Real-browser E2E for the Command Center UI — drives an actual Chromium instance through the exact
// clicks Marek would make, not just the API underneath. Written specifically to close a gap from the
// last round: the routes were verified with curl, but the drawer.js/board.js wiring itself never got a
// real click-through. One long, serial scenario mirrors how the app is actually used (a single deal moving
// through the pipeline) rather than isolated fragments, with screenshots captured at each milestone as
// visual evidence, not just a green checkmark.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUG_PREFIX } from './e2e-constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SHOTS = resolve(__dirname, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const DEAL_NAME = `${SLUG_PREFIX}Sunny Cabins`;
// Mirrors dealSlug()'s slugify exactly (server/routes.mjs) — needed to predict the client_slug "Start
// client" will create, so the marketing-kit fixture files land where the UI will actually look for them.
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const SLUG = slugify(DEAL_NAME);

test.describe.configure({ mode: 'serial' });

test('full deal lifecycle through the real UI: lead → parity → invoice → paid, plus marketing kit + follow-ups', async ({ page }) => {
  await test.step('login screen rejects the wrong password, accepts the right one', async () => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Command Center');
    await page.fill('#pw', 'not-the-password');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('#login-err')).toHaveText(/wrong password/i);

    await page.fill('#pw', 'e2e-test-password');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('.topbar .brand')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '01-board.png') });
  });

  await test.step('add a website lead pointed at the parity fixture', async () => {
    await page.click('#btn-add');
    const modal = page.locator('.modal-wrap form');
    await expect(modal).toBeVisible();
    await modal.locator('select[name=business_line]').selectOption('website');
    await modal.locator('input[name=name]').fill(DEAL_NAME);
    await modal.locator('input[name=city]').fill('Pigeon Forge, TN');
    await modal.locator('input[name=website]').fill('command-center/test/fixtures/old-site.html');
    await modal.locator('button:has-text("Add lead")').click();
    await expect(page.locator('.toast:has-text("Lead added")')).toBeVisible();

    const card = page.locator('.card', { hasText: DEAL_NAME });
    await expect(card).toBeVisible();
    await expect(card.locator('.chip.line-website')).toBeVisible();
  });

  await test.step('open the drawer and save deal details (value + an overdue follow-up date)', async () => {
    await page.locator('.card', { hasText: DEAL_NAME }).click();
    await expect(page.locator('.drawer h2')).toHaveText(DEAL_NAME);

    await page.fill('input[name=deal_value]', '800');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await page.fill('input[name=follow_up_date]', yesterday);
    await page.click('button:has-text("Save details")');
    await expect(page.locator('.toast:has-text("Saved")')).toBeVisible();
  });

  await test.step('demo generation: flag/check the full (interactive) demo, generate a quick one, then confirm before a quick regen overwrites an existing full demo', async () => {
    // Flag for the Full (Claude-authored) demo — same flag/detect pattern as marketing-kit below. The
    // hint shows the raw deal name here (client_slug isn't set until "Start client", below) — same
    // pre-existing fallback marketing-kit's own hint uses (`deal.client_slug || deal.name`); the server
    // check itself still resolves the real slug regardless (dealSlug() in routes.mjs).
    await page.click('button:has-text("Flag for /demo-site (full)")');
    await expect(page.locator(`code:has-text("${DEAL_NAME}")`)).toBeVisible();
    await page.click('button:has-text("Check for full demo")');
    await expect(page.locator('.toast:has-text("Not found")')).toBeVisible();

    // Generate the Quick demo — real demo-gen.mjs subprocess, no full demo exists yet so no confirm needed.
    await page.click('button:has-text("Generate demo")');
    await expect(page.locator('.toast:has-text("Generate demo finished")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.filelink:has-text("Demo site (quick)")')).toBeVisible();

    // Simulate a Full demo having since been built for this same slug (its _source/ dir is the marker) —
    // "Check for full demo" should now find it.
    const sourceDir = resolve(ROOT, 'demos', SLUG, '_source');
    mkdirSync(sourceDir, { recursive: true });
    await page.click('button:has-text("Check for full demo")');
    await expect(page.locator('.section-title:has-text("High-quality demo") ~ p:has-text("Ready")')).toBeVisible();
    await expect(page.locator('.filelink:has-text("Demo site (full ✨)")')).toBeVisible();

    // Regenerating the Quick demo now must ask before overwriting the Full one at the same path.
    page.once('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Generate demo")');
    await expect(page.locator('.toast:has-text("Generate demo finished")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.filelink:has-text("Demo site (quick)")')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '01b-demo-generation.png') });
  });

  await test.step('parity: capture the old site from the drawer', async () => {
    await expect(page.locator('.section-title:has-text("Parity vs. old site")')).toBeVisible();
    await page.click('button:has-text("Capture old site")');
    // capture.mjs is a real subprocess (local-file read, no network) — give it a moment, then the
    // section should swap from "Capture" to "Run parity check".
    await expect(page.locator('button:has-text("Run parity check")')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: resolve(SHOTS, '02-parity-captured.png') });
  });

  await test.step('start the client (this is what actually advances the deal to Won)', async () => {
    await page.click('button:has-text("Start client")');
    await expect(page.locator('.stagebar button[data-stage=won].current')).toBeVisible();
    await expect(page.locator('button:has-text("Build")')).toBeVisible();
  });

  await test.step('force-build via the API (arrange step — the template ships placeholder content that Build correctly refuses; that guard is pre-existing Phase-1 behavior, not what this suite is checking) then run the parity check from the UI', async () => {
    const dealId = await dealIdFromCard(page, DEAL_NAME);
    const buildRes = await page.request.post(`/api/deals/${dealId}/build`, { data: { force: true } });
    expect(buildRes.ok()).toBe(true);

    await page.click('button:has-text("Run parity check")');
    const chip = page.locator('.chip.flag, .chip.plain').filter({ hasText: /Parity pass|regression\(s\)/ });
    await expect(chip).toBeVisible({ timeout: 15000 });
    // Regression test: a real "regressions found" result is a working diagnosis, not a crash — the toast
    // must not read "failed" for it. (This E2E run is what caught the bug in the first place.)
    await expect(page.locator('.toast', { hasText: /failed/i })).toHaveCount(0);
    await page.screenshot({ path: resolve(SHOTS, '03-parity-result.png') });
  });

  await test.step('invoicing: create → mark sent → mark paid, deal auto-advances to Invoiced', async () => {
    await expect(page.locator('.section-title:has-text("Invoice")')).toBeVisible();
    await page.click('button:has-text("Create invoice")');
    const modal = page.locator('.modal-wrap form');
    await expect(modal).toBeVisible();
    // First line item is prefilled from the deal's own value ($800) — just confirm and submit.
    await expect(modal.locator('input[data-k=amount][data-i="0"]')).toHaveValue('800');
    await modal.locator('button:has-text("Generate invoice")').click();
    await expect(page.locator('.chip:has-text("Draft")')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: resolve(SHOTS, '04-invoice-draft.png') });

    await page.click('button:has-text("Mark sent")');
    await expect(page.locator('.chip:has-text("Awaiting payment")')).toBeVisible();

    await page.click('button:has-text("Mark paid")');
    await expect(page.locator('.chip:has-text("Paid")')).toBeVisible();
    await expect(page.locator('.stagebar button[data-stage=invoiced].current')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '05-invoice-paid.png') });
  });

  await test.step('marketing kit: flag, honestly report "not found", then find it once files exist', async () => {
    await page.click('button:has-text("Flag for /marketing-kit")');
    await expect(page.locator(`code:has-text("${SLUG}")`)).toBeVisible();

    await page.click('button:has-text("Check for marketing kit")');
    await expect(page.locator('.toast:has-text("Not found")')).toBeVisible();

    // Drop real files where the UI predicted the skill would write them, then check again.
    const kitDir = resolve(ROOT, 'marketing-toolkit', SLUG);
    mkdirSync(kitDir, { recursive: true });
    writeFileSync(resolve(kitDir, 'email-welcome.md'), 'Subject: Welcome to Sunny Cabins!');

    await page.click('button:has-text("Check for marketing kit")');
    await expect(page.locator('.filelink:has-text("email-welcome.md")')).toBeVisible();
    const openLink = page.locator('.filelink:has-text("email-welcome.md") a');
    await expect(openLink).toHaveAttribute('href', new RegExp(`marketing-kit/file\\?path=email-welcome\\.md`));
  });

  await test.step('follow-ups: the overdue deal we set earlier shows up in the cross-board panel', async () => {
    await page.click('#close-drawer');
    await expect(page.locator('#followup-badge')).toBeVisible();
    await page.click('#btn-followups');
    const panel = page.locator('.modal-wrap');
    await expect(panel.locator('.section-title:has-text("Overdue")')).toBeVisible();
    const row = panel.locator('.fu-row', { hasText: DEAL_NAME });
    await expect(row).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '06-followups.png') });

    await row.click();
    await expect(page.locator('.drawer h2')).toHaveText(DEAL_NAME);
  });
});

// Reads the deal id straight from the card's own DOM state by round-tripping through the deals list —
// the board never puts the numeric id in a visible attribute, so this asks the API directly (same
// session cookie the page already holds) rather than scraping something the UI was never meant to expose.
async function dealIdFromCard(page, name) {
  const res = await page.request.get('/api/deals');
  const deals = await res.json();
  const match = deals.find(d => d.name === name);
  if (!match) throw new Error(`Could not find deal "${name}" via API`);
  return match.id;
}
