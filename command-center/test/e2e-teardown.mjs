// Playwright globalTeardown: removes the throwaway SQLite dir this run's webServer used, plus any
// repo-level artifact (clients/, dist/, parity/, invoices/out/, marketing-toolkit/, proposals/out/,
// listing-kit/out/) the E2E clicks created — all namespaced under SLUG_PREFIX so cleanup can't reach
// anything real.
import { rmSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DATA_DIR } from './playwright.config.mjs';
import { SLUG_PREFIX } from './e2e-constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

export default async function globalTeardown() {
  rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  for (const dir of ['clients', 'dist', 'parity', 'invoices/out', 'marketing-toolkit', 'proposals/out', 'listing-kit/out']) {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (name.startsWith(SLUG_PREFIX)) rmSync(resolve(abs, name), { recursive: true, force: true });
    }
  }
}
