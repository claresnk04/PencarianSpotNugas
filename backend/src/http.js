'use strict';
class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields || {}; }
}
function sendJson(res, status, body, headers = {}) {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s), ...headers });
  res.end(s);
}
const errorBody = (e) => ({ status: 'ERROR', code: e.code, message: e.message, error: { fields: e.fields || {} } });
const success = (message, data, meta) => (meta ? { status: 'SUCCESS', message, data, meta } : { status: 'SUCCESS', message, data });

async function readBody(req, limit = 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new ApiError(413, 'BAD_REQUEST', 'Ukuran request terlalu besar.');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  const ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ct === 'application/json') {
    let v; try { v = JSON.parse(raw); } catch { throw new ApiError(400, 'BAD_REQUEST', 'Body bukan JSON yang valid.'); }
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new ApiError(400, 'BAD_REQUEST', 'Body harus berupa objek JSON.');
    return v;
  }
  if (ct === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  throw new ApiError(415, 'BAD_REQUEST', 'Content-Type harus application/json atau application/x-www-form-urlencoded.');
}
module.exports = { ApiError, sendJson, errorBody, success, readBody };
