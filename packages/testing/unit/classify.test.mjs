import {describe,it,expect} from 'vitest';
import {guessIndustry,SHOULD_HAVE,detectFeatures} from '../../opportunities/src/classify.mjs';

describe('guessIndustry',()=>{
  it('classifies the new verticals correctly instead of falling to default',()=>{
    expect(guessIndustry('<h1>ABC Roofing</h1><p>We repair shingles and gutters after storm damage.</p>')).toBe('roofing');
    expect(guessIndustry('<h1>Cool Air HVAC</h1><p>Furnace and air conditioning repair, heating and cooling service.</p>')).toBe('hvac');
    expect(guessIndustry('<h1>Green Lawns</h1><p>Landscaping, lawn care, and lawn mowing services.</p>')).toBe('landscaping');
    expect(guessIndustry('<h1>Bright Coat Painters</h1><p>Interior painting and exterior painting for your home.</p>')).toBe('painters');
  });
  it('regression: the exact real-world case that motivated this fix (roofing used to fall to default)',()=>{
    expect(guessIndustry('<title>Repair It Roofing</title><h1>Repair It Roofing</h1><p>Attic ventilation, chimney repairs, gutter repairs, roof leak repair.</p>')).toBe('roofing');
  });
  it('regression: a <style> block CSS custom property containing "menu" must not leak into classification text at all (caught on the real repairitroof.com — a roofing site, not a restaurant)',()=>{
    const html = '<title>Repair It Roofing</title><style>.h5oxms .nzoivf{direction:var(--menu-direction)}</style><h1>Repair It Roofing</h1><p>Attic ventilation, chimney repairs, gutter repairs.</p>';
    expect(guessIndustry(html)).toBe('roofing');
  });
  it('regression: bare "menu" is not a restaurant signal at all — confirmed ambiguous between "food menu" and "nav menu" on real data (Wix\'s own generic a11y boilerplate "navigate through the menu items" false-positived a roofing site even after excluding <style>/<script> content)',()=>{
    expect(guessIndustry('<h1>Repair It Roofing</h1><p>Use tab to navigate through the menu items. We repair roofs.</p>')).not.toBe('restaurant');
  });
  it('a real restaurant signal (not bare "menu") still correctly triggers restaurant',()=>{
    expect(guessIndustry('<h1>Joe\'s Place</h1><p>Now taking reservations for dine-in, entrees start at $12.</p>')).toBe('restaurant');
  });
  it('an override always wins regardless of content',()=>expect(guessIndustry('<h1>Anything</h1>','painters')).toBe('painters'));
  it('unrecognized content still falls back to default',()=>expect(guessIndustry('<h1>Generic Co</h1><p>We do things.</p>')).toBe('default'));
  it('does not regress already-working categories',()=>{
    expect(guessIndustry('<h1>Joe\'s Diner</h1><p>Best entrees and appetizers in town, reservations welcome.</p>')).toBe('restaurant');
    expect(guessIndustry('<h1>Glow Salon</h1><p>Hair, balayage, and blowouts.</p>')).toBe('salon');
    expect(guessIndustry('<h1>Smith & Associates</h1><p>Attorney at law, legal representation.</p>')).toBe('lawyer');
    expect(guessIndustry('<h1>Iron Gym</h1><p>Fitness classes, personal training, crossfit.</p>')).toBe('gym');
  });
});

describe('SHOULD_HAVE',()=>{
  it('has a real entry for every new vertical, not just default',()=>{
    for (const industry of ['roofing','hvac','landscaping','painters']) {
      expect(SHOULD_HAVE[industry], `SHOULD_HAVE.${industry}`).toBeDefined();
      expect(SHOULD_HAVE[industry].length).toBeGreaterThan(0);
    }
  });
  it('every should-have feature id is one detectFeatures() can actually flag',()=>{
    const detectable = new Set(['contact-form','click-to-call','map','social','online-ordering','reservations','booking','menu','store','payments','newsletter','whatsapp','live-chat','gallery','faq','reviews']);
    for (const [industry, entries] of Object.entries(SHOULD_HAVE)) {
      for (const [feat] of entries) expect(detectable.has(feat), `${industry} → ${feat}`).toBe(true);
    }
  });
});

describe('detectFeatures',()=>{
  it('detects a real gallery+reviews+contact-form combo',()=>{
    const html = '<form>...</form><img src="a.jpg"><img src="b.jpg"><img src="c.jpg"><img src="d.jpg"><img src="e.jpg"><img src="f.jpg"><div>Customer reviews ★★★★★</div>';
    const f = detectFeatures(html);
    expect(f.has('contact-form')).toBe(true);
    expect(f.has('gallery')).toBe(true);
    expect(f.has('reviews')).toBe(true);
    expect(f.has('booking')).toBe(false);
  });
});
