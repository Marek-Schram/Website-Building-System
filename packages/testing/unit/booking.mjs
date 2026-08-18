// Shared pure logic for the lodging/booking pipeline (tested in booking.test.mjs).
export function slugify(s){return String(s||'prospect').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);}

// Does a hostname belong to one of the platform's domains? (case-insensitive, www-stripped)
export function domMatch(host, domains){const h=(host||'').toLowerCase().replace(/^www\./,'');return domains.some(d=>h===d||h.endsWith('.'+d));}

// Presence hit: first URL whose host matches a platform domain.
export function presenceHit(urls, domains){return urls.find(u=>{try{return domMatch(new URL(u).hostname,domains);}catch{return false;}})||null;}

// Booking-system detection from a site's HTML + its own domain.
const SYSTEMS=[['Cloudbeds',/cloudbeds|myallocator/i],['Lodgify',/lodgify/i],['Freetobook',/freetobook/i],['SiteMinder',/siteminder/i],['Little Hotelier',/littlehotelier/i],['Hostaway',/hostaway/i],['Guesty',/guesty/i],['Checkfront',/checkfront/i],['Booking Kit',/bookingkit|secu-rez|rezstream/i],['ResNexus',/resnexus/i],['Bookeo',/bookeo/i],['RegiFox',/regifox/i],['TravelClick',/travelclick|synxis/i]];
export function detectSystems(html){const h=(html||'').toLowerCase();const out=[];for(const[n,re]of SYSTEMS)if(re.test(h))out.push(n);return out;}
export function hasBookingLink(html){return /(book now|book here|reserve|check availability|book your stay|availability\b)/i.test(html||'');}

// Major hotel-chain detection — this business (get a small/independent property listed on Airbnb, Vrbo,
// Booking.com etc.) isn't a realistic pitch for a national chain: they're already distributed everywhere,
// run their own enterprise booking engines (which don't match the small-business SYSTEMS list above, so
// they'd otherwise misleadingly score HOT), and aren't a plausible $50-150 client. Match on brand name
// (covers all locations regardless of franchisee domain) OR the corporate booking domain (covers cases
// the name alone misses, e.g. a property whose Google Places name doesn't include the brand). Not
// exhaustive — extend these lists as new chains show up in scans; a miss just means a chain slips through
// (same as before this filter existed), not a false exclusion of an independent property.
const CHAIN_BRAND_RE=new RegExp('\\b('+[
  'Marriott','JW Marriott','Ritz-Carlton','Ritz Carlton','W Hotels?','Westin','Sheraton','Le Meridien',
  'Renaissance Hotel','Autograph Collection','Delta Hotels','Gaylord','Courtyard(?: by Marriott)?',
  'Fairfield Inn','SpringHill Suites','Residence Inn','TownePlace Suites','Four Points','Aloft',
  'AC Hotel','Moxy',
  'Hilton','DoubleTree','Embassy Suites','Hampton Inn','Hampton by Hilton','Homewood Suites','Home2 Suites',
  'Tru by Hilton','Canopy by Hilton','Curio Collection','Tapestry Collection','Conrad','Waldorf Astoria',
  'InterContinental','Holiday Inn(?: Express)?','Crowne Plaza','Candlewood Suites','Staybridge Suites',
  'Kimpton','Hotel Indigo','avid hotels','EVEN Hotels',
  'Comfort Inn','Comfort Suites','Quality Inn','Sleep Inn','Clarion','Cambria Hotel','MainStay Suites',
  'Suburban Studios','Econo Lodge','Rodeway Inn','WoodSpring Suites','Ascend Hotel Collection',
  'Wyndham','Days Inn','Super 8','Ramada','Howard Johnson','Travelodge','La Quinta','Microtel',
  'Hawthorn Suites','Baymont','Wingate','AmericInn',
  'Best Western(?: Plus| Premier)?','SureStay','Motel 6','Studio 6','Red Roof','Extended Stay America',
  'Radisson(?: Blu| Red)?','Country Inn(?: & | and )?Suites','Park (?:Inn|Plaza) by Radisson',
  'Drury(?: Inn| Plaza| Hotel)?','Omni Hotels?','Four Seasons','Fairmont','Loews Hotels?',
  'Hyatt(?: Regency| Place| House| Centric)?','Grand Hyatt','Park Hyatt','Andaz','Alila','Thompson Hotels?',
  'Sofitel','Novotel','ibis(?: Styles| Budget)?','Mercure','Pullman','Raffles','Swissotel','Grand Mercure',
  'Caesars(?: Rewards| Entertainment| Palace)?','Wynn','MGM Grand','Bellagio',
  // "Park Inn"/"Park Plaza" WITHOUT the "by Radisson" qualifier are deliberately excluded — too generic,
  // collided with an independent "Benton Park Inn" during testing (2026-08-18).
].join('|')+')\\b','i');
const CHAIN_DOMAINS=['marriott.com','hilton.com','hyatt.com','world.hyatt.com','ihg.com','holidayinn.com','crowneplaza.com','wyndhamhotels.com','choicehotels.com','bestwestern.com','radissonhotels.com','redroof.com','motel6.com','g6hospitality.com','extendedstayamerica.com','druryhotels.com','omnihotels.com','fourseasons.com','ritzcarlton.com','sheraton.com','westin.com','starwoodhotels.com','fairmont.com','loewshotels.com'];
export function isChainProperty(name,website){
  if(CHAIN_BRAND_RE.test(String(name||'')))return true;
  if(website){try{const h=new URL(website).hostname.toLowerCase().replace(/^www\./,'');if(CHAIN_DOMAINS.some(d=>h===d||h.endsWith('.'+d)))return true;}catch{}}
  return false;
}

