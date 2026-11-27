# SNIJ React Frontend

Frontend baru untuk Spot Nugas Inklusif Jogja menggunakan React, Vite, dan TypeScript.

## Menjalankan

```bash
npm install
npm run dev
```

Backend API harus berjalan di `http://localhost:3000`. Jika URL berbeda, salin `.env.example` menjadi `.env` lalu ubah `VITE_API_BASE`.

## Fitur yang sudah terhubung

- Jelajah publik tanpa login
- Pencarian, filter colokan, dan suasana
- Peta Leaflet/OpenStreetMap
- Detail tempat dan state loading/empty/error
- Login JWT
- Kontribusi tempat dengan Idempotency-Key
- Feedback status kontribusi
- Dashboard moderasi admin dengan approve, revisi, reject, dan catatan

Folder ini adalah frontend utama SNIJ. Backend API berada di folder `../backend`.
