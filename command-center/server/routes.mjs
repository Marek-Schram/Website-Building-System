import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, cpSync, readdirSync, statSync, rmSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import {
  listDeals, getDeal, createDeal, updateDeal, deleteDeal, listActivity, logActivity, listFollowUps,
} from './db.mjs';
import {
  ROOT, SCRIPTS, runNodeJob, getJob, waitForJob, runJsonTool, pipeJobToSSE,
} from './tools.mjs';
import { requireAuth, checkPassword, createSession, destroySession, setSessionCookie, clearSessionCookie, passwordConfigured, isAuthenticated, COOKIE } from './auth.mjs';
import { buildSite, parseFrontmatter, parseList } from '../../packages/site-builder/src/build.mjs';
import { CAT as ADDON_CAT, REC as ADDON_REC } from '../../packages/addons/src/addons.mjs';

export const router = Router();

const slugify = s => String(s || 'lead').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const dealSlug = deal => deal.client_slug || slugify(deal.name);
const priorityFromScore = score =>
  typeof score !== 'number' ? null : score >= 55 ? 'HOT' : score >= 35 ? 'WARM' : 'COOL';
const esc = s => String(s ?? '').replace(/"/g, "'");
const q = s => `"${esc(s)}"`;

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// Pulls the last JSON blob out of a job's captured stdout/stderr lines — used for tools run with --json
// whose exit code alone isn't the whole story (e.g. parity-check.mjs exits 1 on a real, readable "fail").
function lastJsonFromLines(lines) {
  const text = lines.join('\n');
  const start = text.indexOf('{'), altStart = text.indexOf('[');
  const from = start === -1 ? altStart : (altStart === -1 ? start : Math.min(start, altStart));
  if (from === -1) return null;
  try { return JSON.parse(text.slice(from)); } catch { return null; }
}

// Recursively lists files under `dir` (bounded depth + count) as paths relative to `dir` — used to browse
// chat-generated output (marketing-toolkit/<slug>/) that no script wrote a manifest for.
function listFilesRecursive(dir, { maxDepth = 3, maxFiles = 200 } = {}) {
  const out = [];
  (function walk(d, depth) {
    if (depth > maxDepth || out.length >= maxFiles) return;
    for (const name of readdirSync(d)) {
      if (out.length >= maxFiles) return;
      const abs = join(d, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, depth + 1);
      else out.push(relative(dir, abs));
    }
  })(dir, 0);
  return out.sort();
}

// ---------- auth ----------

router.get('/session', (req, res) => {
  res.json({ passwordConfigured: passwordConfigured(), authenticated: isAuthenticated(req) });
});

router.post('/login', (req, res) => {
  if (!passwordConfigured()) return res.status(500).json({ error: 'No COMMAND_CENTER_PASSWORD set in .env yet — see command-center/README.md.' });
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'Wrong password.' });
  const token = createSession();
  setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.use(requireAuth);

// ---------- deals (the pipeline board) ----------

router.get('/deals', (req, res) => {
  res.json(listDeals({ businessLine: req.query.businessLine, stage: req.query.stage }));
});

router.post('/deals', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'A business/property name is required.' });
  const deal = createDeal({
    business_line: b.business_line === 'lodging' ? 'lodging' : 'website',
    name: b.name.trim(), contact_name: b.contact_name || null, phone: b.phone || null, email: b.email || null,
    address: b.address || null, city: b.city || null, website: b.website || null, industry: b.industry || null,
    source: b.source || 'manual', stage: 'lead', deal_value: b.deal_value ?? null,
    next_action: b.next_action || null, follow_up_date: b.follow_up_date || null,
  });
  res.status(201).json(deal);
});

router.get('/deals/:id', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  res.json({ ...deal, activity: listActivity(deal.id) });
});

const EDITABLE_FIELDS = ['stage', 'contact_name', 'phone', 'email', 'address', 'city', 'website', 'industry',
  'deal_value', 'next_action', 'follow_up_date', 'invoiced_amount', 'name'];
router.patch('/deals/:id', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const fields = {};
  for (const k of EDITABLE_FIELDS) if (req.body[k] !== undefined) fields[k] = req.body[k];
  res.json(updateDeal(deal.id, fields));
});

router.delete('/deals/:id', (req, res) => {
  if (!getDeal(req.params.id)) return res.status(404).json({ error: 'Deal not found.' });
  deleteDeal(req.params.id);
  res.json({ ok: true });
});

