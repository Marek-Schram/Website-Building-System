import {describe,it,expect} from 'vitest';
import {slugify,domMatch,presenceHit,detectSystems,hasBookingLink,scoreLead,platformLabels,platformSeverity,isChainProperty} from './booking.mjs';

describe('slugify',()=>it('kebab',()=>{expect(slugify("Dollywood DreamMore Resort")).toBe('dollywood-dreammore-resort');}));

describe('domMatch',()=>{
  it('exact + subdomain',()=>{expect(domMatch('airbnb.com',['airbnb.com'])).toBe(true);expect(domMatch('www.airbnb.com',['airbnb.com'])).toBe(true);expect(domMatch('x.airbnb.com',['airbnb.com'])).toBe(true);});
  it('rejects lookalikes',()=>{expect(domMatch('notairbnb.com',['airbnb.com'])).toBe(false);expect(domMatch('booking.com.evil.com',['booking.com'])).toBe(false);});
});

describe('presenceHit',()=>{
  it('finds platform link',()=>{const u='https://www.booking.com/hotel/us/x.html';expect(presenceHit([u],['booking.com'])).toBe(u);});
  it('null when absent',()=>expect(presenceHit(['https://example.com'],['booking.com'])).toBeNull());
});

describe('detectSystems',()=>{
  it('detects known engines',()=>{const hit=detectSystems('<html>Powered by Cloudbeds booking engine</html>');expect(hit).toContain('Cloudbeds');});
  it('detects none',()=>expect(detectSystems('<html>plain static site</html>')).toEqual([]));
});

describe('hasBookingLink',()=>{
  it('detects book now',()=>expect(hasBookingLink('<a>Book Now</a>')).toBe(true));
  it('misses plain',()=>expect(hasBookingLink('<p>hello</p>')).toBe(false));
});

describe('scoreLead',()=>{
  it('HOT with no website at all',()=>{const r=scoreLead(null,20,4.6,'');expect(r.priority).toBe('HOT');expect(r.why).toContain('No website');});
  it('HOT with a website but no booking + no system',()=>{const r=scoreLead({hasBookingLink:false,systems:[]},0,null,'https://x.com');expect(r.priority).toBe('HOT');});
  it('WARM with booking but no system detected',()=>{const r=scoreLead({hasBookingLink:true,systems:[]},0,null,'https://x.com');expect(r.priority).toBe('WARM');});
  it('COOL when booking + a real system are both present',()=>{const r=scoreLead({hasBookingLink:true,systems:['Cloudbeds']},0,null,'https://x.com');expect(r.priority).toBe('COOL');expect(r.opportunityScore).toBe(0);});
  it('reviews add points on top of the base signal',()=>{expect(scoreLead({hasBookingLink:false,systems:[]},50,4.6,'https://x.com').opportunityScore).toBeGreaterThan(scoreLead({hasBookingLink:false,systems:[]},0,null,'https://x.com').opportunityScore);});
  it('never factors in platform-presence search results (not a scoreLead parameter at all)',()=>{expect(scoreLead.length).toBe(4);});
});

describe('platformLabels',()=>it('maps',()=>{expect(platformLabels('airbnb,vrbo')).toEqual(['Airbnb','Vrbo']);}));

describe('platformSeverity',()=>{
  it('high-traffic platforms are high severity',()=>{expect(platformSeverity('airbnb')).toBe('high');expect(platformSeverity('vrbo')).toBe('high');expect(platformSeverity('booking.com')).toBe('high');});
  it('smaller platforms are medium severity',()=>{expect(platformSeverity('expedia')).toBe('medium');expect(platformSeverity('hotels.com')).toBe('medium');});
});

describe('isChainProperty',()=>{
  it('detects national chains by name (real St. Louis scan examples)',()=>{
    expect(isChainProperty('Hyatt Regency St. Louis at The Arch','')).toBe(true);
    expect(isChainProperty('Hilton St. Louis at the Ballpark','')).toBe(true);
    expect(isChainProperty('The Westin St. Louis','')).toBe(true);
    expect(isChainProperty('Hampton Inn St. Louis-Downtown (At the Gateway Arch)','')).toBe(true);
    expect(isChainProperty('Drury Plaza Hotel St. Louis At The Arch','')).toBe(true);
    expect(isChainProperty('Home2 Suites By Hilton St. Louis Downtown','')).toBe(true);
  });
  it('does not flag independent properties (real St. Louis scan examples)',()=>{
    expect(isChainProperty('Tuxedo Park STL Bed & Breakfast Inn','https://tuxedoparkstl.com/')).toBe(false);
    expect(isChainProperty('Gothic Heights Inn','https://gothicheightsinn.com/')).toBe(false);
    expect(isChainProperty('Hidden Gem Bed & Breakfast','http://www.hiddengembedandbreakfast.com/')).toBe(false);
    expect(isChainProperty('The Treehouse Cabin','https://www.treehousecabin.com')).toBe(false);
  });
  it('catches a chain by corporate domain even if the name alone would not match',()=>{
    expect(isChainProperty('Downtown Riverfront Lodge','https://www.marriott.com/en-us/hotels/stlmc-some-hotel/overview/')).toBe(true);
  });
  it('does not false-positive on generic words that are substrings of brand names',()=>{
    expect(isChainProperty('Sunset Ridge Comfort Cottage','https://sunsetridgecottage.example.com')).toBe(false);
  });
  it('does not false-positive on "Park Inn" as a place name, not the Radisson sub-brand (caught in real St. Louis data)',()=>{
    expect(isChainProperty('Benton Park Inn','')).toBe(false);
  });
  it('catches a casino-loyalty-branded property even without a classic hotel-chain word (caught in real St. Louis data)',()=>{
    expect(isChainProperty('HoteLumière at the Arch - A Caesars Rewards Destination','')).toBe(true);
  });
});
