import { api, watchJob } from './api.js';
import { el, esc, toast, fmtTimestamp } from './ui.js';
import { STAGES, STAGE_LABELS, CONTENT_PAGES, CONTENT_PAGE_LABELS, LIST_CONTENT_PAGES, LIST_FIELDS } from './constants.js';

export async function openDrawer(dealId, { onClose, onChanged }) {
  const overlay = el(`<div class="overlay"></div>`);
  const drawer = el(`<div class="drawer"></div>`);
  document.body.append(overlay, drawer);
  const close = () => { overlay.remove(); drawer.remove(); onClose?.(); };
  overlay.addEventListener('click', close);

  async function refresh() {
    const deal = await api.getDeal(dealId);
    render(deal);
    onChanged?.();
  }

  function render(deal) {
    // Two sibling roots (drawer-head + drawer-body) — el() would silently drop the second, so set
    // innerHTML directly instead of appendChild(el(...)).
    drawer.innerHTML = `
      <div class="drawer-head">
        <div class="top">
          <div>
            <h2>${esc(deal.name)}</h2>
            <span class="chip line-${deal.business_line}">${deal.business_line === 'lodging' ? 'Lodging' : 'Website'}</span>
            ${deal.priority ? `<span class="chip p-${deal.priority}">${deal.priority}</span>` : ''}
            ${deal.opportunity_score != null ? `<span class="chip plain">score ${deal.opportunity_score}/100</span>` : ''}
          </div>
          <button class="close-x" id="close-drawer" aria-label="Close">×</button>
        </div>
        <div class="stagebar" id="stagebar">
          ${STAGES.map(s => `<button data-stage="${s}" class="${s === deal.stage ? 'current' : ''}">${STAGE_LABELS[s]}</button>`).join('')}
        </div>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
    `;
    drawer.querySelector('#close-drawer').addEventListener('click', close);
    drawer.querySelector('#stagebar').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-stage]');
      if (!btn || btn.classList.contains('current')) return;
      await api.updateDeal(deal.id, { stage: btn.dataset.stage });
      refresh();
    });

    const body = drawer.querySelector('#drawer-body');
    body.appendChild(renderFieldsForm(deal, refresh));
    if (deal.business_line === 'lodging') body.appendChild(renderPresenceSection(deal));
    if (deal.business_line === 'website' && deal.website) body.appendChild(renderParitySection(deal, refresh));
    body.appendChild(renderFiles(deal));
    body.appendChild(renderActions(deal, refresh));
    // Add-ons apply to a real clients/<slug> folder, which only website deals have — a lodging deal can
    // carry a client_slug too (set when its listing kit is generated), so gate on business_line as well.
    if (deal.business_line === 'website' && deal.client_slug) body.appendChild(renderAddonsSection(deal, refresh));
    if (['won', 'delivered', 'invoiced'].includes(deal.stage)) body.appendChild(renderInvoiceSection(deal, refresh));
    body.appendChild(renderMarketingKitSection(deal, refresh));
    body.appendChild(renderActivity(deal, refresh));
    const delRow = el(`<div class="divider"></div>`);
    body.appendChild(delRow);
    const delBtn = el(`<button class="btn danger sm">Delete deal</button>`);
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${deal.name}"? This only removes it from the board — generated files stay on disk.`)) return;
      await api.deleteDeal(deal.id);
      close(); onChanged?.();
    });
    body.appendChild(delBtn);
  }

  await refresh();
}

// ---------- contact / deal fields ----------

