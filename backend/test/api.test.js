'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDb, seed } = require('../src/db');
const { createApp } = require('../src/app');

let server, base, db, admin, user, uploadDir;
const call = async (method, path, { token, body, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); return { status: r.status, headers: r.headers, json: text ? JSON.parse(text) : null };
};
const login = async (email, password) => (await call('POST', '/api/v1/auth/login', { body: { email, password } })).json.data.token;
const antrean = (q = '') => call('GET', `/api/v1/admin/antrean${q}`, { token: admin });
const valid = (o = {}) => ({ nama_tempat: 'Kafe Sudut Gejayan', colokan_min: 85, noise_level: 'Hening', ...o });
const assertErr = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.json.status, 'ERROR'); assert.equal(r.json.code, code); assert.ok(r.json.message); assert.ok(r.json.error && typeof r.json.error.fields === 'object'); assert.ok(!/stack|at Object|node:/.test(JSON.stringify(r.json))); };

before(async () => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snij-upload-test-'));
  db = openDb(':memory:'); seed(db, { adminEmail: 'admin@snij.test', adminPassword: 'Admin123!', userEmail: 'user@snij.test', userPassword: 'User123!', demoTempat: true });
  server = http.createServer(createApp({ db, jwtSecret: 'x'.repeat(40), uploadDir }));
  await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  admin = await login('admin@snij.test', 'Admin123!'); user = await login('user@snij.test', 'User123!');
});
after(() => { server.close(); db.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); });

