# SNIJ React Frontend

Frontend baru untuk Spot Nugas Inklusif Jogja menggunakan React, Vite, dan TypeScript.

## Menjalankan

```bash
npm install
npm run dev
```

Backend API harus berjalan di `http://localhost:3000`. Jika URL berbeda, salin `.env.example` menjadi `.env` lalu ubah `VITE_API_BASE`.

Untuk build produksi, set `VITE_API_BASE` ke URL API publik ber-HTTPS sebelum menjalankan `npm run build`. Variabel ini ditanam saat build; mengubah environment pada server web setelah build tidak akan mengubah URL API. Sajikan hasil `dist/` melalui web server statis dan konfigurasi backend `CORS_ORIGIN` sama persis dengan origin frontend. Jangan menyimpan secret server di environment frontend.

## Fitur yang sudah terhubung

- Jelajah publik tanpa login
- Pencarian, filter colokan, suasana, WiFi, dan fasilitas lainnya
- Peta Leaflet/OpenStreetMap
- Detail tempat dan state loading/empty/error
- Login JWT
- Kontribusi tempat dengan Idempotency-Key
- Fasilitas inklusif multi-pilihan pada kontribusi dan detail tempat
- Upload foto speedtest JPEG/PNG/WebP (maks. 3 MiB) ke backend, dengan pratinjau dan tinjauan admin
- Status kontribusi dari server
- Dashboard moderasi admin dengan approve, revisi, reject, dan catatan

Folder ini adalah frontend utama SNIJ. Backend API berada di folder `../backend`.
