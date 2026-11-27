# SNIJ API — Modul CRUD ENT-04 Kontribusi (Praktikum 10, Kelompok 04)

REST API **tanpa dependensi eksternal**: hanya Node.js ≥ 22.13 (`node:http`, `node:sqlite`, `node:crypto`).
JWT HS256 dan hash password (scrypt) memakai `node:crypto`. Database: SQLite (file), transaksi atomik.

## Pengembangan lokal
```bash
cd backend
npm start
npm test
```
Salin `.env.example` menjadi `.env` bila perlu mengubah konfigurasi. Pada PowerShell: `Copy-Item .env.example .env`. Akun awal bersifat opsional dan hanya dibuat bila pasangan `SEED_*` diisi. Jangan memakai kredensial demo di produksi.

Memerlukan Node.js **22.13+**. Server API berjalan di `http://localhost:3000`; database dan foto di direktori `data/` dan `uploads/`.

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
| `POST /api/v1/auth/register` | publik | body `{nama,email,password}` → akun baru ber-role USER. Password 8–128 karakter, wajib mengandung huruf dan angka. 201 / 409 / 422 |
| `POST /api/v1/auth/login` | publik | body `{email,password}` → `data.token` (JWT, role USER/ADMIN). Gagal: 401; kosong: 422; >10 gagal/15 mnt: 429 |
| `GET /api/v1/tempat` | publik | query: `q`(2–60), `colokan_min`(0–100), `noise`(Hening,Sedang,Ramai; boleh koma), `wifi`(true/false), `fasilitas`(pilihan koma-terpisah), `sort`(diperbarui_pada,colokan_min,nama_tempat), `order`, `page`, `limit`(1–100, default 20). Filter fasilitas bersifat AND. Tidak ada hasil → **200 `data: []`**; parameter salah → **422** |
| `GET /api/v1/tempat/:id` | publik | 200 / 404 |
| `GET /api/v1/tempat/:id/ulasan` | publik | Daftar ulasan bertanggal, ringkasan rating rata-rata/jumlah; mendukung `page` dan `limit` |
| `GET /api/v1/tempat/:id/ulasan/saya` | token (USER/ADMIN) | Mengambil ulasan milik pengguna untuk tempat tersebut; belum ada ulasan → `data: null` |
| `PUT /api/v1/tempat/:id/ulasan` | token (USER/ADMIN) | Body `{rating, komentar}`; rating bilangan bulat 1–5, komentar wajib maksimal 1000 karakter. Satu ulasan per pengguna per tempat; request berikutnya memperbarui ulasan yang sama. Langsung tampil publik. 200 / 401 / 404 / 422 |
| `POST /api/v1/upload/speedtest` | token (USER/ADMIN) | JSON `{mime_type,data}` dengan `data` base64. JPEG/PNG/WebP, maksimal 3 MiB. Mengembalikan path `foto_speedtest` untuk disertakan pada kontribusi. 201 / 401 / 422 / 413 |
| `GET /api/v1/uploads/speedtest/:id.:ext` | publik | Mengambil foto speedtest tersimpan; hanya id acak dan ekstensi JPG/PNG/WebP yang diterima. 200 / 404 |
| `POST /api/v1/kontribusi` | token (USER/ADMIN) | `nama_tempat` wajib; `colokan_min` 0–100 (alias `persen_colokan`); opsional `noise_level`, `fasilitas_inklusif` (array pilihan), `wifi` (boolean), `fasilitas_lainnya` (array pilihan), `foto_speedtest` (path hasil upload), `alamat`, `lat`+`lng`. Header `Idempotency-Key` (8–128 karakter, disarankan UUID). Status dipaksa `PENDING`; `id/status/dikirim_pada/catatan_admin` dari klien diabaikan. 201 / 401 / 422 / 409 |
| `GET /api/v1/kontribusi/saya` | token (USER/ADMIN) | Daftar status kontribusi milik user yang sedang login. Mendukung `status`, `page`, dan `limit`. |

