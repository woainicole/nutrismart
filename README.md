# NutriSmart 🍽️

Sistem Manajemen Diet, Menu Pasien & Logistik Bahan Dapur Rumah Sakit.

Proyek tugas kuliah Semester 7.

🌐 **Live Demo (Vercel)**: [https://nutrismart-gamma.vercel.app](https://nutrismart-gamma.vercel.app)  
📦 **GitHub Repository**: [https://github.com/woainicole/nutrismart](https://github.com/woainicole/nutrismart)

> 📖 **Panduan Lengkap Demo & Penggunaan**: Lihat file [`PANDUAN_DEMO_DAN_PENGGUNAAN.md`](./PANDUAN_DEMO_DAN_PENGGUNAAN.md) untuk detail alur operasional tiap role, skenario demo langkah demi langkah, dan katalog data dummy.

---

## Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + RPC) |
| Grafik | Chart.js + react-chartjs-2 |
| Ikon | Lucide React |

---

## Cara Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd NUTRISMART
npm install
```

### 2. Siapkan Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** dan jalankan file SQL **berurutan**:
   ```
   database/01_schema.sql   → tabel & constraint
   database/02_functions.sql → function, trigger, RPC
   database/03_views.sql     → view untuk dashboard & laporan
   database/04_rls.sql       → row level security
   database/05_seed.sql      → data dummy
   ```
3. **Matikan public signup** di Authentication → Settings → Auth Providers → Email → Disable "Enable Sign Up"

### 3. Buat Akun Demo

Buka Supabase Dashboard → **Authentication → Users → Add User**, buat 5 akun:

| Email | Password | user_metadata |
|-------|----------|---------------|
| `admin@nutrismart.id` | `admin123` | `{"nama": "Admin RS", "role": "admin"}` |
| `gizi@nutrismart.id` | `gizi1234` | `{"nama": "Dr. Siti Ahli Gizi", "role": "ahli_gizi"}` |
| `koki@nutrismart.id` | `koki1234` | `{"nama": "Chef Budi", "role": "koki"}` |
| `perawat@nutrismart.id` | `perawat1` | `{"nama": "Suster Ani", "role": "perawat"}` |
| `gudang@nutrismart.id` | `gudang12` | `{"nama": "Pak Joko Gudang", "role": "gudang"}` |

> **Penting:** Isi kolom `user_metadata` di form "Add User" agar trigger `handle_new_user` otomatis membuat profil dengan role yang benar.

### 4. Konfigurasi Environment

Salin `.env.example` → `.env.local` dan isi:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Ambil kedua nilai dari Supabase → Settings → API.

### 5. Jalankan

```bash
npm run dev
```

Buka `http://localhost:5173` di browser.

---

## Fitur Utama

- **Dashboard** — statistik pasien, kebutuhan diet, alert stok & kedaluwarsa
- **Master Data** — CRUD bangsal, jenis diet, pasien, bahan & supplier, menu & resep
- **Stok** — ringkasan stok, batch FEFO, barang masuk
- **Menu Harian** — atur menu per diet × waktu makan
- **Pesanan Makan** — generate otomatis, siapkan (potong stok FEFO), ubah status
- **Pengajuan Diet** — perawat ajukan, ahli gizi setujui/tolak
- **Pengembalian** — catat sisa makanan per pesanan
- **Laporan** — distribusi makanan, food waste, pemakaian bahan (CSV + cetak)
- **Grafik** — tren food waste, distribusi diet, konsumsi bahan
- **Pengaturan** — kelola user & konfigurasi cut-off
- **Profil** — ubah nama & ganti password

---

## Role & Akses

| Role | Akses |
|------|-------|
| Admin | Semua halaman |
| Ahli Gizi | Dashboard, pasien, diet, menu, bahan (lihat), stok (lihat), menu harian, pesanan, pengajuan diet, pengembalian, laporan, grafik |
| Koki | Dashboard, diet (lihat), menu, bahan, stok, menu harian (lihat), pesanan, pengembalian, laporan, grafik |
| Perawat | Dashboard, pasien (lihat), diet (lihat), pesanan (lihat), pengajuan diet, pengembalian |
| Gudang | Dashboard, bahan, stok, laporan, grafik |

---

## Alur Demo (Skenario Inti)

1. Login sebagai **Admin** → lihat Dashboard
2. Login sebagai **Ahli Gizi** → atur Menu Harian untuk hari ini
3. Generate Pesanan Makan → semua pasien aktif mendapat 3 pesanan
4. Login sebagai **Koki** → "Siapkan Sesi" pagi → stok terpotong FEFO
5. Ubah status pesanan → siap → terkirim
6. Login sebagai **Perawat** → catat pengembalian makanan
7. Login sebagai **Perawat** → ajukan ubah diet pasien
8. Login sebagai **Ahli Gizi** → setujui pengajuan → diet pasien berubah
9. Cek Laporan & Grafik → data terupdate

---

## Deployment (Opsional)

### Vercel

```bash
npm run build
```

Tambahkan rewrite di `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify

Tambahkan `public/_redirects`:

```
/*    /index.html   200
```

---

## Catatan

- Semua teks UI dalam **Bahasa Indonesia**
- Business logic (validasi alergi, cut-off, potong stok FEFO) ada di **database** (function/trigger)
- Frontend hanya menggunakan `anon key` — tidak ada `service_role key`
- Data seed mencakup 30 hari historis untuk demo grafik & laporan