test('database lama dimigrasikan untuk fasilitas WiFi, pilihan lain, dan foto', () => {
  const file = path.join(uploadDir, 'legacy.sqlite');
  const legacy = new DatabaseSync(file);
  legacy.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, nama TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE tempat(id INTEGER PRIMARY KEY, nama_tempat TEXT NOT NULL, alamat TEXT, lat REAL, lng REAL, colokan_min INTEGER, noise_level TEXT, kontribusi_id INTEGER, diperbarui_pada TEXT NOT NULL);
    CREATE TABLE kontribusi(id INTEGER PRIMARY KEY, nama_tempat TEXT NOT NULL, alamat TEXT, lat REAL, lng REAL, colokan_min INTEGER, noise_level TEXT, status TEXT NOT NULL, catatan_admin TEXT, user_id INTEGER NOT NULL, dikirim_pada TEXT NOT NULL, diproses_oleh INTEGER, diproses_pada TEXT, deleted_at TEXT);
    CREATE TABLE idempotency(key TEXT NOT NULL, user_id INTEGER NOT NULL, fingerprint TEXT NOT NULL, kontribusi_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(key,user_id));
  `);
  legacy.close();
  const migrated = openDb(file);
  for (const table of ['tempat', 'kontribusi']) {
    const columns = migrated.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    assert.ok(columns.includes('wifi'));
    assert.ok(columns.includes('fasilitas_lainnya'));
    assert.ok(columns.includes('foto_speedtest'));
  }
  migrated.close();
});

test('login: sukses (USER & ADMIN), salah sandi 401, field kosong 422', async () => {
  const a = await call('POST', '/api/v1/auth/login', { body: { email: 'admin@snij.test', password: 'Admin123!' } });
  assert.equal(a.status, 200); assert.equal(a.json.data.user.role, 'ADMIN'); assert.equal(a.json.data.token.split('.').length, 3);
  assertErr(await call('POST', '/api/v1/auth/login', { body: { email: 'admin@snij.test', password: 'salah' } }), 401, 'UNAUTHORIZED');
  const e = await call('POST', '/api/v1/auth/login', { body: {} }); assertErr(e, 422, 'VALIDATION_ERROR'); assert.ok(e.json.error.fields.email && e.json.error.fields.password);
});

test('register: USER baru, validasi password, email duplikat, lalu login', async () => {
  const created = await call('POST', '/api/v1/auth/register', { body: { nama: 'Pengguna Baru', email: 'baru@snij.test', password: 'Rahasia123' } });
  assert.equal(created.status, 201); assert.equal(created.json.data.user.role, 'USER'); assert.equal(created.json.data.user.email, 'baru@snij.test');
  assert.equal((await call('POST', '/api/v1/auth/login', { body: { email: 'baru@snij.test', password: 'Rahasia123' } })).status, 200);
  assertErr(await call('POST', '/api/v1/auth/register', { body: { nama: 'Lain', email: 'baru@snij.test', password: 'Rahasia123' } }), 409, 'STATE_CONFLICT');
  const invalid = await call('POST', '/api/v1/auth/register', { body: { nama: 'A', email: 'bukan-email', password: 'pendek' } });
  assertErr(invalid, 422, 'VALIDATION_ERROR'); assert.ok(invalid.json.error.fields.email && invalid.json.error.fields.password);
});

test('status kontribusi: hanya data milik user dan wajib login', async () => {
  const created = await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Kafe Status Saya' }) });
  const own = await call('GET', '/api/v1/kontribusi/saya', { token: user });
  assert.equal(own.status, 200); assert.ok(own.json.data.some((item) => item.id === created.json.data.id));
  assert.ok(own.json.data.every((item) => !('user_id' in item)));
  assertErr(await call('GET', '/api/v1/kontribusi/saya'), 401, 'UNAUTHORIZED');
});

test('fasilitas inklusif: disimpan, dikembalikan, dan divalidasi', async () => {
  const facilities = ['Akses kursi roda', 'Toilet aksesibel', 'Ruang laktasi'];
  const created = await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Kafe Inklusif', fasilitas_inklusif: facilities }) });
  assert.equal(created.status, 201); assert.deepEqual(created.json.data.fasilitas_inklusif, facilities);
  const approved = await call('PATCH', `/api/v1/admin/antrean/${created.json.data.id}`, { token: admin, body: { status: 'APPROVED' } });
  assert.equal(approved.status, 200);
  const place = (await call('GET', '/api/v1/tempat?q=Kafe Inklusif')).json.data[0];
  assert.deepEqual(place.fasilitas_inklusif, facilities);
  assertErr(await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ fasilitas_inklusif: ['Fasilitas tidak dikenal'] }) }), 422, 'VALIDATION_ERROR');
});

test('ulasan tempat: butuh login, rating/komentar tervalidasi, dan satu ulasan dapat diperbarui', async () => {
  const placeId = db.prepare('SELECT id FROM tempat ORDER BY id LIMIT 1').get().id;
  const placeCount = db.prepare('SELECT COUNT(*) AS count FROM tempat').get().count;
  const url = `/api/v1/tempat/${placeId}/ulasan`;
  const empty = await call('GET', url);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.json.data.ringkasan, { rata_rata: null, total: 0 });
  assertErr(await call('PUT', url, { body: { rating: 5, komentar: 'Nyaman.' } }), 401, 'UNAUTHORIZED');
  for (const body of [
    { rating: 0, komentar: 'Tidak valid.' },
    { rating: 6, komentar: 'Tidak valid.' },
    { rating: 4.5, komentar: 'Tidak valid.' },
    { rating: 5, komentar: '   ' },
    { rating: 5, komentar: 'a'.repeat(1001) },
    { rating: 5, komentar: 'Bagus.', nama_tempat: 'Kafe lain' },
  ]) {
    assertErr(await call('PUT', url, { token: user, body }), 422, 'VALIDATION_ERROR');
  }

  const first = await call('PUT', url, { token: user, body: { rating: 4, komentar: 'Tempat nyaman untuk belajar.' } });
  assert.equal(first.status, 200);
  assert.equal(first.json.data.nama_pengguna, 'Pengguna');
  const own = await call('GET', `${url}/saya`, { token: user });
  assert.equal(own.json.data.id, first.json.data.id);
  const updated = await call('PUT', url, { token: user, body: { rating: 2, komentar: 'Perlu lebih banyak colokan.' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.id, first.json.data.id);
  assert.equal(updated.json.data.rating, 2);

  await call('PUT', url, { token: admin, body: { rating: 4, komentar: 'Suasananya menyenangkan.' } });
  const reviews = await call('GET', `${url}?limit=10`);
  assert.equal(reviews.json.data.ringkasan.total, 2);
  assert.equal(reviews.json.data.ringkasan.rata_rata, 3);
  assert.equal(reviews.json.data.ulasan.length, 2);
  assert.ok(reviews.json.data.ulasan.every((review) => !('user_id' in review) && !('email' in review)));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tempat').get().count, placeCount);
  assertErr(await call('GET', '/api/v1/tempat/999999/ulasan'), 404, 'NOT_FOUND');
});

test('upload speedtest, filter WiFi/fasilitas, dan publikasi foto saat disetujui', async () => {
  const png = Buffer.from('iVBORw0KGgo=', 'base64');
  assertErr(await call('POST', '/api/v1/upload/speedtest', {
    body: { mime_type: 'image/png', data: png.toString('base64') },
  }), 401, 'UNAUTHORIZED');
  const uploaded = await call('POST', '/api/v1/upload/speedtest', {
    token: user,
    body: { mime_type: 'image/png', data: png.toString('base64') },
  });
  assert.equal(uploaded.status, 201);
  const photoPath = uploaded.json.data.foto_speedtest;
  const image = await fetch(`${base}${photoPath}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);

  const created = await call('POST', '/api/v1/kontribusi', {
    token: user,
    body: valid({ nama_tempat: 'Kafe Filter Fasilitas', wifi: true, fasilitas_lainnya: ['AC', 'Parkir'], foto_speedtest: photoPath }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.wifi, true);
  assert.deepEqual(created.json.data.fasilitas_lainnya, ['AC', 'Parkir']);
  assert.equal(created.json.data.foto_speedtest, photoPath);
  assert.equal((await call('PATCH', `/api/v1/admin/antrean/${created.json.data.id}`, { token: admin, body: { status: 'APPROVED' } })).status, 200);

  const filtered = await call('GET', '/api/v1/tempat?wifi=true&fasilitas=AC,Parkir');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.json.data.length, 1);
  assert.equal(filtered.json.data[0].foto_speedtest, photoPath);
  assertErr(await call('GET', '/api/v1/tempat?wifi=maybe'), 422, 'VALIDATION_ERROR');
  assertErr(await call('GET', '/api/v1/tempat?fasilitas=Unknown'), 422, 'VALIDATION_ERROR');
  assertErr(await call('POST', '/api/v1/upload/speedtest', {
    token: user,
    body: { mime_type: 'image/png', data: Buffer.from('not image').toString('base64') },
  }), 422, 'VALIDATION_ERROR');
  const oversizedPng = Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024 - png.length + 1)]);
  assertErr(await call('POST', '/api/v1/upload/speedtest', {
    token: user,
    body: { mime_type: 'image/png', data: oversizedPng.toString('base64') },
  }), 422, 'VALIDATION_ERROR');
});

