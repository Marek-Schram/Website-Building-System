#!/usr/bin/env node
/**
 * SiteWright Site Builder — assembles a REAL client site from
 *   clients/<slug>/brand/brand.config.json + clients/<slug>/content/*.md + packages/themes/<theme>.json
 * into a static, secure, ready-to-deploy dist/<slug>/ (index.html + _headers + public assets).
 *
 * This is the step /build-site + scripts/build-client.mjs run. It intentionally produces plain static
 * HTML/CSS/JS (same approach already proven by packages/demo-gen and packages/addons) — no framework/build
 * step — so it stays consistent with everything else in the repo (testing harness, parity-check, and
 * opportunities all operate on plain HTML) and keeps per-site cost near zero.
 *
 * Usage: node packages/site-builder/src/build.mjs "<slug>" [--out dist] [--force]
 *   --force  build even if placeholder ("REPLACE") content is detected (prints a loud warning instead).
 *
 * Also importable as a library: import { buildSite } from './build.mjs'.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAT as ADDON_CAT, S as ADDON_SNIPPETS, STYLE as ADDON_STYLE, applyAddon } from '../../addons/src/addons.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

// ---------- tiny, dependency-free content helpers ----------

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unquote = s => { const t = String(s ?? '').trim(); const m = t.match(/^(["'])([\s\S]*)\1$/); return m ? m[2] : t; };

// Minimal frontmatter parser: `---\nkey: value\n---\nbody`. Values may be quoted; booleans coerced.
export function parseFrontmatter(raw) {
  const m = String(raw ?? '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: String(raw ?? '').trim() };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!km) continue;
    const v = unquote(km[2]);
    data[km[1]] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return { data, body: m[2].trim() };
}

// Minimal list parser for content bodies shaped like:
//   - name: "X"
//     description: "Y"
//   - name: "Z"
// Returns an array of plain objects. Ignores blank lines / non-matching lines.
export function parseList(body) {
  const items = [];
  let cur = null;
  for (const raw of String(body ?? '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const head = raw.match(/^-\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (head) { cur = { [head[1]]: unquote(head[2]) }; items.push(cur); continue; }
    const cont = raw.match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (cont && cur) cur[cont[1]] = unquote(cont[2]);
  }
  return items;
}

// Very small markdown: blank-line-separated paragraphs, **bold**, _italic_, [text](href).
function inline(text) {
  let h = esc(text);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/_([^_]+)_/g, '<em>$1</em>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//i.test(href);
    return `<a href="${esc(href)}"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
  });
  return h;
}
function mdParagraphs(body) {
  return String(body ?? '').split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${inline(p)}</p>`).join('\n');
}

function readMd(path) {
  if (!existsSync(path)) return null;
  return parseFrontmatter(readFileSync(path, 'utf8'));
}

// ---------- validation: never ship literal template placeholders to a real client ----------

const isPlaceholder = v => { const t = String(v ?? '').trim(); return t === '' || /^replace\b/i.test(t); };

function validate(cfg, content) {
  const problems = [];
  const req = { 'brand.businessName': cfg.businessName, 'brand.tagline': cfg.tagline,
    'brand.contact.phone': cfg.contact?.phone, 'brand.contact.email': cfg.contact?.email,
    'brand.contact.address': cfg.contact?.address };
  for (const [k, v] of Object.entries(req)) if (isPlaceholder(v)) problems.push(k);
  const home = content.home;
  if (!home) problems.push('content/home.md (missing)');
  else for (const k of ['hero_heading', 'hero_sub']) if (isPlaceholder(home.data[k])) problems.push('content/home.md#' + k);
  return problems;
}

// ---------- section renderers (skip gracefully — never fabricate content) ----------

function renderHero(cfg, content) {
  const home = content.home;
  if (!home) return '';
  const d = home.data;
  return `\n<section class="hero"><div class="wrap"><h1>${esc(d.hero_heading || cfg.businessName)}</h1><p class="tag">${esc(d.hero_sub || cfg.tagline || '')}</p>${mdParagraphs(home.body)}<div class="cta-row">${cfg.contact?.phone ? `<a class="btn primary" href="tel:${esc(String(cfg.contact.phone).replace(/[^0-9+]/g, ''))}">📞 ${esc(cfg.contact.phone)}</a>` : ''}${d.cta_label ? `<a class="btn" href="${esc(d.cta_href || '#contact')}">${esc(d.cta_label)}</a>` : ''}</div></div></section>`;
}

function renderServices(cfg, content) {
  const svc = content.services;
  if (!svc) return '';
  const items = parseList(svc.body);
  if (!items.length) return '';
  const cards = items.map((s, i) => `<article class="card"><div class="ic">${['①', '②', '③', '④', '⑤', '⑥'][i] || '•'}</div><h3>${esc(s.name || '')}</h3><p>${esc(s.description || '')}</p>${s.price ? `<p class="price">${esc(s.price)}</p>` : ''}</article>`).join('');
  return `\n<section id="services"><div class="wrap"><h2>${esc(svc.data.title || 'What We Offer')}</h2><div class="grid">${cards}</div></div></section>`;
}

function renderAbout(cfg, content) {
  const about = content.about;
  if (!about || !about.body) return '';
  return `\n<section id="about" class="alt"><div class="wrap narrow"><h2>${esc(about.data.title || 'About ' + cfg.businessName)}</h2><div class="prose">${mdParagraphs(about.body)}</div></div></section>`;
}

// Real quotes only — never invent testimonials for a real client's live site.
function renderTestimonials(cfg, content) {
  const t = content.testimonials;
  if (!t) return '';
  const items = parseList(t.body).filter(x => x.quote && x.quote.trim());
  if (!items.length) return '';
  const cards = items.map(x => `<blockquote class="card"><p>“${esc(x.quote)}”</p>${x.author ? `<cite>— ${esc(x.author)}</cite>` : ''}</blockquote>`).join('');
  return `\n<section id="testimonials"><div class="wrap"><h2>${esc(t.data.title || 'What Customers Say')}</h2><div class="grid">${cards}</div></div></section>`;
}

function renderHours(cfg) {
  if (!cfg.contact?.hours) return '';
  return `\n<section id="hours" class="alt"><div class="wrap narrow"><h2>Hours</h2><p class="prose">${esc(cfg.contact.hours)}</p></div></section>`;
}

function renderContactForm(cfg, content) {
  const c = content.contact;
  const formAction = cfg.addonConfig?.['contact-form']?.action;
  return `\n<section id="contact"><div class="wrap narrow"><h2>${esc(c?.data.title || 'Get In Touch')}</h2>${c?.body ? mdParagraphs(c.body) : ''}<div class="info">${cfg.contact?.phone ? `<div class="box"><b>Call</b><a href="tel:${esc(String(cfg.contact.phone).replace(/[^0-9+]/g, ''))}">${esc(cfg.contact.phone)}</a></div>` : ''}${cfg.contact?.email ? `<div class="box"><b>Email</b><a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a></div>` : ''}${cfg.contact?.address ? `<div class="box"><b>Visit</b><a href="https://maps.google.com/?q=${encodeURIComponent(cfg.contact.address)}" target="_blank" rel="noopener">${esc(cfg.contact.address)}</a></div>` : ''}</div>${c?.data.form !== false ? `<form class="sw-form" method="POST" action="${esc(formAction || '#')}"><input name="name" placeholder="Name" required aria-label="Name"><input type="email" name="email" placeholder="you@example.com" required aria-label="Email"><textarea name="message" rows="4" placeholder="How can we help?" required aria-label="Message"></textarea><input type="text" name="_gotcha" style="display:none" tabindex="-1"><button type="submit">Send</button></form>` : ''}</div></section>`;
}

function renderGallery(cfg, content) {
  const g = content.gallery;
  if (!g) return '';
  const items = parseList(g.body).filter(x => x.src);
  if (!items.length) return '';
  const imgs = items.map(x => `<img loading="lazy" src="${esc(x.src)}" alt="${esc(x.alt || cfg.businessName)}">`).join('');
  return `\n<section id="gallery" class="alt"><div class="wrap"><h2>${esc(g.data.title || 'Gallery')}</h2><div class="sw-gallery">${imgs}</div></div></section>`;
}

function renderFaq(cfg, content) {
  const f = content.faq;
  if (!f) return '';
  const items = parseList(f.body).filter(x => x.q && x.a);
  if (!items.length) return '';
  const rows = items.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('');
  return `\n<section id="faq"><div class="wrap narrow"><h2>${esc(f.data.title || 'FAQ')}</h2>${rows}</div></section>`;
}

function renderCta(cfg, content) {
  const d = content.home?.data;
  if (!d?.cta_label) return '';
  return `\n<section class="cta-band"><div class="wrap"><a class="btn primary" href="${esc(d.cta_href || '#contact')}">${esc(d.cta_label)}</a></div></section>`;
}

function renderFooter(cfg) {
  const yr = new Date().getFullYear();
  const social = cfg.marketing?.socialLinks || {};
  const links = Object.entries(social).filter(([, v]) => v).map(([k, v]) => `<a href="https://${k}.com/${esc(v)}" rel="noopener" target="_blank">${esc(k)}</a>`).join(' · ');
  return `\n<footer><div class="wrap">© ${yr} ${esc(cfg.businessName)}.${links ? ' ' + links : ''}</div></footer>`;
}

const SECTION_RENDERERS = {
  Hero: renderHero, Services: renderServices, About: renderAbout, Testimonials: renderTestimonials,
  Hours: renderHours, ContactForm: renderContactForm, Gallery: renderGallery, FAQ: renderFaq,
  CTA: renderCta, Footer: renderFooter,
};

// ---------- page shell (shared CSS vars/classes with packages/addons so injected add-ons match) ----------

function shell({ cfg, sectionsHtml, headExtra }) {
  const c = cfg.brand?.colors || {};
  const primary = c.primary || '#1d4ed8', accent = c.accent || '#0369a1', ink = c.secondary || '#0f172a';
  const name = esc(cfg.businessName), tag = esc(cfg.tagline || '');
  const desc = `${name} — ${cfg.tagline || ''}`.trim();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}"><title>${name} — ${tag}</title>
<link rel="icon" href="data:,">
${headExtra || ''}
<style>:root{--primary:${primary};--accent:${accent};--ink:${ink};--bg:#ffffff}*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,sans-serif;color:var(--ink);background:var(--bg)}a{color:var(--primary)}.wrap{max-width:1040px;margin:0 auto;padding:0 20px}.narrow{max-width:720px}header{position:sticky;top:0;background:#fffffff2;border-bottom:1px solid #0000000f;z-index:10}.nav{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;max-width:1040px;margin:0 auto}.brand{font-weight:800;color:var(--primary);text-decoration:none}.nav a.link{margin-left:18px;text-decoration:none;color:var(--ink);font-weight:600}.btn{display:inline-block;background:var(--accent);color:#fff;padding:.8rem 1.4rem;border-radius:.6rem;text-decoration:none;font-weight:700;border:0;cursor:pointer;font:inherit}.btn.primary{background:var(--primary)}.hero{padding:5.5rem 0 4rem;text-align:center}.hero h1{font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0;color:var(--primary)}.hero .tag{font-size:1.2rem;opacity:.85;margin-bottom:1rem}.cta-row{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;margin-top:1rem}section{padding:3.2rem 0}section.alt{background:#f8fafc}.cta-band{text-align:center;background:#f1f5f9}h2{font-size:1.8rem;color:var(--primary);text-align:center;margin-bottom:1.4rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}.card{background:#fff;border:1px solid #0000000d;border-radius:.9rem;padding:1.4rem;margin:0}.ic{width:40px;height:40px;border-radius:.6rem;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:800;margin-bottom:.6rem}.price{font-weight:700;color:var(--accent)}.prose{max-width:720px;margin:0 auto}.prose p{margin:.6rem 0}.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.2rem 0}.box{background:#fff;border:1px solid #0000000d;border-radius:.8rem;padding:1.1rem;text-align:center}.box b{display:block;color:var(--primary)}.sw-form{display:flex;flex-direction:column;gap:.7rem;max-width:520px;margin:0 auto}.sw-form input,.sw-form textarea{padding:.8rem;border:1px solid #00000022;border-radius:.5rem;font:inherit}.sw-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.6rem}.sw-gallery img{width:100%;border-radius:.5rem}details{max-width:640px;margin:.5rem auto;border:1px solid #0000000d;border-radius:.5rem;padding:.4rem .8rem}summary{cursor:pointer;font-weight:600}footer{padding:2.4rem 0;text-align:center;color:#475569;border-top:1px solid #0000000f}footer a{color:var(--primary);font-weight:600}@media(max-width:560px){.nav a.link{display:none}}</style>
</head>
<body>
<header><nav class="nav"><a class="brand" href="#top">${name}</a><div><a class="link" href="#services">Services</a><a class="link" href="#about">About</a><a class="link" href="#contact">Contact</a>${cfg.contact?.phone ? `<a class="btn primary" href="tel:${esc(String(cfg.contact.phone).replace(/[^0-9+]/g, ''))}">Call Now</a>` : ''}</div></nav></header>
<main id="top">
${sectionsHtml}
</main>
</body></html>`;
}

// ---------- addon options derived from brand.config (no invented data) ----------

function addonOptsFor(id, cfg) {
  const extra = cfg.addonConfig?.[id] || {};
  return {
    name: cfg.businessName, phone: cfg.contact?.phone, address: cfg.contact?.address,
    instagram: cfg.marketing?.socialLinks?.instagram, facebook: cfg.marketing?.socialLinks?.facebook,
    ...extra,
  };
}

const NEEDS_CONFIG = { 'online-ordering': ['url'], reservations: ['url'], booking: [], newsletter: [],
  'live-chat': ['script'], payments: ['url'], store: ['key'] };

// ---------- main build ----------

export function buildSite(slug, { outDir = 'dist', force = false } = {}) {
  const clientDir = resolve(ROOT, 'clients', slug);
  const cfgPath = resolve(clientDir, 'brand', 'brand.config.json');
  if (!existsSync(cfgPath)) throw new Error(`No brand.config.json for "${slug}" (expected ${cfgPath}). Run /new-client first.`);
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

  const contentDir = resolve(clientDir, 'content');
  const content = {};
  for (const name of ['home', 'about', 'services', 'contact', 'testimonials', 'faq', 'gallery']) {
    const md = readMd(resolve(contentDir, name + '.md'));
    if (md) content[name] = md;
  }

  const problems = validate(cfg, content);
  if (problems.length && !force) {
    const msg = `Cannot build "${slug}" — placeholder/missing content:\n` + problems.map(p => '  • ' + p).join('\n') +
      `\nFill these in under clients/${slug}/brand/ and clients/${slug}/content/, then rebuild. (--force to build anyway.)`;
    throw new Error(msg);
  }

  const theme = (() => {
    const p = resolve(ROOT, 'packages/themes', `${cfg.theme || 'beacon'}.json`);
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
    return { name: 'beacon', defaultSections: ['Hero', 'Services', 'About', 'Testimonials', 'Hours', 'ContactForm', 'Footer'] };
  })();

  const warnings = [...problems.map(p => `placeholder (built anyway with --force): ${p}`)];
  const renderedSections = new Set();
  const sections = (theme.defaultSections || []).map(name => {
    const fn = SECTION_RENDERERS[name];
    if (!fn) { warnings.push(`unknown theme section "${name}" — skipped`); return ''; }
    const html = fn(cfg, content);
    if (!html) warnings.push(`section "${name}" skipped — no real content supplied`);
    else renderedSections.add(name);
    return html;
  }).filter(Boolean).join('\n');

  let html = shell({ cfg, sectionsHtml: sections + renderFooter(cfg) });

  // packages/addons ships some "native" snippets with HARDCODED PLACEHOLDER content (fake menu items like
  // "Signature Dish $18", fake hours, stock photos, generic FAQ text) — correct for a marketing demo, but
  // never acceptable to auto-inject into a real client's live site. The site-builder has real-content-driven
  // renderers for every one of them (fed from content/*.md), so those ids are routed there instead: applied
  // only if the real-content section actually rendered, otherwise skipped with a pointer to the content file.
  const REAL_CONTENT_COVERS = { hours: ['Hours', 'hours'], menu: ['Services', 'services'], gallery: ['Gallery', 'gallery'],
    faq: ['FAQ', 'faq'], reviews: ['Testimonials', 'testimonials'], 'contact-form': ['ContactForm', 'contact'] };

  // Apply requested add-ons using the SAME snippet generators as /add-feature (packages/addons) — but only
  // the ones that use real client data (map, click-to-call, social, chatbot, whatsapp, embeds with config).
  const applied = [], skipped = [];
  for (const id of cfg.addons || []) {
    if (!ADDON_CAT.find(a => a.id === id)) { warnings.push(`unknown addon "${id}" in brand.config.addons — skipped`); continue; }
    const covers = REAL_CONTENT_COVERS[id];
    if (covers) {
      const [sectionName, contentFile] = covers;
      if (renderedSections.has(sectionName)) { applied.push(id); continue; } // real version already on the page.
      skipped.push({ id, reason: `add real content to content/${contentFile}.md — the generic add-on uses placeholder data and is skipped on real client builds` });
      continue;
    }
    const need = NEEDS_CONFIG[id];
    if (need && need.some(k => !cfg.addonConfig?.[id]?.[k])) {
      skipped.push({ id, reason: `needs addonConfig.${id}.${need.join('/')} in brand.config.json` });
      continue;
    }
    html = applyAddon(html, id, addonOptsFor(id, cfg));
    applied.push(id);
  }

  // Catch dangling in-page anchors (e.g. a cta_href of "#menu" when the rendered section id is "services")
  // before they ship — this exact class of bug is what packages/testing/harness/human-test.mjs flags later.
  const anchorIds = new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  for (const href of new Set([...html.matchAll(/href\s*=\s*"#([^"#]+)"/g)].map(m => m[1]))) {
    if (!anchorIds.has(href)) warnings.push(`dangling anchor link "#${href}" — no section with that id was rendered`);
  }

  const distDir = resolve(ROOT, outDir, slug);
  mkdirSync(distDir, { recursive: true });
  writeFileSync(resolve(distDir, 'index.html'), html, 'utf8');

  // Security headers: use the client's own if they customized it, else the standard template.
  const clientHeaders = resolve(clientDir, 'public', '_headers');
  const headersSrc = existsSync(clientHeaders) ? clientHeaders : resolve(ROOT, 'packages/security/headers.template');
  cpSync(headersSrc, resolve(distDir, '_headers'));

  // Copy any other client public assets (logo, images) alongside, if present.
  const publicDir = resolve(clientDir, 'public');
  if (existsSync(publicDir)) {
    for (const entry of readdirSync(publicDir)) {
      if (entry === '_headers') continue;
      cpSync(resolve(publicDir, entry), resolve(distDir, entry), { recursive: true });
    }
  }

  const domain = cfg.deploy?.domain;
  writeFileSync(resolve(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n${domain ? `Sitemap: https://${domain}/sitemap.xml\n` : ''}`);
  writeFileSync(resolve(distDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n  <url><loc>https://${domain || 'example.com'}/</loc></url>\n</urlset>\n`);

  return { slug, distDir, businessName: cfg.businessName, theme: theme.name, applied, skipped, warnings };
}

// ---------- CLI ----------

const isMain = (() => { try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; } })();
if (isMain) {
  const av = process.argv.slice(2);
  const slug = av.find(a => !a.startsWith('--'));
  const opt = (k, d = null) => { const i = av.indexOf('--' + k); return i >= 0 && av[i + 1] && !av[i + 1].startsWith('--') ? av[i + 1] : d; };
  if (!slug) { console.error('Usage: build.mjs "<slug>" [--out dist] [--force]'); process.exit(1); }
  try {
    const r = buildSite(slug, { outDir: opt('out', 'dist'), force: av.includes('--force') });
    console.log(`\n✅ Built "${r.businessName}" (theme: ${r.theme}) → ${r.distDir}`);
    if (r.applied.length) console.log(`   Add-ons applied: ${r.applied.join(', ')}`);
    if (r.skipped.length) { console.log('   Add-ons needing attention:'); r.skipped.forEach(s => console.log(`     • ${s.id} — ${s.reason}`)); }
    if (r.warnings.length) { console.log('   Warnings:'); r.warnings.forEach(w => console.log(`     • ${w}`)); }
    console.log(`\n   Next: node packages/testing/harness/run-all.mjs ${r.distDir}/index.html\n`);
  } catch (e) {
    console.error('\n❌ ' + e.message + '\n');
    process.exit(1);
  }
}
