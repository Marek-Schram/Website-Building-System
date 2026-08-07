#!/usr/bin/env node
import {execSync} from 'node:child_process';
const s=process.argv[2];if(!s){console.error('Usage: deploy.mjs "<slug>"');process.exit(1);}
console.log(`Deploying ${s}... confirm /test-site + /security-gate passed + _headers exists.`);
try{execSync(`npx wrangler pages deploy dist/${s} --project-name=${s}`,{stdio:'inherit'});console.log('✅ Deployed.');}catch(e){console.error('Failed. Need wrangler + CLOUDFLARE_API_TOKEN.');}
