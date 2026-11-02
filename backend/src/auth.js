'use strict';
const crypto = require('node:crypto');
const b64u = (x) => Buffer.from(x).toString('base64url');
const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest();

function signJwt(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  return `${h}.${p}.${hmac(`${h}.${p}`, secret).toString('base64url')}`;
}
function verifyJwt(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    const [h, p, s] = parts;
    if (JSON.parse(Buffer.from(h, 'base64url')).alg !== 'HS256') return null; // tolak alg:none dll.
    const expected = hmac(`${h}.${p}`, secret), got = Buffer.from(s, 'base64url');
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [s, h] = String(stored).split(':');
  if (!s || !h) return false;
  const a = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY_HASH = hashPassword('dummy-untuk-menyamakan-waktu');
module.exports = { signJwt, verifyJwt, hashPassword, verifyPassword, DUMMY_HASH };