Nilai `fasilitas_inklusif` yang didukung: `Akses kursi roda`, `Toilet aksesibel`, `Parkir disabilitas`, `Jalur pemandu`, `Ruang laktasi`, `Ruang ibadah`, dan `Area ramah anak`.
Nilai `fasilitas_lainnya`: `AC`, `Toilet`, `Parkir`, `Mushola`, `Area outdoor`, dan `Ruang non-smoking`. Skema lama dimigrasikan ringan saat server mulai.
| `GET /api/v1/admin/antrean` | ADMIN | `status` (default PENDING), `q`, `order`, `page`, `limit`. 401 / 403 / 422 |
| `PATCH /api/v1/admin/antrean/:id` | ADMIN | body `{status, catatan_admin}` saja. `REJECTED` wajib catatan → 422. Hanya `PENDING → APPROVED/REJECTED/REVISION_NEEDED`; selain itu (mis. APPROVED→PENDING, atau sudah diubah admin lain) → **409 STATE_CONFLICT**. Saat APPROVED, tempat masuk ke `GET /tempat` (BR-01) |

Urutan pemeriksaan: 401 → 403 → validasi body (422) → 404 → transisi status (409). Auth diperiksa sebelum body dibaca.

## Cara kerja yang perlu diketahui
- **Atomik & anti-balapan:** PATCH berjalan di `BEGIN IMMEDIATE`; baca status + `UPDATE … WHERE status='PENDING'` + insert ke `tempat` dalam satu transaksi. Dua admin bersamaan → satu 200, satu 409 (diuji).
- **Idempotency:** kunci berlaku per user. Kunci sama + data sama → record yang sama (header `Idempotency-Replayed: true`, tidak ada record baru). Kunci sama + data beda → 409. Request yang gagal validasi tidak memakai kunci.
- **Role** dibaca dari database pada tiap request, bukan dari klaim token.
- **SQL injection:** semua query berparameter; `sort` memakai whitelist.
- Ulasan hanya terhubung ke tempat yang sudah ada di katalog publik, sehingga menulis ulasan tidak membuat tempat baru. Keunikan `(tempat_id,user_id)` dan upsert transaksional menjaga satu ulasan per pengguna/kafe.
- Foto diperiksa berdasarkan tipe MIME dan signature file, dibatasi 3 MiB, diberi nama UUID, dan disimpan di `UPLOAD_DIR` (default `backend/uploads`). Simpan direktori ini bersama `DB_FILE` saat backup dan gunakan storage persisten.

## Konfigurasi produksi

Set `NODE_ENV=production`, `JWT_SECRET` acak minimal 32 karakter, `CORS_ORIGIN` ke origin frontend yang tepat (bukan `*`), `DB_FILE` ke lokasi database persisten, dan `UPLOAD_DIR` ke lokasi file persisten. Atur juga `PORT` dan `JWT_TTL_SECONDS` sesuai kebutuhan. Server akan menolak secret yang lemah, CORS wildcard/kosong, port tidak valid, serta masa token di bawah 60 detik. Jangan masukkan `.env` atau kredensial seed ke Git.

Contoh PowerShell sebelum menjalankan API:
```powershell
$env:NODE_ENV = "production"
$env:JWT_SECRET = "<secret-acak-minimal-32-karakter>"
$env:CORS_ORIGIN = "https://snij.example.com"
$env:DB_FILE = "D:\snij-data\snij.db"
$env:UPLOAD_DIR = "D:\snij-data\uploads"
npm start
```

Jalankan di belakang reverse proxy HTTPS dan arahkan `/api` ke API; sajikan build frontend secara terpisah dengan `VITE_API_BASE` menunjuk ke URL HTTPS API. Pastikan reverse proxy mengizinkan request upload hingga setidaknya 4.1 MiB (payload JSON base64 untuk gambar 3 MiB). Login rate limit saat ini in-memory per proses; gunakan gateway/proxy dengan rate limiting untuk deployment multi-instance.

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

## Batasan
- Tidak ada DELETE (tidak diminta di spesifikasi ini) maupun refresh token. Logout dilakukan dengan menghapus token di sisi frontend.
