// Dedicated config for packages/parity's DOM-extraction tests — all fixtures use page.setContent(), so
// unlike the root playwright.config.mjs (e2e, needs a running dev server) this needs no webServer/baseURL.
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 15000,
  fullyParallel: true,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
