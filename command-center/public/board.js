import { api, watchJob } from './api.js';
import { el, esc, toast, fmtDate, fmtMoney, isOverdue } from './ui.js';
import { STAGES, STAGE_LABELS } from './constants.js';

export function renderLogin(root, { onSuccess }) {
  root.innerHTML = '';
  root.appendChild(el(`
    <div class="center-shell">
      <form class="login-card" id="login-form">
        <div class="mark">🎛️</div>
        <h1>Command Center</h1>
        <p class="sub">SiteWright &amp; Pixelreach — one board, everything you run.</p>
        <div class="field">
          <label for="pw">Password</label>
          <input id="pw" type="password" autocomplete="current-password" autofocus>
        </div>
        <div class="error-text" id="login-err"></div>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
    </div>
  `));
  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-err');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errBox.textContent = '';
    const pw = document.getElementById('pw').value;
    try { await api.login(pw); onSuccess(); }
    catch (err) { errBox.textContent = err.message; }
  });
}

let currentFilter = { businessLine: '' };

export async function renderBoard(root, { onOpenDeal, onLogout }) {
  // el() only keeps the first top-level element of a template — use innerHTML directly here since this
  // shell has two sibling roots (topbar + board).
  root.innerHTML = `
    <div class="topbar">
      <div class="brand">🎛️ Command Center</div>
      <div class="tabs" id="line-tabs">
        <button data-line="" class="active">All</button>
        <button data-line="website">Website</button>
        <button data-line="lodging">Lodging</button>
      </div>
      <div class="spacer"></div>
      <div class="topbar-actions">
        <button class="btn sm" id="btn-followups">Follow-ups<span class="badge-count" id="followup-badge" hidden></span></button>
        <button class="btn sm" id="btn-import">Import leads</button>
        <button class="btn sm" id="btn-add">+ Add lead</button>
        <button class="btn sm" id="btn-logout">Sign out</button>
      </div>
    </div>
    <div class="board" id="board"></div>
  `;

  document.getElementById('btn-logout').addEventListener('click', async () => { await api.logout(); onLogout(); });
  document.getElementById('btn-add').addEventListener('click', () => openAddLeadModal(reload));
  document.getElementById('btn-import').addEventListener('click', () => openImportModal(reload));
  document.getElementById('btn-followups').addEventListener('click', () => openFollowUpsPanel(onOpenDeal));
  refreshFollowUpBadge();
  document.getElementById('line-tabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-line]');
    if (!btn) return;
    currentFilter.businessLine = btn.dataset.line;
    [...document.querySelectorAll('#line-tabs button')].forEach(b => b.classList.toggle('active', b === btn));
    reload();
  });

  async function reload() {
    const deals = await api.listDeals({ businessLine: currentFilter.businessLine });
    renderColumns(deals, onOpenDeal);
    refreshFollowUpBadge();
  }
  await reload();
  return { reload };
}

async function refreshFollowUpBadge() {
  const badge = document.getElementById('followup-badge');
  if (!badge) return;
  try {
    const { overdue } = await api.followUps();
    if (overdue.length) { badge.textContent = overdue.length; badge.hidden = false; }
    else badge.hidden = true;
  } catch { /* badge is cosmetic — a failed fetch just leaves it hidden */ }
}

function openFollowUpsPanel(onOpenDeal) {
  const wrap = el(`<div class="modal-wrap"><div class="modal" style="max-width:460px;max-height:80vh;overflow-y:auto"><h3>Follow-ups</h3><div id="fu-body">Loading…</div></div></div>`);
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  const body = wrap.querySelector('#fu-body');

  function group(label, deals, warn) {
    if (!deals.length) return '';
    return `<div class="section-title" style="margin-top:1rem">${label} (${deals.length})</div>` + deals.map(d => `
      <button type="button" class="filelink fu-row" data-id="${d.id}" style="width:100%;text-align:left;cursor:pointer;border:1px solid var(--line);${warn ? 'border-color:var(--crit)' : ''}">
        <span><span class="chip line-${d.business_line}">${d.business_line === 'lodging' ? 'Lodging' : 'Website'}</span> ${esc(d.name)}</span>
        <span style="${warn ? 'color:var(--crit)' : ''};font-family:var(--mono);font-size:.78rem">${esc(d.follow_up_date)}</span>
      </button>`).join('');
  }

  api.followUps().then(({ overdue, upcoming, later }) => {
    if (!overdue.length && !upcoming.length && !later.length) { body.innerHTML = `<p class="hint" style="margin:0">No deals have a follow-up date set.</p>`; return; }
    body.innerHTML = group('Overdue', overdue, true) + group('Next 14 days', upcoming, false) + group('Later', later, false);
    body.querySelectorAll('.fu-row').forEach(btn => btn.addEventListener('click', () => { wrap.remove(); onOpenDeal(Number(btn.dataset.id)); }));
  }).catch(err => { body.innerHTML = ''; body.appendChild(el(`<p class="hint">${esc(err.message)}</p>`)); });
}