router.post('/deals/:id/activity', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Note text is required.' });
  logActivity(deal.id, req.body.type && ['note', 'call', 'email'].includes(req.body.type) ? req.body.type : 'note', text);
  res.status(201).json({ activity: listActivity(deal.id) });
});

// Cross-board follow-up reminders: every deal with a follow_up_date set, split into overdue / upcoming
// (next 14 days) / later — so a due date doesn't just sit quietly on a card in whatever column it's in.
router.get('/follow-ups', (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const soonStr = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const all = listFollowUps();
  const overdue = all.filter(d => d.follow_up_date < todayStr);
  const upcoming = all.filter(d => d.follow_up_date >= todayStr && d.follow_up_date <= soonStr);
  const later = all.filter(d => d.follow_up_date > soonStr);
  res.json({ overdue, upcoming, later });
});

// ---------- jobs (SSE progress for long-running tools) ----------

router.get('/jobs/:id/stream', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  pipeJobToSSE(job, res);
});

// ---------- importing leads (bulk-create deals from a scan) ----------

router.post('/import/leads', (req, res) => {
  const { niche, city, max } = req.body || {};
  if (!niche || !city) return res.status(400).json({ error: 'Both a niche (e.g. "bakery") and a city are required.' });
  const args = [niche, city, '--max', String(max || 20)];
  const job = runNodeJob(SCRIPTS.findLeads, args, { meta: { kind: 'import-leads' } });
  waitForJob(job).then(j => {
    if (j.status !== 'done') return;
    const fromFile = readJsonIfExists(resolve(ROOT, 'leads.json'));
    const text = j.lines.join('\n');
    let leads = fromFile?.leads;
    if (!leads) { try { leads = JSON.parse(text.slice(text.indexOf('['))); } catch { leads = []; } }
    let created = 0;
    for (const l of leads || []) {
      if (!l.name) continue;
      createDeal({
        business_line: 'website', name: l.name, phone: l.phone || null, address: l.address || null,
        city, website: l.website || null, industry: l.type || niche, source: `find-leads: ${niche} in ${city}`,
        stage: 'lead', priority: l.priority || priorityFromScore(l.opportunityScore), opportunity_score: l.opportunityScore ?? null,
      });
      created++;
    }
    job.meta.created = created;
  });
  res.status(202).json({ jobId: job.id });
});

router.post('/import/booking-leads', (req, res) => {
  const { city, types, max } = req.body || {};
  if (!city) return res.status(400).json({ error: 'A city is required.' });
  const args = [city, '--max', String(max || 20)];
  if (types) args.push('--types', types);
  const job = runNodeJob(SCRIPTS.findBookingLeads, args, { meta: { kind: 'import-booking-leads' } });
  waitForJob(job).then(j => {
    if (j.status !== 'done') return;
    const data = readJsonIfExists(resolve(ROOT, 'lodging-prospects/out', slugify(city) + '.json'));
    let created = 0;
    for (const l of data?.leads || []) {
      if (!l.name) continue;
      // find-booking-leads already did the hard part — which platforms they're missing from, and which
      // booking system they run (own-site scan). Keep both instead of throwing this away on import.
      const deal = createDeal({
        business_line: 'lodging', name: l.name, phone: l.phone || null, address: l.address || null,
        city, website: l.website || null, industry: l.type || null, source: `find-booking-leads: ${city}`,
        stage: 'lead', priority: l.priority || priorityFromScore(l.opportunityScore), opportunity_score: l.opportunityScore ?? null,
        detected_booking_system: (l.own?.systems || [])[0] || null,
        platform_presence: l.presence ? JSON.stringify(l.presence) : null,
      });
      if (l.presence?.length) {
        const missing = l.presence.filter(p => !p.found).map(p => p.label);
        logActivity(deal.id, 'note', missing.length
          ? `Missing from: ${missing.join(', ')}${l.own?.systems?.length ? ` · runs ${l.own.systems.join(', ')}` : ''}`
          : 'Already listed on all checked platforms');
      }
      created++;
    }
    job.meta.created = created;
  });
  res.status(202).json({ jobId: job.id });
});

router.get('/jobs/:id/result', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found (server may have restarted).' });
  res.json({ status: job.status, code: job.code, meta: job.meta });
});