function renderFieldsForm(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Details</div>`));
  const form = el(`
    <form>
      <div class="grid2">
        <div class="field"><label>Contact name</label><input name="contact_name" value="${esc(deal.contact_name || '')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(deal.phone || '')}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Email</label><input name="email" value="${esc(deal.email || '')}"></div>
        <div class="field"><label>City</label><input name="city" value="${esc(deal.city || '')}"></div>
      </div>
      <div class="field"><label>Website</label><input name="website" value="${esc(deal.website || '')}" placeholder="https://…"></div>
      <div class="field"><label>Address</label><input name="address" value="${esc(deal.address || '')}"></div>
      <div class="field"><label>Industry</label><input name="industry" value="${esc(deal.industry || '')}"></div>
      <div class="grid2">
        <div class="field"><label>Deal value ($)</label><input name="deal_value" type="number" value="${deal.deal_value ?? ''}"></div>
        <div class="field"><label>Follow-up date</label><input name="follow_up_date" type="date" value="${deal.follow_up_date || ''}"></div>
      </div>
      <div class="field"><label>Next action</label><input name="next_action" value="${esc(deal.next_action || '')}" placeholder="e.g. call back, send follow-up"></div>
      ${deal.stage === 'invoiced' || deal.stage === 'delivered' ? `<div class="field"><label>Invoiced amount ($)</label><input name="invoiced_amount" type="number" value="${deal.invoiced_amount ?? ''}"></div>` : ''}
      <button type="submit" class="btn sm">Save details</button>
    </form>
  `);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { await api.updateDeal(deal.id, fd); toast('Saved'); refresh(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  wrap.appendChild(form);
  return wrap;
}

// ---------- booking-platform presence (lodging deals) ----------

function renderPresenceSection(deal) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Booking platforms</div>`));
  let presence = [];
  try { presence = deal.platform_presence ? JSON.parse(deal.platform_presence) : []; } catch { /* stale/bad data — show nothing rather than break the drawer */ }
  if (presence.length) {
    const chips = el(`<div class="action-row" style="margin-bottom:.4rem"></div>`);
    for (const p of presence) chips.appendChild(el(`<span class="chip ${p.found ? 'plain' : 'flag'}">${p.found ? '✓' : '✗'} ${esc(p.label)}</span>`));
    wrap.appendChild(chips);
  }
  wrap.appendChild(el(`<p class="hint" style="margin:0 0 .5rem">${deal.detected_booking_system ? `Runs <b>${esc(deal.detected_booking_system)}</b> — proposals will offer to connect to it.` : presence.length ? 'No booking system detected on their own site.' : 'Not checked yet.'}</p>`));
  return wrap;
}

