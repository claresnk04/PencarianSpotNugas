# SNIJ API — Modul CRUD ENT-04 Kontribusi (Praktikum 10, Kelompok 04)

REST API **tanpa dependensi eksternal**: hanya Node.js ≥ 22.13 (`node:http`, `node:sqlite`, `node:crypto`).
JWT HS256 dan hash password (scrypt) memakai `node:crypto`. Database: SQLite (file), transaksi atomik.

## Menjalankan
```bash
cp .env.example .env                  # isi JWT_SECRET (>= 32 karakter)
export $(grep -v '^#' .env | xargs)   # atau set variabel lingkungan dengan cara lain
npm start                             # http://localhost:3000
npm test                              # 11 test otomatis (T01–T10 + login)
```
Akun awal (dibuat sekali bila tabel kosong): `admin@snij.test / Admin123!` (ADMIN), `user@snij.test / User123!` (USER). **Ganti di produksi** lewat `SEED_*`.

## Format respons
Sukses: `{"status":"SUCCESS","message":"...","data":...,"meta":{page,limit,total,total_pages}}`
Error (selalu bentuk yang sama):
```json
{"status":"ERROR","code":"VALIDATION_ERROR","message":"...","error":{"fields":{"nama_field":"Pesan rinci"}}}
```
Kode: `VALIDATION_ERROR` 422 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `STATE_CONFLICT` 409 · tambahan: `NOT_FOUND` 404, `BAD_REQUEST` 400/413/415, `METHOD_NOT_ALLOWED` 405, `TOO_MANY_REQUESTS` 429, `INTERNAL_ERROR` 500 (tanpa stack trace; detail hanya di log server).

## Endpoint
| Method + Route | Akses | Keterangan |
|---|---|---|
| `POST /api/v1/auth/login` | publik | body `{email,password}` → `data.token` (JWT, role USER/ADMIN). Gagal: 401; kosong: 422; >10 gagal/15 mnt: 429 |
| `GET /api/v1/tempat` | publik | query: `q`(2–60), `colokan_min`(0–100), `noise`(Hening,Sedang,Ramai; boleh koma), `sort`(diperbarui_pada,colokan_min,nama_tempat), `order`, `page`, `limit`(1–100, default 20). Tidak ada hasil → **200 `data: []`**; parameter salah → **422** |
| `GET /api/v1/tempat/:id` | publik | 200 / 404 |
| `POST /api/v1/kontribusi` | token (USER/ADMIN) | `nama_tempat` wajib; `colokan_min` 0–100 (alias `persen_colokan`); opsional `noise_level`, `alamat`, `lat`+`lng`. Header `Idempotency-Key` (8–128 karakter, disarankan UUID). Status dipaksa `PENDING`; `id/status/dikirim_pada/catatan_admin` dari klien diabaikan. 201 / 401 / 422 / 409 |
| `GET /api/v1/admin/antrean` | ADMIN | `status` (default PENDING), `q`, `order`, `page`, `limit`. 401 / 403 / 422 |
| `PATCH /api/v1/admin/antrean/:id` | ADMIN | body `{status, catatan_admin}` saja. `REJECTED` wajib catatan → 422. Hanya `PENDING → APPROVED/REJECTED/REVISION_NEEDED`; selain itu (mis. APPROVED→PENDING, atau sudah diubah admin lain) → **409 STATE_CONFLICT**. Saat APPROVED, tempat masuk ke `GET /tempat` (BR-01) |

Urutan pemeriksaan: 401 → 403 → validasi body (422) → 404 → transisi status (409). Auth diperiksa sebelum body dibaca.

## Cara kerja yang perlu diketahui
- **Atomik & anti-balapan:** PATCH berjalan di `BEGIN IMMEDIATE`; baca status + `UPDATE … WHERE status='PENDING'` + insert ke `tempat` dalam satu transaksi. Dua admin bersamaan → satu 200, satu 409 (diuji).
- **Idempotency:** kunci berlaku per user. Kunci sama + data sama → record yang sama (header `Idempotency-Replayed: true`, tidak ada record baru). Kunci sama + data beda → 409. Request yang gagal validasi tidak memakai kunci.
- **Role** dibaca dari database pada tiap request, bukan dari klaim token.
- **SQL injection:** semua query berparameter; `sort` memakai whitelist.

## Pemetaan pengujian
| ID | Dibuktikan oleh |
|---|---|
| T01 | POST 201 PENDING → antrean → PATCH 200 → tampil di `/tempat` |
| T02 | 422 + `error.fields`, jumlah record tidak bertambah |
| T03 | 200 `[]` |
| T04 | 401 tanpa/invalid token, 403 role USER, data tetap |
| T05 | 409 APPROVED→PENDING, 2 PATCH serentak (200+409), 422 REJECTED tanpa catatan |
| T06 | Sisi server: JSON rusak 400, 404, tanpa stack trace. Skenario offline/Coba Lagi diuji di UI (DevTools) |
| T07 | 5 POST serentak dengan key sama → 1 record |
| T08 | 422 untuk `colokan_min=150&sort=…&limit=500` |
| T09 | Urutan stabil antar halaman (tie-breaker id) |
| T10 | Setujui, tolak tanpa/dengan catatan, konflik |

Untuk bukti laporan, jalankan skenario yang sama lewat Postman/Network tab dan ambil screenshot; hasil `npm test` bukan pengganti bukti tersebut.

## Batasan yang disengaja
- **Upload foto speedtest (multipart) belum ada** → request multipart dijawab 415. Body: JSON atau `x-www-form-urlencoded`.
- Tidak ada DELETE (tidak diminta di spesifikasi ini), refresh token, maupun logout.
- Rate limit login hanya in-memory (per proses). Untuk produksi pasang HTTPS/reverse proxy di depan server ini.