// ---------- prospecting actions on a single deal ----------

router.post('/deals/:id/scan-opportunities', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.website) return res.status(400).json({ error: 'This deal has no website URL to scan yet — add one first.' });
  const slug = dealSlug(deal);
  const job = runNodeJob(SCRIPTS.opportunities, [deal.website, '--slug', slug, ...(deal.industry ? ['--industry', deal.industry] : [])]);
  logActivity(deal.id, 'tool_run', `Opportunity scan started for ${deal.website}`);
  waitForJob(job).then(j => {
    const report = readJsonIfExists(resolve(ROOT, 'opportunities', slug, 'report.json'));
    if (!report) { logActivity(deal.id, 'tool_run', 'Opportunity scan finished with no readable report.'); return; }
    updateDeal(deal.id, {
      opportunity_score: report.opportunityScore, priority: priorityFromScore(report.opportunityScore),
      opportunity_report_path: `opportunities/${slug}/report.md`,
    });
    logActivity(deal.id, 'tool_run', `Opportunity scan done — ${report.opportunities.length} findings, score ${report.opportunityScore}/100`);
  });
  res.status(202).json({ jobId: job.id });
});

router.post('/deals/:id/generate-demo', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  // A high-quality /demo-site (Full mode) may already exist at this same demos/<slug>/ path — its
  // demos/<slug>/_source/ directory is the marker. Quick mode would silently overwrite it, so this
  // requires an explicit confirm (force:true) rather than clobbering real authored work unasked.
  const hasFullDemo = existsSync(resolve(ROOT, 'demos', slug, '_source'));
  if (hasFullDemo && !req.body?.force) {
    return res.status(409).json({ needsConfirm: true, message: 'A high-quality demo already exists for this deal — generating a quick demo will replace it.' });
  }
  const args = ['--name', deal.name, '--slug', slug];
  if (deal.industry) args.push('--type', deal.industry);
  if (deal.website) args.push('--url', deal.website);
  if (deal.city) args.push('--city', deal.city);
  if (deal.phone) args.push('--phone', deal.phone);
  if (deal.email) args.push('--email', deal.email);
  if (deal.address) args.push('--address', deal.address);
  const job = runNodeJob(SCRIPTS.demo, args);
  logActivity(deal.id, 'tool_run', 'Demo site generation started');
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'demos', slug, 'index.html');
    if (existsSync(path)) {
      // Clean up the stale _source/ marker so a later "Check for full demo" can't false-positive on a
      // full demo that's actually just been overwritten by this quick one.
      if (hasFullDemo) rmSync(resolve(ROOT, 'demos', slug, '_source'), { recursive: true, force: true });
      updateDeal(deal.id, { demo_path: `demos/${slug}/index.html`, demo_quality: 'quick' });
      logActivity(deal.id, 'tool_run', hasFullDemo ? 'Quick demo regenerated — overwrote the earlier high-quality demo at the same path.' : 'Demo site ready');
    } else logActivity(deal.id, 'tool_run', 'Demo generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
});

// ---------- full demo (Claude-authored /demo-site Full mode — same flag+detect pattern as marketing-kit
// above: the board can't run an interactive Claude Code skill, only flag it for the human to run in chat
// and detect the result once it exists) ----------

router.post('/deals/:id/full-demo/flag', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  updateDeal(deal.id, { needs_full_demo: 1 });
  logActivity(deal.id, 'note', `Flagged for /demo-site ${slug} (Full mode) — run it in Claude Code chat.`);
  res.json({ ok: true, slug });
});

router.post('/deals/:id/full-demo/check', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  const indexPath = resolve(ROOT, 'demos', slug, 'index.html');
  const sourceDir = resolve(ROOT, 'demos', slug, '_source');
  if (!existsSync(indexPath) || !existsSync(sourceDir)) return res.json({ found: false });
  updateDeal(deal.id, { demo_path: `demos/${slug}/index.html`, demo_quality: 'full', needs_full_demo: 0 });
  logActivity(deal.id, 'tool_run', 'High-quality demo found — /demo-site Full mode completed.');
  res.json({ found: true });
});

