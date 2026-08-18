import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldClient } from '../../../scripts/new-client.mjs';

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'nc-test-'));
  mkdirSync(join(root, 'clients/_template/brand'), { recursive: true });
  mkdirSync(join(root, 'clients/_template/content'), { recursive: true });
  writeFileSync(join(root, 'clients/_template/brand/brand.config.json'), JSON.stringify({ businessName: 'REPLACE' }));
  writeFileSync(join(root, 'clients/_template/content/home.md'), '---\nhero_heading: REPLACE\n---\n');
  return root;
}

describe('scaffoldClient (demo → client reuse precedence)', () => {
  const roots = [];
  afterAll(() => { while (roots.length) rmSync(roots.pop(), { recursive: true, force: true }); });

  it('with no demos/<slug>/_source/, falls back to the blank template', () => {
    const root = makeRoot(); roots.push(root);
    const r = scaffoldClient('acme', { root });
    expect(r.seededFromDemo).toBe(false);
    const cfg = JSON.parse(readFileSync(join(r.clientDir, 'brand/brand.config.json'), 'utf8'));
    expect(cfg.businessName).toBe('REPLACE'); // still the placeholder — needs a human/agent to fill in
  });

  it('with demos/<slug>/_source/ present, seeds real content from it instead of the blank template', () => {
    const root = makeRoot(); roots.push(root);
    mkdirSync(join(root, 'demos/acme/_source/brand'), { recursive: true });
    mkdirSync(join(root, 'demos/acme/_source/content'), { recursive: true });
    writeFileSync(join(root, 'demos/acme/_source/brand/brand.config.json'), JSON.stringify({ businessName: 'Acme Real Co' }));
    writeFileSync(join(root, 'demos/acme/_source/content/home.md'), '---\nhero_heading: Acme Real Co\n---\nReal copy.');
    const r = scaffoldClient('acme', { root });
    expect(r.seededFromDemo).toBe(true);
    const cfg = JSON.parse(readFileSync(join(r.clientDir, 'brand/brand.config.json'), 'utf8'));
    expect(cfg.businessName).toBe('Acme Real Co');
    expect(readFileSync(join(r.clientDir, 'content/home.md'), 'utf8')).toContain('Real copy.');
  });

  it('regression: does not layer the demo over the blank template — no stale template placeholder files (e.g. an un-overwritten testimonials.md) leak into a demo-seeded client', () => {
    const root = makeRoot(); roots.push(root);
    // Template also ships a testimonials.md the demo _source does NOT have:
    writeFileSync(join(root, 'clients/_template/content/testimonials.md'), '---\ntitle: What Customers Say\n---\n');
    mkdirSync(join(root, 'demos/acme/_source/brand'), { recursive: true });
    mkdirSync(join(root, 'demos/acme/_source/content'), { recursive: true });
    writeFileSync(join(root, 'demos/acme/_source/brand/brand.config.json'), '{}');
    writeFileSync(join(root, 'demos/acme/_source/content/home.md'), '---\nhero_heading: X\n---\n');
    const r = scaffoldClient('acme', { root });
    expect(existsSync(join(r.clientDir, 'content/testimonials.md'))).toBe(false);
  });

  it('refuses to scaffold over an existing client directory', () => {
    const root = makeRoot(); roots.push(root);
    mkdirSync(join(root, 'clients/acme'), { recursive: true });
    expect(() => scaffoldClient('acme', { root })).toThrow(/exists/);
  });
});