// Opportunity scoring shared by the proposal flow. Deliberately does NOT factor in keyless
// booking-platform-presence search results: verified 2026-08-18 that scraping Bing/DuckDuckGo result
// pages for "is this property on Airbnb/Booking.com/etc" produces mostly false negatives (Bing wraps
// real results in undocumented tracking redirects; a "not found" from our scraper means "our scraper
// couldn't confirm it," not "it's actually absent" — see memory/lessons-learned.md for the investigation).
// Scoring instead uses only signals fetched directly and reliably: the property's OWN site (does it
// exist, does it have a booking link, does it run a real booking system) and Google Places data
// (review count/rating). Presence-check results are still surfaced to the user as unscored, clearly
// labeled "unverified" evidence — see find-booking-leads.mjs / lodging-opportunities.mjs.
export function scoreLead(own,reviews,rating,website){
  let s=0;const why=[];
  if(!website){
    s+=35;why.push('No website');
  } else {
    if(own&&own.hasBookingLink){why.push('Has own-site booking');}else{s+=25;why.push('No direct booking on own site');}
    if(own&&own.systems&&own.systems.length){why.push('Runs '+own.systems.join('/'));}else{s+=15;why.push('No booking-management system detected');}
  }
  if(reviews>=25){s+=15;why.push(reviews+' reviews');}else if(reviews>=5)s+=8;
  if(rating>=4)s+=5;
  const os=Math.min(s,100);return{opportunityScore:os,priority:os>=35?'HOT':os>=15?'WARM':'COOL',why};
}

const PLATFORM_LABEL={airbnb:'Airbnb',vrbo:'Vrbo','booking.com':'Booking.com',expedia:'Expedia','hotels.com':'Hotels.com'};
export function platformLabels(raw){return String(raw||'airbnb,vrbo').split(',').map(s=>s.trim()).filter(Boolean).map(p=>PLATFORM_LABEL[p]||p);}

// How much traffic being missing from a given platform costs — used to severity-tag opportunity findings.
const HIGH_TRAFFIC_PLATFORMS=new Set(['airbnb','vrbo','booking.com']);
export function platformSeverity(platformId){return HIGH_TRAFFIC_PLATFORMS.has(platformId)?'high':'medium';}