router.post('/deals/:id/generate-brief', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.website) return res.status(400).json({ error: 'This deal has no website URL — a pitch packet needs one to review.' });
  const slug = dealSlug(deal);
  const args = [deal.website, '--slug', slug, '--name', deal.name];
  if (deal.industry) args.push('--type', deal.industry);
  if (deal.city) args.push('--city', deal.city);
  if (deal.phone) args.push('--phone', deal.phone);
  if (deal.address) args.push('--address', deal.address);
  const job = runNodeJob(SCRIPTS.prospectBrief, args);
  logActivity(deal.id, 'tool_run', 'Pitch packet generation started');
  waitForJob(job).then(j => {
    const data = readJsonIfExists(resolve(ROOT, 'prospect-briefs', slug, 'brief.json'));
    const path = resolve(ROOT, 'prospect-briefs', slug, 'prospect-brief.html');
    if (existsSync(path)) {
      updateDeal(deal.id, {
        proposal_path: `prospect-briefs/${slug}/prospect-brief.html`,
        ...(data ? { opportunity_score: data.opportunityScore, priority: priorityFromScore(data.opportunityScore) } : {}),
      });
      logActivity(deal.id, 'tool_run', 'Pitch packet ready — send prospect-brief.html + outreach-email.txt');
    } else logActivity(deal.id, 'tool_run', 'Pitch packet generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
});

// Keyless single-property check (re-runs find-booking-leads against just this deal's own site) — the
// "which platforms are they missing, what do they already run" evidence that makes the pitch honest.
router.post('/deals/:id/check-booking-presence', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (deal.business_line !== 'lodging') return res.status(400).json({ error: 'Booking-presence checks are for lodging deals.' });
  if (!deal.website) return res.status(400).json({ error: 'This deal has no website URL to check.' });
  const args = ['--url', deal.website, '--name', deal.name];
  if (deal.city) args.push('--city', deal.city);
  const job = runNodeJob(SCRIPTS.findBookingLeads, args);
  logActivity(deal.id, 'tool_run', 'Booking-platform presence check started');
  waitForJob(job).then(j => {
    const data = readJsonIfExists(resolve(ROOT, 'lodging-prospects/out', slugify(deal.name) + '.json'));
    const lead = data?.leads?.[0];
    if (!lead) { logActivity(deal.id, 'tool_run', 'Presence check finished but produced no readable result.'); return; }
    updateDeal(deal.id, {
      opportunity_score: lead.opportunityScore, priority: lead.priority || priorityFromScore(lead.opportunityScore),
      detected_booking_system: (lead.own?.systems || [])[0] || null,
      platform_presence: lead.presence ? JSON.stringify(lead.presence) : null,
    });
    const missing = (lead.presence || []).filter(p => !p.found).map(p => p.label);
    logActivity(deal.id, 'tool_run', missing.length
      ? `Missing from: ${missing.join(', ')}${lead.own?.systems?.length ? ` · runs ${lead.own.systems.join(', ')}` : ''}`
      : 'Already listed on all checked platforms');
  });
  res.status(202).json({ jobId: job.id });
});

router.post('/deals/:id/propose-lodging', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  const platforms = req.body?.platforms || deal.platforms_wanted || 'airbnb,vrbo';
  const bookingSystem = req.body?.bookingSystem || deal.detected_booking_system || '';
  const args = [deal.name, '--slug', slug, '--platforms', platforms];
  if (deal.city) args.push('--city', deal.city);
  if (deal.contact_name) args.push('--contact', deal.contact_name);
  if (deal.industry) args.push('--property-type', deal.industry);
  if (bookingSystem) args.push('--booking-system', bookingSystem);
  if (req.body?.tier) args.push('--tier', req.body.tier);
  // Remember whatever was actually used (including a manually-typed booking system) so it carries forward
  // to the listing kit later instead of asking Marek to type it twice.
  updateDeal(deal.id, { platforms_wanted: platforms, ...(bookingSystem ? { detected_booking_system: bookingSystem } : {}) });
  const job = runNodeJob(SCRIPTS.proposeLodging, args);
  logActivity(deal.id, 'tool_run', `Lodging proposal generation started (${platforms})`);
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'proposals/out', slug, 'proposal.html');
    if (existsSync(path)) {
      updateDeal(deal.id, { proposal_path: `proposals/out/${slug}/proposal.html` });
      logActivity(deal.id, 'tool_run', 'Lodging proposal ready');
    } else logActivity(deal.id, 'tool_run', 'Proposal generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
});

