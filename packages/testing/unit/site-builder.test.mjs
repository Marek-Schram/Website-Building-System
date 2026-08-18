import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, parseList, buildSite } from '../../site-builder/src/build.mjs';

// Minimal brand.config.json + content/*.md fixture, written to an arbitrary directory — used to exercise
// the clientDir override (a demo's demos/<slug>/_source/ isn't under clients/) without touching real client
// fixtures. Returns the dir so a test can layer additional fields (heroImage, theme, etc.) on top.
function writeFixtureClient(dir, { theme = 'beacon', heroImage, font } = {}) {
  mkdirSync(join(dir, 'brand'), { recursive: true });
  mkdirSync(join(dir, 'content'), { recursive: true });
  writeFileSync(join(dir, 'brand', 'brand.config.json'), JSON.stringify({
    businessName: 'Fixture Co', tagline: 'A fixture business',
    theme, brand: { colors: { primary: '#1d4ed8' }, ...(heroImage ? { heroImage } : {}), ...(font ? { font } : {}) },
    contact: { phone: '314-555-0100', email: 'hi@fixture.example', address: '1 Test St' },
    addons: [],
  }, null, 2));
  writeFileSync(join(dir, 'content', 'home.md'), '---\nhero_heading: Fixture Co\nhero_sub: A fixture business\n---\nWelcome.');
  return dir;
}

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
    // Footer must render exactly once — regression test for a real bug found during Phase 2 testing:
    // Footer is in every theme's defaultSections (rendered via SECTION_RENDERERS) AND used to also be
    // appended a second time unconditionally, so every real build shipped a duplicate footer.
    expect((html.match(/<footer>/g) || []).length).toBe(1);
  });
});

describe('buildSite clientDir override (Phase 4 hook: demo pipeline points this at demos/<slug>/_source/)', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sw-clientdir-out-'));
  const srcDir = mkdtempSync(join(tmpdir(), 'sw-clientdir-src-'));
  afterAll(() => { rmSync(outDir, { recursive: true, force: true }); rmSync(srcDir, { recursive: true, force: true }); });

  it('builds from an arbitrary directory, not just clients/<slug>, to outDir/<slug>/index.html', () => {
    writeFixtureClient(srcDir);
    const r = buildSite('fixture-co', { outDir, clientDir: srcDir });
    expect(r.businessName).toBe('Fixture Co');
    expect(existsSync(join(outDir, 'fixture-co', 'index.html'))).toBe(true);
  });

  it('omitting clientDir still defaults to clients/<slug>/ (backward compatible)', () => {
    const r = buildSite('example-bakery', { outDir });
    expect(r.businessName).toBe("Sweet Peter's Bakery");
  });
});

describe('theme-driven hero layout + font (Phase 2: real visual variety, not one fixed shell)', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sw-theme-out-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('image-hero renders a real background-image when a hero photo is supplied', () => {
    const src = writeFixtureClient(mkdtempSync(join(tmpdir(), 'sw-theme-src-')), { theme: 'harvest', heroImage: 'https://example.com/hero.jpg' });
    const r = buildSite('fixture-co', { outDir, clientDir: src });
    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    expect(html).toContain('hero image-hero');
    expect(html).toContain("url('https://example.com/hero.jpg')");
  });

  it('gracefully falls back to plain text-hero when the theme wants a photo but none was supplied', () => {
    const src = writeFixtureClient(mkdtempSync(join(tmpdir(), 'sw-theme-src-')), { theme: 'harvest' }); // no heroImage
    const r = buildSite('fixture-co', { outDir, clientDir: src });
    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    // Checks the rendered <section>'s own class, not the whole page — the shared CSS ruleset always
    // defines .hero.image-hero{}/.hero.split-hero{} regardless of which layout a given build actually uses.
    expect(html).toContain('<section class="hero">');
    expect(html).not.toContain('<section class="hero image-hero"');
    expect(html).not.toContain('<section class="hero split-hero"');
  });

  it('split-hero renders the two-column layout when a photo is supplied', () => {
    const src = writeFixtureClient(mkdtempSync(join(tmpdir(), 'sw-theme-src-')), { theme: 'summit', heroImage: 'https://example.com/hero2.jpg' });
    const r = buildSite('fixture-co', { outDir, clientDir: src });
    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    expect(html).toContain('hero split-hero');
    expect(html).toContain('hero-img');
  });

  it('brand.font (previously captured but never used) now reaches the output as a real CSS var', () => {
    const src = writeFixtureClient(mkdtempSync(join(tmpdir(), 'sw-theme-src-')), { font: { heading: 'Playfair Display', body: 'Inter' } });
    const r = buildSite('fixture-co', { outDir, clientDir: src });
    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    expect(html).toContain("--font-heading:'Playfair Display'");
  });

  it('falls back to the theme\'s own font pairing when brand.font is not set', () => {
    const src = writeFixtureClient(mkdtempSync(join(tmpdir(), 'sw-theme-src-')), { theme: 'harvest' });
    const r = buildSite('fixture-co', { outDir, clientDir: src });
    const html = readFileSync(join(r.distDir, 'index.html'), 'utf8');
    expect(html).toContain("--font-heading:'Lora'");
  });
});
