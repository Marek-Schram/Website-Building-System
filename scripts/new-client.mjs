#!/usr/bin/env node
import {cpSync,existsSync} from 'node:fs';import {resolve} from 'node:path';
const s=process.argv[2];if(!s){console.error('Usage: new-client.mjs "<slug>"');process.exit(1);}
const root=resolve(import.meta.dirname,'..'),d=resolve(root,'clients',s);
if(existsSync(d)){console.error(`"${s}" exists.`);process.exit(1);}cpSync(resolve(root,'clients/_template'),d,{recursive:true});
console.log(`✅ clients/${s}. Fill brand/ + content/ (or seed from parity/<slug>/brand.seed.json), then /build-site → /add-feature → /test-site → /security-gate → /deploy-site`);