// Captures the OLD site (deal.website, when replacing an existing site — /match-site's capture step) as a
// parity baseline: style + every feature it has, so a rebuild can be checked against losing nothing.
router.post('/deals/:id/capture-old-site', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (deal.business_line !== 'website') return res.status(400).json({ error: 'Parity checks are for website deals (replacing an existing site).' });
  if (!deal.website) return res.status(400).json({ error: 'This deal has no website URL to capture yet — add the old site\'s URL first.' });
  const slug = dealSlug(deal);
  const job = runNodeJob(SCRIPTS.captureOldSite, [deal.website, '--slug', slug]);
  logActivity(deal.id, 'tool_run', `Capturing old site (${deal.website}) as a parity baseline`);
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'parity', slug, 'baseline.json');
    if (existsSync(path)) {
      updateDeal(deal.id, { parity_baseline_path: `parity/${slug}/baseline.json`, parity_status: null, parity_result: null, parity_checked_at: null });
      logActivity(deal.id, 'tool_run', 'Old site captured — style + functionality baseline ready for parity checks');
    } else logActivity(deal.id, 'tool_run', 'Capture finished but no baseline was written (site may be unreachable).');
  });
  res.status(202).json({ jobId: job.id });
});

router.post('/deals/:id/run-parity-check', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.parity_baseline_path) return res.status(400).json({ error: 'Capture the old site first — there is no baseline to compare against.' });
  const distIndex = deal.dist_path && resolve(ROOT, deal.dist_path, 'index.html');
  const target = deal.live_url || distIndex;
  if (!target || (!deal.live_url && !existsSync(target))) return res.status(400).json({ error: 'Build (or deploy) the new site first — there is nothing to compare yet.' });
  const slug = dealSlug(deal);
  const job = runNodeJob(SCRIPTS.parityCheck, [slug, target, '--json']);
  logActivity(deal.id, 'tool_run', `Parity check started against ${target}`);
  waitForJob(job).then(j => {
    const data = lastJsonFromLines(j.lines);
    if (!data) { logActivity(deal.id, 'tool_run', 'Parity check finished but produced no readable result.'); return; }
    const r = data.results || {};
    updateDeal(deal.id, {
      parity_status: data.pass ? 'pass' : 'fail',
      parity_result: JSON.stringify(r),
      parity_checked_at: new Date().toISOString(),
    });
    logActivity(deal.id, 'tool_run', data.pass
      ? `Parity check PASSED — ${r.preserved?.length || 0} preserved, ${r.improvements?.length || 0} added, 0 regressions`
      : `Parity check found ${r.regressions?.length || 0} regression(s): ${(r.regressions || []).join(', ')} — fix before launch`);
  });
  res.status(202).json({ jobId: job.id });
});

// ---------- marketing kit (chat-driven /marketing-kit skill — the board can only flag + detect it, the
// same "not a script" pattern as the security gate) ----------

router.post('/deals/:id/marketing-kit/flag', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  updateDeal(deal.id, { needs_marketing_kit: 1 });
  logActivity(deal.id, 'note', `Flagged for /marketing-kit ${slug} — run it in Claude Code chat.`);
  res.json({ ok: true, slug });
});

router.post('/deals/:id/marketing-kit/check', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  const dir = resolve(ROOT, 'marketing-toolkit', slug);
  if (!existsSync(dir)) return res.json({ found: false });
  const files = listFilesRecursive(dir);
  if (!files.length) return res.json({ found: false });
  updateDeal(deal.id, { marketing_kit_path: `marketing-toolkit/${slug}`, needs_marketing_kit: 0 });
  logActivity(deal.id, 'tool_run', `Marketing kit found — ${files.length} file(s) in marketing-toolkit/${slug}`);
  res.json({ found: true, files });
});

router.get('/deals/:id/marketing-kit/files', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.marketing_kit_path) return res.json({ files: [] });
  const dir = resolve(ROOT, deal.marketing_kit_path);
  if (!existsSync(dir)) return res.json({ files: [] });
  res.json({ files: listFilesRecursive(dir) });
});

router.get('/deals/:id/marketing-kit/file', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.marketing_kit_path) return res.status(404).json({ error: 'No marketing kit for this deal yet.' });
  const dir = resolve(ROOT, deal.marketing_kit_path);
  const rel = String(req.query.path || '');
  const abs = resolve(dir, rel);
  if (!abs.startsWith(dir + '/') && abs !== dir) return res.status(400).json({ error: 'Invalid path.' });
  if (!existsSync(abs) || !statSync(abs).isFile()) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(abs);
});

