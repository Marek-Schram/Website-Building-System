import {describe,it,expect} from 'vitest';
import {slugify,domMatch,presenceHit,detectSystems,hasBookingLink,scoreLead,platformLabels} from './booking.mjs';

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
  it('HOT when no presence + no own booking',()=>{const r=scoreLead([{found:false}],{hasBookingLink:false},20,4.6,'https://x.com');expect(r.priority).toBe('HOT');expect(r.opportunityScore).toBeGreaterThanOrEqual(70);});
  it('WARM on 2 platforms',()=>expect(scoreLead([{found:true},{found:true}],{hasBookingLink:true},0,null,'https://x.com').priority).toBe('WARM'));
  it('COOL on many platforms + own booking',()=>{const r=scoreLead([{found:true},{found:true},{found:true}],{hasBookingLink:true},0,null,'https://x.com');expect(r.priority).toBe('COOL');});
  it('reviews add points',()=>{expect(scoreLead([{found:false}],{hasBookingLink:false},50,4.6,'https://x.com').opportunityScore).toBeGreaterThan(scoreLead([{found:false}],{hasBookingLink:false},0,null,'https://x.com').opportunityScore);});
});

describe('platformLabels',()=>it('maps',()=>{expect(platformLabels('airbnb,vrbo')).toEqual(['Airbnb','Vrbo']);}));
