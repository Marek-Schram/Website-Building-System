#!/usr/bin/env node
/**
 * SiteWright Prospect Brief
 * ------------------------------------------------------------------
 * ONE command that produces a single polished HTML document you can
 * email a lead (or print to PDF). It runs, in sequence:
 *   1. Opportunity scan  → the weak points on their CURRENT site
 *   2. Instant Audit      → a 0–100 score (speed/SEO/HTTPS/headers)
 *   3. Demo generator     → a matching starter site for them
 * …then assembles everything into a branded, self-contained
 * prospect-brief.html (+ the demo) under prospect-briefs/<slug>/.
 *
 * The result is a credible, personalized pitch: "Here's what your
 * current site is missing, here's your score, and here's a free
 * starter site I already built — I can do all this for less."
 *
 * Usage:
 *   node packages/prospect-brief/src/brief.mjs <url> [--name "Joe's"] [--type plumber] [--city "St. Charles, MO"] [--phone "..."] [--address "..."] [--slug name]
 *
 * Notes:
 *   - Works with just a URL (it infers name/type). Pass flags for a nicer demo.
 *   - Set PAGESPEED_API_KEY for real speed numbers (optional).
 *   - Output is a print-ready HTML (use the browser's "Save as PDF").
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const OPP = resolve(ROOT, 'packages/opportunities/src/opportunities.mjs');
const AUDIT = resolve(ROOT, 'packages/audit/src/audit.mjs');
const DEMO = resolve(ROOT, 'packages/demo-gen/src/demo.mjs');

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
if (!target) { console.error('Usage: brief.mjs <url> [--name --type --city --phone --address --slug]'); process.exit(1); }

const slugify = s => String(s || 'prospect').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const run = (script, a) => { const r = spawnSync('node', [script, ...a], { encoding: 'utf8', timeout: 120000 }); return r.stdout || ''; };

console.log('🧩 Building prospect brief…');

// --- 1. Opportunity scan (JSON) ---
console.log('  • scanning for weak points…');
let opp = null;
try { opp = JSON.parse(run(OPP, [target, '--json', ...(opt('type') ? ['--industry', opt('type')] : [])])); } catch { /* fallback below */ }

// --- 2. Audit (JSON) ---
console.log('  • auditing speed/SEO/security…');
let audit = null;
try { audit = JSON.parse(run(AUDIT, [target, '--json'])); } catch { /* optional */ }

// --- Resolve business details (prefer flags, then opp detection) ---
const name = opt('name') || opp?.business || 'Your Business';
const type = opt('type') || opp?.industry || 'default';
const slug = slugify(opt('slug') || name);

// --- 3. Generate a matching demo ---
console.log('  • generating a matching demo site…');
const demoArgs = ['--name', name, '--type', type, '--slug', slug + '-demo'];
if (opt('city')) demoArgs.push('--city', opt('city'));
if (opt('phone')) demoArgs.push('--phone', opt('phone'));
if (opt('address')) demoArgs.push('--address', opt('address'));
run(DEMO, demoArgs);
const demoSrc = resolve(ROOT, 'demos', slug + '-demo', 'index.html');

// --- Assemble output dir ---
const outDir = resolve(process.cwd(), 'prospect-briefs', slug);
mkdirSync(outDir, { recursive: true });
// copy the demo alongside the brief so links work offline
if (existsSync(demoSrc)) {
  mkdirSync(resolve(outDir, 'demo'), { recursive: true });
  cpSync(demoSrc, resolve(outDir, 'demo', 'index.html'));
}

// --- Build the brief data ---
const opps = opp?.opportunities || [];
const counts = opp?.counts || { high: 0, medium: 0, low: 0 };
const oppScore = opp?.opportunityScore ?? 0;
const auditScore = audit?.siteWrightScore ?? null;
const auditGrade = audit?.grade ?? null;
const sevIcon = s => s === 'high' ? '🔴' : s === 'medium' ? '🟡' : '⚪';
const sevClass = s => s === 'high' ? 'high' : s === 'medium' ? 'med' : 'low';

const oppRows = opps.map((o, i) => `
    <div class="finding ${sevClass(o.severity)}">
      <div class="fhead"><span class="sev">${sevIcon(o.severity)} ${esc(o.severity)}</span> <strong>${esc(o.finding)}</strong></div>
      <div class="fimpact"><b>Why it matters:</b> ${esc(o.impact)}</div>
      <div class="ffix"><b>The fix:</b> ${esc(o.fix)}</div>
    </div>`).join('');

const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const auditBlock = auditScore != null ? `
      <div class="scorecard">
        <div class="scorenum">${auditScore}<span>/100</span></div>
        <div class="scorelabel">Current site score (grade ${esc(auditGrade)})</div>
        <div class="scoresub">${audit.https ? 'HTTPS ✅' : 'No HTTPS ❌'} · ${(audit.securityHeadersMissing || []).length} security headers missing</div>
      </div>` : '';

