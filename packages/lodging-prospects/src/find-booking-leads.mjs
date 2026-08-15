#!/usr/bin/env node
// Lodging Booking-Lead Finder. Usage:
//   find-booking-leads.mjs "<city>" [--types hotel,hostel,cabin,bed-and-breakfast,vacation-rental] [--max N] [--json|--csv] [--skip-site-scan]
//   find-booking-leads.mjs --url "https://site.example" --name "Example Lodge" [--city "Town"]  (single-property check, no key needed)
// Finds bookable lodging, checks booking-platform presence (Airbnb/Vrbo/Booking.com/Expedia/Hotels.com)
// + own-site booking systems, scores HOT/WARM/COOL for the "get you listed where guests search" pitch.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {domMatch,detectSystems,hasBookingLink,scoreLead,slugify} from '../../testing/unit/booking.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const PLATFORMS=JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../data/platforms.json'),'utf8')).platforms;
const TYPES=['hotel','hostel','cabin','bed-and-breakfast','vacation-rental'];
const args=process.argv.slice(2),pos=args.filter(a=>!a.startsWith('--')),loc=pos[0];
const asJson=args.includes('--json'),asCsv=args.includes('--csv'),skipScan=args.includes('--skip-site-scan');
const opt=(k,d=null)=>{const i=args.indexOf('--'+k);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?(args[i+1]||d):d;};
const mi=args.indexOf('--max'),MAX=mi>=0?(parseInt(args[mi+1])||20):20;
const singleUrl=opt('url','').trim(),singleName=opt('name','').trim();
const selTypes=(opt('types','')||'').split(',').map(s=>s.trim()).filter(t=>TYPES.includes(t));
const types=selTypes.length?selTypes:TYPES;
const KEY=process.env.GOOGLE_PLACES_API_KEY||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const host=(u)=>{try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}