// Runs a one-shot action button that may kick off a background job; toasts + refreshes when it's done.
// Used by sections that don't have a shared console box (parity, invoicing, marketing kit).
async function runSimpleAction(btn, fn, refresh) {
  btn.disabled = true;
  const orig = btn.textContent;
  try {
    const result = await fn();
    if (result?.jobId) {
      btn.textContent = 'Running…';
      await new Promise(resolveJob => watchJob(result.jobId, {
        onDone: msg => {
          toast(msg.status === 'done' ? `${orig} finished` : `${orig} failed — see activity log`, { error: msg.status !== 'done' });
          resolveJob();
        },
      }));
    } else {
      toast(result?.found === false ? 'Not found yet' : `${orig} done`);
    }
    refresh();
  } catch (err) {
    toast(err.message, { error: true });
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

// ---------- parity check (rebuilds — prove nothing was lost vs. the old site) ----------

function renderParitySection(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Parity vs. old site</div>`));
  if (!deal.parity_baseline_path) {
    wrap.appendChild(el(`<p class="hint" style="margin:0 0 .5rem">Capture the current site at ${esc(deal.website)} before rebuilding, so the check can prove nothing gets lost.</p>`));
    const btn = el(`<button class="btn sm">Capture old site</button>`);
    btn.addEventListener('click', () => runSimpleAction(btn, () => api.captureOldSite(deal.id), refresh));
    wrap.appendChild(btn);
    return wrap;
  }
  const row = el(`<div class="action-row" style="margin-bottom:.4rem"></div>`);
  const runBtn = el(`<button class="btn sm">Run parity check</button>`);
  runBtn.addEventListener('click', () => runSimpleAction(runBtn, () => api.runParityCheck(deal.id), refresh));
  row.appendChild(runBtn);
  wrap.appendChild(row);
  if (deal.parity_status) {
    let result = {};
    try { result = deal.parity_result ? JSON.parse(deal.parity_result) : {}; } catch { /* stale data — show nothing rather than break the drawer */ }
    const pass = deal.parity_status === 'pass';
    wrap.appendChild(el(`<div class="chip ${pass ? 'plain' : 'flag'}" style="display:inline-block;margin-bottom:.4rem">${pass ? `✓ Parity pass — ${result.improvements?.length || 0} improvement(s)` : `✗ ${result.regressions?.length || 0} regression(s)`}</div>`));
    if (!pass && result.regressions?.length) wrap.appendChild(el(`<p class="hint" style="margin:0 0 .3rem">Missing: ${result.regressions.map(esc).join(', ')} — fix before launch.</p>`));
    wrap.appendChild(el(`<p class="hint" style="margin:0">Checked ${fmtTimestamp(deal.parity_checked_at)}</p>`));
  } else {
    wrap.appendChild(el(`<p class="hint" style="margin:0">Not checked yet — build (or deploy) the new site, then run the check.</p>`));
  }
  return wrap;
}

// ---------- invoicing ----------

function renderInvoiceSection(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Invoice</div>`));
  if (deal.invoice_status) {
    const label = { draft: 'Draft', sent: 'Awaiting payment', paid: 'Paid' }[deal.invoice_status] || deal.invoice_status;
    wrap.appendChild(el(`<div class="chip ${deal.invoice_status === 'paid' ? 'plain' : 'flag'}" style="display:inline-block;margin-bottom:.4rem">${esc(deal.invoice_number || '')} — ${label}</div>`));
  }
  const row = el(`<div class="action-row"></div>`);
  wrap.appendChild(row);
  const genBtn = el(`<button class="btn sm">${deal.invoice_path ? 'Regenerate invoice…' : 'Create invoice…'}</button>`);
  genBtn.addEventListener('click', () => openInvoiceModal(deal, refresh));
  row.appendChild(genBtn);
  if (deal.invoice_path && deal.invoice_status !== 'sent' && deal.invoice_status !== 'paid') {
    const b = el(`<button class="btn sm">Mark sent</button>`);
    b.addEventListener('click', () => runSimpleAction(b, () => api.markInvoiceSent(deal.id), refresh));
    row.appendChild(b);
  }
  if (deal.invoice_path && deal.invoice_status !== 'paid') {
    const b = el(`<button class="btn sm primary">Mark paid</button>`);
    b.addEventListener('click', () => runSimpleAction(b, () => api.markInvoicePaid(deal.id), refresh));
    row.appendChild(b);
  }
  return wrap;
}

