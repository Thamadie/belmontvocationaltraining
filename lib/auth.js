'use strict';

// Authentication for two kinds of visitors:
// - one admin account configured through environment variables;
// - candidate accounts that sign up on the website (passwords hashed with scrypt).
// Sessions are stored (hashed) in MongoDB so they survive restarts, and are
// referenced by HttpOnly, SameSite cookies. Repeated failed logins lock an IP out.

const crypto = require('crypto');
const { promisify } = require('util');
const store = require('./store');

const scrypt = promisify(crypto.scrypt);

const ADMIN_COOKIE = 'bvt_admin';
const USER_COOKIE = 'bvt_user';
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const USER_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const USING_DEFAULT_PASSWORD = !process.env.ADMIN_PASSWORD;

const failedLogins = new Map(); // `${kind}:${ip}` -> { count, until }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = await scrypt(String(password), Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookieAttrs(req, sameSite) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
}

function isLockedOut(key) {
  const entry = failedLogins.get(key);
  return entry && entry.until > Date.now();
}

function recordFailure(key) {
  const entry = failedLogins.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.until = Date.now() + 15 * 60 * 1000;
    entry.count = 0;
  }
  failedLogins.set(key, entry);
}

function readToken(req, cookie) {
  const token = parseCookies(req.headers.cookie)[cookie];
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function startSession(req, res, kind, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = kind === 'admin' ? ADMIN_TTL_MS : USER_TTL_MS;
  await store.createSession(token, new Date(Date.now() + ttl), kind, userId);
  // Candidates arrive from links (emails, search results), so their cookie is Lax.
  const cookie = kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
  res.append('Set-Cookie', `${cookie}=${token}; Max-Age=${ttl / 1000}; ${cookieAttrs(req, kind === 'admin' ? 'Strict' : 'Lax')}`);
  return token;
}

async function endSession(req, res, kind) {
  const cookie = kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
  const token = readToken(req, cookie);
  if (token) await store.deleteSession(token);
  res.append('Set-Cookie', `${cookie}=; Max-Age=0; ${cookieAttrs(req, kind === 'admin' ? 'Strict' : 'Lax')}`);
}

// ---------------------------------------------------------------- admin

async function adminLogin(req, res) {
  const key = `admin:${req.ip}`;
  if (isLockedOut(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const { username, password } = req.body || {};
  if (!safeEqual(username || '', ADMIN_USERNAME) || !safeEqual(password || '', ADMIN_PASSWORD)) {
    recordFailure(key);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  failedLogins.delete(key);
  await startSession(req, res, 'admin');
  res.json({ ok: true, username: ADMIN_USERNAME });
}

async function adminLogout(req, res) {
  await endSession(req, res, 'admin');
  res.json({ ok: true });
}

async function isAdmin(req) {
  const token = readToken(req, ADMIN_COOKIE);
  return Boolean(token && (await store.getSession(token, 'admin')));
}

async function requireAdmin(req, res, next) {
  if (!(await isAdmin(req))) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

// ---------------------------------------------------------------- candidates

// Resolves the signed-in candidate (or null) and caches it on the request.
async function currentUser(req) {
  if (req.user !== undefined) return req.user;
  req.user = null;
  const token = readToken(req, USER_COOKIE);
  if (!token) return null;
  const session = await store.getSession(token, 'user');
  if (!session) return null;
  const user = await store.getUser(session.userId);
  if (user && user.accountStatus !== 'suspended') {
    req.user = user;
    req.userToken = token;
  }
  return req.user;
}

async function requireUser(req, res, next) {
  if (!(await currentUser(req))) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

async function userLogin(req, res) {
  const key = `user:${req.ip}`;
  if (isLockedOut(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const password = String((req.body || {}).password || '');
  const user = email ? await store.getUserWithHash({ email }) : null;
  const ok = user && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    recordFailure(key);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (user.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended. Please contact Belmont.' });
  }
  failedLogins.delete(key);
  await startSession(req, res, 'user', user.id);
  await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
  res.json({ ok: true });
}

async function userLogout(req, res) {
  await endSession(req, res, 'user');
  res.json({ ok: true });
}

module.exports = {
  adminLogin,
  adminLogout,
  isAdmin,
  requireAdmin,
  currentUser,
  requireUser,
  userLogin,
  userLogout,
  startSession,
  hashPassword,
  verifyPassword,
  ADMIN_USERNAME,
  USING_DEFAULT_PASSWORD,
};
