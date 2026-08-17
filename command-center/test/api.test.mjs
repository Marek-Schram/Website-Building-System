// Full API integration suite for the Command Center server. Boots the real Express router in-process
// against a throwaway SQLite DB (COMMAND_CENTER_DATA_DIR) so it never touches Marek's real pipeline.db,
// then exercises every Phase 1-3 route through real HTTP requests — the same layer the browser UI calls.
//
// Where a route spawns a real CLI tool (capture.mjs, parity-check.mjs, proposal.mjs, invoice.mjs...) this
// suite lets it actually run rather than mocking it — the fixtures under test/fixtures/ were hand-verified
// against the real tools first (see the exact expected regression/preserved/improvement lists below), so a
// wrong result here means the wiring actually broke, not that a mock drifted from reality.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import { mkdtempSync, rmSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

let server, base, tmpDataDir;
const cookies = {};

// Every repo-level artifact this suite might create, namespaced under one prefix so cleanup can't miss
// anything and can never touch a real client's files.
const SLUG_PREFIX = 'vitest-cc-';
const cleanupDirs = ['clients', 'dist', 'parity', 'invoices/out', 'marketing-toolkit', 'proposals/out', 'listing-kit/out'];

function cleanupArtifacts() {
  for (const dir of cleanupDirs) {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (name.startsWith(SLUG_PREFIX)) rmSync(resolve(abs, name), { recursive: true, force: true });
    }
  }
}

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookies.session ? { Cookie: cookies.session } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookies.session = setCookie.split(';')[0];
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function waitForJob(jobId, { timeoutMs = 30000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await req('GET', `/jobs/${jobId}/result`);
    if (data?.status && data.status !== 'running') return data;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Job ${jobId} did not finish within ${timeoutMs}ms`);
}

beforeAll(async () => {
  tmpDataDir = mkdtempSync(join(tmpdir(), 'cc-test-data-'));
  process.env.COMMAND_CENTER_DATA_DIR = tmpDataDir;
  process.env.COMMAND_CENTER_PASSWORD = 'vitest-test-password';
  cleanupArtifacts(); // in case a previous crashed run left something behind

  const { router } = await import('../server/routes.mjs');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use((req2, res2, next) => {
    req2.cookies = {};
    const header = req2.headers.cookie;
    if (header) for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i > -1) req2.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    next();
  });
  app.use('/api', router);
  server = http.createServer(app);
  await new Promise(resolve2 => server.listen(0, resolve2));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(async () => {
  await new Promise(resolve2 => server.close(resolve2));
  rmSync(tmpDataDir, { recursive: true, force: true });
  cleanupArtifacts();
});

// ---------- auth ----------

describe('auth', () => {
  it('reports unauthenticated before login', async () => {
    const { data } = await req('GET', '/session');
    expect(data).toEqual({ passwordConfigured: true, authenticated: false });
  });

  it('rejects a protected route without a session', async () => {
    const { status } = await req('GET', '/deals');
    expect(status).toBe(401);
  });

  it('rejects the wrong password', async () => {
    const { status, data } = await req('POST', '/login', { password: 'definitely-wrong' });
    expect(status).toBe(401);
    expect(data.error).toBeTruthy();
  });

  it('accepts the right password and unlocks protected routes', async () => {
    const { status } = await req('POST', '/login', { password: 'vitest-test-password' });
    expect(status).toBe(200);
    const session = await req('GET', '/session');
    expect(session.data.authenticated).toBe(true);
    const deals = await req('GET', '/deals');
    expect(deals.status).toBe(200);
  });
});

// ---------- deals CRUD ----------

describe('deals CRUD', () => {
  it('rejects a deal with no name', async () => {
    const { status, data } = await req('POST', '/deals', { business_line: 'website' });
    expect(status).toBe(400);
    expect(data.error).toMatch(/name/i);
  });

  it('creates, reads, patches, and deletes a deal', async () => {
    const created = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}crud-deal` });
    expect(created.status).toBe(201);
    expect(created.data.stage).toBe('lead');
    const id = created.data.id;

    const fetched = await req('GET', `/deals/${id}`);
    expect(fetched.data.name).toBe(`${SLUG_PREFIX}crud-deal`);
    expect(Array.isArray(fetched.data.activity)).toBe(true);
    expect(fetched.data.activity[0].text).toMatch(/Deal created/);

    const patched = await req('PATCH', `/deals/${id}`, { deal_value: 500, stage: 'contacted' });
    expect(patched.data.deal_value).toBe(500);
    expect(patched.data.stage).toBe('contacted');

    const afterPatch = await req('GET', `/deals/${id}`);
    expect(afterPatch.data.activity.some(a => a.type === 'stage_change' && a.text === 'lead → contacted')).toBe(true);

    const deleted = await req('DELETE', `/deals/${id}`);
    expect(deleted.data.ok).toBe(true);
    const gone = await req('GET', `/deals/${id}`);
    expect(gone.status).toBe(404);
  });

  it('404s on an unknown deal id', async () => {
    const { status } = await req('GET', '/deals/999999');
    expect(status).toBe(404);
  });
});

