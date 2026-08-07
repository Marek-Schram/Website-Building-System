#!/usr/bin/env node
// Human-Like Functional Tester (zero-dep). Usage: human-test.mjs <html-or-url> [--json]
import {readFileSync,existsSync} from 'node:fs';
const args=process.argv.slice(2),target=args.find(a=>!a.startsWith('--')),asJson=args.includes('--json');
if(!target){console.error('Usage: human-test.mjs <html-or-url> [--json]');process.exit(2);}
const R=[],add=(l,a,m)=>R.push({level:l,area:a,msg:m});
async function load(t){if(/^https?:\/\//i.test(t)){const res=await fetch(t,{redirect:'follow',signal:AbortSignal.timeout(15000)});return{html:await res.text(),status:res.status};}if(!existsSync(t)){console.error('Not found: '+t);process.exit(2);}return{html:readFileSync(t,'utf8'),status:200};}
const attr=(t,n)=>{const m=t.match(new RegExp(n+'\\s*=\\s*"([^"]*)"','i'));return m?m[1]:null;},tags=(h,t)=>h.match(new RegExp(`<${t}\\b[^>]*>`,'gi'))||[],btw=(h,t)=>{const m=h.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`,'i'));return m?m[1]:null;},all=(h,t)=>[...h.matchAll(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`,'gi'))].map(m=>m[1]),strip=s=>(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
(async()=>{const{html,status}=await load(target);
add(status<400?'pass':'fail','load',status<400?`Loaded (HTTP ${status}).`:`HTTP ${status}.`);
const title=strip(btw(html,'title'));add(title?'pass':'fail','seo',title?`Title ("${title.slice(0,50)}").`:'No <title>.');
add(/name\s*=\s*"description"[^>]*content\s*=\s*"[^"]+"/i.test(html)?'pass':'warn','seo',/description/i.test(html)?'Meta description.':'No meta description.');
const h1=all(html,'h1').map(strip).filter(Boolean);add(h1.length===1?'pass':h1.length===0?'fail':'warn','content',h1.length===1?`One headline.`:h1.length===0?'No <h1>.':`${h1.length} <h1>s.`);
add(/name\s*=\s*"viewport"/i.test(html)?'pass':'fail','mobile',/viewport/i.test(html)?'Viewport.':'No viewport meta.');
const anc=[...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)],ids=new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/gi)].map(m=>m[1]));let empty=0,dead=0,bad=[],notext=0;for(const a of anc){const o=a[0].match(/<a\b[^>]*>/i)[0],href=attr(o,'href'),txt=strip(a[1]);if(href===null||href.trim()==='')empty++;else if(href.trim()==='#')dead++;else if(href.startsWith('#')){const id=href.slice(1);if(id&&!ids.has(id))bad.push(href);}if(!txt&&!/aria-label/i.test(o))notext++;}
add(anc.length>0?'pass':'warn','nav',`${anc.length} link(s).`);if(empty)add('fail','nav',`${empty} empty href.`);if(dead)add('warn','nav',`${dead} point to "#".`);if(bad.length)add('fail','nav',`Anchor no target: ${bad.slice(0,5).join(', ')}.`);if(notext)add('fail','a11y',`${notext} link(s) no text/aria.`);
const tel=/href\s*=\s*"tel:/i.test(html),mail=/href\s*=\s*"mailto:/i.test(html),form=/<form\b/i.test(html);add(tel||mail||form?'pass':'fail','contact',tel||mail||form?`Reachable: ${[tel&&'phone',mail&&'email',form&&'form'].filter(Boolean).join(', ')}.`:'No contact method.');
const imgs=tags(html,'img'),noAlt=imgs.filter(t=>attr(t,'alt')===null);add(imgs.length===0||noAlt.length===0?'pass':'fail','a11y',imgs.length===0?'No images.':noAlt.length===0?`All ${imgs.length} img alt.`:`${noAlt.length}/${imgs.length} img no alt.`);
const body=strip(btw(html,'body')||html).toLowerCase(),ph=['lorem ipsum','replace ','your business name'].filter(p=>body.includes(p));add(ph.length?'warn':'pass','content',ph.length?`Placeholder: ${[...new Set(ph)].join(', ')}.`:'No placeholder.');
add(/<html[^>]+lang\s*=/i.test(html)?'pass':'warn','a11y',/lang\s*=/i.test(html)?'Has lang.':'No lang.');
const f=R.filter(r=>r.level==='fail'),w=R.filter(r=>r.level==='warn'),p=R.filter(r=>r.level==='pass');
if(asJson)console.log(JSON.stringify({target,summary:{pass:p.length,warn:w.length,fail:f.length},results:R},null,2));else{const ic=l=>l==='pass'?'✅':l==='warn'?'⚠️ ':'❌';console.log(`\n🧑‍💻 Human-Like Test — ${target}\n`);R.forEach(r=>console.log(`  ${ic(r.level)} [${r.area}] ${r.msg}`));console.log(`\n  Summary: ${p.length} passed · ${w.length} warnings · ${f.length} failed`);console.log(f.length?`  ❌ ${f.length} issue(s).`:w.length?`  ⚠️  ${w.length} to polish.`:'  🎉 Everything works.');console.log('');}
process.exit(f.length?1:0);})().catch(e=>{console.error('failed:',e.message);process.exit(2);});