function openInvoiceModal(deal, refresh) {
  let items = [];
  try { items = deal.invoice_items ? JSON.parse(deal.invoice_items) : []; } catch { /* start fresh */ }
  if (!items.length) items = [{ desc: deal.business_line === 'lodging' ? 'Listing setup' : 'Website build', amount: deal.deal_value || '' }];
  const { wrap, body } = modalShell(`Invoice — ${deal.name}`);
  const form = el(`<form></form>`);
  const rowsEl = el(`<div></div>`);
  form.appendChild(rowsEl);

  function draw() {
    rowsEl.innerHTML = '';
    items.forEach((item, i) => {
      const row = el(`
        <div class="grid2" style="align-items:end">
          <div class="field"><label>${i === 0 ? 'Description' : ''}</label><input data-k="desc" data-i="${i}" value="${esc(item.desc || '')}"></div>
          <div class="field" style="display:flex;gap:.4rem;align-items:end">
            <div style="flex:1"><label>${i === 0 ? 'Amount ($)' : ''}</label><input data-k="amount" data-i="${i}" type="number" value="${item.amount ?? ''}"></div>
            <button type="button" class="btn sm danger" data-remove="${i}">×</button>
          </div>
        </div>
      `);
      rowsEl.appendChild(row);
    });
  }
  draw();
  rowsEl.addEventListener('input', e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    items[i][e.target.dataset.k] = e.target.value;
  });
  rowsEl.addEventListener('click', e => {
    const idx = e.target.dataset.remove;
    if (idx === undefined) return;
    items.splice(Number(idx), 1);
    draw();
  });

  const addBtn = el(`<button type="button" class="btn sm">+ Add line item</button>`);
  addBtn.addEventListener('click', () => { items.push({ desc: '', amount: '' }); draw(); });
  form.appendChild(addBtn);
  form.appendChild(el(`<div class="field"><label>Due date</label><input name="dueDate" type="date" value="${deal.invoice_due_date || ''}"></div>`));
  form.appendChild(el(`<div class="field"><label>Notes (optional)</label><input name="notes" placeholder="e.g. thanks for being an early client"></div>`));
  form.appendChild(el(`
    <div class="action-row" style="justify-content:flex-end;margin-top:.5rem">
      <button type="button" class="btn" id="modal-cancel">Cancel</button>
      <button type="submit" class="btn primary">Generate invoice</button>
    </div>
  `));
  form.querySelector('#modal-cancel').addEventListener('click', () => wrap.remove());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const cleanItems = items.filter(it => it.desc && Number(it.amount) > 0).map(it => ({ desc: it.desc, amount: Number(it.amount) }));
    if (!cleanItems.length) { toast('Add at least one line item with a description and amount.', { error: true }); return; }
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true; submitBtn.textContent = 'Generating…';
    try {
      const result = await api.generateInvoice(deal.id, { items: cleanItems, dueDate: form.dueDate.value, notes: form.notes.value.trim() });
      if (result?.jobId) {
        watchJob(result.jobId, {
          onDone: msg => { wrap.remove(); toast(msg.status === 'done' ? 'Invoice ready' : 'Invoice generation failed', { error: msg.status !== 'done' }); refresh(); },
        });
      } else { wrap.remove(); refresh(); }
    } catch (err) { toast(err.message, { error: true }); submitBtn.disabled = false; submitBtn.textContent = 'Generate invoice'; }
  });
  body.appendChild(form);
}

// ---------- marketing kit (chat-driven /marketing-kit skill — flag it, then detect the output) ----------

