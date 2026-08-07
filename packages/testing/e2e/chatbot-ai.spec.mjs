import { test, expect } from '@playwright/test';

const BASE = process.env.SITE_URL || 'http://localhost:4321';

test.describe('Chatbot AI tier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    test.skip((await page.locator('#sw-chat').count()) === 0, 'no chatbot on this page');
    test.skip((await page.locator('#sw-chat').getAttribute('data-ai-endpoint') || '') === '', 'no AI endpoint configured');
  });

  test('calls the AI endpoint for unknown questions', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-in').fill('Do you offer senior citizen discounts?');
    await page.locator('#sw-chat-form button').click();
    await expect(page.locator('#sw-chat-log .sw-bot').last()).toContainText('AI says hi', { timeout: 8000 });
  });

  test('falls back to rule-based when AI fails', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-in').fill('FAILME');
    await page.locator('#sw-chat-form button').click();
    await expect(page.locator('#sw-chat-log .sw-bot').last()).toContainText('contact form', { timeout: 8000 });
  });

  test('still answers FAQ keywords locally (no AI call)', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-in').fill('Where are you located?');
    await page.locator('#sw-chat-form button').click();
    await expect(page.locator('#sw-chat-log .sw-bot').last()).toContainText('map');
  });
});
