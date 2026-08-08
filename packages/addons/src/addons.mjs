#!/usr/bin/env node
// Add-Ons Generator. Usage: addons.mjs list|recommend|make ...  See docs/ADDONS.md
// Also importable as a library (CAT, S, STYLE, REC, applyAddon) — e.g. by packages/site-builder — with
// zero CLI side effects on import (dispatch below is guarded to run only when executed directly).
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const av=process.argv.slice(2),cmd=av[0],opt=(k,d=null)=>{const i=av.indexOf('--'+k);return i>=0&&av[i+1]&&!av[i+1].startsWith('--')?av[i+1]:d;},esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const CAT=[{id:'contact-form',name:'Contact / Quote Form',type:'native',ind:['all']},{id:'map',name:'Google Map',type:'native',ind:['all']},{id:'hours',name:'Business Hours',type:'native',ind:['all']},{id:'reviews',name:'Reviews',type:'native',ind:['all']},{id:'gallery',name:'Photo Gallery',type:'native',ind:['all']},{id:'faq',name:'FAQ',type:'native',ind:['all']},{id:'social',name:'Social Links',type:'native',ind:['all']},{id:'click-to-call',name:'Sticky Click-to-Call',type:'native',ind:['all']},{id:'menu',name:'HTML Menu',type:'native',ind:['restaurant','cafe','bakery']},{id:'online-ordering',name:'Online Ordering',type:'embed',ind:['restaurant','cafe','bakery'],config:['provider','url']},{id:'reservations',name:'Reservations',type:'embed',ind:['restaurant'],config:['provider','url']},{id:'booking',name:'Appointment Booking',type:'embed',ind:['salon','barber','dentist','gym','cleaning','lawyer','autorepair'],config:['provider','url']},{id:'newsletter',name:'Newsletter',type:'embed',ind:['all'],config:['action']},{id:'whatsapp',name:'WhatsApp Chat',type:'embed',ind:['all'],config:['phone']},{id:'live-chat',name:'Live Chat',type:'embed',ind:['all'],config:['script']},{id:'payments',name:'Payments',type:'embed',ind:['all','retail'],config:['provider','url']},{id:'store',name:'Product Store',type:'embed',ind:['retail'],config:['key']},{id:'chatbot',name:'AI / FAQ Chatbot',type:'native',ind:['all'],config:['faq (optional)','aiEndpoint (optional, Cloudflare Workers AI)']}];
const S={
'contact-form':o=>`\n<section id="contact-form" class="sw-addon"><h2>Get In Touch</h2><form class="sw-form" method="POST" action="${esc(o.action||'#')}"><input name="name" placeholder="Name" required aria-label="Name"><input type="email" name="email" placeholder="you@example.com" required aria-label="Email"><textarea name="message" rows="4" placeholder="How can we help?" required aria-label="Message"></textarea><input type="text" name="_gotcha" style="display:none" tabindex="-1"><button type="submit">Send</button></form></section>`,
'map':o=>`\n<section id="map" class="sw-addon"><h2>Find Us</h2><iframe title="Map" width="100%" height="320" style="border:0;border-radius:.6rem" loading="lazy" src="https://www.google.com/maps?q=${encodeURIComponent(o.address||o.name||'')}&output=embed"></iframe></section>`,
'hours':o=>`\n<section id="hours" class="sw-addon"><h2>Hours</h2><table class="sw-hours"><tr><td>Mon–Fri</td><td>${esc(o.weekday||'9–5')}</td></tr><tr><td>Sat</td><td>${esc(o.saturday||'10–2')}</td></tr><tr><td>Sun</td><td>Closed</td></tr></table></section>`,
'reviews':o=>`\n<section id="reviews" class="sw-addon"><h2>What Customers Say</h2><div class="sw-grid"><blockquote class="sw-card"><p>“Best in town.”</p><cite>★★★★★</cite></blockquote><blockquote class="sw-card"><p>“Professional and fair.”</p><cite>★★★★★</cite></blockquote><blockquote class="sw-card"><p>“Will use again.”</p><cite>★★★★★</cite></blockquote></div></section>`,
'gallery':o=>`\n<section id="gallery" class="sw-addon"><h2>Gallery</h2><div class="sw-gallery">${[1,2,3,4,5,6].map(i=>`<img loading="lazy" alt="${esc(o.name||'Business')} photo ${i}" src="https://placehold.co/400x300?text=Photo+${i}">`).join('')}</div></section>`,
'faq':o=>`\n<section id="faq" class="sw-addon"><h2>FAQ</h2><details class="sw-faq"><summary>What areas do you serve?</summary><p>Your area.</p></details><details class="sw-faq"><summary>How do I book?</summary><p>Call or form.</p></details></section>`,
'social':o=>`\n<section id="social" class="sw-addon"><h2>Follow Us</h2><div class="sw-social"><a href="${esc(o.instagram&&'https://instagram.com/'+o.instagram||'https://instagram.com/')}" rel="noopener" target="_blank" aria-label="Instagram">📸</a><a href="${esc(o.facebook&&'https://facebook.com/'+o.facebook||'https://facebook.com/')}" rel="noopener" target="_blank" aria-label="Facebook">👍</a></div></section>`,
'click-to-call':o=>`\n<a class="sw-callbar" href="tel:${esc((o.phone||'').replace(/[^0-9+]/g,''))}">📞 Call ${esc(o.name||'Us')}${o.phone?' · '+esc(o.phone):''}</a>`,
'menu':o=>`\n<section id="menu" class="sw-addon sw-menu"><h2>${esc(o.name?o.name+' — Menu':'Our Menu')}</h2><p class="sw-note">v=vegetarian · gf=gluten-free</p><h3>Mains</h3><ul class="sw-menu-list"><li><span>Signature Dish</span><span class="sw-price">$18</span></li><li><span>Chef Special <em class="sw-tags">gf</em></span><span class="sw-price">$22</span></li></ul></section>`,
'online-ordering':o=>`\n<section id="order" class="sw-addon" style="text-align:center"><h2>Order Online</h2><p>Order directly${o.provider?' (via '+esc(o.provider)+')':''} — skip the fees.</p><a class="sw-btn sw-btn-primary" href="${esc(o.url||'#')}" rel="noopener" target="_blank">🛒 Order Now</a></section>`,
'reservations':o=>`\n<section id="reserve" class="sw-addon" style="text-align:center"><h2>Reserve a Table</h2><a class="sw-btn sw-btn-primary" href="${esc(o.url||'#')}" rel="noopener" target="_blank">📅 Book a Table</a></section>`,
'booking':o=>o.url?`\n<section id="book" class="sw-addon"><h2>Book an Appointment</h2><iframe title="Booking" src="${esc(o.url)}" width="100%" height="640" style="border:0;border-radius:.6rem" loading="lazy"></iframe></section>`:`\n<section id="book" class="sw-addon" style="text-align:center"><h2>Book an Appointment</h2><a class="sw-btn sw-btn-primary" href="#">📅 Book Now</a></section>`,
'newsletter':o=>`\n<section id="newsletter" class="sw-addon"><h2>Get Deals & Updates</h2><form class="sw-form sw-inline" method="POST" action="${esc(o.action||'#')}"><input type="email" name="email" placeholder="you@example.com" required aria-label="Email"><button type="submit">Subscribe</button></form></section>`,
'whatsapp':o=>`\n<a class="sw-whatsapp" href="https://wa.me/${esc((o.phone||'').replace(/[^0-9]/g,''))}" rel="noopener" target="_blank" aria-label="WhatsApp">💬 Chat</a>`,
'live-chat':o=>`\n<!-- Live chat: paste tawk.to/Crisp script. ${esc(o.script||'')} -->\n<script>/* TODO: tawk.to */</script>`,
'payments':o=>`\n<section id="pay" class="sw-addon" style="text-align:center"><h2>Buy Now</h2><a class="sw-btn sw-btn-primary" href="${esc(o.url||'#')}" rel="noopener" target="_blank">💳 Purchase</a></section>`,
'store':o=>`\n<section id="store" class="sw-addon"><h2>Shop</h2><div id="snipcart" hidden data-api-key="${esc(o.key||'YOUR_KEY')}"></div><button class="snipcart-add-item sw-btn sw-btn-primary" data-item-id="s1" data-item-name="Product" data-item-price="19.99" data-item-url="/">Add · $19.99</button></section>`,
'chatbot':o=>chatbotSnippet(o)};

