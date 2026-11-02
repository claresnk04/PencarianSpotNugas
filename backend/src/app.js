'use strict';
const crypto = require('node:crypto');
const { ApiError, sendJson, errorBody, success, readBody } = require('./http');
const { signJwt, verifyJwt, verifyPassword, DUMMY_HASH } = require('./auth');
const { tx } = require('./db');

const NOISE = ['Hening', 'Sedang', 'Ramai'];
const STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'REVISION_NEEDED'];
const isInt = (v) => /^-?\d+$/.test(String(v).trim());
const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const fail422 = (message, fields) => { throw new ApiError(422, 'VALIDATION_ERROR', message, fields); };
const toBool = (cond, fields, k, msg) => { if (!cond) fields[k] = msg; };

function createApp({ db, jwtSecret, jwtTtl = 28800, corsOrigin = '*', log = false }) {
  const loginFails = new Map(); // rate limit login sederhana (in-memory)

  // ---------- util ----------
  function authenticate(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    const payload = m && verifyJwt(m[1], jwtSecret);
    if (!payload) throw new ApiError(401, 'UNAUTHORIZED', 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');
    const u = db.prepare('SELECT id,email,nama,role FROM users WHERE id=?').get(payload.sub);
    if (!u) throw new ApiError(401, 'UNAUTHORIZED', 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');
    return u; // role diambil dari DB (bukan dari klaim token)
  }
  function paging(q, fields, defLimit) {
    let page = 1, limit = defLimit;
    if (!blank(q.page)) { if (!isInt(q.page) || +q.page < 1) fields.page = 'Harus bilangan bulat >= 1'; else page = +q.page; }
    if (!blank(q.limit)) { if (!isInt(q.limit) || +q.limit < 1 || +q.limit > 100) fields.limit = 'Harus bilangan bulat 1–100'; else limit = +q.limit; }
    return { page, limit };
  }
  const meta = (page, limit, total) => ({ page, limit, total, total_pages: Math.ceil(total / limit) });
  const like = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;
  const dirOf = (q, fields, def) => {
    if (blank(q.order)) return def;
    const o = String(q.order).toLowerCase();
    if (o !== 'asc' && o !== 'desc') { fields.order = 'Pilih: asc atau desc'; return def; }
    return o;
  };
  const kontribusiOut = (r) => ({ id: r.id, nama_tempat: r.nama_tempat, alamat: r.alamat, lat: r.lat, lng: r.lng,
    colokan_min: r.colokan_min, noise_level: r.noise_level, status: r.status, catatan_admin: r.catatan_admin, dikirim_pada: r.dikirim_pada });

  // ---------- handlers ----------
  const login = async ({ req, res, ip }) => {
    const b = await readBody(req), f = {};
    if (typeof b.email !== 'string' || !b.email.trim()) f.email = 'Email wajib diisi';
    if (typeof b.password !== 'string' || !b.password) f.password = 'Kata sandi wajib diisi';
    if (Object.keys(f).length) fail422('Periksa kembali isian login.', f);
    const email = b.email.trim().toLowerCase(), rk = `${ip}|${email}`, rec = loginFails.get(rk);
    if (rec && rec.n >= 10 && rec.until > Date.now()) throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    const okPw = verifyPassword(b.password, u ? u.password_hash : DUMMY_HASH);
    if (!u || !okPw) {
      const n = (rec && rec.until > Date.now() ? rec.n : 0) + 1; loginFails.set(rk, { n, until: Date.now() + 15 * 60e3 });
      throw new ApiError(401, 'UNAUTHORIZED', 'Email atau kata sandi salah.');
    }
    loginFails.delete(rk);
    const token = signJwt({ sub: u.id, role: u.role, email: u.email }, jwtSecret, jwtTtl);
    sendJson(res, 200, success('Login berhasil.', { token, token_type: 'Bearer', expires_in: jwtTtl, user: { id: u.id, email: u.email, nama: u.nama, role: u.role } }));
  };

  const listTempat = ({ res, query: q }) => {
    const f = {}, where = [], args = [];
    const { page, limit } = paging(q, f, 20);
    if (!blank(q.q)) {
      const s = String(q.q).trim();
      if (s.length < 2 || s.length > 60) f.q = 'Panjang pencarian 2–60 karakter';
      else { where.push("(nama_tempat LIKE ? ESCAPE '\\' OR alamat LIKE ? ESCAPE '\\')"); args.push(like(s), like(s)); }
    }
    if (!blank(q.colokan_min)) {
      if (!isInt(q.colokan_min) || +q.colokan_min < 0 || +q.colokan_min > 100) f.colokan_min = 'Harus bilangan bulat 0–100';
      else { where.push('colokan_min >= ?'); args.push(+q.colokan_min); }
    }
    if (!blank(q.noise)) {
      const vals = String(q.noise).split(',').map((x) => x.trim());
      if (vals.some((v) => !NOISE.includes(v))) f.noise = 'Pilih: Hening, Sedang, Ramai';
      else { where.push(`noise_level IN (${vals.map(() => '?').join(',')})`); args.push(...vals); }
    }
    const SORTS = { diperbarui_pada: 'diperbarui_pada', colokan_min: 'colokan_min', nama_tempat: 'nama_tempat', nama: 'nama_tempat' };
    let sortCol = 'diperbarui_pada';
    if (!blank(q.sort)) { if (!Object.hasOwn(SORTS, q.sort)) f.sort = 'Pilih: diperbarui_pada, colokan_min, nama_tempat'; else sortCol = SORTS[q.sort]; }
    const dir = dirOf(q, f, sortCol === 'nama_tempat' ? 'asc' : 'desc');
    if (Object.keys(f).length) fail422('Periksa filter Anda.', f);
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM tempat ${w}`).get(...args).c;
    const rows = db.prepare(`SELECT id,nama_tempat,alamat,lat,lng,colokan_min,noise_level,diperbarui_pada FROM tempat ${w}
      ORDER BY ${sortCol} ${dir}, id ${dir} LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
    sendJson(res, 200, success(total ? 'Berhasil mengambil daftar tempat.' : 'Belum ada tempat yang cocok', rows, meta(page, limit, total)));
  };

  const getTempat = ({ res, params }) => {
    const r = db.prepare('SELECT id,nama_tempat,alamat,lat,lng,colokan_min,noise_level,diperbarui_pada FROM tempat WHERE id=?').get(+params[0]);
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Tempat tidak ditemukan.');
    sendJson(res, 200, success('Berhasil mengambil detail tempat.', r));
  };

  function validateKontribusi(b) {
    const f = {}, p = {};
    if (typeof b.nama_tempat !== 'string' || !b.nama_tempat.trim()) f.nama_tempat = 'Nama tempat wajib diisi';
    else if (b.nama_tempat.trim().length > 120) f.nama_tempat = 'Maksimal 120 karakter';
    else p.nama_tempat = b.nama_tempat.trim().replace(/\s+/g, ' ');
    const ck = 'colokan_min' in b ? 'colokan_min' : ('persen_colokan' in b ? 'persen_colokan' : 'colokan_min');
    p.colokan_min = null;
    if (!blank(b[ck])) {
      if (!isInt(b[ck]) || (typeof b[ck] === 'number' && !Number.isInteger(b[ck]))) f[ck] = 'Persentase colokan harus berupa angka bulat';
      else if (+b[ck] < 0 || +b[ck] > 100) f[ck] = 'Persentase colokan harus 0–100%';
      else p.colokan_min = +b[ck];
    }
    p.noise_level = null;
    if (!blank(b.noise_level)) { if (!NOISE.includes(b.noise_level)) f.noise_level = 'Pilih: Hening, Sedang, Ramai'; else p.noise_level = b.noise_level; }
    p.alamat = null;
    if (!blank(b.alamat)) { if (typeof b.alamat !== 'string' || b.alamat.trim().length > 255) f.alamat = 'Maksimal 255 karakter'; else p.alamat = b.alamat.trim(); }
    p.lat = null; p.lng = null;
    if (!blank(b.lat) || !blank(b.lng)) {
      const lat = Number(b.lat), lng = Number(b.lng);
      toBool(!blank(b.lat) && Number.isFinite(lat) && lat >= -90 && lat <= 90, f, 'lat', 'Latitude harus angka -90 s.d. 90');
      toBool(!blank(b.lng) && Number.isFinite(lng) && lng >= -180 && lng <= 180, f, 'lng', 'Longitude harus angka -180 s.d. 180');
      if (!f.lat && !f.lng) { p.lat = lat; p.lng = lng; }
    }
    if (Object.keys(f).length) fail422('Kontribusi belum terkirim. Periksa kembali isian form Anda.', f);
    return p; // id, status, dikirim_pada, catatan_admin dari klien diabaikan
  }

  const createKontribusi = async ({ req, res, user }) => {
    const p = validateKontribusi(await readBody(req));
    const key = req.headers['idempotency-key'];
    if (key !== undefined && !/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) fail422('Header Idempotency-Key tidak valid.', { 'Idempotency-Key': 'Gunakan 8–128 karakter (disarankan UUID)' });
    const fp = crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
    let rec, replay = false;
    tx(db, () => {
      if (key) {
        const ex = db.prepare('SELECT * FROM idempotency WHERE key=? AND user_id=?').get(key, user.id);
        if (ex) {
          if (ex.fingerprint !== fp) throw new ApiError(409, 'STATE_CONFLICT', 'Idempotency-Key sudah dipakai untuk data yang berbeda.');
          rec = db.prepare('SELECT * FROM kontribusi WHERE id=?').get(ex.kontribusi_id); replay = true; return;
        }
      }
      const now = new Date().toISOString();
      const r = db.prepare(`INSERT INTO kontribusi(nama_tempat,alamat,lat,lng,colokan_min,noise_level,status,user_id,dikirim_pada)
        VALUES(?,?,?,?,?,?,'PENDING',?,?)`).run(p.nama_tempat, p.alamat, p.lat, p.lng, p.colokan_min, p.noise_level, user.id, now);
      rec = db.prepare('SELECT * FROM kontribusi WHERE id=?').get(r.lastInsertRowid);
      if (key) db.prepare('INSERT INTO idempotency(key,user_id,fingerprint,kontribusi_id,created_at) VALUES(?,?,?,?,?)').run(key, user.id, fp, rec.id, now);
    });
    sendJson(res, 201, success('Terima kasih! Kontribusi Anda berhasil dikirim dan sedang menunggu moderasi.', kontribusiOut(rec)),
      replay ? { 'Idempotency-Replayed': 'true' } : {});
  };

  const listAntrean = ({ res, query: q }) => {
    const f = {}, where = ['k.deleted_at IS NULL'], args = [];
    const { page, limit } = paging(q, f, 10);
    let status = 'PENDING';
    if (!blank(q.status)) { if (!STATUS.includes(q.status)) f.status = `Pilih: ${STATUS.join(', ')}`; else status = q.status; }
    where.push('k.status = ?'); args.push(status);
    if (!blank(q.q)) {
      const s = String(q.q).trim();
      if (s.length < 2 || s.length > 60) f.q = 'Panjang pencarian 2–60 karakter';
      else { where.push("(k.nama_tempat LIKE ? ESCAPE '\\' OR u.nama LIKE ? ESCAPE '\\')"); args.push(like(s), like(s)); }
    }
    const dir = dirOf(q, f, 'asc');
    if (!blank(q.sort) && q.sort !== 'dikirim_pada') f.sort = 'Pilih: dikirim_pada';
    if (Object.keys(f).length) fail422('Periksa parameter antrean.', f);
    const w = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) c FROM kontribusi k JOIN users u ON u.id=k.user_id WHERE ${w}`).get(...args).c;
    const rows = db.prepare(`SELECT k.*, u.nama AS kontributor FROM kontribusi k JOIN users u ON u.id=k.user_id WHERE ${w}
      ORDER BY k.dikirim_pada ${dir}, k.id ${dir} LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
    sendJson(res, 200, success('Berhasil mengambil antrean kontribusi.', rows.map((r) => ({ ...kontribusiOut(r), kontributor: r.kontributor })), meta(page, limit, total)));
  };

  const patchAntrean = async ({ req, res, params, user }) => {
    const id = +params[0], b = await readBody(req), f = {};
    for (const k of Object.keys(b)) if (k !== 'status' && k !== 'catatan_admin') f[k] = 'Field ini tidak boleh diubah';
    if (!STATUS.includes(b.status)) f.status = `Pilih: ${STATUS.join(', ')}`;
    let catatan = null;
    if (!blank(b.catatan_admin)) { if (typeof b.catatan_admin !== 'string' || b.catatan_admin.trim().length > 500) f.catatan_admin = 'Maksimal 500 karakter'; else catatan = b.catatan_admin.trim(); }
    if (b.status === 'REJECTED' && !catatan && !f.catatan_admin) f.catatan_admin = 'Isi alasan penolakan';
    if (Object.keys(f).length) fail422('Perubahan status belum diproses. Periksa isian Anda.', f);
    const out = tx(db, () => {
      const cur = db.prepare('SELECT * FROM kontribusi WHERE id=? AND deleted_at IS NULL').get(id);
      if (!cur) throw new ApiError(404, 'NOT_FOUND', 'Kontribusi tidak ditemukan.');
      if (cur.status !== 'PENDING') throw new ApiError(409, 'STATE_CONFLICT', `Status kontribusi sudah diubah (saat ini ${cur.status}). Muat ulang antrean.`);
      if (b.status === 'PENDING') throw new ApiError(409, 'STATE_CONFLICT', 'Transisi status ke PENDING tidak diizinkan.');
      const now = new Date().toISOString();
      const r = db.prepare(`UPDATE kontribusi SET status=?, catatan_admin=?, diproses_oleh=?, diproses_pada=? WHERE id=? AND status='PENDING'`)
        .run(b.status, catatan, user.id, now, id);
      if (r.changes !== 1) throw new ApiError(409, 'STATE_CONFLICT', 'Status kontribusi sudah diubah oleh admin lain.');
      if (b.status === 'APPROVED') // BR-01: tampil publik hanya setelah Terverifikasi
        db.prepare('INSERT INTO tempat(nama_tempat,alamat,lat,lng,colokan_min,noise_level,kontribusi_id,diperbarui_pada) VALUES(?,?,?,?,?,?,?,?)')
          .run(cur.nama_tempat, cur.alamat, cur.lat, cur.lng, cur.colokan_min, cur.noise_level, cur.id, now);
      return db.prepare('SELECT * FROM kontribusi WHERE id=?').get(id);
    });
    const msg = { APPROVED: 'Kontribusi disetujui — kini tampil di publik.', REJECTED: 'Kontribusi ditolak.', REVISION_NEEDED: 'Kontribusi dikembalikan untuk revisi.' }[b.status];
    sendJson(res, 200, success(msg, { ...kontribusiOut(out), diproses_pada: out.diproses_pada }));
  };

  // ---------- router ----------
  const R = (method, re, auth, fn) => ({ method, re, auth, fn });
  const routes = [
    R('GET', /^\/health$/, null, ({ res }) => sendJson(res, 200, success('OK', { uptime: process.uptime() }))),
    R('POST', /^\/api\/v1\/auth\/login$/, null, login),
    R('GET', /^\/api\/v1\/tempat$/, null, listTempat),
    R('GET', /^\/api\/v1\/tempat\/(\d+)$/, null, getTempat),
    R('POST', /^\/api\/v1\/kontribusi$/, 'ANY', createKontribusi),
    R('GET', /^\/api\/v1\/admin\/antrean$/, 'ADMIN', listAntrean),
    R('PATCH', /^\/api\/v1\/admin\/antrean\/(\d+)$/, 'ADMIN', patchAntrean),
  ];

  return async function handle(req, res) {
    const t0 = Date.now();
    const cors = { 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    const origWrite = res.writeHead.bind(res);
    res.writeHead = (s, h) => origWrite(s, { ...cors, ...h });
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key',
          'Access-Control-Expose-Headers': 'Idempotency-Replayed', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      const url = new URL(req.url, 'http://localhost');
      const q = {}; for (const [k, v] of url.searchParams) if (!(k in q)) q[k] = v; // nilai pertama menang
      const matches = routes.map((r) => ({ r, m: r.re.exec(url.pathname) })).filter((x) => x.m);
      if (!matches.length) throw new ApiError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
      const hit = matches.find((x) => x.r.method === req.method);
      if (!hit) { res.setHeader('Allow', matches.map((x) => x.r.method).join(', ')); throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method tidak diizinkan untuk endpoint ini.'); }
      const ctx = { req, res, query: q, params: hit.m.slice(1), ip: req.socket.remoteAddress || '-' };
      if (hit.r.auth) { // 401 -> 403 diperiksa SEBELUM body dibaca/divalidasi
        ctx.user = authenticate(req);
        if (hit.r.auth === 'ADMIN' && ctx.user.role !== 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Anda tidak punya izin untuk aksi ini.');
      }
      await hit.r.fn(ctx);
    } catch (e) {
      if (!(e instanceof ApiError)) { console.error('[ERROR]', e); e = new ApiError(500, 'INTERNAL_ERROR', 'Terjadi gangguan pada sistem. Silakan coba beberapa saat lagi.'); }
      const h = e.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {};
      if (e.status === 413) h.Connection = 'close';
      if (!res.headersSent) sendJson(res, e.status, errorBody(e), h);
    } finally { if (log) console.log(`${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${Date.now() - t0}ms`); }
  };
}
module.exports = { createApp };