// ---------- invoicing (packages/invoicing) ----------

router.post('/deals/:id/invoice/generate', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const items = (req.body?.items || []).filter(i => i && String(i.desc || '').trim() && Number(i.amount) > 0)
    .map(i => ({ desc: String(i.desc).trim(), amount: Number(i.amount) }));
  if (!items.length) return res.status(400).json({ error: 'At least one line item (description + amount) is required.' });
  const slug = dealSlug(deal);
  const number = deal.invoice_number || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(deal.id).padStart(4, '0')}`;
  const dueDate = req.body?.dueDate || '';
  const notes = req.body?.notes || '';
  const args = [deal.name, '--slug', slug, '--number', number, '--items', JSON.stringify(items), '--business-line', deal.business_line];
  if (dueDate) args.push('--due', dueDate);
  if (notes) args.push('--notes', notes);
  if (deal.contact_name) args.push('--bill-contact', deal.contact_name);
  if (deal.email) args.push('--bill-email', deal.email);
  if (deal.address) args.push('--bill-address', deal.address + (deal.city ? `, ${deal.city}` : ''));
  updateDeal(deal.id, { invoice_number: number, invoice_status: 'draft', invoice_items: JSON.stringify(items), invoice_due_date: dueDate || null, invoice_paid_at: null });
  const job = runNodeJob(SCRIPTS.invoice, args);
  logActivity(deal.id, 'tool_run', `Invoice ${number} generation started (${items.length} item(s))`);
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'invoices/out', slug, `invoice-${number}.html`);
    if (existsSync(path)) {
      updateDeal(deal.id, { invoice_path: `invoices/out/${slug}/invoice-${number}.html` });
      const total = items.reduce((s, i) => s + i.amount, 0);
      logActivity(deal.id, 'tool_run', `Invoice ${number} ready — $${total.toLocaleString()}`);
    } else logActivity(deal.id, 'tool_run', 'Invoice generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
});

router.post('/deals/:id/invoice/mark-sent', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.invoice_path) return res.status(400).json({ error: 'Generate an invoice first.' });
  updateDeal(deal.id, { invoice_status: 'sent' });
  logActivity(deal.id, 'note', `Invoice ${deal.invoice_number} marked sent`);
  res.json({ ok: true });
});

router.post('/deals/:id/invoice/mark-paid', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (!deal.invoice_path) return res.status(400).json({ error: 'Generate an invoice first.' });
  let items = [];
  try { items = JSON.parse(deal.invoice_items || '[]'); } catch { /* fall through with empty items */ }
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  updateDeal(deal.id, {
    invoice_status: 'paid', invoice_paid_at: new Date().toISOString(), stage: 'invoiced',
    ...(deal.invoiced_amount == null && total ? { invoiced_amount: total } : {}),
  });
  logActivity(deal.id, 'note', `Invoice ${deal.invoice_number} marked paid — moved to Invoiced`);
  res.json({ ok: true });
});

// ---------- winning the deal / delivery ----------

router.post('/deals/:id/start-client', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  if (deal.business_line !== 'website') return res.status(400).json({ error: 'Only website deals get a client folder — lodging deals use the listing kit instead.' });
  const slug = dealSlug(deal);
  const clientDir = resolve(ROOT, 'clients', slug);
  if (!existsSync(clientDir)) {
    cpSync(resolve(ROOT, 'clients/_template'), clientDir, { recursive: true });
    const cfgPath = resolve(clientDir, 'brand/brand.config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    cfg.businessName = deal.name;
    if (deal.industry) cfg.industry = deal.industry;
    cfg.contact = cfg.contact || {};
    if (deal.phone) cfg.contact.phone = deal.phone;
    if (deal.email) cfg.contact.email = deal.email;
    if (deal.address) cfg.contact.address = deal.address;
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    logActivity(deal.id, 'tool_run', `Client folder created at clients/${slug} (pre-filled from deal info)`);
  }
  updateDeal(deal.id, { client_slug: slug, stage: 'won' });
  res.json({ slug });
});

router.post('/deals/:id/listing-kit', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  const platforms = req.body?.platforms || deal.platforms_wanted || 'airbnb,vrbo';
  const bookingSystem = req.body?.bookingSystem || deal.detected_booking_system || '';
  const args = [deal.name, '--slug', slug, '--platforms', platforms];
  if (deal.city) args.push('--city', deal.city);
  if (bookingSystem) args.push('--booking-system', bookingSystem);
  const job = runNodeJob(SCRIPTS.listingKit, args);
  updateDeal(deal.id, { client_slug: slug, stage: 'won', platforms_wanted: platforms, ...(bookingSystem ? { detected_booking_system: bookingSystem } : {}) });
  logActivity(deal.id, 'tool_run', `Listing kit generation started (${platforms})`);
  waitForJob(job).then(j => logActivity(deal.id, 'tool_run', j.status === 'done' ? 'Listing kit ready in listing-kit/out/' + slug : 'Listing kit generation failed'));
  res.status(202).json({ jobId: job.id });
});

// ---------- brand / content editing (website deals only) ----------

function requireClient(req, res) {
  const deal = getDeal(req.params.id);
  if (!deal) { res.status(404).json({ error: 'Deal not found.' }); return null; }
  if (!deal.client_slug) { res.status(400).json({ error: 'Start the client first (Won stage) before editing its site.' }); return null; }
  const dir = resolve(ROOT, 'clients', deal.client_slug);
  if (!existsSync(dir)) { res.status(404).json({ error: `clients/${deal.client_slug} is missing on disk.` }); return null; }
  return { deal, dir };
}

router.get('/deals/:id/brand', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  res.json(JSON.parse(readFileSync(resolve(ctx.dir, 'brand/brand.config.json'), 'utf8')));
});

router.put('/deals/:id/brand', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  writeFileSync(resolve(ctx.dir, 'brand/brand.config.json'), JSON.stringify(req.body, null, 2));
  logActivity(ctx.deal.id, 'note', 'Brand config updated');
  res.json({ ok: true });
});

const CONTENT_PAGES = ['home', 'about', 'services', 'contact', 'testimonials', 'faq', 'gallery'];
router.get('/deals/:id/content/:page', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  const page = req.params.page;
  if (!CONTENT_PAGES.includes(page)) return res.status(400).json({ error: 'Unknown content page.' });
  const path = resolve(ctx.dir, 'content', page + '.md');
  if (!existsSync(path)) return res.json({ data: {}, body: '', items: [] });
  const { data, body } = parseFrontmatter(readFileSync(path, 'utf8'));
  const listPages = ['services', 'testimonials', 'faq', 'gallery'];
  res.json({ data, body: listPages.includes(page) ? '' : body, items: listPages.includes(page) ? parseList(body) : [] });
});

function stringifyContent(page, { data, body, items }) {
  const fm = Object.entries(data || {}).map(([k, v]) => `${k}: ${q(v)}`).join('\n');
  const listPages = ['services', 'testimonials', 'faq', 'gallery'];
  const content = listPages.includes(page)
    ? (items || []).map(item => Object.entries(item).filter(([, v]) => v).map(([k, v], i) => `${i === 0 ? '- ' : '  '}${k}: ${q(v)}`).join('\n')).join('\n')
    : (body || '');
  return `---\n${fm}\n---\n${content}\n`;
}

router.put('/deals/:id/content/:page', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  const page = req.params.page;
  if (!CONTENT_PAGES.includes(page)) return res.status(400).json({ error: 'Unknown content page.' });
  writeFileSync(resolve(ctx.dir, 'content', page + '.md'), stringifyContent(page, req.body || {}));
  logActivity(ctx.deal.id, 'note', `Content updated: ${page}.md`);
  res.json({ ok: true });
});

// ---------- add-ons ----------

router.get('/addons', (req, res) => {
  const industry = req.query.industry;
  const recommended = new Set(ADDON_REC[industry] || ADDON_REC.default);
  res.json(ADDON_CAT.map(a => ({ ...a, recommended: recommended.has(a.id) })));
});

router.post('/deals/:id/addons', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  const addonId = req.body?.id;
  if (!addonId || !ADDON_CAT.find(a => a.id === addonId)) return res.status(400).json({ error: 'Unknown add-on id.' });
  const cfgPath = resolve(ctx.dir, 'brand/brand.config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.addons = cfg.addons || [];
  if (!cfg.addons.includes(addonId)) cfg.addons.push(addonId);
  if (req.body.config) { cfg.addonConfig = cfg.addonConfig || {}; cfg.addonConfig[addonId] = req.body.config; }
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  logActivity(ctx.deal.id, 'note', `Add-on enabled: ${addonId}`);
  res.json(cfg);
});

router.delete('/deals/:id/addons/:addonId', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  const cfgPath = resolve(ctx.dir, 'brand/brand.config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.addons = (cfg.addons || []).filter(a => a !== req.params.addonId);
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  logActivity(ctx.deal.id, 'note', `Add-on removed: ${req.params.addonId}`);
  res.json(cfg);
});

// ---------- build / test / security gate / deploy ----------

router.post('/deals/:id/build', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  try {
    const r = buildSite(ctx.deal.client_slug, { force: !!req.body?.force });
    updateDeal(ctx.deal.id, { dist_path: `dist/${ctx.deal.client_slug}` });
    logActivity(ctx.deal.id, 'tool_run', `Built site — ${r.applied.length} add-on(s) applied${r.warnings.length ? `, ${r.warnings.length} warning(s)` : ''}`);
    res.json(r);
  } catch (err) {
    logActivity(ctx.deal.id, 'tool_run', `Build failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.post('/deals/:id/test', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  const target = resolve(ROOT, 'dist', ctx.deal.client_slug, 'index.html');
  if (!existsSync(target)) return res.status(400).json({ error: 'Build the site first — there is no dist/ output to test yet.' });
  const job = runNodeJob(SCRIPTS.testRunAll, [target]);
  logActivity(ctx.deal.id, 'tool_run', 'Test suite started');
  waitForJob(job).then(j => logActivity(ctx.deal.id, 'tool_run', j.status === 'done' ? 'Tests passed' : 'Tests reported failures — see the run for details'));
  res.status(202).json({ jobId: job.id });
});