// ---- Chatbot: rule-based FAQ widget (FREE, no API). Optional Cloudflare Workers AI upgrade via data-ai-endpoint. ----
function chatbotSnippet(o){
  const name = String(o.name||'us');
  const phone = (o.phone||'').replace(/[^0-9+]/g,'');
  const defaultFaq = [
    {q:['hours','open','close','when'], a:'We\u2019re open Mon\u2013Sat. Call us for exact hours!'},
    {q:['location','where','address','directions'], a:'You can find us on the map on this page \u2014 tap the address for directions.'},
    {q:['price','cost','how much','quote'], a:'Pricing depends on what you need \u2014 send us a message or call for a fast quote.'},
    {q:['book','appointment','reserve','schedule'], a:'Use the booking button on this page, or call us and we\u2019ll set it up.'},
    {q:['order','delivery','takeout','pickup'], a:'You can order online using the button on this page.'},
    {q:['contact','phone','call','email','reach'], a:(phone?('Call us at '+ (o.phone||'') +', or use'):'Use') + ' the contact form on this page \u2014 we reply fast.'}
  ];
  let faq = defaultFaq;
  if(o.faq){ try{ const p = JSON.parse(o.faq); if(Array.isArray(p)&&p.length) faq=p; }catch{} }
  const faqJson = JSON.stringify(faq);
  const aiEndpoint = o.aiEndpoint ? String(o.aiEndpoint) : '';
  const tel = phone ? ('tel:'+phone) : '#contact';
  // Widget is a single-quoted concatenated string so it never conflicts with the outer template literal.
  return '\n<!-- SiteWright Chatbot: free rule-based FAQ. Optional AI via data-ai-endpoint (Cloudflare Workers AI, free 10k/day). -->\n'+
'<div id="sw-chat" data-ai-endpoint="'+esc(aiEndpoint)+'">\n'+
'  <button id="sw-chat-toggle" aria-label="Open chat">\uD83D\uDCAC Chat</button>\n'+
'  <div id="sw-chat-panel" hidden>\n'+
'    <div id="sw-chat-head"><span>'+esc(name)+' \u00B7 Ask us anything</span><button id="sw-chat-x" aria-label="Close">\u00D7</button></div>\n'+
'    <div id="sw-chat-log" role="log" aria-live="polite"></div>\n'+
'    <div id="sw-chat-chips"></div>\n'+
'    <form id="sw-chat-form"><input id="sw-chat-in" autocomplete="off" placeholder="Type your question\u2026" aria-label="Your question"><button type="submit">Send</button></form>\n'+
'  </div>\n'+
'</div>\n'+
'<style>\n'+
'#sw-chat{position:fixed;right:16px;bottom:16px;z-index:40;font:15px/1.5 system-ui,sans-serif}\n'+
'#sw-chat-toggle{background:var(--primary,#1d4ed8);color:#fff;border:0;border-radius:2rem;padding:.7rem 1.1rem;font-weight:700;cursor:pointer;box-shadow:0 6px 18px #0003}\n'+
'#sw-chat-panel{position:fixed;right:16px;bottom:70px;width:320px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #0000001a;border-radius:14px;box-shadow:0 12px 40px #0003;overflow:hidden;display:flex;flex-direction:column;max-height:70vh}\n'+
'#sw-chat-head{background:var(--primary,#1d4ed8);color:#fff;padding:.7rem .9rem;display:flex;justify-content:space-between;align-items:center;font-weight:600}\n'+
'#sw-chat-x{background:none;border:0;color:#fff;font-size:1.3rem;cursor:pointer;line-height:1}\n'+
'#sw-chat-log{padding:.8rem;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:.5rem}\n'+
'.sw-msg{max-width:85%;padding:.5rem .7rem;border-radius:.7rem}\n'+
'.sw-bot{background:#f1f5f9;align-self:flex-start}\n'+
'.sw-user{background:var(--primary,#1d4ed8);color:#fff;align-self:flex-end}\n'+
'#sw-chat-chips{display:flex;flex-wrap:wrap;gap:.35rem;padding:0 .8rem .4rem}\n'+
'.sw-chip{background:#eef2ff;border:1px solid #c7d2fe;border-radius:1rem;padding:.25rem .6rem;font-size:.8rem;cursor:pointer}\n'+
'#sw-chat-form{display:flex;gap:.4rem;padding:.6rem;border-top:1px solid #0000000d}\n'+
'#sw-chat-in{flex:1;padding:.55rem;border:1px solid #00000022;border-radius:.5rem;font:inherit}\n'+
'#sw-chat-form button{background:var(--accent,#f59e0b);color:#fff;border:0;border-radius:.5rem;padding:.55rem .9rem;font-weight:700;cursor:pointer}\n'+
'</style>\n'+
'<script>\n'+
'(function(){\n'+
'  var FAQ='+faqJson+';\n'+
'  var TEL='+JSON.stringify(tel)+';\n'+
'  var root=document.getElementById("sw-chat"),panel=document.getElementById("sw-chat-panel"),log=document.getElementById("sw-chat-log"),chips=document.getElementById("sw-chat-chips");\n'+
'  var aiEndpoint=root.getAttribute("data-ai-endpoint")||"";\n'+
'  function add(text,who){var d=document.createElement("div");d.className="sw-msg "+(who==="user"?"sw-user":"sw-bot");d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;}\n'+
'  function answer(q){var s=q.toLowerCase();for(var i=0;i<FAQ.length;i++){var keys=FAQ[i].q||[];for(var j=0;j<keys.length;j++){if(s.indexOf(keys[j])>-1)return FAQ[i].a;}}return null;}\n'+
'  function respond(q){\n'+
'    var a=answer(q);\n'+
'    if(a){add(a,"bot");return;}\n'+
'    if(aiEndpoint){add("\u2026","bot");fetch(aiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})}).then(function(r){return r.json();}).then(function(d){log.lastChild.textContent=(d&&(d.reply||d.response))||fallback();}).catch(function(){log.lastChild.textContent=fallback();});return;}\n'+
'    add(fallback(),"bot");\n'+
'  }\n'+
'  function fallback(){return "Great question! I\u2019m a simple assistant \u2014 for that one, please call or use the contact form and we\u2019ll help right away.";}\n'+
'  function chip(label,q){var b=document.createElement("button");b.className="sw-chip";b.type="button";b.textContent=label;b.onclick=function(){add(q,"user");respond(q);};chips.appendChild(b);}\n'+
'  document.getElementById("sw-chat-toggle").onclick=function(){panel.hidden=!panel.hidden;if(log.childElementCount===0){add("Hi! Ask me about hours, location, pricing, or booking. How can I help?","bot");chip("Hours","What are your hours?");chip("Location","Where are you located?");chip("Pricing","How much does it cost?");chip("Book","How do I book?");}};\n'+
'  document.getElementById("sw-chat-x").onclick=function(){panel.hidden=true;};\n'+
'  document.getElementById("sw-chat-form").onsubmit=function(e){e.preventDefault();var inp=document.getElementById("sw-chat-in");var q=inp.value.trim();if(!q)return;add(q,"user");inp.value="";respond(q);};\n'+
'})();\n'+
'</script>';
}
const STYLE=`\n<style id="sw-addons-style">.sw-addon{max-width:1040px;margin:0 auto;padding:2.6rem 1.25rem}.sw-addon h2{color:var(--primary,#1d4ed8);font-size:1.6rem;text-align:center;margin-bottom:1rem}.sw-note{opacity:.7;font-size:.9rem;text-align:center}.sw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}.sw-card{background:#fff;border:1px solid #0000000d;border-radius:.8rem;padding:1.1rem;margin:0}.sw-form{display:flex;flex-direction:column;gap:.7rem;max-width:520px;margin:0 auto}.sw-form.sw-inline{flex-direction:row}.sw-form input,.sw-form textarea{padding:.8rem;border:1px solid #00000022;border-radius:.5rem;font:inherit}.sw-btn,.sw-form button{display:inline-block;background:var(--accent,#f59e0b);color:#fff;border:0;padding:.85rem 1.5rem;border-radius:.6rem;font-weight:700;text-decoration:none;cursor:pointer}.sw-btn-primary{background:var(--primary,#1d4ed8)}.sw-hours{margin:0 auto;border-collapse:collapse}.sw-hours td{padding:.4rem 1rem;border-bottom:1px solid #0000000d}.sw-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.6rem}.sw-gallery img{width:100%;border-radius:.5rem}.sw-faq{max-width:640px;margin:.5rem auto;border:1px solid #0000000d;border-radius:.5rem;padding:.4rem .8rem}.sw-faq summary{cursor:pointer;font-weight:600}.sw-social{display:flex;gap:1rem;justify-content:center;font-size:1.6rem}.sw-menu-list{list-style:none;padding:0;max-width:640px;margin:0 auto}.sw-menu-list li{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px dashed #00000018}.sw-callbar{position:fixed;left:0;right:0;bottom:0;background:var(--primary,#1d4ed8);color:#fff;text-align:center;padding:.9rem;font-weight:700;text-decoration:none;z-index:30}.sw-whatsapp{position:fixed;right:16px;bottom:76px;background:#25D366;color:#fff;padding:.7rem 1rem;border-radius:2rem;font-weight:700;text-decoration:none;z-index:31}@media(max-width:560px){.sw-form.sw-inline{flex-direction:column}}</style>`;
const REC={restaurant:['menu','online-ordering','reservations','map','hours','reviews','click-to-call'],cafe:['menu','online-ordering','map','hours','reviews','social'],bakery:['menu','online-ordering','gallery','map','hours','reviews'],salon:['booking','gallery','reviews','map','hours','social'],barber:['booking','reviews','map','hours','click-to-call'],dentist:['booking','contact-form','reviews','map','hours','faq'],gym:['booking','gallery','reviews','social','newsletter'],plumber:['contact-form','click-to-call','reviews','faq','map'],lawyer:['contact-form','booking','faq','reviews','map'],autorepair:['booking','contact-form','reviews','map','hours'],retail:['store','payments','gallery','reviews','newsletter'],default:['contact-form','map','hours','reviews','social','click-to-call','chatbot']};
function list(ind){const rows=CAT.filter(a=>!ind||a.ind.includes(ind)||a.ind.includes('all'));console.log(`\n📦 Add-Ons${ind?' — '+ind:''}\n`);rows.forEach(a=>console.log(`  ${a.type==='native'?'🧩':'🔌'} ${a.id.padEnd(16)} ${a.name}${a.config?'  (config: '+a.config.join(', ')+')':''}`));console.log('');}
function rec(ind){const l=REC[ind]||REC.default;console.log(`\n⭐ Recommended for ${ind||'general'}:\n`);l.forEach((id,i)=>{const a=CAT.find(x=>x.id===id);if(a)console.log(`  ${i+1}. ${a.type==='native'?'🧩':'🔌'} ${a.name} (${a.id})`);});console.log('');}
// Pure: insert one addon's snippet (+ shared style, once) into an HTML string. No file I/O — reusable by
// the CLI (make, below) and by other packages (e.g. site-builder) that already hold the HTML in memory.
function applyAddon(html,id,opts={}){const a=CAT.find(x=>x.id===id);if(!a)throw new Error('Unknown addon "'+id+'"');const sn=S[id](opts);let h=html;if(!h.includes('id="sw-addons-style"'))h=h.replace('</head>',STYLE+'\n</head>');if(id==='chatbot'&&h.includes('id="sw-chat"')){const i=h.indexOf('<!-- SiteWright Chatbot');if(i>=0){const j=h.indexOf('</script>',i);if(j>=0)h=h.slice(0,i)+h.slice(j+9);}}const anc=h.includes('</main>')?'</main>':'</body>';return h.replace(anc,sn+'\n'+anc);}
function make(id){const a=CAT.find(x=>x.id===id);if(!a){console.error('Unknown "'+id+'". Run: addons.mjs list');process.exit(1);}const o={name:opt('name'),phone:opt('phone'),address:opt('address'),url:opt('url'),provider:opt('provider'),action:opt('action'),key:opt('key'),script:opt('script'),instagram:opt('instagram'),facebook:opt('facebook'),weekday:opt('weekday'),saturday:opt('saturday'),faq:opt('faq'),aiEndpoint:opt('aiEndpoint')},out=opt('out');
if(out){if(!existsSync(out)){console.error('--out not found: '+out);process.exit(1);}const h=applyAddon(readFileSync(out,'utf8'),id,o);writeFileSync(out,h,'utf8');console.log(`✅ Added "${a.name}" (${id}) to ${out}`);if(a.type==='embed'&&a.config)console.log('   ⚙️  set: '+a.config.join(', '));}
else{console.log(STYLE+'\n'+S[id](o));}}
// CLI dispatch only runs when this file is executed directly (`node addons.mjs ...`), never on import —
// so other packages can `import {CAT,S,STYLE,REC,applyAddon} from './addons.mjs'` with zero side effects.
const isMain=(()=>{try{return import.meta.url===`file://${process.argv[1]}`;}catch{return false;}})();
if(isMain){switch(cmd){case'list':list(opt('industry'));break;case'recommend':rec(opt('industry'));break;case'make':make(av[1]);break;default:console.log('Usage: addons.mjs list|recommend --industry X|make <id> [--out <html>]');process.exit(cmd?1:0);}}
export {CAT,S,STYLE,REC,applyAddon};