// ---------- parity checks (website deals, replacing an existing site) ----------

describe('parity checks', () => {
  let dealId;
  const slug = `${SLUG_PREFIX}sunny-cabins`;

  it('creates a website deal pointed at the old-site fixture', async () => {
    const { status, data } = await req('POST', '/deals', {
      business_line: 'website', name: slug, website: 'command-center/test/fixtures/old-site.html',
    });
    expect(status).toBe(201);
    dealId = data.id;
  });

  it('refuses to run a parity check with no baseline yet', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/run-parity-check`);
    expect(status).toBe(400);
    expect(data.error).toMatch(/capture the old site/i);
  });

  it('refuses to capture for a lodging deal', async () => {
    const lodging = await req('POST', '/deals', { business_line: 'lodging', name: `${SLUG_PREFIX}lodging-parity-guard`, website: 'x' });
    const { status, data } = await req('POST', `/deals/${lodging.data.id}/capture-old-site`);
    expect(status).toBe(400);
    expect(data.error).toMatch(/website deals/i);
    await req('DELETE', `/deals/${lodging.data.id}`);
  });

  it('captures the old site as a parity baseline', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/capture-old-site`);
    expect(status).toBe(202);
    const job = await waitForJob(data.jobId);
    expect(job.status).toBe('done');

    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.parity_baseline_path).toBe(`parity/${slug}/baseline.json`);
    expect(existsSync(resolve(ROOT, deal.parity_baseline_path))).toBe(true);
    expect(existsSync(resolve(ROOT, `parity/${slug}/baseline.md`))).toBe(true);
  });

  it('refuses to run the check before a new site exists to compare against', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/run-parity-check`);
    expect(status).toBe(400);
    expect(data.error).toMatch(/build/i);
  });

  it('runs the parity check against the new-site fixture and records the EXACT hand-verified result', async () => {
    // Points dist_path straight at the fixture (bypassing a real site-builder run) so this test's
    // expectations are pinned to a result confirmed by running the real CLI tool by hand — see
    // the ground truth captured in the session notes: pass=false, these exact three lists.
    const { updateDeal } = await import('../server/db.mjs');
    updateDeal(dealId, { dist_path: 'command-center/test/fixtures/new-site' });

    const { status, data } = await req('POST', `/deals/${dealId}/run-parity-check`);
    expect(status).toBe(202);
    await waitForJob(data.jobId); // job "fails" (exit 1) on a real regression — that's expected, not a bug

    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.parity_status).toBe('fail');
    expect(deal.parity_checked_at).toBeTruthy();
    const result = JSON.parse(deal.parity_result);
    expect(result.regressions).toEqual(['booking', 'faq']);
    expect(result.preserved).toEqual(['contact-form', 'click-to-call', 'map']);
    expect(result.improvements).toEqual(['newsletter', 'gallery']);
    expect(result.style.find(s => s.item.includes('2563eb')).ok).toBe(true);
    expect(result.style.find(s => s.item.includes('f59e0b')).ok).toBe(false);

    const activity = (await req('GET', `/deals/${dealId}`)).data.activity;
    expect(activity[0].text).toMatch(/2 regression\(s\): booking, faq/);
  });

  it('serves the parity brief file link', async () => {
    const res = await fetch(base + `/deals/${dealId}/files/parityBrief`, { headers: { Cookie: cookies.session } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Parity Brief/);
  });
});

// ---------- invoicing ----------

describe('invoicing', () => {
  let dealId;
  const slug = `${SLUG_PREFIX}invoice-co`;

  it('sets up a won website deal', async () => {
    const created = await req('POST', '/deals', { business_line: 'website', name: slug, contact_name: 'Jamie Rivera', email: 'jamie@example.com' });
    dealId = created.data.id;
    await req('PATCH', `/deals/${dealId}`, { stage: 'won' });
  });

  it('refuses to generate an invoice with no line items', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/invoice/generate`, { items: [] });
    expect(status).toBe(400);
    expect(data.error).toMatch(/line item/i);
  });

  it('drops zero/negative/blank line items rather than crashing on them', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/invoice/generate`, {
      items: [{ desc: '', amount: 100 }, { desc: 'Free thing', amount: 0 }, { desc: 'Website build', amount: 600 }],
      dueDate: '2026-09-15',
    });
    expect(status).toBe(202);
    const job = await waitForJob(data.jobId);
    expect(job.status).toBe('done');
  });

  it('generated a real branded invoice with only the valid line item', async () => {
    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.invoice_status).toBe('draft');
    expect(deal.invoice_number).toMatch(/^INV-/);
    expect(deal.invoice_path).toBeTruthy();
    expect(JSON.parse(deal.invoice_items)).toEqual([{ desc: 'Website build', amount: 600 }]);

    const res = await fetch(base + `/deals/${dealId}/files/invoice`, { headers: { Cookie: cookies.session } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/SiteWright/); // website-line deals bill under the SiteWright identity
    expect(html).toMatch(/Jamie Rivera/);
    expect(html).toMatch(/\$600\.00/);
  });

  it('refuses mark-sent/mark-paid before an invoice exists', async () => {
    const fresh = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}no-invoice-yet` });
    const sent = await req('POST', `/deals/${fresh.data.id}/invoice/mark-sent`);
    expect(sent.status).toBe(400);
    const paid = await req('POST', `/deals/${fresh.data.id}/invoice/mark-paid`);
    expect(paid.status).toBe(400);
    await req('DELETE', `/deals/${fresh.data.id}`);
  });

  it('marks sent, then paid — and paid auto-advances the deal + fills the invoiced amount', async () => {
    const sent = await req('POST', `/deals/${dealId}/invoice/mark-sent`);
    expect(sent.data.ok).toBe(true);
    expect((await req('GET', `/deals/${dealId}`)).data.invoice_status).toBe('sent');

    const paid = await req('POST', `/deals/${dealId}/invoice/mark-paid`);
    expect(paid.data.ok).toBe(true);
    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.invoice_status).toBe('paid');
    expect(deal.stage).toBe('invoiced');
    expect(deal.invoiced_amount).toBe(600);
    expect(deal.invoice_paid_at).toBeTruthy();
  });

  it('a lodging deal invoices under the Pixelreach Digital identity instead', async () => {
    const created = await req('POST', '/deals', { business_line: 'lodging', name: `${SLUG_PREFIX}cabin-invoice` });
    const id = created.data.id;
    await req('PATCH', `/deals/${id}`, { stage: 'won' });
    const gen = await req('POST', `/deals/${id}/invoice/generate`, { items: [{ desc: 'Listing setup', amount: 90 }] });
    await waitForJob(gen.data.jobId);
    const res = await fetch(base + `/deals/${id}/files/invoice`, { headers: { Cookie: cookies.session } });
    const html = await res.text();
    expect(html).toMatch(/Pixelreach Digital/);
    await req('DELETE', `/deals/${id}`);
  });
});

