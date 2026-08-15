#!/usr/bin/env node
import '../../env.mjs';
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { router } from './routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.COMMAND_CENTER_PORT || '4700', 10);
const HOST = '127.0.0.1'; // local-only by design — never bind 0.0.0.0 for a tool with a shared secret password

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Tiny manual cookie parser (avoids adding cookie-parser as a dependency for one job).
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
});

app.use(express.static(resolve(__dirname, '../public')));
app.use('/api', router);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong on the server.' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n🎛️  Command Center → http://${HOST}:${PORT}\n`);
});
