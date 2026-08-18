import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {writeParityOutput} from '../../parity/src/output.mjs';

const dirs = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), {recursive:true, force:true}); });

function tmpDir() { const d = mkdtempSync(resolve(tmpdir(), 'parity-output-test-')); dirs.push(d); return d; }

const SAMPLE = {
  target: 'https://example.com', slug: 'example', name: 'Example Co', desc: 'A test business',
  colors: {primary:'#1d4ed8', accent:'#ff4040', background:'#ffffff', text:'#0f172a', all:['#1d4ed8','#ff4040']},
  fonts: ['Inter','Lora'], logo: null,
  title: 'Example Co', pages: [{href:'/contact', label:'Contact'}],
  headings: {h1:['Welcome'], h2:['Our Services']},
  features: ['contact-form','booking'], providers: {booking:'Calendly'},
  contact: {phone:'314-555-0100', email:'hi@example.com', address:null},
  capturedAt: '2026-08-18T00:00:00.000Z',
};

describe('writeParityOutput',()=>{
  it('writes baseline.json with the expected top-level shape (regression safety net for the capture.mjs refactor)',()=>{
    const dir = tmpDir();
    const baseline = writeParityOutput(dir, SAMPLE);
    expect(Object.keys(baseline).sort()).toEqual(['business','capturedAt','contact','functionality','slug','source','structure','style'].sort());
    expect(baseline.business).toEqual({name:'Example Co', description:'A test business'});
    expect(baseline.style.colors).toEqual({primary:'#1d4ed8', accent:'#ff4040', background:'#ffffff', text:'#0f172a'});
    const onDisk = JSON.parse(readFileSync(resolve(dir,'baseline.json'),'utf8'));
    expect(onDisk).toEqual(baseline);
  });
  it('writes brand.seed.json schema-compatible with site-builder\'s brand.config.json',()=>{
    const dir = tmpDir();
    writeParityOutput(dir, SAMPLE);
    const seed = JSON.parse(readFileSync(resolve(dir,'brand.seed.json'),'utf8'));
    expect(seed.businessName).toBe('Example Co');
    expect(seed.brand.colors).toEqual({primary:'#1d4ed8', secondary:'#0f172a', accent:'#ff4040'});
    expect(seed.features).toEqual({contactForm:true, booking:true, payments:false, store:false});
    expect(seed.addons).toEqual(['contact-form','booking']);
  });
  it('writes a human-readable baseline.md',()=>{
    const dir = tmpDir();
    writeParityOutput(dir, SAMPLE);
    const md = readFileSync(resolve(dir,'baseline.md'),'utf8');
    expect(md).toContain('Example Co');
    expect(md).toContain('contact-form');
  });
  it('brand.seed.json logo: falls back to the placeholder path when nothing was captured',()=>{
    const dir = tmpDir();
    writeParityOutput(dir, SAMPLE); // SAMPLE.logo is null
    const seed = JSON.parse(readFileSync(resolve(dir,'brand.seed.json'),'utf8'));
    expect(seed.brand.logo).toBe('assets/logo.svg');
  });
  it('regression: a real captured logo path must win over the hardcoded placeholder (found during Phase 4 validation — this used to be unconditionally overwritten)',()=>{
    const dir = tmpDir();
    writeParityOutput(dir, {...SAMPLE, logo:'assets/logo-1.png'});
    const seed = JSON.parse(readFileSync(resolve(dir,'brand.seed.json'),'utf8'));
    expect(seed.brand.logo).toBe('assets/logo-1.png');
  });
  it('passes through extra fields (the hook capture-browser.mjs uses for bodyCopy/photos)',()=>{
    const dir = tmpDir();
    const baseline = writeParityOutput(dir, {...SAMPLE, extra:{bodyCopy:{headings:[],paragraphs:['Hi']}, photos:[{src:'/hero.jpg',role:'hero'}]}});
    expect(baseline.bodyCopy.paragraphs).toEqual(['Hi']);
    expect(baseline.photos[0].role).toBe('hero');
  });
});
