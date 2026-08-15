#!/usr/bin/env node
/**
 * Invoice Generator — branded, print-ready invoice.html for a won deal (website or lodging line).
 *
 * Branding comes from a theme file (packages/invoicing/themes/sitewright.json for the website line,
 * reuses packages/proposals/themes/pixelreach.json for the lodging line — same identity as proposals,
 * one file to rebrand each). To rebrand, edit those files (or pass --theme <file>).
 *
 * Usage:
 *   node packages/invoicing/src/invoice.mjs "<Client / Property Name>" \
 *       --items '[{"desc":"Website build","amount":600},{"desc":"Booking add-on","amount":100}]' \
 *       [--slug X] [--number INV-2026-0001] [--due 2026-09-01] [--business-line website|lodging] \
 *       [--theme sitewright] [--bill-contact "Jane"] [--bill-email x@y.com] [--bill-address "..."] \
 *       [--notes "..."] [--status draft|sent|paid] [--json]
 *
 * Output → invoices/out/<slug>/{invoice-<number>.html, invoice.json}
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const client = args.find(a => !a.startsWith('--'));
const opt = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const asJson = args.includes('--json');
if (!client) { console.error('Usage: invoice.mjs "<Client Name>" --items \'[{"desc":"...","amount":1}]\' [--slug --number --due --business-line --theme --bill-contact --bill-email --bill-address --notes --status]'); process.exit(1); }

let items;
try { items = JSON.parse(opt('items', '[]')); } catch { console.error('--items must be a JSON array like \'[{"desc":"Website build","amount":600}]\''); process.exit(1); }
items = (Array.isArray(items) ? items : []).map(i => ({ desc: String(i.desc || 'Item'), amount: Number(i.amount) || 0 }));
if (!items.length) { console.error('At least one line item is required.'); process.exit(1); }

const slugify = s => String(s || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const slug = slugify(opt('slug', client));
const businessLine = opt('business-line', 'website') === 'lodging' ? 'lodging' : 'website';
const defaultTheme = businessLine === 'lodging' ? 'pixelreach' : 'sitewright';
const themeName = opt('theme', defaultTheme);
const themePathLocal = resolve(ROOT, 'packages/invoicing/themes', themeName + '.json');
const themePath = existsSync(themePathLocal) ? themePathLocal : resolve(ROOT, 'packages/proposals/themes', themeName + '.json');
if (!existsSync(themePath)) { console.error(`Theme "${themeName}" not found (looked in packages/invoicing/themes and packages/proposals/themes).`); process.exit(1); }
const theme = JSON.parse(readFileSync(themePath, 'utf8'));
const brand = theme.brand, C = theme.colors;

const number = opt('number') || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const due = opt('due', '');
const status = ['draft', 'sent', 'paid'].includes(opt('status', 'draft')) ? opt('status', 'draft') : 'draft';
const billContact = opt('bill-contact', '');
const billEmail = opt('bill-email', '');
const billAddress = opt('bill-address', '');
const notes = opt('notes', '');
const total = items.reduce((s, i) => s + i.amount, 0);
const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const dueFmt = due ? new Date(due + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_LABEL = { draft: 'DRAFT', sent: 'AWAITING PAYMENT', paid: 'PAID' };

const rows = items.map(i => `
      <tr><td>${esc(i.desc)}</td><td class="amt">${money(i.amount)}</td></tr>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${esc(number)} — ${esc(client)} | ${esc(brand.name)}</title>
<style>
  :root{--brand:${C.primary};--brand-dark:${C.primaryDark};--accent:${C.accent};--bg:${C.bg};--ink:${C.ink};--muted:${C.muted};--light:${C.lightBg};--border:${C.border}}
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#eef2f7}
  .page{max-width:720px;margin:24px auto;background:var(--bg);box-shadow:0 8px 40px #0000001a;border-radius:14px;overflow:hidden}
  .head{padding:2.2rem 2.4rem;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border)}
  .head .from{font-weight:800;color:var(--brand-dark);font-size:1.15rem}
  .head .from .tag{font-weight:400;color:var(--muted);font-size:.85rem;margin-top:.15rem}
  .head .right{text-align:right}
  .head h1{margin:0;color:var(--brand);font-size:1.6rem}
  .badge{display:inline-block;margin-top:.4rem;padding:.2rem .7rem;border-radius:999px;font-size:.75rem;font-weight:700;letter-spacing:.03em}
  .badge.draft{background:var(--light);color:var(--brand-dark)}
  .badge.sent{background:#fef3c7;color:#92400e}
  .badge.paid{background:#dcfce7;color:#166534}
  .meta{display:flex;gap:2.4rem;padding:1.6rem 2.4rem 0}
  .meta .block{font-size:.9rem}
  .meta .block b{display:block;color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem}
  table{width:100%;border-collapse:collapse;margin:1.6rem 0 0}
  th,td{padding:.7rem 2.4rem;text-align:left}
  th{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--border)}
  td{border-bottom:1px solid #0000000d}
  td.amt,th.amt{text-align:right}
  tfoot td{border-bottom:none;font-weight:800;font-size:1.15rem;padding-top:1rem}
  .notes{padding:1.2rem 2.4rem;color:var(--muted);font-size:.9rem}
  .foot{padding:1.2rem 2.4rem 1.8rem;color:var(--muted);font-size:.8rem;border-top:1px solid var(--border);margin-top:1rem}
  .foot a{color:var(--brand)}
  @media print{body{background:#fff}.page{box-shadow:none;margin:0;border-radius:0}}
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div class="from">
      ${esc(brand.name)}
      <div class="tag">${esc(brand.tagline || '')}</div>
    </div>
    <div class="right">
      <h1>Invoice</h1>
      <div class="badge ${status}">${STATUS_LABEL[status]}</div>
    </div>
  </div>
  <div class="meta">
    <div class="block"><b>Invoice #</b>${esc(number)}</div>
    <div class="block"><b>Date</b>${today}</div>
    ${due ? `<div class="block"><b>Due</b>${dueFmt}</div>` : ''}
  </div>
  <div class="meta">
    <div class="block"><b>Bill to</b>${esc(client)}${billContact ? `<br>${esc(billContact)}` : ''}${billAddress ? `<br>${esc(billAddress)}` : ''}${billEmail ? `<br>${esc(billEmail)}` : ''}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td class="amt">${money(total)}</td></tr></tfoot>
  </table>
  ${notes ? `<div class="notes"><b>Notes:</b> ${esc(notes)}</div>` : ''}
  <div class="foot">
    ${theme.paymentInstructions ? esc(theme.paymentInstructions) + '<br>' : ''}${theme.terms ? esc(theme.terms) + '<br>' : ''}
    ${esc(brand.name)} · <a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a>${brand.phone ? ` · <a href="tel:${esc(brand.phone)}">${esc(brand.phone)}</a>` : ''}
  </div>
</div>
</body>
</html>`;

const outDir = resolve(ROOT, 'invoices/out', slug);
mkdirSync(outDir, { recursive: true });
const fileBase = `invoice-${number}`;
writeFileSync(resolve(outDir, fileBase + '.html'), html);
const data = { generatedAt: new Date().toISOString(), number, slug, client, businessLine, status, items, total, due, billContact, billEmail, billAddress, notes };
writeFileSync(resolve(outDir, 'invoice.json'), JSON.stringify(data, null, 2));

if (asJson) { console.log(JSON.stringify({ ...data, file: `invoices/out/${slug}/${fileBase}.html` }, null, 2)); }
else {
  console.log(`\n🧾 Invoice ${number} for "${client}" → invoices/out/${slug}/`);
  console.log(`   • ${fileBase}.html (open in browser → File ▸ Print ▸ Save as PDF to email)`);
  console.log(`   • invoice.json`);
  console.log(`\n   ${items.length} item(s) · total ${money(total)}${due ? ` · due ${dueFmt}` : ''}\n`);
}
