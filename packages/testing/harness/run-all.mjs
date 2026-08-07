#!/usr/bin/env node
// Orchestrator. Usage: run-all.mjs <html-or-url> [--url <live>]
import {spawnSync} from 'node:child_process';import {existsSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const __d=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(__d,'../../..'),args=process.argv.slice(2),target=args.find(a=>!a.startsWith('--')),ui=args.indexOf('--url'),live=ui>=0?args[ui+1]:(target&&/^https?:\/\//i.test(target)?target:null);
if(!target){console.error('Usage: run-all.mjs <html-or-url> [--url <live>]');process.exit(2);}
const has=n=>existsSync(resolve(ROOT,'node_modules',n))||existsSync(resolve(ROOT,'node_modules','.bin',n));
const L=[],rec=(n,s,d)=>L.push({n,s,d});console.log(`\n🧪 Test Suite — ${target}\n${'─'.repeat(48)}`);
let r=spawnSync('node',[resolve(__d,'human-test.mjs'),target],{encoding:'utf8'});process.stdout.write(r.stdout||'');rec('Human-like test',r.status===0?'pass':'fail',r.status===0?'no blockers':'issues');
if(live){const ap=resolve(ROOT,'packages/audit/src/audit.mjs');if(existsSync(ap)){r=spawnSync('node',[ap,live],{encoding:'utf8',timeout:90000});process.stdout.write(r.stdout||'');rec('Instant audit',r.status===0?'pass':'warn','score');}}else rec('Instant audit','skip','no --url');
if(has('vitest')){console.log('\n▶ Unit…');r=spawnSync('npx',['vitest','run','packages/testing/unit'],{cwd:ROOT,encoding:'utf8'});process.stdout.write((r.stdout||'')+(r.stderr||''));rec('Unit tests',r.status===0?'pass':'fail','logic');}else rec('Unit tests','skip','vitest not installed');
if(live&&has('@playwright/test')){console.log('\n▶ E2E…');r=spawnSync('npx',['playwright','test','packages/testing/e2e'],{cwd:ROOT,encoding:'utf8',env:{...process.env,SITE_URL:live}});process.stdout.write((r.stdout||'')+(r.stderr||''));rec('E2E tests',r.status===0?'pass':'fail','browser');}else rec('E2E tests','skip',live?'playwright not installed':'no --url');
if(has('knip')){console.log('\n▶ Dead-code…');r=spawnSync('npx',['knip','--no-progress'],{cwd:ROOT,encoding:'utf8'});process.stdout.write((r.stdout||'').slice(0,1200));rec('Dead-code','info','report');}else rec('Dead-code','skip','knip not installed');
console.log(`\n${'─'.repeat(48)}\n📋 Verdict`);const ic=s=>({pass:'✅',fail:'❌',warn:'⚠️ ',skip:'⏭️ ',info:'ℹ️ '}[s]||'•');L.forEach(l=>console.log(`  ${ic(l.s)} ${l.n} — ${l.d}`));const f=L.filter(l=>l.s==='fail');if(f.length){console.log(`\n❌ ${f.length} failed. Hand to qa-debugger.`);process.exit(1);}console.log('\n🎉 All active layers passed.');process.exit(0);
