// Runs the repo's existing scripts as child processes and makes their progress watchable live (SSE) — this
// is the ONLY way the command center touches packages/*/src/*.mjs. Nothing in there gets rewritten; a job is
// just `node <script> <args>` with its stdout/stderr captured line-by-line.
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');

const jobs = new Map(); // jobId -> job record (kept only in memory; a job disappears on server restart)
const JOB_TTL_MS = 30 * 60 * 1000; // stop remembering finished jobs after 30 minutes

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function runNodeJob(scriptPath, args = [], { meta = {} } = {}) {
  sweep();
  const id = randomUUID();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const job = { id, emitter, lines: [], status: 'running', code: null, meta, startedAt: Date.now(), finishedAt: null };
  jobs.set(id, job);

  const push = line => { job.lines.push(line); emitter.emit('line', line); };
  let child;
  try {
    child = spawn(process.execPath, [scriptPath, ...args], { cwd: ROOT, env: process.env });
  } catch (err) {
    push('[error] ' + err.message);
    job.status = 'failed'; job.code = 1; job.finishedAt = Date.now();
    queueMicrotask(() => emitter.emit('close', 1));
    return job;
  }
  const onData = d => String(d).split(/\r?\n/).filter(Boolean).forEach(push);
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', code => {
    job.status = code === 0 ? 'done' : 'failed';
    job.code = code;
    job.finishedAt = Date.now();
    emitter.emit('close', code);
  });
  child.on('error', err => {
    push('[error] ' + err.message);
    job.status = 'failed'; job.code = 1; job.finishedAt = Date.now();
    emitter.emit('close', 1);
  });
  return job;
}

export function getJob(id) { return jobs.get(id); }

export function waitForJob(job) {
  if (job.status !== 'running') return Promise.resolve(job);
  return new Promise(res => job.emitter.once('close', () => res(job)));
}

// Convenience for scripts that support --json: run, wait, parse the last JSON-looking stdout blob.
export async function runJsonTool(scriptPath, args = [], opts = {}) {
  const job = runNodeJob(scriptPath, [...args, '--json'], opts);
  await waitForJob(job);
  const text = job.lines.join('\n');
  const start = text.indexOf('{'), altStart = text.indexOf('[');
  const from = start === -1 ? altStart : (altStart === -1 ? start : Math.min(start, altStart));
  if (from === -1) return { job, data: null };
  try { return { job, data: JSON.parse(text.slice(from)) }; }
  catch { return { job, data: null }; }
}

// Streams a job's output as Server-Sent Events onto an already-open Express response.
export function pipeJobToSSE(job, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  for (const line of job.lines) res.write(`data: ${JSON.stringify({ line })}\n\n`);
  if (job.status !== 'running') {
    res.write(`data: ${JSON.stringify({ done: true, status: job.status, code: job.code })}\n\n`);
    res.end();
    return;
  }
  const onLine = line => res.write(`data: ${JSON.stringify({ line })}\n\n`);
  const onClose = code => {
    res.write(`data: ${JSON.stringify({ done: true, status: job.status, code })}\n\n`);
    res.end();
  };
  job.emitter.on('line', onLine);
  job.emitter.once('close', onClose);
  res.on('close', () => { job.emitter.off('line', onLine); job.emitter.off('close', onClose); });
}

// Repo-relative script paths used by the routes.
export const SCRIPTS = {
  findLeads: resolve(ROOT, 'packages/prospecting/src/find-leads.mjs'),
  opportunities: resolve(ROOT, 'packages/opportunities/src/opportunities.mjs'),
  audit: resolve(ROOT, 'packages/audit/src/audit.mjs'),
  demo: resolve(ROOT, 'packages/demo-gen/src/demo.mjs'),
  prospectBrief: resolve(ROOT, 'packages/prospect-brief/src/brief.mjs'),
  addons: resolve(ROOT, 'packages/addons/src/addons.mjs'),
  buildClient: resolve(ROOT, 'scripts/build-client.mjs'),
  testRunAll: resolve(ROOT, 'packages/testing/harness/run-all.mjs'),
  deploy: resolve(ROOT, 'scripts/deploy.mjs'),
  findBookingLeads: resolve(ROOT, 'packages/lodging-prospects/src/find-booking-leads.mjs'),
  proposeLodging: resolve(ROOT, 'packages/proposals/src/proposal.mjs'),
  listingKit: resolve(ROOT, 'packages/listing-kit/src/kit.mjs'),
  captureOldSite: resolve(ROOT, 'packages/parity/src/capture.mjs'),
  parityCheck: resolve(ROOT, 'packages/parity/src/parity-check.mjs'),
  invoice: resolve(ROOT, 'packages/invoicing/src/invoice.mjs'),
};
