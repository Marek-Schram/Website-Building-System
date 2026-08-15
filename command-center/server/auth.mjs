// Local single-user session auth. No accounts, no external service: one password (COMMAND_CENTER_PASSWORD
// in .env) unlocks a session token that lives in server memory — restarting the server logs everyone out,
// which is fine for a tool that only ever runs on your own machine.
import { randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'cc_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const sessions = new Map(); // token -> expiresAt

function safeEqual(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordConfigured() {
  return !!process.env.COMMAND_CENTER_PASSWORD;
}

export function checkPassword(candidate) {
  const real = process.env.COMMAND_CENTER_PASSWORD || '';
  return real.length > 0 && safeEqual(candidate || '', real);
}

export function createSession() {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function destroySession(token) {
  sessions.delete(token);
}

function validSession(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

export function isAuthenticated(req) {
  return validSession(req.cookies?.[COOKIE]);
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE);
}

// Express middleware: 401 JSON for API routes, otherwise let the SPA shell handle showing the login screen.
export function requireAuth(req, res, next) {
  if (!passwordConfigured()) {
    return res.status(500).json({ error: 'COMMAND_CENTER_PASSWORD is not set in .env — see command-center/README.md' });
  }
  const token = req.cookies?.[COOKIE];
  if (validSession(token)) return next();
  res.status(401).json({ error: 'Not signed in' });
}

export { COOKIE };
