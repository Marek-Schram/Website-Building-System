import {describe,it,expect} from 'vitest';
import {DISPLAY,chooseIndustry,chooseColors,chooseServices,renderDemoHtml} from '../../demo-gen/src/demo.mjs';

describe('DISPLAY map',()=>{
  it('has an entry for every new vertical (not falling back to default)',()=>{
    for (const k of ['roofing','hvac','landscaping','painters']) {
      expect(DISPLAY[k], `DISPLAY.${k}`).toBeDefined();
      expect(DISPLAY[k].s.length).toBeGreaterThan(0);
    }
  });
});

describe('chooseIndustry',()=>{
  it('explicit type text wins and maps to the new verticals, not default',()=>{
    expect(chooseIndustry('roofing company')).toBe('roofing');
    expect(chooseIndustry('HVAC contractor')).toBe('hvac');
  });
  it('falls back to guessing from real fetched html when no type given',()=>{
    expect(chooseIndustry(null, '<h1>ABC Roofing</h1><p>We repair shingles.</p>')).toBe('roofing');
  });
  it('falls back to default with neither type nor html',()=>{
    expect(chooseIndustry(null, null)).toBe('default');
  });
});

describe('chooseColors',()=>{
  it('real captured colors win over the fixed palette when available',()=>{
    const c = chooseColors(DISPLAY.default, null, {primary:'#116dff', accent:'#ff4040', text:'#111', background:'#fff'});
    expect(c.primary).toBe('#116dff');
    expect(c.accent).toBe('#ff4040');
  });
  it('falls back to the industry\'s fixed palette when no real colors were captured (fetch failed/no url)',()=>{
    const c = chooseColors(DISPLAY.plumber, null, null);
    expect(c.primary).toBe('#1d4ed8'); // 'trust' palette, plumber's bucket
  });
  it('--theme override picks a specific fallback palette by name',()=>{
    const c = chooseColors(DISPLAY.plumber, 'lux', null);
    expect(c.primary).toBe('#9d174d');
  });
});

describe('chooseServices',()=>{
  it('real nav-derived service labels win when at least 2 real ones are found',()=>{
    const nav = [{label:'Attic Ventilation'},{label:'Chimney Repairs'},{label:'Flat Roofs'}];
    expect(chooseServices(DISPLAY.roofing, null, nav)).toEqual(['Attic Ventilation','Chimney Repairs','Flat Roofs']);
  });
  it('regression: a phone number rendered as nav text must not be treated as a service (caught on the real repairitroof.com)',()=>{
    const nav = [{label:'314-328-4077'},{label:'Attic Ventilation'},{label:'Chimney Repairs'}];
    const chosen = chooseServices(DISPLAY.roofing, null, nav);
    expect(chosen).not.toContain('314-328-4077');
  });
  it('regression: nav-label variants like "Our Services" (not exact "Services") must still be filtered as utility items',()=>{
    const nav = [{label:'Our Services'},{label:'Pay Invoice'},{label:'More'}];
    // none of these are real service names — too few real ones remain, so falls back to the generic list
    expect(chooseServices(DISPLAY.roofing, null, nav)).toEqual(DISPLAY.roofing.s);
  });
  it('falls back to the generic per-industry list when fewer than 2 real nav labels remain',()=>{
    expect(chooseServices(DISPLAY.plumber, null, [{label:'Home'},{label:'Contact'}])).toEqual(DISPLAY.plumber.s);
  });
  it('explicit services (from a lead\'s own data) win over everything',()=>{
    expect(chooseServices(DISPLAY.plumber, ['Custom A','Custom B'], [{label:'Real 1'},{label:'Real 2'}])).toEqual(['Custom A','Custom B']);
  });
});

describe('renderDemoHtml',()=>{
  it('renders industry-appropriate tagline and service blurbs, not self-referential filler',()=>{
    const html = renderDemoHtml({name:'ABC Roofing', phone:'314-555-0100'}, 'roofing', DISPLAY.roofing, {primary:'#1d4ed8',accent:'#0369a1',ink:'#0f172a',bg:'#fff'}, ['Roof Repair','Storm Damage']);
    expect(html).toContain('Quality roofing, done right');
    expect(html).toContain('Roof Repair — backed by years of local experience.');
    expect(html).not.toContain('About "Roof Repair".'); // the old tautological filler this replaces
  });
});