test('T01 CRUD valid: POST 201 PENDING -> muncul di antrean -> PATCH APPROVED 200 -> tampil publik', async () => {
  const c = await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Kafe T01 Unik' }) });
  assert.equal(c.status, 201); assert.equal(c.json.status, 'SUCCESS'); assert.equal(c.json.data.status, 'PENDING');
  const id = c.json.data.id;
  const before = await call('GET', '/api/v1/tempat?q=T01 Unik'); assert.deepEqual(before.json.data, []); // BR-01: belum tampil
  const list = await antrean(); assert.ok(list.json.data.some((x) => x.id === id));
  const p = await call('PATCH', `/api/v1/admin/antrean/${id}`, { token: admin, body: { status: 'APPROVED' } });
  assert.equal(p.status, 200); assert.equal(p.json.data.status, 'APPROVED');
  const pub = await call('GET', '/api/v1/tempat?q=T01 Unik'); assert.equal(pub.json.data.length, 1);
  assert.equal((await call('GET', `/api/v1/tempat/${pub.json.data[0].id}`)).status, 200);
});

test('T02 input salah: 422 + error.fields, tidak ada record baru', async () => {
  const n0 = (await antrean('?limit=100')).json.meta.total;
  for (const body of [valid({ nama_tempat: '' }), valid({ nama_tempat: '   ' }), {}, valid({ colokan_min: 150 }), valid({ colokan_min: -1 }), valid({ colokan_min: 'abc' }), valid({ colokan_min: 12.5 }), valid({ noise_level: 'Bising' })]) {
    const r = await call('POST', '/api/v1/kontribusi', { token: user, body }); assertErr(r, 422, 'VALIDATION_ERROR'); assert.ok(Object.keys(r.json.error.fields).length);
  }
  const r = await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: '', colokan_min: 150 }) });
  assert.ok(r.json.error.fields.nama_tempat && r.json.error.fields.colokan_min);
  assert.equal((await antrean('?limit=100')).json.meta.total, n0);
});

