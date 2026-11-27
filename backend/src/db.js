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
    colokan_min INTEGER CHECK(colokan_min BETWEEN 0 AND 100), noise_level TEXT CHECK(noise_level IN ('Hening','Sedang','Ramai')), fasilitas_inklusif TEXT,
    wifi INTEGER CHECK(wifi IN (0,1)), fasilitas_lainnya TEXT, foto_speedtest TEXT,
    kontribusi_id INTEGER, diperbarui_pada TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kontribusi(
    id INTEGER PRIMARY KEY, nama_tempat TEXT NOT NULL, alamat TEXT, lat REAL, lng REAL,
    colokan_min INTEGER CHECK(colokan_min BETWEEN 0 AND 100), noise_level TEXT CHECK(noise_level IN ('Hening','Sedang','Ramai')), fasilitas_inklusif TEXT,
    wifi INTEGER CHECK(wifi IN (0,1)), fasilitas_lainnya TEXT, foto_speedtest TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','REVISION_NEEDED')),
    catatan_admin TEXT, user_id INTEGER NOT NULL REFERENCES users(id),
    dikirim_pada TEXT NOT NULL, diproses_oleh INTEGER REFERENCES users(id), diproses_pada TEXT, deleted_at TEXT);
  CREATE INDEX IF NOT EXISTS ix_kontribusi_status ON kontribusi(status, dikirim_pada, id);
  CREATE TABLE IF NOT EXISTS idempotency(
    key TEXT NOT NULL, user_id INTEGER NOT NULL, fingerprint TEXT NOT NULL,
    kontribusi_id INTEGER NOT NULL REFERENCES kontribusi(id), created_at TEXT NOT NULL, PRIMARY KEY(key, user_id));
  CREATE TABLE IF NOT EXISTS ulasan(
    id INTEGER PRIMARY KEY, tempat_id INTEGER NOT NULL REFERENCES tempat(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), komentar TEXT NOT NULL,
    dibuat_pada TEXT NOT NULL, diperbarui_pada TEXT NOT NULL,
    UNIQUE(tempat_id, user_id));
  CREATE INDEX IF NOT EXISTS ix_ulasan_tempat ON ulasan(tempat_id, diperbarui_pada DESC, id DESC);`);
  // Migrasi ringan untuk database lama yang dibuat sebelum field fasilitas tersedia.
  const additions = {
    tempat: ['fasilitas_inklusif TEXT', 'wifi INTEGER CHECK(wifi IN (0,1))', 'fasilitas_lainnya TEXT', 'foto_speedtest TEXT'],
    kontribusi: ['fasilitas_inklusif TEXT', 'wifi INTEGER CHECK(wifi IN (0,1))', 'fasilitas_lainnya TEXT', 'foto_speedtest TEXT'],
  };
  for (const [table, definitions] of Object.entries(additions)) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    for (const definition of definitions) {
      const name = definition.split(' ')[0];
      if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
  }
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
    if (o.adminEmail && o.adminPassword) ins.run(o.adminEmail.toLowerCase(), 'Admin SNIJ', hashPassword(o.adminPassword), 'ADMIN');
    if (o.userEmail && o.userPassword) ins.run(o.userEmail.toLowerCase(), 'Pengguna', hashPassword(o.userPassword), 'USER');
  }
  if (o.demoTempat === true && db.prepare('SELECT COUNT(*) c FROM tempat').get().c === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare('INSERT INTO tempat(nama_tempat,alamat,lat,lng,colokan_min,noise_level,fasilitas_inklusif,wifi,fasilitas_lainnya,diperbarui_pada) VALUES(?,?,?,?,?,?,?,?,?,?)');
    [
      ['Kopi Nako Seturan', 'Jl. Seturan Raya No.15, Depok, Sleman', -7.7694, 110.392, 85, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Filosofi Kopi Jogja', 'Jl. Wahid Hasyim No.4, Gondokusuman, Kota Yogyakarta', -7.7891, 110.3709, 60, 'Sedang', null, 1, '["AC","Toilet","Parkir"]'],
      ['Kopinus UNY', 'Jl. Colombo No.1, Karangmalang, Depok, Sleman', -7.7722, 110.3867, 50, 'Sedang', '["Akses kursi roda","Ruang ibadah"]', 1, '["Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Nongkrong Coffee & Space', 'Jl. Babarsari No.6, Depok, Sleman', -7.7759, 110.4043, 95, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Area outdoor","Ruang non-smoking"]'],
      ['Warung Kopi Jos 24 Jam', 'Jl. Pasar Kembang No.7, Gedongtengen, Kota Yogyakarta', -7.7951, 110.3641, 30, 'Ramai', null, 1, '["Toilet","Parkir"]'],
      ['Kedai Pintar Condongcatur', 'Jl. Anggajaya II No.3, Condongcatur, Depok, Sleman', -7.7489, 110.3981, 78, 'Hening', '["Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Perpustakaan Kota Yogyakarta', 'Jl. Suroto No.9, Kotabaru, Gondokusuman, Kota Yogyakarta', -7.7811, 110.3766, 40, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Doppio Coffee Kaliurang', 'Jl. Kaliurang KM 5.5, Sleman', -7.751, 110.3869, 70, 'Sedang', null, 1, '["AC","Toilet","Parkir"]'],
      ['Study Room FT UNY', 'Gedung Dekanat FT UNY, Karangmalang, Depok, Sleman', -7.7728, 110.3852, 90, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Satu Ruang Co-working', 'Jl. Perumnas Condongcatur Blok B No.12, Depok, Sleman', -7.7466, 110.4012, 100, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Taman Pintar Learning Center', 'Jl. Panembahan Senopati No.1-3, Prawirodirjan, Gondomanan', -7.8002, 110.3645, 35, 'Sedang', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Kafe Buku Sleman', 'Jl. Palagan Tentara Pelajar No.22, Sleman', -7.7358, 110.37, 65, 'Hening', null, 1, '["AC","Toilet","Parkir","Area outdoor","Ruang non-smoking"]'],
      ['Ruang Bersama Kotabaru', 'Jl. Diponegoro No.48, Kotabaru, Gondokusuman', -7.7843, 110.3755, 88, 'Hening', '["Akses kursi roda","Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Ruang non-smoking"]'],
      ['Angkringan WiFi Gedongkiwo', 'Jl. Gedongkiwo, Mantrijeron, Kota Yogyakarta', -7.8105, 110.3665, 20, 'Ramai', null, 1, '["Toilet","Parkir"]'],
      ['Laboratorium Terbuka UKDW', 'Jl. Dr. Wahidin Sudirohusodo No.5-25, Gondokusuman', -7.7858, 110.372, 80, 'Hening', '["Akses kursi roda"]', 1, '["AC","Toilet","Parkir","Ruang non-smoking"]'],
      ['Brew + Code Babarsari', 'Jl. Babarsari No.20, Caturtunggal, Depok, Sleman', -7.7741, 110.406, 92, 'Hening', '["Ruang ibadah"]', 1, '["AC","Toilet","Parkir","Mushola","Area outdoor","Ruang non-smoking"]'],
      ['Pantai Timur Food Court', 'Jl. Ring Road Utara, Ngaglik, Sleman', -7.7387, 110.395, 25, 'Ramai', '["Akses kursi roda","Ruang ibadah"]', 1, '["Toilet","Parkir","Mushola"]'],
      ['Kebon Klengkeng Cafe', 'Jl. Kledokan, Caturtunggal, Depok, Sleman', -7.7709, 110.3997, 72, 'Sedang', null, 1, '["Toilet","Parkir","Area outdoor","Ruang non-smoking"]']
    ].forEach((r) => ins.run(...r, now));
  }
}
module.exports = { openDb, tx, seed };
