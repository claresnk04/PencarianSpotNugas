'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs'), path = require('node:path');
const { hashPassword } = require('./auth');

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, nama TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('USER','ADMIN')));
  CREATE TABLE IF NOT EXISTS tempat(
    id INTEGER PRIMARY KEY, nama_tempat TEXT NOT NULL, alamat TEXT, lat REAL, lng REAL,
    colokan_min INTEGER CHECK(colokan_min BETWEEN 0 AND 100), noise_level TEXT CHECK(noise_level IN ('Hening','Sedang','Ramai')),
    kontribusi_id INTEGER, diperbarui_pada TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kontribusi(
    id INTEGER PRIMARY KEY, nama_tempat TEXT NOT NULL, alamat TEXT, lat REAL, lng REAL,
    colokan_min INTEGER CHECK(colokan_min BETWEEN 0 AND 100), noise_level TEXT CHECK(noise_level IN ('Hening','Sedang','Ramai')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','REVISION_NEEDED')),
    catatan_admin TEXT, user_id INTEGER NOT NULL REFERENCES users(id),
    dikirim_pada TEXT NOT NULL, diproses_oleh INTEGER REFERENCES users(id), diproses_pada TEXT, deleted_at TEXT);
  CREATE INDEX IF NOT EXISTS ix_kontribusi_status ON kontribusi(status, dikirim_pada, id);
  CREATE TABLE IF NOT EXISTS idempotency(
    key TEXT NOT NULL, user_id INTEGER NOT NULL, fingerprint TEXT NOT NULL,
    kontribusi_id INTEGER NOT NULL REFERENCES kontribusi(id), created_at TEXT NOT NULL, PRIMARY KEY(key, user_id));`);
  return db;
}
/** Transaksi atomik; BEGIN IMMEDIATE mengunci tulis sehingga cek-status + update tidak bisa disela request lain. */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function seed(db, o = {}) {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
    const ins = db.prepare('INSERT INTO users(email,nama,password_hash,role) VALUES(?,?,?,?)');
    ins.run((o.adminEmail || 'admin@snij.test').toLowerCase(), 'Admin SNIJ', hashPassword(o.adminPassword || 'Admin123!'), 'ADMIN');
    ins.run((o.userEmail || 'user@snij.test').toLowerCase(), 'Pengguna Demo', hashPassword(o.userPassword || 'User123!'), 'USER');
  }
  if (o.demoTempat !== false && db.prepare('SELECT COUNT(*) c FROM tempat').get().c === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare('INSERT INTO tempat(nama_tempat,alamat,lat,lng,colokan_min,noise_level,diperbarui_pada) VALUES(?,?,?,?,?,?,?)');
    [['Kafe Demo Gejayan', 'Jl. Contoh No. 1', -7.775, 110.39, 90, 'Hening'], ['Perpustakaan Demo Kampus', 'Jl. Contoh No. 2', -7.77, 110.38, 70, 'Hening'],
     ['Kopi Demo Sudut', 'Jl. Contoh No. 3', -7.78, 110.4, 70, 'Sedang'], ['Co-working Demo', 'Jl. Contoh No. 4', -7.76, 110.37, 100, 'Sedang'],
     ['Warung Demo Nugas', 'Jl. Contoh No. 5', -7.79, 110.41, 40, 'Ramai'], ['Kafe Demo Cafe Mlati', 'Jl. Contoh No. 6', -7.74, 110.35, 70, 'Hening'],
     ['Taman Baca Demo', 'Jl. Contoh No. 7', -7.77, 110.36, 70, 'Hening'], ['Cafe Demo Seturan', 'Jl. Contoh No. 8', -7.76, 110.42, 70, 'Hening']
    ].forEach((r) => ins.run(...r, now));
  }
}
module.exports = { openDb, tx, seed };
