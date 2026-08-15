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
    body.appendChild(renderFiles(deal));
    body.appendChild(renderActions(deal, refresh));
    if (deal.client_slug) body.appendChild(renderAddonsSection(deal, refresh));
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

// ---------- generated files ----------

function renderFiles(deal) {
  const links = [
    ['opportunityReport', 'Opportunity report', deal.opportunity_report_path],
    ['demo', 'Demo site', deal.demo_path],
    ['proposal', deal.business_line === 'lodging' ? 'Proposal' : 'Pitch packet', deal.proposal_path],
    ['dist', 'Built site', deal.dist_path],
    [null, 'Live site', deal.live_url],
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

  async function runAction(btn, fn) {
    btn.disabled = true;
    const orig = btn.textContent;
    try {
      const result = await fn();
      if (result?.jobId) {
        consoleBox.style.display = 'block'; consoleBox.textContent = '';
        btn.textContent = 'Running…';
        watchJob(result.jobId, {
          onLine: line => { consoleBox.textContent += line + '\n'; consoleBox.scrollTop = consoleBox.scrollHeight; },
          onDone: msg => {
            btn.disabled = false; btn.textContent = orig;
            toast(msg.status === 'done' ? `${orig} finished` : `${orig} failed — see log`, { error: msg.status !== 'done' });
            refresh();
          },
        });
      } else {
        btn.disabled = false; btn.textContent = orig;
        toast(`${orig} done`);
        refresh();
      }
    } catch (err) {
      btn.disabled = false; btn.textContent = orig;
      toast(err.message, { error: true });
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
    if (deal.stage !== 'won' && deal.stage !== 'delivered' && deal.stage !== 'invoiced') {
      addBtn('Generate proposal', () => api.proposeLodging(deal.id, {}));
    }
    addBtn('Generate listing kit', () => api.listingKit(deal.id, {}));
  }

  return wrap;
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
