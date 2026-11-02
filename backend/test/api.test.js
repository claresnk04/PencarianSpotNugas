'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { openDb, seed } = require('../src/db');
const { createApp } = require('../src/app');

let server, base, db, admin, user;
const call = async (method, path, { token, body, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); return { status: r.status, headers: r.headers, json: text ? JSON.parse(text) : null };
};
const login = async (email, password) => (await call('POST', '/api/v1/auth/login', { body: { email, password } })).json.data.token;
const antrean = (q = '') => call('GET', `/api/v1/admin/antrean${q}`, { token: admin });
const valid = (o = {}) => ({ nama_tempat: 'Kafe Sudut Gejayan', colokan_min: 85, noise_level: 'Hening', ...o });
const assertErr = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.json.status, 'ERROR'); assert.equal(r.json.code, code); assert.ok(r.json.message); assert.ok(r.json.error && typeof r.json.error.fields === 'object'); assert.ok(!/stack|at Object|node:/.test(JSON.stringify(r.json))); };

before(async () => {
  db = openDb(':memory:'); seed(db);
  server = http.createServer(createApp({ db, jwtSecret: 'x'.repeat(40) }));
  await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
  admin = await login('admin@snij.test', 'Admin123!'); user = await login('user@snij.test', 'User123!');
});
after(() => { server.close(); db.close(); });

test('login: sukses (USER & ADMIN), salah sandi 401, field kosong 422', async () => {
  const a = await call('POST', '/api/v1/auth/login', { body: { email: 'admin@snij.test', password: 'Admin123!' } });
  assert.equal(a.status, 200); assert.equal(a.json.data.user.role, 'ADMIN'); assert.equal(a.json.data.token.split('.').length, 3);
  assertErr(await call('POST', '/api/v1/auth/login', { body: { email: 'admin@snij.test', password: 'salah' } }), 401, 'UNAUTHORIZED');
  const e = await call('POST', '/api/v1/auth/login', { body: {} }); assertErr(e, 422, 'VALIDATION_ERROR'); assert.ok(e.json.error.fields.email && e.json.error.fields.password);
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