function renderMarketingKitSection(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Marketing kit</div>`));
  if (deal.marketing_kit_path) {
    const list = el(`<div class="hint">Loading files…</div>`);
    wrap.appendChild(list);
    api.marketingKitFiles(deal.id).then(({ files }) => {
      list.innerHTML = '';
      if (!files.length) { list.appendChild(el(`<p class="hint" style="margin:0">No files found in ${esc(deal.marketing_kit_path)}.</p>`)); return; }
      for (const f of files) {
        list.appendChild(el(`<div class="filelink"><span>${esc(f)}</span><a href="/api/deals/${deal.id}/marketing-kit/file?path=${encodeURIComponent(f)}" target="_blank" rel="noopener">Open ↗</a></div>`));
      }
    }).catch(err => { list.innerHTML = ''; list.appendChild(el(`<p class="hint">${esc(err.message)}</p>`)); });
    return wrap;
  }
  if (deal.needs_marketing_kit) {
    const slug = deal.client_slug || deal.name;
    wrap.appendChild(el(`<p class="hint" style="margin:0 0 .5rem">Flagged — run <code>/marketing-kit ${esc(slug)}</code> in Claude Code chat, then check back here.</p>`));
    const btn = el(`<button class="btn sm">Check for marketing kit</button>`);
    btn.addEventListener('click', () => runSimpleAction(btn, () => api.checkMarketingKit(deal.id), refresh));
    wrap.appendChild(btn);
    return wrap;
  }
  const btn = el(`<button class="btn sm">Flag for /marketing-kit</button>`);
  btn.addEventListener('click', () => runSimpleAction(btn, () => api.flagMarketingKit(deal.id), refresh));
  wrap.appendChild(btn);
  return wrap;
}

// ---------- generated files ----------

function renderFiles(deal) {
  const links = [
    ['opportunityReport', 'Opportunity report', deal.opportunity_report_path],
    ['parityBrief', 'Parity brief', deal.parity_baseline_path],
    ['demo', 'Demo site', deal.demo_path],
    ['proposal', deal.business_line === 'lodging' ? 'Proposal' : 'Pitch packet', deal.proposal_path],
    ['dist', 'Built site', deal.dist_path],
    [null, 'Live site', deal.live_url],
    ['invoice', 'Invoice', deal.invoice_path],
  ].filter(([, , path]) => path);
  const wrap = el(`<div></div>`);
  if (!links.length) return wrap;
  wrap.appendChild(el(`<div class="section-title">Generated</div>`));
  for (const [kind, label, path] of links) {
    const href = kind ? `/api/deals/${deal.id}/files/${kind}` : path;
    wrap.appendChild(el(`<div class="filelink"><span>${esc(label)}</span><a href="${esc(href)}" target="_blank" rel="noopener">Open ↗</a></div>`));
  }
  return wrap;
}

// ---------- actions (contextual) ----------

function renderActions(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Actions</div>`));
  const row = el(`<div class="action-row"></div>`);
  wrap.appendChild(row);
  const consoleBox = el(`<div class="console" style="display:none"></div>`);
  wrap.appendChild(consoleBox);

  const addBtn = (label, onClick) => {
    const b = el(`<button class="btn sm">${esc(label)}</button>`);
    b.addEventListener('click', () => runAction(b, onClick));
    row.appendChild(b);
    return b;
  };
  const addModalBtn = (label, openModal) => {
    const b = el(`<button class="btn sm">${esc(label)}</button>`);
    b.addEventListener('click', () => openModal({ consoleBox, refresh }));
    row.appendChild(b);
    return b;
  };

  async function runAction(btn, fn) {
    btn.disabled = true;
    const orig = btn.textContent;
    try {
      const result = await fn();
      if (result?.jobId) {
        btn.textContent = 'Running…';
        await watchJobAndRefresh(result.jobId, { label: orig, consoleBox, refresh });
      } else {
        toast(`${orig} done`);
        refresh();
      }
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  if (deal.business_line === 'website') {
    if (deal.stage !== 'won' && deal.stage !== 'delivered' && deal.stage !== 'invoiced') {
      addBtn('Scan opportunities', () => api.scanOpportunities(deal.id));
      addBtn('Generate demo', () => api.generateDemo(deal.id));
      addBtn('Generate pitch packet', () => api.generateBrief(deal.id));
    }
    if (!deal.client_slug) {
      addBtn('Start client →', () => api.startClient(deal.id));
    } else {
      addBtn('Edit brand', () => openBrandEditor(deal, refresh));
      addBtn('Edit content', () => openContentEditor(deal, refresh));
      addBtn('Build', () => api.build(deal.id));
      addBtn('Run tests', () => api.test(deal.id));
      if (deal.needs_security_gate) addBtn('Clear security gate ✓', () => api.clearSecurityGate(deal.id));
      else addBtn('Flag for security gate', () => api.flagSecurityGate(deal.id));
      addBtn('Deploy', () => api.deploy(deal.id));
    }
  } else {
    if (deal.website) addBtn('Check booking presence', () => api.checkBookingPresence(deal.id));
    if (deal.stage !== 'won' && deal.stage !== 'delivered' && deal.stage !== 'invoiced') {
      addModalBtn('Generate proposal…', ctx => openLodgingActionModal('proposal', deal, ctx));
    }
    addModalBtn('Generate listing kit…', ctx => openLodgingActionModal('kit', deal, ctx));
  }

  return wrap;
}

// Shared by plain action buttons and the lodging config modals: shows a job's live output in the given
// console box and toasts + refreshes the drawer once it finishes.
function watchJobAndRefresh(jobId, { label, consoleBox, refresh }) {
  consoleBox.style.display = 'block'; consoleBox.textContent = '';
  return new Promise(resolveJob => {
    watchJob(jobId, {
      onLine: line => { consoleBox.textContent += line + '\n'; consoleBox.scrollTop = consoleBox.scrollHeight; },
      onDone: msg => {
        toast(msg.status === 'done' ? `${label} finished` : `${label} failed — see log`, { error: msg.status !== 'done' });
        refresh();
        resolveJob(msg);
      },
    });
  });
}

// Config modal for the two lodging actions that need per-run choices (which platforms, which tier, which
// booking system to connect to) instead of always falling back to defaults.
function openLodgingActionModal(kind, deal, { consoleBox, refresh }) {
  const isProposal = kind === 'proposal';
  const platformDefs = [['airbnb', 'Airbnb'], ['vrbo', 'Vrbo'], ['booking.com', 'Booking.com'], ['expedia', 'Expedia'], ['hotels.com', 'Hotels.com']];
  const wanted = new Set((deal.platforms_wanted || 'airbnb,vrbo').split(',').map(s => s.trim()).filter(Boolean));
  const { wrap, body } = modalShell(isProposal ? `Generate proposal — ${deal.name}` : `Generate listing kit — ${deal.name}`);
  const form = el(`
    <form>
      <div class="field">
        <label>Platforms</label>
        <div>${platformDefs.map(([id, label]) => `<label style="display:inline-flex;align-items:center;gap:.3rem;margin:.2rem .9rem .2rem 0;font-weight:400"><input type="checkbox" name="platform" value="${id}" ${wanted.has(id) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
      </div>
      ${isProposal ? `<div class="field"><label>Tier</label><select name="tier"><option value="basic">Basic — $50 / 1 platform</option><option value="standard" selected>Standard — $90 / 2 platforms</option><option value="pro">Pro — $150 / 3 platforms</option></select></div>` : ''}
      <div class="field"><label>Booking system (optional)</label><input name="bookingSystem" value="${esc(deal.detected_booking_system || '')}" placeholder="e.g. Cloudbeds — leave blank if none"></div>
      <div class="action-row" style="justify-content:flex-end">
        <button type="button" class="btn" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn primary">${isProposal ? 'Generate proposal' : 'Generate listing kit'}</button>
      </div>
    </form>
  `);
  form.querySelector('#modal-cancel').addEventListener('click', () => wrap.remove());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const platforms = [...form.querySelectorAll('input[name=platform]:checked')].map(i => i.value).join(',');
    if (!platforms) { toast('Pick at least one platform.', { error: true }); return; }
    const payload = { platforms, bookingSystem: form.bookingSystem.value.trim() };
    if (isProposal) payload.tier = form.tier.value;
    wrap.remove();
    const label = isProposal ? 'Generate proposal' : 'Generate listing kit';
    try {
      const result = isProposal ? await api.proposeLodging(deal.id, payload) : await api.listingKit(deal.id, payload);
      if (result?.jobId) await watchJobAndRefresh(result.jobId, { label, consoleBox, refresh });
      else refresh();
    } catch (err) { toast(err.message, { error: true }); }
  });
  body.appendChild(form);
}

// ---------- add-ons ----------

// Returns the section synchronously (so it can be appendChild'd right away) and fills the list in once
// the addon catalog + brand config have loaded.
function renderAddonsSection(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Add-ons</div>`));
  const list = el(`<div>Loading…</div>`);
  wrap.appendChild(list);
  loadAddons(deal, list);
  return wrap;
}

async function loadAddons(deal, list) {
  try {
    const [addons, brand] = await Promise.all([api.listAddons(deal.industry), api.getBrand(deal.id)]);
    list.innerHTML = '';
    const enabled = new Set(brand.addons || []);
    for (const a of addons) {
      const row = el(`
        <div class="addon-row">
          <div><span class="id">${esc(a.id)}</span> — ${esc(a.name)}${a.recommended ? ' ⭐' : ''}</div>
          <input type="checkbox" ${enabled.has(a.id) ? 'checked' : ''}>
        </div>
      `);
      row.querySelector('input').addEventListener('change', async e => {
        try {
          if (e.target.checked) await api.enableAddon(deal.id, a.id);
          else await api.disableAddon(deal.id, a.id);
          toast(`${a.name} ${e.target.checked ? 'enabled' : 'disabled'} — rebuild to apply`);
        } catch (err) { toast(err.message, { error: true }); e.target.checked = !e.target.checked; }
      });
      list.appendChild(row);
    }
  } catch (err) { list.innerHTML = ''; list.appendChild(el(`<p class="hint">${esc(err.message)}</p>`)); }
}

// ---------- activity log ----------

function renderActivity(deal, refresh) {
  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-title">Activity</div>`));
  const form = el(`
    <form class="action-row">
      <input name="text" placeholder="Add a note…" style="flex:1;border:1px solid var(--line-strong);border-radius:8px;padding:.45rem .6rem">
      <button class="btn sm" type="submit">Add</button>
    </form>
  `);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    await api.addActivity(deal.id, { text, type: 'note' });
    form.text.value = '';
    refresh();
  });
  wrap.appendChild(form);
  for (const a of deal.activity || []) {
    wrap.appendChild(el(`
      <div class="activity-item type-${a.type}">
        <span class="ts">${fmtTimestamp(a.created_at)} · ${a.type.replace('_', ' ')}</span>
        ${esc(a.text)}
      </div>
    `));
  }
  return wrap;
}