async function placesSearch(q){const fm=['places.displayName','places.formattedAddress','places.nationalPhoneNumber','places.websiteUri','places.rating','places.userRatingCount','places.primaryType','places.businessStatus'].join(',');const res=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':KEY,'X-Goog-FieldMask':fm},body:JSON.stringify({textQuery:q,maxResultCount:Math.min(MAX,20)}),signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('Places '+res.status);return (await res.json()).places||[];}

// Keyless web search → array of result URLs (first ~12). Tries DuckDuckGo, falls back to Bing.
async function ddg(q){const res=await fetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'},signal:AbortSignal.timeout(15000)});if(!res.ok)return null;const html=await res.text();const urls=[];const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;let m;while((m=re.exec(html))){let u=m[1].replace('&amp;','&');try{u=decodeURIComponent(u.split('uddg=')[1]?.split('&rut=')[0]??u);}catch{}urls.push(u);}return urls.slice(0,12);}
async function bing(q){const res=await fetch('https://www.bing.com/search?q='+encodeURIComponent(q)+'&count=12',{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36','Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(15000)});if(!res.ok)return null;const html=await res.text();if(!html.includes('b_algo'))return null;const urls=[...html.matchAll(/https?:\/\/(?!r\.bing|th\.bing|www\.bing|www\.w3\.org|schemas\.live\.com)[a-z0-9.-]+\.[a-z]{2,}[^"< )]*/g)].map(x=>x[0]).filter(u=>!u.includes('bing.com')&&!u.includes('w3.org')&&!u.includes('schemas.live.com'));return [...new Set(urls)].slice(0,12);}
async function searchWeb(q){const d=await ddg(q);if(d&&d.length)return d;const b=await bing(q);return b&&b.length?b:[];}

// Check one property against one platform. Returns {found, evidence}.
async function checkPresence(name,platform,placeName){const q=`"${name}" ${platform.label} ${placeName||''}`.trim();const urls=await searchWeb(q);const hit=urls.find(u=>domMatch(host(u),platform.domains));return{platform:platform.id,label:platform.label,found:!!hit,evidence:hit||''};}

// Scan a property's own website for booking links + booking systems.
async function scanOwnSite(url){
  const r={site:url,hasBookingLink:false,systems:[],evidence:[]};
  if(!url)return r;
  let html='';try{const res=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'follow'});if(res.ok)html=await res.text();}catch{return r;}
  const h=html.toLowerCase();
  r.hasBookingLink=hasBookingLink(html);
  for(const n of detectSystems(html)){r.systems.push(n);r.evidence.push(n+' referenced on site');}
  for(const p of PLATFORMS){const re=new RegExp(p.domains.map(d=>d.replace('.','\\.')).join('|'));if(re.test(html)){r.systems.push(p.label+' link');r.evidence.push('Links to '+p.label);r.hasBookingLink=true;}}
  r.systems=[...new Set(r.systems)];r.evidence=[...new Set(r.evidence)].slice(0,6);
  return r;
}

function csvOut(leads){const e=s=>`"${String(s??'').replace(/"/g,'""')}"`;console.log('priority,score,name,type,phone,website,presence,bookingSystems,why');leads.forEach(l=>console.log([l.priority,l.opportunityScore,e(l.name),e(l.type),e(l.phone),e(l.website),e(l.presence.filter(p=>p.found).map(p=>p.label).join('|')),e((l.own.systems||[]).join('|')),e(l.why.join('; '))].join(',')));}

(async()=>{
  let places=[];
  if(singleUrl){places=[{name:singleName||singleUrl,formattedAddress:opt('city',''),nationalPhoneNumber:'',websiteUri:singleUrl,primaryType:'',rating:null,userRatingCount:0,displayName:{text:singleName||singleUrl},businessStatus:'OPERATIONAL'}];}
  else{if(!KEY){console.error('❌ GOOGLE_PLACES_API_KEY not set (.env) — or use --url/--name for a single-property check.');process.exit(1);}if(!loc){console.error('Usage: find-booking-leads.mjs "<city>" [--types hotel,hostel,...] [--max N] [--json|--csv] | --url <site> --name "<name>"');process.exit(1);}}
  const seen=new Set();const leads=[];
  if(!singleUrl){for(const t of types){const label=t==='bed-and-breakfast'?'bed and breakfast':t==='vacation-rental'?'vacation rental':t;let ps=[];try{ps=await placesSearch(`${label} in ${loc}`);}catch(e){console.error('⚠ '+label+': '+e.message);}for(const p of ps){const n=p.displayName?.text||'';if(!n||(p.businessStatus&&p.businessStatus!=='OPERATIONAL')||seen.has(n.toLowerCase()))continue;seen.add(n.toLowerCase());places.push(p);}}}
  for(const p of places){
    const name=p.displayName?.text||singleName||'';if(!name)continue;
    const own=skipScan?{site:p.websiteUri||'',hasBookingLink:false,systems:[],evidence:[]}:await scanOwnSite(p.websiteUri);
    const presence=[];for(const pl of PLATFORMS){const chk=await checkPresence(name,pl,loc||opt('city',''));presence.push(chk);await sleep(500);}
    const sc=scoreLead(presence,own,p.userRatingCount||0,p.rating||null,p.websiteUri||'');
    leads.push({name,phone:p.nationalPhoneNumber||'',address:p.formattedAddress||'',website:p.websiteUri||'',rating:p.rating??null,reviews:p.userRatingCount??0,type:p.primaryType||'',own,presence,...sc});
    console.error(`· ${sc.priority} ${sc.opportunityScore} ${name} — ${presence.filter(x=>x.found).length}/5 platforms`);
  }
  leads.sort((a,b)=>b.opportunityScore-a.opportunityScore);
  if(!leads.length){console.log('No leads found.');process.exit(0);}
  if(asJson){console.log(JSON.stringify({city:loc||singleName,count:leads.length,leads},null,2));return;}
  if(asCsv){csvOut(leads);return;}
  console.log(`\n🏨 "${loc||singleName}" → ${leads.length} bookable properties\n`);
  leads.forEach((l,i)=>{const t=l.priority==='HOT'?'🔥 HOT':l.priority==='WARM'?'☀️  WARM':'❄️  COOL';console.log(`${String(i+1).padStart(2)}. [${t}] ${l.name} (${l.opportunityScore}/100)\n     ${l.phone||'no phone'} · ${l.website||'NO WEBSITE'} · ⭐${l.rating??'—'} (${l.reviews})\n     Presence: ${l.presence.filter(p=>p.found).map(p=>p.label).join(', ')||'none'} · Systems: ${(l.own.systems||[]).join(', ')||'—'} · Direct booking: ${l.own.hasBookingLink?'yes':'no'}\n     ${l.why.join(' · ')}\n`);});
  console.log('Tip: pitch “get listed where guests already search” on HOT/WARM leads → /propose-lodging. Verify evidence before outreach.');
  const citySlug=slugify(loc||singleName);
  const outDir=resolve(ROOT,'lodging-prospects/out');mkdirSync(outDir,{recursive:true});
  writeFileSync(resolve(outDir,citySlug+'.json'),JSON.stringify({city:loc||singleName,count:leads.length,leads},null,2));
  const mdDir=resolve(ROOT,'memory/leads');mkdirSync(mdDir,{recursive:true});
  const md='# Lodging leads — '+(loc||singleName)+' · '+new Date().toISOString().slice(0,10)+'\n\n| Priority | Score | Property | Phone | Website | Platforms | Booking system | Why |\n|---|---|---|---|---|---|---|---|\n'+leads.map(l=>`| ${l.priority} | ${l.opportunityScore} | ${esc(l.name)} | ${esc(l.phone||'—')} | ${esc(l.website||'—')} | ${l.presence.filter(p=>p.found).map(p=>p.label).join(', ')||'none'} | ${esc((l.own.systems||[]).join(', ')||'—')} | ${esc(l.why.join('; '))} |`).join('\n')+'\n\n_Verify before outreach. Booking platforms: '+PLATFORMS.map(p=>p.label).join(', ')+'._\n';
  writeFileSync(resolve(mdDir,'lodging-'+citySlug+'.md'),md);
  console.log('Wrote JSON → '+resolve(outDir,citySlug+'.json')+' and leads → memory/leads/lodging-'+citySlug+'.md');
})().catch(e=>{console.error('failed:',e.message);process.exit(1);});
