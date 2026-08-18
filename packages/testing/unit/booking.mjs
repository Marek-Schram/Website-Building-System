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

// Opportunity scoring shared by the proposal flow.
export function scoreLead(presence,own,reviews,rating,website){
  const present=(presence||[]).filter(p=>p&&p.found).length;let s=0;const why=[];
  if(present===0){s+=50;why.push('No booking-platform presence');}
  else if(present<=2){s+=25;why.push('Only '+present+'/5 platforms');}
  else{s+=10;why.push('On '+present+'/5 platforms');}
  if(own&&own.hasBookingLink){s+=10;why.push('Has own-site booking');}else{s+=20;why.push('No direct booking on own site');}
  if(!website){s+=15;why.push('No website');}
  if(reviews>=25){s+=15;why.push(reviews+' reviews');}else if(reviews>=5)s+=8;
  if(rating>=4)s+=5;
  const os=Math.min(s,100);return{opportunityScore:os,priority:os>=55?'HOT':os>=35?'WARM':'COOL',why};
}

const PLATFORM_LABEL={airbnb:'Airbnb',vrbo:'Vrbo','booking.com':'Booking.com',expedia:'Expedia','hotels.com':'Hotels.com'};
export function platformLabels(raw){return String(raw||'airbnb,vrbo').split(',').map(s=>s.trim()).filter(Boolean).map(p=>PLATFORM_LABEL[p]||p);}

// How much traffic being missing from a given platform costs — used to severity-tag opportunity findings.
const HIGH_TRAFFIC_PLATFORMS=new Set(['airbnb','vrbo','booking.com']);
export function platformSeverity(platformId){return HIGH_TRAFFIC_PLATFORMS.has(platformId)?'high':'medium';}