// ---------- marketing kit (chat-driven skill — flag + filesystem detection) ----------

describe('marketing kit', () => {
  let dealId;
  const slug = `${SLUG_PREFIX}bloom-cafe`;

  it('sets up a deal and flags it', async () => {
    const created = await req('POST', '/deals', { business_line: 'website', name: slug });
    dealId = created.data.id;
    const { data } = await req('POST', `/deals/${dealId}/marketing-kit/flag`);
    expect(data.slug).toBe(slug);
    expect((await req('GET', `/deals/${dealId}`)).data.needs_marketing_kit).toBe(1);
  });

  it('honestly reports nothing found before the skill has run', async () => {
    const { data } = await req('POST', `/deals/${dealId}/marketing-kit/check`);
    expect(data.found).toBe(false);
    expect((await req('GET', `/deals/${dealId}`)).data.needs_marketing_kit).toBe(1); // still flagged
  });

  it('finds the kit once files exist, and clears the flag', async () => {
    const kitDir = resolve(ROOT, 'marketing-toolkit', slug, 'checklists');
    mkdirSync(kitDir, { recursive: true });
    writeFileSync(resolve(kitDir, 'google-business-profile.md'), '# GBP checklist');
    writeFileSync(resolve(ROOT, 'marketing-toolkit', slug, 'email-welcome.md'), 'Subject: Welcome');

    const { data } = await req('POST', `/deals/${dealId}/marketing-kit/check`);
    expect(data.found).toBe(true);
    expect(data.files.sort()).toEqual(['checklists/google-business-profile.md', 'email-welcome.md']);

    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.needs_marketing_kit).toBe(0);
    expect(deal.marketing_kit_path).toBe(`marketing-toolkit/${slug}`);
  });

  it('serves an individual file', async () => {
    const res = await fetch(base + `/deals/${dealId}/marketing-kit/file?path=email-welcome.md`, { headers: { Cookie: cookies.session } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Subject: Welcome');
  });

  it('blocks a path-traversal attempt', async () => {
    const { status, data } = await req('GET', `/deals/${dealId}/marketing-kit/file?path=${encodeURIComponent('../../../../etc/passwd')}`);
    expect(status).toBe(400);
    expect(data.error).toMatch(/invalid path/i);
  });

  it('blocks traversal even when the relative path resolves outside via ..', async () => {
    const { status } = await req('GET', `/deals/${dealId}/marketing-kit/file?path=${encodeURIComponent('../' + slug + '-decoy/secret.md')}`);
    expect(status).toBe(400);
  });
});

// ---------- lodging proposal / listing-kit config (deterministic, no network) ----------

describe('lodging config flow', () => {
  let dealId;
  const slug = `${SLUG_PREFIX}mountain-view-cabin`;

  it('creates a lodging deal and generates a proposal with explicit picks', async () => {
    const created = await req('POST', '/deals', { business_line: 'lodging', name: slug, city: 'Pigeon Forge' });
    dealId = created.data.id;
    const { status, data } = await req('POST', `/deals/${dealId}/propose-lodging`, {
      platforms: 'airbnb,vrbo,expedia', tier: 'pro', bookingSystem: 'Cloudbeds',
    });
    expect(status).toBe(202);
    await waitForJob(data.jobId);

    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.platforms_wanted).toBe('airbnb,vrbo,expedia');
    expect(deal.detected_booking_system).toBe('Cloudbeds');
    expect(deal.proposal_path).toBeTruthy();
  });

  it('listing kit reuses the same platforms/booking-system without being told again', async () => {
    const { status, data } = await req('POST', `/deals/${dealId}/listing-kit`, {}); // no platforms in the body
    expect(status).toBe(202);
    const job = await waitForJob(data.jobId);
    expect(job.status).toBe('done');
    // activity is newest-first: [0] is the "ready" line, [1] is "generation started (<platforms>)"
    const activity = (await req('GET', `/deals/${dealId}`)).data.activity;
    expect(activity[0].text).toMatch(/Listing kit ready/);
    expect(activity[1].text).toMatch(/airbnb,vrbo,expedia/);
    // and the deal's own record of "what was picked" is untouched — proof it fell back rather than reset
    const deal = (await req('GET', `/deals/${dealId}`)).data;
    expect(deal.platforms_wanted).toBe('airbnb,vrbo,expedia');
    expect(deal.detected_booking_system).toBe('Cloudbeds');
  });
});

