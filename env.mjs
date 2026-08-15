// Zero-dependency .env loader. Import for its side effect (`import '../../../env.mjs'`) at the top of any
// script that reads process.env.<KEY> — populates process.env from the repo-root .env file, if present,
// without overriding variables the shell/CI already set. Never logs values; .env itself stays out of git.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export function loadEnv(path = resolve(ROOT, '.env')) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][\w]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    const q = val.match(/^(["'])([\s\S]*)\1$/);
    if (q) val = q[2];
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();