// ---------- brand editor ----------

function modalShell(title) {
  const wrap = el(`<div class="modal-wrap"><div class="modal" style="max-width:520px;max-height:85vh;overflow-y:auto"><h3>${esc(title)}</h3><div id="modal-body"></div></div></div>`);
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  return { wrap, body: wrap.querySelector('#modal-body') };
}

async function openBrandEditor(deal, refresh) {
  const { wrap, body } = modalShell(`Brand — ${deal.name}`);
  let cfg;
  try { cfg = await api.getBrand(deal.id); } catch (err) { toast(err.message, { error: true }); wrap.remove(); return; }
  const form = el(`
    <form>
      <div class="field"><label>Business name</label><input name="businessName" value="${esc(cfg.businessName || '')}"></div>
      <div class="field"><label>Tagline</label><input name="tagline" value="${esc(cfg.tagline || '')}"></div>
      <div class="grid2">
        <div class="field"><label>Theme</label>
          <select name="theme">${['beacon', 'harvest', 'summit'].map(t => `<option value="${t}" ${cfg.theme === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Industry</label><input name="industry" value="${esc(cfg.industry || '')}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Primary color</label><input name="primary" type="color" value="${cfg.brand?.colors?.primary || '#1d4ed8'}"></div>
        <div class="field"><label>Accent color</label><input name="accent" type="color" value="${cfg.brand?.colors?.accent || '#0369a1'}"></div>
      </div>
      <div class="field"><label>Phone</label><input name="phone" value="${esc(cfg.contact?.phone || '')}"></div>
      <div class="field"><label>Email</label><input name="email" value="${esc(cfg.contact?.email || '')}"></div>
      <div class="field"><label>Address</label><input name="address" value="${esc(cfg.contact?.address || '')}"></div>
      <div class="field"><label>Hours</label><input name="hours" value="${esc(cfg.contact?.hours || '')}"></div>
      <div class="action-row" style="justify-content:flex-end">
        <button type="button" class="btn" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>
  `);
  form.querySelector('#modal-cancel').addEventListener('click', () => wrap.remove());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const next = {
      ...cfg, businessName: fd.businessName, tagline: fd.tagline, theme: fd.theme, industry: fd.industry,
      brand: { ...cfg.brand, colors: { ...cfg.brand?.colors, primary: fd.primary, accent: fd.accent } },
      contact: { ...cfg.contact, phone: fd.phone, email: fd.email, address: fd.address, hours: fd.hours },
    };
    try { await api.putBrand(deal.id, next); toast('Brand saved'); wrap.remove(); refresh(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  body.appendChild(form);
}

// ---------- content editor ----------

async function openContentEditor(deal, refresh) {
  const { wrap, body } = modalShell(`Content — ${deal.name}`);
  const tabs = el(`<div class="subtabs">${CONTENT_PAGES.map((p, i) => `<button data-page="${p}" class="${i === 0 ? 'active' : ''}">${CONTENT_PAGE_LABELS[p]}</button>`).join('')}</div>`);
  const pane = el(`<div id="content-pane"></div>`);
  body.append(tabs, pane);
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-page]');
    if (!btn) return;
    [...tabs.children].forEach(b => b.classList.toggle('active', b === btn));
    loadPage(btn.dataset.page);
  });
  async function loadPage(page) {
    pane.innerHTML = 'Loading…';
    let data;
    try { data = await api.getContent(deal.id, page); } catch (err) { pane.innerHTML = ''; pane.appendChild(el(`<p class="hint">${esc(err.message)}</p>`)); return; }
    pane.innerHTML = '';
    pane.appendChild(LIST_CONTENT_PAGES.has(page) ? renderListEditor(deal, page, data, refresh) : renderProseEditor(deal, page, data, refresh));
  }
  loadPage(CONTENT_PAGES[0]);
}

function renderProseEditor(deal, page, data, refresh) {
  const fmKeys = Object.keys(data.data || {});
  const form = el(`<form></form>`);
  for (const k of fmKeys) {
    form.appendChild(el(`<div class="field"><label>${esc(k)}</label><input name="fm_${esc(k)}" value="${esc(data.data[k])}"></div>`));
  }
  form.appendChild(el(`<div class="field"><label>Body text</label><textarea name="body" rows="6">${esc(data.body || '')}</textarea></div>`));
  form.appendChild(el(`<button type="submit" class="btn primary sm">Save page</button>`));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newData = {};
    for (const k of fmKeys) newData[k] = fd.get('fm_' + k);
    try { await api.putContent(deal.id, page, { data: newData, body: fd.get('body') }); toast('Saved'); refresh(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  return form;
}

function renderListEditor(deal, page, data, refresh) {
  const fields = LIST_FIELDS[page];
  const wrap = el(`<div class="list-editor"></div>`);
  const rowsEl = el(`<div></div>`);
  wrap.append(rowsEl);
  let items = data.items && data.items.length ? [...data.items] : [];

  function draw() {
    rowsEl.innerHTML = '';
    items.forEach((item, i) => {
      const row = el(`<div class="row"><div class="top"><button type="button" class="btn sm danger">Remove</button></div></div>`);
      for (const [key, label] of fields) {
        row.appendChild(el(`<div class="field"><label>${esc(label)}</label><input data-key="${key}" value="${esc(item[key] || '')}"></div>`));
      }
      row.querySelector('button').addEventListener('click', () => { items.splice(i, 1); draw(); });
      row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => { items[i][inp.dataset.key] = inp.value; }));
      rowsEl.appendChild(row);
    });
  }
  draw();

  const addBtn = el(`<button type="button" class="btn sm">+ Add ${esc(CONTENT_PAGE_LABELS[page].toLowerCase())} item</button>`);
  addBtn.addEventListener('click', () => { items.push({}); draw(); });
  const saveBtn = el(`<button type="button" class="btn primary sm" style="margin-left:.5rem">Save page</button>`);
  saveBtn.addEventListener('click', async () => {
    try { await api.putContent(deal.id, page, { data: data.data || {}, items }); toast('Saved'); refresh(); }
    catch (err) { toast(err.message, { error: true }); }
  });
  wrap.append(addBtn, saveBtn);
  return wrap;
}