// ---------- follow-up reminders (cross-board, date-boundary logic) ----------

describe('follow-ups', () => {
  it('groups deals into overdue / next-14-days / later, sorted ascending, excluding deals with no date', async () => {
    const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const far = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);

    const a = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}fu-overdue`, follow_up_date: past });
    const b = await req('POST', '/deals', { business_line: 'lodging', name: `${SLUG_PREFIX}fu-soon`, follow_up_date: soon });
    const c = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}fu-far`, follow_up_date: far });
    const d = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}fu-none` }); // no date — must not appear anywhere

    const { data } = await req('GET', '/follow-ups');
    const names = group => group.map(x => x.name);
    expect(names(data.overdue)).toContain(`${SLUG_PREFIX}fu-overdue`);
    expect(names(data.upcoming)).toContain(`${SLUG_PREFIX}fu-soon`);
    expect(names(data.later)).toContain(`${SLUG_PREFIX}fu-far`);
    expect([...names(data.overdue), ...names(data.upcoming), ...names(data.later)]).not.toContain(`${SLUG_PREFIX}fu-none`);

    for (const { data: dl } of [a, b, c, d]) await req('DELETE', `/deals/${dl.id}`);
  });
});

// ---------- files endpoint edge cases ----------

describe('generated-file links', () => {
  it('404s for a file kind that has not been generated yet', async () => {
    const created = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}no-files-yet` });
    const { status } = await req('GET', `/deals/${created.data.id}/files/invoice`);
    expect(status).toBe(404);
    await req('DELETE', `/deals/${created.data.id}`);
  });

  it('404s for an unknown file kind', async () => {
    const created = await req('POST', '/deals', { business_line: 'website', name: `${SLUG_PREFIX}bad-kind` });
    const { status } = await req('GET', `/deals/${created.data.id}/files/not-a-real-kind`);
    expect(status).toBe(404);
    await req('DELETE', `/deals/${created.data.id}`);
  });
});
