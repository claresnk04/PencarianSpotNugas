# SNIJ — Spot Nugas Inklusif Jogja

Platform pencarian tempat belajar/nugas di Yogyakarta dengan fitur filter inklusif, berbasis kontribusi komunitas.

---

## 🗂️ Struktur Proyek

```
SpotNugas/
├── backend/      Node.js REST API (SQLite, JWT auth, RBAC)
└── frontend/     React + TypeScript + Vite (Leaflet map)
```

---

## ⚙️ Prasyarat

| Tools    | Versi minimal |
|----------|--------------|
| Node.js  | 22.13        |
| npm      | 10+          |

---

## 🚀 Menjalankan di Development

### 1. Backend

```powershell
cd backend
npm install
npm start
# → API berjalan di http://localhost:3000
```

**Environment variables (opsional):**

Salin `backend/.env.example` → `backend/.env` lalu sesuaikan nilainya. Tanpa `.env`, backend akan menggunakan nilai default (JWT secret acak, port 3000, SQLite di `./data/snij.db`).

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Frontend sudah dikonfigurasi untuk proxy `/api/*` ke `localhost:3000` via Vite.

---

## 🏗️ Build Production

### Backend

```powershell
cd backend
# Set environment variables di OS / server:
# JWT_SECRET, CORS_ORIGIN, PORT, DB_FILE, dll.
npm start
```

### Frontend

```powershell
cd frontend
# Buat .env.local dengan nilai production:
# VITE_API_BASE=https://api.snij.example.com/api/v1
npm run build
# Output di frontend/dist — deploy ke static hosting (Nginx, Vercel, dll.)
```

---

## 🌐 Endpoint API Utama

| Method | Path                           | Auth    | Deskripsi                    |
|--------|--------------------------------|---------|------------------------------|
| POST   | `/api/v1/auth/register`        | –       | Daftar akun                  |
| POST   | `/api/v1/auth/login`           | –       | Login, dapat JWT             |
| GET    | `/api/v1/tempat`               | –       | Daftar tempat (dengan filter)|
| GET    | `/api/v1/tempat/:id`           | –       | Detail satu tempat           |
| GET    | `/api/v1/tempat/:id/ulasan`    | –       | Daftar ulasan dan rating      |
| PUT    | `/api/v1/tempat/:id/ulasan`    | User    | Tulis/perbarui ulasan kafe    |
| POST   | `/api/v1/upload/speedtest`     | User    | Upload foto speedtest        |
| POST   | `/api/v1/kontribusi`           | User    | Kirim kontribusi tempat baru |
| GET    | `/api/v1/kontribusi/saya`      | User    | Status kontribusi saya       |
| GET    | `/api/v1/admin/antrean`        | Admin   | Antrean moderasi             |
| PATCH  | `/api/v1/admin/antrean/:id`    | Admin   | Setujui/tolak kontribusi     |

### Filter `GET /api/v1/tempat`

| Param        | Contoh          | Keterangan                       |
|--------------|-----------------|----------------------------------|
| `q`          | `kopi`          | Cari nama/alamat (min 2 karakter)|
| `colokan_min`| `50`            | Minimum % colokan                |
| `noise`      | `Hening`        | Filter suasana                   |
| `wifi`       | `true`          | Hanya yang ada WiFi              |
| `fasilitas`  | `AC,Toilet`     | Filter fasilitas (comma-separated)|
| `sort`       | `colokan_min`   | Urutan hasil                     |
| `order`      | `desc`          | asc / desc                       |

---

## 🔐 Akun Default (Seed)

Akun seed hanya dibuat saat database pertama kali diinisialisasi. Set via environment variable:

```env
SEED_ADMIN_EMAIL=admin@snij.id
SEED_ADMIN_PASSWORD=Admin1234
SEED_DEMO_TEMPAT=true
```

---

## 🧪 Menjalankan Test Backend

```powershell
cd backend
npm test
```

---

## 📦 Stack

- **Backend**: Node.js (built-in `http`), better-sqlite3, JWT (HS256)  
- **Frontend**: React 19, TypeScript, Vite 8, React-Leaflet, Lucide React  
- **Database**: SQLite (file-based, zero-config)
