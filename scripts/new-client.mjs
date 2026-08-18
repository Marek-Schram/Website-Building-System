#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// If a full interactive demo (/demo-site) was already built for this slug, it already has real authored
// brand.config.json + content/*.md — strictly richer than a bare parity brand.seed.json (no content files
// at all) or the blank template's empty placeholder files. Reuse it directly instead of the blank template,
// so no stale placeholder filler (e.g. the template's contact.md body "Reach us.") ends up mixed in with
// real content. Returns {clientDir, seededFromDemo}.
export function scaffoldClient(slug, { root, demoSourceDir, templateDir } = {}) {
  const clientDir = resolve(root, 'clients', slug);
  if (existsSync(clientDir)) throw new Error(`"${slug}" exists.`);
  const demoSource = demoSourceDir ?? resolve(root, 'demos', slug, '_source');
  const template = templateDir ?? resolve(root, 'clients/_template');

  if (existsSync(demoSource)) {
    mkdirSync(clientDir, { recursive: true });
    for (const dir of ['brand', 'content', 'public']) {
      const src = resolve(demoSource, dir);
      if (existsSync(src)) cpSync(src, resolve(clientDir, dir), { recursive: true });
    }
    return { clientDir, seededFromDemo: true };
  }
  cpSync(template, clientDir, { recursive: true });
  return { clientDir, seededFromDemo: false };
}

const isMain = (() => { try { return fileURLToPath(import.meta.url) === resolve(process.argv[1]); } catch { return false; } })();
if (isMain) {
  const s = process.argv[2]; if (!s) { console.error('Usage: new-client.mjs "<slug>"'); process.exit(1); }
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  try {
    const { seededFromDemo } = scaffoldClient(s, { root });
    console.log(seededFromDemo
      ? `✅ clients/${s} — seeded from demos/${s}/_source/ (already has real brand + content from the interactive demo). Review it, then /build-site → /add-feature → /test-site → /security-gate → /deploy-site`
      : `✅ clients/${s}. Fill brand/ + content/ (or seed from parity/<slug>/brand.seed.json), then /build-site → /add-feature → /test-site → /security-gate → /deploy-site`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