router.post('/deals/:id/security-gate/flag', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  updateDeal(deal.id, { needs_security_gate: 1 });
  logActivity(deal.id, 'note', `Flagged for /security-gate ${deal.client_slug || ''} — run it in Claude Code chat.`);
  res.json({ ok: true });
});

router.post('/deals/:id/security-gate/clear', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  updateDeal(deal.id, { needs_security_gate: 0 });
  logActivity(deal.id, 'note', 'Security gate cleared');
  res.json({ ok: true });
});

router.post('/deals/:id/deploy', (req, res) => {
  const ctx = requireClient(req, res); if (!ctx) return;
  if (!existsSync(resolve(ROOT, 'dist', ctx.deal.client_slug, 'index.html'))) return res.status(400).json({ error: 'Build the site first.' });
  const job = runNodeJob(SCRIPTS.deploy, [ctx.deal.client_slug]);
  logActivity(ctx.deal.id, 'tool_run', 'Deploy started');
  waitForJob(job).then(j => {
    const text = j.lines.join('\n');
    const m = text.match(/https:\/\/[a-z0-9.-]*\.(pages|workers)\.dev\S*/i) || text.match(/https:\/\/\S+/);
    if (j.status === 'done' && m) {
      updateDeal(ctx.deal.id, { live_url: m[0], stage: 'delivered' });
      logActivity(ctx.deal.id, 'tool_run', `Deployed — ${m[0]}`);
    } else {
      logActivity(ctx.deal.id, 'tool_run', 'Deploy did not confirm a live URL — check CLOUDFLARE_API_TOKEN and wrangler output.');
    }
  });
  res.status(202).json({ jobId: job.id });
});

// ---------- files: let the UI open what the tools produced ----------

router.get('/deals/:id/files/:kind', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const map = {
    demo: deal.demo_path, proposal: deal.proposal_path, opportunityReport: deal.opportunity_report_path,
    dist: deal.dist_path && `${deal.dist_path}/index.html`, invoice: deal.invoice_path,
    parityBrief: deal.parity_baseline_path && deal.parity_baseline_path.replace(/baseline\.json$/, 'baseline.md'),
  };
  const rel = map[req.params.kind];
  if (!rel) return res.status(404).json({ error: 'Not generated yet.' });
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs) || !abs.startsWith(ROOT)) return res.status(404).json({ error: 'File not found on disk.' });
  res.sendFile(abs);
});
