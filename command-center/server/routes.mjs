import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  listDeals, getDeal, createDeal, updateDeal, deleteDeal, listActivity, logActivity,
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
      createDeal({
        business_line: 'lodging', name: l.name, phone: l.phone || null, address: l.address || null,
        city, website: l.website || null, industry: l.type || null, source: `find-booking-leads: ${city}`,
        stage: 'lead', priority: l.priority || priorityFromScore(l.opportunityScore), opportunity_score: l.opportunityScore ?? null,
      });
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
  const args = ['--name', deal.name, '--slug', slug];
  if (deal.industry) args.push('--type', deal.industry);
  if (deal.city) args.push('--city', deal.city);
  if (deal.phone) args.push('--phone', deal.phone);
  if (deal.email) args.push('--email', deal.email);
  if (deal.address) args.push('--address', deal.address);
  const job = runNodeJob(SCRIPTS.demo, args);
  logActivity(deal.id, 'tool_run', 'Demo site generation started');
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'demos', slug, 'index.html');
    if (existsSync(path)) {
      updateDeal(deal.id, { demo_path: `demos/${slug}/index.html` });
      logActivity(deal.id, 'tool_run', 'Demo site ready');
    } else logActivity(deal.id, 'tool_run', 'Demo generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
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

router.post('/deals/:id/propose-lodging', (req, res) => {
  const deal = getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });
  const slug = dealSlug(deal);
  const args = [deal.name, '--slug', slug];
  if (deal.city) args.push('--city', deal.city);
  if (deal.contact_name) args.push('--contact', deal.contact_name);
  if (req.body?.platforms) args.push('--platforms', req.body.platforms);
  if (req.body?.bookingSystem) args.push('--booking-system', req.body.bookingSystem);
  if (req.body?.tier) args.push('--tier', req.body.tier);
  const job = runNodeJob(SCRIPTS.proposeLodging, args);
  logActivity(deal.id, 'tool_run', 'Lodging proposal generation started');
  waitForJob(job).then(j => {
    const path = resolve(ROOT, 'proposals/out', slug, 'proposal.html');
    if (existsSync(path)) {
      updateDeal(deal.id, { proposal_path: `proposals/out/${slug}/proposal.html` });
      logActivity(deal.id, 'tool_run', 'Lodging proposal ready');
    } else logActivity(deal.id, 'tool_run', 'Proposal generation finished but no file was found.');
  });
  res.status(202).json({ jobId: job.id });
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
  const args = [deal.name, '--slug', slug];
  if (deal.city) args.push('--city', deal.city);
  if (req.body?.platforms) args.push('--platforms', req.body.platforms);
  if (req.body?.bookingSystem) args.push('--booking-system', req.body.bookingSystem);
  const job = runNodeJob(SCRIPTS.listingKit, args);
  updateDeal(deal.id, { client_slug: slug, stage: 'won' });
  logActivity(deal.id, 'tool_run', 'Listing kit generation started');
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
  const map = { demo: deal.demo_path, proposal: deal.proposal_path, opportunityReport: deal.opportunity_report_path, dist: deal.dist_path && `${deal.dist_path}/index.html` };
  const rel = map[req.params.kind];
  if (!rel) return res.status(404).json({ error: 'Not generated yet.' });
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs) || !abs.startsWith(ROOT)) return res.status(404).json({ error: 'File not found on disk.' });
  res.sendFile(abs);
});
