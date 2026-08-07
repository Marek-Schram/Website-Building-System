#!/usr/bin/env node
import {readFileSync,existsSync} from 'node:fs';import {resolve} from 'node:path';
const s=process.argv[2];if(!s){console.error('Usage: build-client.mjs "<slug>"');process.exit(1);}
const c=resolve(import.meta.dirname,'..','clients',s,'brand','brand.config.json');if(!existsSync(c)){console.error(`No config for "${s}".`);process.exit(1);}
const cfg=JSON.parse(readFileSync(c,'utf8'));console.log(`Building ${cfg.businessName} (theme: ${cfg.theme})`);console.log('Add-ons:',(cfg.addons||[]).join(', ')||'none');console.log('→ TODO Claude: astro build + add-ons → dist/'+s+'; copy headers.template → public/_headers.');
