'use strict';
const http = require('node:http'), crypto = require('node:crypto');
const { openDb, seed } = require('./src/db');
const { createApp } = require('./src/app');
const env = process.env;
let jwtSecret = env.JWT_SECRET;
if (!jwtSecret) { jwtSecret = crypto.randomBytes(32).toString('hex'); console.warn('[WARN] JWT_SECRET kosong: memakai secret acak (token tidak valid setelah restart). Set JWT_SECRET di produksi.'); }
else if (jwtSecret.length < 32) { console.error('JWT_SECRET minimal 32 karakter.'); process.exit(1); }
const db = openDb(env.DB_FILE || './data/snij.db');
seed(db, { adminEmail: env.SEED_ADMIN_EMAIL, adminPassword: env.SEED_ADMIN_PASSWORD, userEmail: env.SEED_USER_EMAIL, userPassword: env.SEED_USER_PASSWORD, demoTempat: env.SEED_DEMO_TEMPAT !== 'false' });
const server = http.createServer(createApp({ db, jwtSecret, jwtTtl: +env.JWT_TTL_SECONDS || 28800, corsOrigin: env.CORS_ORIGIN || '*', log: true }));
const port = +env.PORT || 3000;
server.listen(port, () => console.log(`SNIJ API berjalan di http://localhost:${port}`));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => server.close(() => { db.close(); process.exit(0); }));
