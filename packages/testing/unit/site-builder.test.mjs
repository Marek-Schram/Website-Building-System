import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, parseList, buildSite } from '../../site-builder/src/build.mjs';

describe('parseFrontmatter', () => {
  it('splits data/body and coerces booleans', () => {
    const { data, body } = parseFrontmatter('---\ntitle: Contact\nform: true\n---\nReach us.');
    expect(data).toEqual({ title: 'Contact', form: true });
    expect(body).toBe('Reach us.');
  });
  it('strips quotes from values', () => {
    const { data } = parseFrontmatter('---\nhero_heading: "Warm bread, real butter"\n---\n');
    expect(data.hero_heading).toBe('Warm bread, real butter');
  });
  it('returns empty data for content with no frontmatter', () => {
    expect(parseFrontmatter('just text').data).toEqual({});
  });
});

describe('parseList', () => {
  it('parses repeated - key: value blocks', () => {
    const items = parseList('- name: "Daily Breads"\n  description: "Sourdough, brioche, rye."\n- name: "Cakes"\n  description: "Custom orders."');
    expect(items).toEqual([
      { name: 'Daily Breads', description: 'Sourdough, brioche, rye.' },
      { name: 'Cakes', description: 'Custom orders.' },
    ]);
  });
  it('returns [] for empty body', () => { expect(parseList('')).toEqual([]); });
});

describe('buildSite validation', () => {
  it('refuses to build a client that still has REPLACE placeholders', () => {
    expect(() => buildSite('_template', { outDir: mkdtempSync(join(tmpdir(), 'sw-')) })).toThrow(/placeholder/i);
  });
  it('throws for an unknown client slug', () => {
    expect(() => buildSite('no-such-client-xyz', { outDir: mkdtempSync(join(tmpdir(), 'sw-')) })).toThrow(/No brand\.config/);
  });
});

describe('buildSite (example-bakery, real fixture)', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sw-build-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('produces a real, secure, non-fabricated static site', () => {
    const r = buildSite('example-bakery', { outDir });
    expect(r.businessName).toBe("Sweet Peter's Bakery");

    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    expect(html).toContain("Sweet Peter's Bakery");
    expect(html.toLowerCase()).not.toContain('replace');
    // hours/menu/reviews come from real content, never the generic placeholder snippets:
    expect(html).not.toContain('Signature Dish');
    expect(html).not.toContain('Mon–Fri');
    expect(html).toContain('Tue-Sun 6am-2pm');
    expect(html).toContain('Daily Breads');
    // no duplicate ids (each addon/section anchor must be unique on the page):
    const ids = [...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // every in-page #anchor resolves to a real id:
    for (const href of new Set([...html.matchAll(/href\s*=\s*"#([^"#]+)"/g)].map(m => m[1])))
      expect(ids).toContain(href);

    expect(existsSync(join(r.distDir, '_headers'))).toBe(true);
    const headers = readFileSync(join(r.distDir, '_headers'), 'utf8');
    for (const h of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options'])
      expect(headers).toContain(h);

    expect(existsSync(join(r.distDir, 'robots.txt'))).toBe(true);
    expect(existsSync(join(r.distDir, 'sitemap.xml'))).toBe(true);
  });
});
