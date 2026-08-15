// Command Center database — a single local SQLite file (command-center/data/pipeline.db, gitignored).
// Two tables: deals (the pipeline board's cards) and activity (a timestamped log per deal). Everything else
// a deal points at — the demo, the proposal, the client folder — stays exactly where the real tools put it;
// this database only keeps a link (a path or slug), never a copy.
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(resolve(DATA_DIR, 'pipeline.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_line TEXT NOT NULL DEFAULT 'website' CHECK (business_line IN ('website','lodging')),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  website TEXT,
  industry TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','contacted','proposal_sent','won','delivered','invoiced')),
  priority TEXT CHECK (priority IN ('HOT','WARM','COOL') OR priority IS NULL),
  opportunity_score INTEGER,
  deal_value REAL,
  next_action TEXT,
  follow_up_date TEXT,
  client_slug TEXT,
  demo_path TEXT,
  opportunity_report_path TEXT,
  proposal_path TEXT,
  dist_path TEXT,
  live_url TEXT,
  needs_security_gate INTEGER NOT NULL DEFAULT 0,
  invoiced_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note','call','email','stage_change','tool_run')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_deal ON activity(deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
`);

// Lightweight migration: CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already existed
// (e.g. from a Phase 1 database) — add any that are missing, one at a time, ignoring "duplicate column".
const MIGRATIONS = [
  "ALTER TABLE deals ADD COLUMN detected_booking_system TEXT",
  "ALTER TABLE deals ADD COLUMN platform_presence TEXT", // JSON: [{platform,label,found}], from find-booking-leads
  "ALTER TABLE deals ADD COLUMN platforms_wanted TEXT",  // e.g. "airbnb,vrbo" — last platforms picked for this deal
];
for (const sql of MIGRATIONS) { try { db.exec(sql); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; } }

const DEAL_FIELDS = ['business_line', 'name', 'contact_name', 'phone', 'email', 'address', 'city', 'website',
  'industry', 'source', 'stage', 'priority', 'opportunity_score', 'deal_value', 'next_action', 'follow_up_date',
  'client_slug', 'demo_path', 'opportunity_report_path', 'proposal_path', 'dist_path', 'live_url',
  'needs_security_gate', 'invoiced_amount', 'detected_booking_system', 'platform_presence', 'platforms_wanted'];

export function listDeals({ businessLine, stage } = {}) {
  let sql = 'SELECT * FROM deals';
  const where = [], params = {};
  if (businessLine) { where.push('business_line = @businessLine'); params.businessLine = businessLine; }
  if (stage) { where.push('stage = @stage'); params.stage = stage; }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(params);
}

export function getDeal(id) {
  return db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
}

export function createDeal(fields) {
  const cols = DEAL_FIELDS.filter(f => fields[f] !== undefined);
  const stmt = db.prepare(`INSERT INTO deals (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`);
  const info = stmt.run(fields);
  logActivity(info.lastInsertRowid, 'note', 'Deal created' + (fields.source ? ` (source: ${fields.source})` : ''));
  return getDeal(info.lastInsertRowid);
}

export function updateDeal(id, fields) {
  const cols = DEAL_FIELDS.filter(f => fields[f] !== undefined);
  if (!cols.length) return getDeal(id);
  const before = getDeal(id);
  const stmt = db.prepare(`UPDATE deals SET ${cols.map(c => `${c} = @${c}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`);
  stmt.run({ ...fields, id });
  if (fields.stage && before && fields.stage !== before.stage) {
    logActivity(id, 'stage_change', `${before.stage} → ${fields.stage}`);
  }
  return getDeal(id);
}

export function deleteDeal(id) {
  db.prepare('DELETE FROM deals WHERE id = ?').run(id);
}

export function listActivity(dealId) {
  return db.prepare('SELECT * FROM activity WHERE deal_id = ? ORDER BY created_at DESC, id DESC').all(dealId);
}

export function logActivity(dealId, type, text) {
  return db.prepare('INSERT INTO activity (deal_id, type, text) VALUES (?, ?, ?)').run(dealId, type, text);
}