// --- The polished, print-ready HTML brief ---
const brief = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Website Review for ${esc(name)} — SiteWright</title>
<style>
  :root{--brand:#1d4ed8;--accent:#92400e;--ink:#0f172a;--muted:#64748b;--hi:#dc2626;--med:#d97706;--low:#64748b}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#eef2f7}
  .page{max-width:820px;margin:24px auto;background:#fff;box-shadow:0 8px 40px #0000001a;border-radius:14px;overflow:hidden}
  .cover{background:linear-gradient(135deg,var(--brand),#0369a1);color:#fff;padding:2.6rem 2.4rem}
  .cover .kicker{opacity:.85;font-weight:600;letter-spacing:.04em;text-transform:uppercase;font-size:.8rem}
  .cover h1{margin:.3rem 0 .2rem;font-size:2rem;line-height:1.15}
  .cover .sub{opacity:.92}
  .cover .meta{margin-top:1rem;font-size:.85rem;opacity:.85}
  .band{display:flex;gap:1rem;flex-wrap:wrap;padding:1.4rem 2.4rem;background:#f8fafc;border-bottom:1px solid #0000000d}
  .stat{flex:1;min-width:150px}
  .stat .n{font-size:1.9rem;font-weight:800;color:var(--brand)}
  .stat .l{color:var(--muted);font-size:.85rem}
  .scorecard{margin-left:auto;text-align:right}
  .scorenum{font-size:2.2rem;font-weight:800;color:var(--brand)}
  .scorenum span{font-size:1rem;color:var(--muted)}
  .scorelabel{font-size:.85rem;color:var(--muted)}
  .scoresub{font-size:.78rem;color:var(--muted)}
  section{padding:1.8rem 2.4rem}
  h2{color:var(--brand);font-size:1.3rem;margin:0 0 .8rem}
  .finding{border:1px solid #0000000f;border-left:4px solid var(--low);border-radius:8px;padding:.9rem 1rem;margin:.7rem 0;background:#fff}
  .finding.high{border-left-color:var(--hi);background:#fef2f2}
  .finding.med{border-left-color:var(--med);background:#fffbeb}
  .fhead{margin-bottom:.3rem}
  .sev{font-size:.75rem;text-transform:uppercase;font-weight:700;color:var(--muted);margin-right:.4rem}
  .fimpact,.ffix{font-size:.92rem;color:#334155}
  .ffix{margin-top:.2rem}
  .cta{background:var(--ink);color:#fff;padding:1.6rem 2.4rem;text-align:center}
  .cta a{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;padding:.85rem 1.6rem;border-radius:.6rem;margin-top:.6rem}
  .demo-note{font-size:.85rem;color:var(--muted);padding:.4rem 2.4rem 1.6rem}
  .foot{padding:1.2rem 2.4rem;color:var(--muted);font-size:.8rem;border-top:1px solid #0000000d}
  @media print{body{background:#fff}.page{box-shadow:none;margin:0;border-radius:0}.cta a{border:1px solid #fff}}
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <div class="kicker">Free Website Review · SiteWright</div>
    <h1>${esc(name)}</h1>
    <div class="sub">A quick look at your current website — what's working, what's costing you customers, and what I'd fix.</div>
    <div class="meta">Prepared ${today}${target && /^https?:/i.test(target) ? ` · reviewed ${esc(target)}` : ''}</div>
  </div>

  <div class="band">
    <div class="stat"><div class="n">${opps.length}</div><div class="l">improvements found</div></div>
    <div class="stat"><div class="n">${counts.high}</div><div class="l">high priority 🔴</div></div>
    <div class="stat"><div class="n">${counts.medium}</div><div class="l">medium 🟡</div></div>
    ${auditBlock}
  </div>

  <section>
    <h2>What I found on your current site</h2>
    ${opps.length ? oppRows : '<p>Your site is in good shape — few issues found. I can still make it faster and cheaper to run.</p>'}
  </section>

  <div class="cta">
    <div>I already built you a free starter site to show what's possible.</div>
    <a href="demo/index.html">👀 View your free demo site</a>
  </div>
  <div class="demo-note">The demo is a starting point that matches your business — the full site keeps everything good about your current one, fixes the issues above, and costs less than you'd expect. No obligation.</div>

  <div class="foot">
    Prepared by <b>SiteWright</b>. This review looks at publicly visible parts of your website only.
    Impact figures are industry estimates. Let's talk about a faster, secure, mobile-friendly site for less —
    reply to this email and I'll walk you through it.
  </div>
</div>
</body>
</html>`;

writeFileSync(resolve(outDir, 'prospect-brief.html'), brief);

// Also save a machine-readable bundle
writeFileSync(resolve(outDir, 'brief.json'), JSON.stringify({
  business: name, industry: type, source: target, generatedAt: new Date().toISOString(),
  opportunityScore: oppScore, opportunityCounts: counts, auditScore, auditGrade,
  opportunities: opps, demo: 'demo/index.html',
}, null, 2));

// A ready-to-send outreach email
const top = opps.slice(0, 3).map(o => `• ${o.finding} — ${o.impact}`).join('\n');
const first = String(name).split(/\s|'/)[0];
writeFileSync(resolve(outDir, 'outreach-email.txt'),
`Subject: A few things I noticed about ${name}'s website (+ a free demo)

Hi ${first},

I put together a quick, no-obligation review of your website. A few things stood out:

${top || '• A few quick wins to bring in more customers.'}

I also built you a free starter site so you can see what's possible. Full review + demo attached
(open prospect-brief.html).

I build fast, secure, mobile-friendly sites for local businesses — usually for less than what
you're paying now. Happy to walk you through it if you're interested.

Best,
[Your name]
`);

console.log(`\n✅ Prospect brief for "${name}" → prospect-briefs/${slug}/`);
console.log(`   • prospect-brief.html  (open in a browser → File ▸ Print ▸ Save as PDF to email)`);
console.log(`   • demo/index.html      (their free matching demo)`);
console.log(`   • outreach-email.txt   (ready-to-send message with the top 3 findings)`);
console.log(`   • brief.json           (data bundle)`);
console.log(`\n   Summary: ${opps.length} improvements (${counts.high} high) · current score ${auditScore ?? 'n/a'}${auditScore != null ? '/100' : ''}\n`);