test('T03 hasil kosong: 200 data []', async () => {
  const r = await call('GET', '/api/v1/tempat?colokan_min=100&noise=Hening&q=tidak-ada-yang-cocok');
  assert.equal(r.status, 200); assert.deepEqual(r.json.data, []); assert.equal(r.json.meta.total, 0);
});

test('T04 (a) tanpa/invalid token 401, (b) role USER 403 & data tidak berubah', async () => {
  assertErr(await call('GET', '/api/v1/admin/antrean'), 401, 'UNAUTHORIZED');
  assertErr(await call('POST', '/api/v1/kontribusi', { body: valid() }), 401, 'UNAUTHORIZED');
  assertErr(await call('GET', '/api/v1/admin/antrean', { token: 'abc.def.ghi' }), 401, 'UNAUTHORIZED');
  const c = await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Kafe T04' }) }); const id = c.json.data.id;
  assertErr(await call('GET', '/api/v1/admin/antrean', { token: user }), 403, 'FORBIDDEN');
  assertErr(await call('PATCH', `/api/v1/admin/antrean/${id}`, { token: user, body: { status: 'APPROVED' } }), 403, 'FORBIDDEN');
  assert.equal(db.prepare('SELECT status FROM kontribusi WHERE id=?').get(id).status, 'PENDING');
});

test('T05 transisi ilegal 409, dua admin bersamaan, tolak tanpa catatan 422', async () => {
  const mk = async (n) => (await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: n }) })).json.data.id;
  const a = await mk('Kafe T05a');
  await call('PATCH', `/api/v1/admin/antrean/${a}`, { token: admin, body: { status: 'APPROVED' } });
  assertErr(await call('PATCH', `/api/v1/admin/antrean/${a}`, { token: admin, body: { status: 'PENDING' } }), 409, 'STATE_CONFLICT');
  const b = await mk('Kafe T05b');
  const rs = await Promise.all([1, 2].map(() => call('PATCH', `/api/v1/admin/antrean/${b}`, { token: admin, body: { status: 'APPROVED' } })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM tempat WHERE kontribusi_id=?').get(b).c, 1); // tidak ada perubahan ganda
  const c = await mk('Kafe T05c');
  for (const body of [{ status: 'REJECTED' }, { status: 'REJECTED', catatan_admin: '   ' }]) {
    const r = await call('PATCH', `/api/v1/admin/antrean/${c}`, { token: admin, body }); assertErr(r, 422, 'VALIDATION_ERROR'); assert.ok(r.json.error.fields.catatan_admin);
  }
  assert.equal(db.prepare('SELECT status FROM kontribusi WHERE id=?').get(c).status, 'PENDING');
  assertErr(await call('PATCH', `/api/v1/admin/antrean/${c}`, { token: admin, body: { status: 'APPROVED', id: 1, dikirim_pada: 'x' } }), 422, 'VALIDATION_ERROR');
  assertErr(await call('PATCH', '/api/v1/admin/antrean/999999', { token: admin, body: { status: 'APPROVED' } }), 404, 'NOT_FOUND');
});

