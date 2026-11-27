'use strict';
const path = require('node:path');
const { openDb, seed } = require('../backend/src/db');
const { createApp } = require('../backend/src/app');
const { JOGJA_SPOTS } = require('../backend/seed-jogja');

const dbFile = process.env.DB_FILE || '/tmp/snij.db';
const uploadDir = process.env.UPLOAD_DIR || '/tmp/snij-uploads';
const jwtSecret = process.env.JWT_SECRET || 'snij-vercel-default-secret-key-2026-32chars';

let handler;

function getHandler() {
  if (handler) return handler;
  const db = openDb(dbFile);
  seed(db, {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@snij.id',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'AdminSnij2026!',
    userEmail: process.env.SEED_USER_EMAIL || 'user@snij.id',
    userPassword: process.env.SEED_USER_PASSWORD || 'UserSnij2026!',
    demoTempat: false,
  });

  if (db.prepare('SELECT COUNT(*) c FROM tempat').get().c === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare(
      'INSERT INTO tempat(nama_tempat,alamat,lat,lng,colokan_min,noise_level,fasilitas_inklusif,wifi,fasilitas_lainnya,diperbarui_pada) VALUES(?,?,?,?,?,?,?,?,?,?)',
    );
    for (const row of JOGJA_SPOTS) ins.run(...row, now);
  }

  handler = createApp({
    db,
    jwtSecret,
    jwtTtl: +process.env.JWT_TTL_SECONDS || 28800,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    uploadDir: path.resolve(uploadDir),
    log: false,
  });
  return handler;
}

module.exports = async function vercelHandler(req, res) {
  return getHandler()(req, res);
};
