#!/usr/bin/env node
// Lodging Booking-Lead Finder. Usage:
//   find-booking-leads.mjs "<city>" [--types hotel,hostel,cabin,bed-and-breakfast,vacation-rental] [--max N] [--json|--csv] [--skip-site-scan]
//   find-booking-leads.mjs --url "https://site.example" --name "Example Lodge" [--city "Town"]  (single-property check, no key needed)
// Finds bookable lodging, checks booking-platform presence (Airbnb/Vrbo/Booking.com/Expedia/Hotels.com)
// + own-site booking systems, scores HOT/WARM/COOL for the "get you listed where guests search" pitch.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {scoreLead,slugify} from '../../testing/unit/booking.mjs';
import {checkPresence,scanOwnSite} from './scan.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const PLATFORMS=JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../data/platforms.json'),'utf8')).platforms;
const TYPES=['hotel','hostel','cabin','bed-and-breakfast','vacation-rental'];
// loc = the leading positional arg (city), if present. NOT args.filter(!startsWith('--'))[0] — in the
// keyless single-property mode (--url/--name/--city, no positional at all) that would grab whichever
// flag's VALUE happens to come first in argv (e.g. the --url) and mislabel every output as that URL.
const args=process.argv.slice(2),loc=(args[0]&&!args[0].startsWith('--'))?args[0]:undefined;
const asJson=args.includes('--json'),asCsv=args.includes('--csv'),skipScan=args.includes('--skip-site-scan');
const opt=(k,d=null)=>{const i=args.indexOf('--'+k);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?(args[i+1]||d):d;};
const mi=args.indexOf('--max'),MAX=mi>=0?(parseInt(args[mi+1])||20):20;
const singleUrl=opt('url','').trim(),singleName=opt('name','').trim();
const selTypes=(opt('types','')||'').split(',').map(s=>s.trim()).filter(t=>TYPES.includes(t));
const types=selTypes.length?selTypes:TYPES;
const KEY=process.env.GOOGLE_PLACES_API_KEY||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

async function placesSearch(q){const fm=['places.displayName','places.formattedAddress','places.nationalPhoneNumber','places.websiteUri','places.rating','places.userRatingCount','places.primaryType','places.businessStatus'].join(',');const res=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':KEY,'X-Goog-FieldMask':fm},body:JSON.stringify({textQuery:q,maxResultCount:Math.min(MAX,20)}),signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('Places '+res.status);return (await res.json()).places||[];}

function csvOut(leads){const e=s=>`"${String(s??'').replace(/"/g,'""')}"`;console.log('priority,score,name,type,phone,website,presence,bookingSystems,why');leads.forEach(l=>console.log([l.priority,l.opportunityScore,e(l.name),e(l.type),e(l.phone),e(l.website),e(l.presence.filter(p=>p.found).map(p=>p.label).join('|')),e((l.own.systems||[]).join('|')),e(l.why.join('; '))].join(',')));}

(async()=>{
  let places=[];
  if(singleUrl){places=[{name:singleName||singleUrl,formattedAddress:opt('city',''),nationalPhoneNumber:'',websiteUri:singleUrl,primaryType:'',rating:null,userRatingCount:0,displayName:{text:singleName||singleUrl},businessStatus:'OPERATIONAL'}];}
  else{if(!KEY){console.error('❌ GOOGLE_PLACES_API_KEY not set (.env) — or use --url/--name for a single-property check.');process.exit(1);}if(!loc){console.error('Usage: find-booking-leads.mjs "<city>" [--types hotel,hostel,...] [--max N] [--json|--csv] | --url <site> --name "<name>"');process.exit(1);}}
  const seen=new Set();const leads=[];
  if(!singleUrl){for(const t of types){const label=t==='bed-and-breakfast'?'bed and breakfast':t==='vacation-rental'?'vacation rental':t;let ps=[];try{ps=await placesSearch(`${label} in ${loc}`);}catch(e){console.error('⚠ '+label+': '+e.message);}for(const p of ps){const n=p.displayName?.text||'';if(!n||(p.businessStatus&&p.businessStatus!=='OPERATIONAL')||seen.has(n.toLowerCase()))continue;seen.add(n.toLowerCase());places.push(p);}}}
  for(const p of places){
    const name=p.displayName?.text||singleName||'';if(!name)continue;
    const own=skipScan?{site:p.websiteUri||'',hasBookingLink:false,systems:[],evidence:[]}:await scanOwnSite(p.websiteUri,PLATFORMS);
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
