import {describe,it,expect} from 'vitest';
import {extractColors,extractFonts,extractContact,extractNav,extractLogo} from '../../parity/src/extract-static.mjs';

describe('extractColors',()=>{
  it('picks the most frequent non-black/white hex as primary',()=>{
    const c = extractColors('#1d4ed8 #1d4ed8 #1d4ed8 #ff4040 #ffffff #000000');
    expect(c.primary).toBe('#1d4ed8');
    expect(c.accent).toBe('#ff4040');
  });
  it('falls back to sensible defaults on no color data',()=>{
    const c = extractColors('no colors here');
    expect(c.primary).toBe('#1d4ed8');
  });
});

describe('extractFonts',()=>{
  it('extracts font-family declarations, first-appearance order',()=>{
    expect(extractFonts('font-family: Lora, serif; font-family: Inter, sans-serif;')).toEqual(['Lora','Inter']);
  });
  it('extracts a Google Fonts family from a css2 URL',()=>{
    expect(extractFonts('fonts.googleapis.com/css2?family=Open+Sans:wght@400')).toEqual(['Open Sans']);
  });
});

describe('extractContact',()=>{
  it('extracts a tel: href phone and mailto: email',()=>{
    const c = extractContact('<a href="tel:+13143284077">Call</a><a href="mailto:info@example.com">Email</a>');
    expect(c.phone).toBe('+13143284077');
    expect(c.email).toBe('info@example.com');
  });
  it('does NOT reliably handle JS-rendered content — documents the known gap capture-browser.mjs fixes',()=>{
    // No tel:/mailto: href and no plain-text phone/email in the raw HTML (as on a JS-heavy site) → nulls,
    // not a crash. This is the exact blind spot capture-browser.mjs (Phase 1) is built to close.
    const c = extractContact('<div id="app"></div><script>renderContactWidget()</script>');
    expect(c.phone).toBeNull();
    expect(c.email).toBeNull();
  });
});

describe('extractNav',()=>{
  it('extracts internal links with short labels, dedupes',()=>{
    const html = '<a href="/services">Services</a><a href="/services">Services</a><a href="/contact">Contact</a>';
    const nav = extractNav(html, null);
    expect(nav.map(n=>n.label)).toEqual(['Services','Contact']);
  });
  it('skips labels over 30 chars',()=>{
    const html = `<a href="/x">${'a'.repeat(31)}</a>`;
    expect(extractNav(html, null)).toEqual([]);
  });
});

describe('extractLogo',()=>{
  it('finds an img src containing "logo"',()=>expect(extractLogo('<img src="/assets/company-logo.png">')).toBe('/assets/company-logo.png'));
  it('returns null when no logo image exists',()=>expect(extractLogo('<img src="/assets/hero.png">')).toBeNull());
});
