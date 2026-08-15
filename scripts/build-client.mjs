#!/usr/bin/env node
// Thin wrapper so `npm run build:client -- <slug>` and existing skill/docs references keep working;
// the real implementation lives in packages/site-builder/src/build.mjs.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../packages/site-builder/src/build.mjs');
const r = spawnSync('node', [target, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