test('T06 gangguan: JSON rusak 400, route tak dikenal 404, tanpa stack trace', async () => {
  const r = await fetch(`${base}/api/v1/kontribusi`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user}` }, body: '{rusak' });
  assertErr({ status: r.status, json: await r.json() }, 400, 'BAD_REQUEST');
  assertErr(await call('GET', '/api/v1/tidak-ada'), 404, 'NOT_FOUND');
});

test('T07 Idempotency-Key: kirim berulang = 1 record', async () => {
  const key = 'b7f1c3a2-1111-4222-8333-944455556666', h = { 'Idempotency-Key': key };
  const n0 = db.prepare('SELECT COUNT(*) c FROM kontribusi').get().c;
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Kafe T07' }), headers: h })));
  assert.ok(rs.every((r) => r.status === 201)); assert.equal(new Set(rs.map((r) => r.json.data.id)).size, 1);
  assert.ok(rs.some((r) => r.headers.get('idempotency-replayed') === 'true'));
  assert.equal(db.prepare('SELECT COUNT(*) c FROM kontribusi').get().c, n0 + 1);
  assertErr(await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: 'Data Lain' }), headers: h }), 409, 'STATE_CONFLICT');
  assertErr(await call('POST', '/api/v1/kontribusi', { token: user, body: valid(), headers: { 'Idempotency-Key': 'x' } }), 422, 'VALIDATION_ERROR');
});

test('T08 query tidak valid: 422 per parameter', async () => {
  const r = await call('GET', '/api/v1/tempat?colokan_min=150&sort=harga_tertinggi&limit=500');
  assertErr(r, 422, 'VALIDATION_ERROR'); assert.ok(r.json.error.fields.colokan_min && r.json.error.fields.sort && r.json.error.fields.limit);
  assertErr(await call('GET', "/api/v1/tempat?q=a&noise=Bising&page=0"), 422, 'VALIDATION_ERROR');
  assert.equal((await call('GET', "/api/v1/tempat?q=%27%3B%20DROP%20TABLE%20tempat%3B--")).status, 200); // injeksi diperlakukan sebagai teks
  assert.equal(db.prepare('SELECT COUNT(*) c FROM tempat').get().c > 0, true);
});

test('T09 pagination stabil (tie-breaker id), tanpa duplikat', async () => {
  const all = (await call('GET', '/api/v1/tempat?sort=colokan_min&order=desc&limit=100')).json.data.map((x) => x.id);
  const got = [];
  for (let p = 1; p <= Math.ceil(all.length / 3); p++) got.push(...(await call('GET', `/api/v1/tempat?sort=colokan_min&order=desc&limit=3&page=${p}`)).json.data.map((x) => x.id));
  assert.deepEqual(got, all); assert.equal(new Set(got).size, got.length);
  const far = await call('GET', '/api/v1/tempat?page=999&limit=5'); assert.equal(far.status, 200); assert.deepEqual(far.json.data, []);
});

test('T10 moderasi: setujui, tolak tanpa/dengan catatan, konflik', async () => {
  const mk = async (n) => (await call('POST', '/api/v1/kontribusi', { token: user, body: valid({ nama_tempat: n }) })).json.data.id;
  const a = await mk('Kafe T10a'), b = await mk('Kafe T10b');
  assert.equal((await call('PATCH', `/api/v1/admin/antrean/${a}`, { token: admin, body: { status: 'APPROVED' } })).status, 200);
  assertErr(await call('PATCH', `/api/v1/admin/antrean/${b}`, { token: admin, body: { status: 'REJECTED' } }), 422, 'VALIDATION_ERROR');
  const rj = await call('PATCH', `/api/v1/admin/antrean/${b}`, { token: admin, body: { status: 'REJECTED', catatan_admin: 'Data tidak lengkap.' } });
  assert.equal(rj.status, 200); assert.equal(rj.json.data.catatan_admin, 'Data tidak lengkap.');
  assertErr(await call('PATCH', `/api/v1/admin/antrean/${b}`, { token: admin, body: { status: 'APPROVED' } }), 409, 'STATE_CONFLICT');
  const rejected = await antrean('?status=REJECTED&limit=100'); assert.ok(rejected.json.data.some((x) => x.id === b));
  assert.equal((await call('GET', '/api/v1/tempat?q=T10b')).json.data.length, 0); // ditolak tidak tampil publik
});
