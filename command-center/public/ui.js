// Small, framework-free rendering helpers shared across the app.

export const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toast(message, { error = false } = {}) {
  const wrap = document.getElementById('toasts');
  const node = el(`<div class="toast${error ? ' err' : ''}">${esc(message)}</div>`);
  wrap.appendChild(node);
  setTimeout(() => node.remove(), error ? 6000 : 3200);
}

export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '';
}

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtTimestamp(v) {
  const d = new Date(v.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function isOverdue(followUpDate) {
  if (!followUpDate) return false;
  return new Date(followUpDate + 'T23:59:59') < new Date();
}
