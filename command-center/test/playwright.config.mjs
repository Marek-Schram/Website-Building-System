// Dedicated Playwright config for the Command Center app itself (separate from the repo-root
// playwright.config.mjs, which tests BUILT CLIENT SITES, not this tool). Two things make this config
// exist rather than reusing the MCP browser tool used elsewhere in this repo's workflow:
//
//  1. This environment's Playwright MCP server insists on the "chrome" channel, which isn't installed
//     here — only a plain Chromium build is (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers). Pointing
//     launchOptions.executablePath straight at that Chromium sidesteps it entirely.
//  2. `webServer` boots the real server against a throwaway SQLite dir (never Marek's real pipeline.db)
//     and a fixed test port, and tears it down after — so this suite is safe to run any time, repeatedly,
//     without touching real pipeline data.
import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const PORT = 4799;
export const E2E_DATA_DIR = mkdtempSync(join(tmpdir(), 'cc-e2e-data-'));

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.e2e.mjs',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false, // one shared SQLite file across the whole run — keep it serial
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: resolve(__dirname, 'e2e-setup.mjs'),
  globalTeardown: resolve(__dirname, 'e2e-teardown.mjs'),
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: 'on',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: `node ${resolve(ROOT, 'command-center/server/index.mjs')}`,
    cwd: ROOT,
    env: {
      ...process.env,
      COMMAND_CENTER_PASSWORD: 'e2e-test-password',
      COMMAND_CENTER_PORT: String(PORT),
      COMMAND_CENTER_DATA_DIR: E2E_DATA_DIR,
    },
    url: `http://127.0.0.1:${PORT}/api/session`,
    timeout: 15000,
    reuseExistingServer: false,
  },
});
