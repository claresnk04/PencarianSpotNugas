'use strict';
const http = require('node:http'), crypto = require('node:crypto');
const { openDb, seed } = require('./src/db');
const { createApp } = require('./src/app');
const env = process.env;
const production = env.NODE_ENV === 'production';
let jwtSecret = env.JWT_SECRET;
if (!jwtSecret && production) { console.error('JWT_SECRET wajib diisi saat NODE_ENV=production.'); process.exit(1); }
if (!jwtSecret) { jwtSecret = crypto.randomBytes(32).toString('hex'); console.warn('[WARN] JWT_SECRET kosong: memakai secret acak (token tidak valid setelah restart).'); }
else if (jwtSecret.length < 32) { console.error('JWT_SECRET minimal 32 karakter.'); process.exit(1); }
const corsOrigin = env.CORS_ORIGIN || (production ? '' : '*');
if (production && (!corsOrigin || corsOrigin === '*')) { console.error('CORS_ORIGIN wajib berupa origin frontend yang spesifik saat NODE_ENV=production.'); process.exit(1); }
const port = Number(env.PORT || 3000);
const jwtTtl = Number(env.JWT_TTL_SECONDS || 28800);
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT harus bilangan bulat 1–65535.'); process.exit(1); }
if (!Number.isInteger(jwtTtl) || jwtTtl < 60) { console.error('JWT_TTL_SECONDS harus bilangan bulat minimal 60.'); process.exit(1); }
const db = openDb(env.DB_FILE || './data/snij.db');
seed(db, { adminEmail: env.SEED_ADMIN_EMAIL, adminPassword: env.SEED_ADMIN_PASSWORD, userEmail: env.SEED_USER_EMAIL, userPassword: env.SEED_USER_PASSWORD, demoTempat: env.SEED_DEMO_TEMPAT === 'true' });
const uploadDir = env.UPLOAD_DIR || './uploads';
const server = http.createServer(createApp({ db, jwtSecret, jwtTtl, corsOrigin, uploadDir, log: true }));
server.listen(port, () => console.log(`SNIJ API berjalan di http://localhost:${port}`));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => server.close(() => { db.close(); process.exit(0); }));
