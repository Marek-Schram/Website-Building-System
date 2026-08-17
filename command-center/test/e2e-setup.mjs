// Playwright globalSetup: sweeps any leftover pw-e2e-* artifacts from a previous crashed run before this
// run starts, so a bad prior run can never make a fresh run's assertions flaky.
import { rmSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUG_PREFIX } from './e2e-constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

export default async function globalSetup() {
  for (const dir of ['clients', 'dist', 'parity', 'invoices/out', 'marketing-toolkit', 'proposals/out', 'listing-kit/out']) {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (name.startsWith(SLUG_PREFIX)) rmSync(resolve(abs, name), { recursive: true, force: true });
    }
  }
}
