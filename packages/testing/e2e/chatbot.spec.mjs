import { test, expect } from '@playwright/test';

const BASE = process.env.SITE_URL || 'http://localhost:4321';

test.describe('Chatbot widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    test.skip((await page.locator('#sw-chat').count()) === 0, 'no chatbot on this page');
  });

  test('opens and shows welcome + chips', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await expect(page.locator('#sw-chat-log .sw-bot').first()).toContainText('How can I help?');
    await expect(page.locator('#sw-chat-chips .sw-chip').first()).toBeVisible();
  });

  test('answers FAQ by keyword', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-in').fill('Do you have emergency service?');
    await page.locator('#sw-chat-form button').click();
    await expect(page.locator('#sw-chat-log .sw-bot').last()).toContainText('emergency service');
  });

  test('falls back for unknown questions (no AI)', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-in').fill('zzqx yyz novolt');
    await page.locator('#sw-chat-form button').click();
    await expect(page.locator('#sw-chat-log .sw-bot').last()).toContainText('contact form');
  });

  test('quick-reply chip sends a user message', async ({ page }) => {
    await page.locator('#sw-chat-toggle').click();
    await page.locator('#sw-chat-chips .sw-chip').first().click();
    await expect(page.locator('#sw-chat-log .sw-user').first()).toContainText('hours');
  });
});