function renderColumns(deals, onOpenDeal) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (const stage of STAGES) {
    const inStage = deals.filter(d => d.stage === stage);
    const col = el(`
      <div class="col stage-${stage}">
        <div class="col-head"><span>${STAGE_LABELS[stage]}</span><span class="count">${inStage.length}</span></div>
        <div class="col-body"></div>
      </div>
    `);
    const body = col.querySelector('.col-body');
    if (!inStage.length) body.appendChild(el(`<div class="empty-col">—</div>`));
    for (const deal of inStage) body.appendChild(renderCard(deal, onOpenDeal));
    boardEl.appendChild(col);
  }
}

function renderCard(deal, onOpenDeal) {
  const overdue = isOverdue(deal.follow_up_date);
  const card = el(`
    <button class="card" type="button">
      <div class="row1">
        <span class="chip line-${deal.business_line}">${deal.business_line === 'lodging' ? 'Lodging' : 'Website'}</span>
        ${deal.priority ? `<span class="chip p-${deal.priority}">${deal.priority}</span>` : ''}
      </div>
      <div class="name">${esc(deal.name)}</div>
      <div class="meta">${esc(deal.city || '')}${deal.deal_value ? ` · ${fmtMoney(deal.deal_value)}` : ''}</div>
      ${deal.follow_up_date ? `<div class="followup" style="${overdue ? 'color:var(--crit)' : ''}">${overdue ? '⚠ overdue: ' : 'follow up '}${fmtDate(deal.follow_up_date)}</div>` : ''}
      <div class="flags">
        ${deal.needs_security_gate ? '<span class="chip flag">security gate</span>' : ''}
        ${deal.live_url ? '<span class="chip plain">live</span>' : ''}
      </div>
    </button>
  `);
  card.addEventListener('click', () => onOpenDeal(deal.id));
  return card;
}

function openAddLeadModal(onDone) {
  const modal = el(`
    <div class="modal-wrap">
      <form class="modal">
        <h3>Add a lead</h3>
        <div class="field"><label>Business line</label>
          <select name="business_line"><option value="website">Website</option><option value="lodging">Lodging</option></select>
        </div>
        <div class="field"><label>Name</label><input name="name" required></div>
        <div class="grid2">
          <div class="field"><label>City</label><input name="city"></div>
          <div class="field"><label>Industry</label><input name="industry" placeholder="e.g. plumber, cabin"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>Phone</label><input name="phone"></div>
          <div class="field"><label>Email</label><input name="email"></div>
        </div>
        <div class="field"><label>Website</label><input name="website" placeholder="https://…"></div>
        <div class="field"><label>Address</label><input name="address"></div>
        <div class="action-row" style="justify-content:flex-end;margin-top:.5rem">
          <button type="button" class="btn" id="cancel">Cancel</button>
          <button type="submit" class="btn primary">Add lead</button>
        </div>
      </form>
    </div>
  `);
  document.body.appendChild(modal);
  modal.querySelector('#cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { await api.createDeal(fd); modal.remove(); toast('Lead added'); onDone(); }
    catch (err) { toast(err.message, { error: true }); }
  });
}

function openImportModal(onDone) {
  const modal = el(`
    <div class="modal-wrap">
      <form class="modal">
        <h3>Import leads</h3>
        <div class="field"><label>Business line</label>
          <select name="line"><option value="website">Website (Google Places)</option><option value="lodging">Lodging (booking platforms)</option></select>
        </div>
        <div class="field" id="niche-field"><label>Niche</label><input name="niche" placeholder="e.g. bakery, plumber"></div>
        <div class="field"><label>City</label><input name="city" required placeholder="e.g. St. Charles, MO"></div>
        <div class="field"><label>Max results</label><input name="max" type="number" value="15" min="1" max="20"></div>
        <p class="hint" id="import-hint"></p>
        <div class="action-row" style="justify-content:flex-end;margin-top:.5rem">
          <button type="button" class="btn" id="cancel">Cancel</button>
          <button type="submit" class="btn primary">Start scan</button>
        </div>
      </form>
    </div>
  `);
  document.body.appendChild(modal);
  const lineSel = modal.querySelector('select[name=line]');
  const nicheField = modal.querySelector('#niche-field');
  const hint = modal.querySelector('#import-hint');
  const updateHint = () => {
    nicheField.style.display = lineSel.value === 'website' ? '' : 'none';
    hint.textContent = lineSel.value === 'website'
      ? 'Needs GOOGLE_PLACES_API_KEY in .env. Can take up to a minute.'
      : 'Keyless — checks Airbnb/Vrbo/Booking.com/Expedia/Hotels.com presence. Can take a minute or two.';
  };
  lineSel.addEventListener('change', updateHint); updateHint();
  modal.querySelector('#cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Scanning…';
    try {
      const { jobId } = fd.line === 'website'
        ? await api.importLeads({ niche: fd.niche, city: fd.city, max: fd.max })
        : await api.importBookingLeads({ city: fd.city, max: fd.max });
      watchJob(jobId, {
        onDone: async () => {
          const result = await api.jobResult(jobId);
          modal.remove();
          toast(`Imported ${result.meta?.created ?? 0} lead(s)`);
          onDone();
        },
      });
    } catch (err) { toast(err.message, { error: true }); btn.disabled = false; btn.textContent = 'Start scan'; }
  });
}
