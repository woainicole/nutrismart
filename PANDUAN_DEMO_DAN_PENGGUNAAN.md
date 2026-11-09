# Panduan Lengkap NutriSmart 🍽️
**Informasi Akun Demo, Alur Operasional Per Role, dan Katalog Data Dummy**

Dokumen ini disusun sebagai panduan demonstrasi dosen/penguji dan panduan teknis pengoperasian sistem NutriSmart.

> **v2 — 2026-11-09:** Diperbarui sesuai addendum v2 (T-29–T-47). Database sudah live dengan 13 migration tambahan (06–18). Fitur baru: deteksi alergi otomatis, siapkan sesi hanya sekali, ubah status massal, riwayat makan pasien, sistem notifikasi realtime, log aktivitas, proyeksi kebutuhan bahan, validasi gizi diet, dan lainnya.

---

## 1. Daftar Akun Demo & Kredensial

Sistem menyediakan 5 akun dengan hak akses dan wewenang yang berbeda sesuai pembagian peran rumah sakit:

| No | Role | Email | Password | Nama Lengkap | Penugasan |
|:--:|---|---|---|---|---|
| 1 | **Admin** | `admin@nutrismart.id` | `admin123` | Admin RS | Semua Modul RS |
| 2 | **Ahli Gizi** | `gizi@nutrismart.id` | `gizi1234` | Dr. Siti Ahli Gizi | Gizi, Menu & Diet |
| 3 | **Koki** | `koki@nutrismart.id` | `koki1234` | Chef Budi | Dapur & Stok |
| 4 | **Perawat** | `perawat@nutrismart.id` | `perawat1` | Suster Ani | Bangsal Melati |
| 5 | **Gudang** | `gudang@nutrismart.id` | `gudang12` | Pak Joko Gudang | Logistik & Bahan |

> **Catatan:** Seluruh akun sudah terdaftar dan terkonfirmasi secara aktif di database Supabase Auth.

---

## 2. Hak Akses & Matriks Menu Per Role

NutriSmart menerapkan **Role-Based Access Control (RBAC)** baik di antarmuka (Sidebar & Route) maupun di tingkat database (Row Level Security / RLS):

| Menu / Halaman | Admin | Ahli Gizi | Koki | Perawat | Gudang |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | Full | Full | Full | Full | Full |
| **Pasien** | Full | Full | ❌ | Lihat | ❌ |
| **Jenis Diet** | Full | Full | Lihat | Lihat | ❌ |
| **Menu & Resep** | Full | Full | Lihat | ❌ | ❌ |
| **Bahan & Supplier** | Full | Lihat | Lihat | ❌ | Full |
| **Bangsal** | Full | ❌ | ❌ | ❌ | ❌ |
| **Stok (FEFO)** | Full | Lihat | Lihat | ❌ | Full |
| **Menu Harian** | Full | Full | Lihat | ❌ | ❌ |
| **Pesanan Makan** | Full | Full | Full (Siapkan) | Lihat | ❌ |
| **Pengajuan Diet** | Full | Setujui / Tolak | ❌ | Buat / Batalkan | ❌ |
| **Pengajuan Pembelian** | Full | ❌ | Buat Form | ❌ | Setujui / Terima |
| **Pengembalian Makanan** | Full | Lihat | Lihat | Catat Sisa | ❌ |
| **Riwayat Makan** | Full | Full | ❌ | Lihat | ❌ |
| **Notifikasi** | Full | Full | Full | Full | Full |
| **Log Aktivitas** | Full | ❌ | ❌ | ❌ | ❌ |
| **Laporan & Ekspor CSV** | Full | Full | Full | ❌ | Full |
| **Grafik & Tren** | Full | Full | Full | ❌ | Full |
| **Pengaturan Sistem** | Full | ❌ | ❌ | ❌ | ❌ |
| **Profil & Ganti Password** | Full | Full | Full | Full | Full |

*Keterangan:* `Lihat` = Role dapat membuka halaman, tetapi tombol Tambah/Ubah/Hapus (CUD) otomatis disembunyikan. Pembatasan sesungguhnya dijaga oleh RLS di database.

---

## 3. Skenario Demo Utama (Alur End-to-End Rumah Sakit)

Jalankan demonstrasi secara berurutan mengikuti alur kerja rumah sakit berikut:

### Skenario A: Perencanaan Menu & Pesanan (Role Ahli Gizi)
1. Login sebagai **Ahli Gizi** (`gizi@nutrismart.id` / `gizi1234`).
2. Masuk ke menu **Menu Harian**:
   - Pilih tanggal hari ini.
   - Atur jadwal menu per waktu makan (Pagi, Siang, Malam) untuk tiap jenis diet.
   - *Data seed sudah mengisi jadwal 7 hari ke depan, namun Anda dapat mengubahnya untuk demo.*
3. Masuk ke menu **Pesanan Makan**:
   - Klik tombol **"Generate / Sinkronkan Pesanan"**.
   - Sistem memanggil RPC `generate_pesanan_harian(tanggal)`.
   - Otomatis terbit 3 pesanan makan (Pagi, Siang, Malam) untuk setiap pasien aktif.
   - **Deteksi Alergi Otomatis (v2):** Konflik alergi dideteksi dari nama menu, nama bahan resep, dan tag alergen bahan — bukan hanya tag manual. Pasien dengan alergi `ayam` akan mendapat badge merah dan catatan konflik di pesanannya.
   - Ahli gizi dapat memilih menu pengganti yang aman langsung di tabel.

---

### Skenario B: Pengolahan Dapur & Pemotongan Stok FEFO (Role Koki)
1. Logout, lalu login sebagai **Koki** (`koki@nutrismart.id` / `koki1234`).
2. Masuk ke menu **Pesanan Makan**:
   - Pilih tanggal dan sesi (misal: Pagi).
   - **Filter Chip Menu (v2):** Lihat rekap produksi per menu (misal: "Nasi Tim Ayam (12)", "Bubur Ayam (5)"). Klik chip untuk memfilter tabel.
   - Jika ada pesanan tanpa menu (konflik alergi belum diselesaikan), banner kuning akan muncul dan tombol **"Siapkan Sesi"** akan dinonaktifkan.
   - Klik tombol **"Siapkan Sesi Pagi"**.
   - **Mekanisme Otomatis:**
     - Pemotongan stok FEFO dari batch kedaluwarsa terdekat.
     - Status pesanan berubah menjadi `disiapkan`.
     - Sesi dicatat di `sesi_makan` — **tidak bisa disiapkan dua kali** (tombol langsung disabled setelah berhasil).
     - Notifikasi otomatis dikirim ke perawat bangsal.
3. **Ubah Status Massal (v2):**
   - Pilih chip menu tertentu (misal: "Nasi Tim Ayam").
   - Centang semua baris atau pilih beberapa.
   - Klik **"Tandai Siap"** atau **"Tandai Terkirim"** — semua berubah sekaligus.
   - Toast menampilkan "12 diubah, 0 dilewati".

---

### Skenario C: Penerimaan Makanan & Pelaporan Sisa Makanan (Role Perawat)
1. Logout, lalu login sebagai **Perawat** (`perawat@nutrismart.id` / `perawat1`).
2. Buka **Notifikasi** (lonceng di Topbar): Lihat notifikasi "Sesi Pagi mulai disiapkan" yang dikirim koki.
3. Setelah waktu makan selesai, buka menu **Pengembalian**:
   - Pilih tanggal dan waktu makan yang baru saja terkirim.
   - Catat **persen sisa makanan** (0%, 25%, 50%, 75%, atau 100%) dan **alasan** (mual, nafsu makan menurun, dll).
   - Klik Simpan. Data ini masuk ke analisa **Food Waste** dan **Riwayat Makan**.
4. Buka menu **Pengajuan Diet**:
   - Lihat riwayat pengajuan yang pernah dibuat, termasuk yang sudah disetujui atau ditolak beserta alasan penolakan (v2).
   - Pengajuan yang masih `menunggu` dapat **dibatalkan** oleh perawat pengaju (v2).

---

### Skenario D: Riwayat Makan Pasien (Role Ahli Gizi) ⭐ Permintaan Dosen
1. Login sebagai **Ahli Gizi**, buka menu **Riwayat Makan**.
2. Pilih pasien menggunakan pencarian nama / no. RM.
3. Lihat **timeline harian** pagi / siang / malam dengan:
   - Nama menu, status pesanan, persen sisa, alasan, kalori dikonsumsi.
   - Baris total kalori & natrium harian.
4. **Kartu ringkasan:** rata-rata sisa, rata-rata kalori harian, jumlah makan tercatat vs belum dicatat.
5. **Grafik:** batang kalori per hari + garis rata-rata sisa (%).
6. **Riwayat perubahan diet:** daftar persetujuan diet lama → baru lengkap dengan tanggal.
7. Ekspor CSV atau Cetak.

> **Poin penting untuk dosen:** Jika diet pasien diganti setelah beberapa hari, hari-hari sebelumnya tetap menampilkan diet *lama* (snapshot `jenis_diet_id` tersimpan di tiap baris pesanan).

---

### Skenario E: Pengajuan Perubahan Diet & Validasi Cut-off (Perawat → Ahli Gizi)
1. Sebagai **Perawat**, masuk ke **Pengajuan Diet**:
   - Klik **"Ajukan Perubahan Diet"**, pilih pasien, diet baru, tanggal berlaku, alasan.
   - **Uji Cut-off:** Ajukan untuk sesi yang jamnya sudah lewat → database menolak otomatis: `"Pengajuan melewati batas waktu (cut-off HH:MM)"`.
   - Ajukan untuk jadwal valid → status `menunggu`. Lonceng notifikasi ahli gizi bertambah +1.
2. Login sebagai **Ahli Gizi**, buka **Pengajuan Diet**:
   - Klik **"Setujui"** → diet pasien berubah, pesanan mendatang tersinkron otomatis.
   - Atau klik **"Tolak"** → wajib isi alasan penolakan (v2). Perawat dinotifikasi beserta alasannya.

---

### Skenario F: Pengajuan Pembelian & Logistik Stok (Koki → Gudang)
1. Login sebagai **Koki**, buka **Pengajuan Pembelian**:
   - Buat pengajuan baru (bahan di bawah stok minimum disarankan otomatis).
   - Klik **"Kirim Pengajuan"** → notifikasi otomatis ke gudang & admin.
2. Login sebagai **Gudang**, buka **Pengajuan Pembelian**:
   - Setujui → notifikasi balik ke koki.
   - Saat barang datang: klik **"Terima Barang"**, masukkan tanggal kedaluwarsa tiap bahan.
   - RPC `terima_pembelian()` membuat batch stok baru (FEFO).
3. Buka **Stok** tab **Kebutuhan** (v2):
   - Pilih tanggal (default: besok).
   - Lihat proyeksi kebutuhan bahan vs stok saat ini — baris merah = kekurangan.
   - Tombol **"Buat Pengajuan Pembelian dari Kekurangan"** mengisi form otomatis.

---

### Skenario G: Analisis, Laporan & Konfigurasi (Role Admin)
1. Login sebagai **Admin**, buka **Dashboard**:
   - KPI: pasien aktif, total porsi, progres terkirim, jumlah peringatan.
   - Panel progres sesi (Pagi/Siang/Malam) dengan lencana "Sudah disiapkan oleh X pukul HH:mm".
   - Panel peringatan: stok menipis, near-expiry, konflik alergi belum diselesaikan.
2. Buka **Laporan** (3 laporan + filter tanggal + ekspor CSV + cetak):
   - Rekap Distribusi Makanan Harian.
   - Food Waste per Bangsal.
   - Pemakaian & Pembelian Bahan.
3. Buka **Grafik**:
   - Tren Food Waste harian/bulanan.
   - Distribusi Jenis Diet (donut).
   - Top 10 Konsumsi Bahan (bar horizontal).
   - **Menu Sisa Tertinggi (v2):** bar horizontal top 10 menu + badge "Perlu Dievaluasi" jika rata-rata sisa ≥ 40%.
4. Buka **Log Aktivitas** (v2):
   - Riwayat semua perubahan data: siapa, kapan, tabel apa, data lama vs baru.
   - Klik baris untuk melihat diff detail di modal.
5. Buka **Pengaturan**:
   - Jam cut-off (Pagi, Siang, Malam), ambang near-expiry, role & bangsal staf.

---

## 4. Fitur Database v2 (Migration 06–18)

Semua migration berikut sudah diterapkan ke Supabase production:

| Migration | Fitur | Trigger/Function/Tabel |
|---|---|---|
| `06` | Deteksi alergi otomatis dari nama + bahan resep | `alergen_menu()`, `konflik_alergi()`, kolom `bahan_makanan.alergen` |
| `06` | Snapshot diet di pesanan, kolom waktu status | `pesanan_makan.jenis_diet_id`, `disiapkan_at`, `siap_at`, `terkirim_at` |
| `06` | Sesi makan — pencatat sesi yang sudah disiapkan | Tabel `sesi_makan` |
| `07` | Siapkan sesi hanya sekali (advisory lock) | `siapkan_pesanan()` v2 |
| `08` | Ubah status pesanan massal | `ubah_status_pesanan(ids[], status)` |
| `09` | Riwayat makan pasien | View `v_riwayat_makan` |
| `10` | Sistem notifikasi realtime | Tabel `notifikasi`, 4 trigger, `kirim_notifikasi()` |
| `11` | Sinkron pesanan otomatis saat pasien berubah | Trigger `trg_pasien_sinkron` |
| `12` | Pemantauan asupan & pasien perlu perhatian | View `v_asupan_harian`, `v_pasien_perhatian` |
| `13` | Validasi kalori/natrium menu vs batas diet | Trigger `trg_validasi_menu_diet`, kolom `jenis_diet.batas_kalori/natrium` |
| `14` | Log aktivitas audit trail | Tabel `log_aktivitas`, trigger `_catat_log` di 8 tabel |
| `15` | Proyeksi kebutuhan bahan harian | Function `kebutuhan_bahan(tanggal)` |
| `16` | Pembatalan & alasan penolakan pengajuan diet | Kolom `alasan_penolakan`, status `dibatalkan` |
| `17` | Kartu stok & mutasi batch | Tabel `mutasi_stok` |
| `18` | Catatan ahli gizi per pasien | Tabel `catatan_gizi` |

---

## 5. Katalog Data Dummy di Database Supabase

Seluruh tabel telah diisi dengan data awal yang realistis untuk mendukung skenario pengujian:

### `pengaturan` (Konfigurasi Global)
- `cutoff_pagi`: `06:00`
- `cutoff_siang`: `09:00`
- `cutoff_malam`: `15:00`
- `batas_hari_kedaluwarsa`: `3` hari

### `bangsal` (3 Ruang Perawatan)
- **Melati** (Lantai 1) · **Mawar** (Lantai 2) · **VIP** (Lantai 3)

### `jenis_diet` (5 Kategori Diet Medis)
- **Normal**: Maks 700 kkal, 800 mg natrium, tekstur biasa.
- **Diet DM**: Maks 500 kkal, 600 mg natrium, tekstur biasa.
- **Rendah Garam**: Maks 600 kkal, 300 mg natrium.
- **Diet Lunak**: Maks 550 kkal, 700 mg natrium, tekstur lunak.
- **Diet Cair**: Maks 400 kkal, 500 mg natrium, tekstur cair.

### `pasien` (22 Pasien Aktif)
Studi kasus yang direkomendasikan untuk demo:

| Pasien | RM | Bangsal | Alergi | Diet | Keterangan Demo |
|---|---|---|---|---|---|
| Andi Pratama | RM001 | Melati 101A | — | Diet DM | Diabetes Melitus |
| Budi Santoso | RM002 | Melati 101B | — | Rendah Garam | Hipertensi |
| Dian Kusuma | RM004 | Melati 102B | `kacang` | Normal | Uji deteksi alergi kacang |
| Fajar Rahman | RM006 | Melati 103B | `udang` | Normal | Uji deteksi alergi udang |
| Haris Munandar | RM008 | Mawar 201B | `kacang, udang` | Lunak | Alergi ganda |
| Rizky Firmansyah | RM018 | Melati 104A | — | Cair | Diet Cair / susu |

### `supplier` (3 Pemasok)
- **PT Segar Jaya**: Beras, ayam, susu, gula, minyak.
- **UD Tani Makmur**: Telur, tahu, tempe, bayam, wortel, kacang, buah.
- **CV Laut Biru**: Ikan segar, udang.

### `bahan_makanan` (17 Komoditas Dapur)
Beras, Daging Ayam, Ikan, Telur, Tahu, Tempe, Bayam, Wortel, Kacang Tanah, Udang, Susu Segar, Gula Pasir, Minyak Goreng, Garam Dapur, Buah Segar, Kentang, Jahe.

> **v2:** Tiap bahan kini punya kolom `alergen[]` opsional untuk tag alergen tambahan di luar nama bahan.

### `stok_batch` (33 Batch — Uji Kasus Nyata)
- **Near-Expiry Alert:** Ayam (3 kg, kedaluwarsa 2 hari), Bayam (2 kg, kedaluwarsa 1 hari).
- **Low Stock Alert:** Kacang Tanah (sisa 1.5 kg, minimum 3 kg).
- Batch lain aman dengan kedaluwarsa bervariasi.

### `menu` & `resep` (10 Menu Masakan RS)
1. **Nasi Tim Ayam** (Normal, DM) — Beras 0.15 kg, Ayam 0.1 kg, Wortel 0.05 kg.
2. **Nasi Goreng Telur** (Normal) — Beras 0.15 kg, Telur 2 pcs.
3. **Sup Ikan Wortel** (Normal, Rendah Garam, DM).
4. **Bubur Ayam** (Lunak, Normal) — ⚠️ *Mengandung ayam (alergen potensial)*.
5. **Tumis Tahu Tempe** (Normal, DM, Rendah Garam).
6. **Soto Ayam** — ⚠️ *Mengandung alergen: kacang*.
7. **Nasi Udang Saus** — ⚠️ *Mengandung alergen: udang*.
8. **Bubur Kacang Hijau** — ⚠️ *Mengandung alergen: kacang*.
9. **Sup Bayam Telur** (Normal, DM, Rendah Garam).
10. **Jus Buah Susu** (Cair).

### `pesanan_makan` & `pengembalian_makanan` (778 / 167 Rows)
- Data historis 30+ hari, 3 sesi × 22 pasien aktif.
- ~167 catatan food waste dengan variasi sisa dan alasan klinis.
- Data ini membuat Laporan Food Waste dan Grafik Tren 30 Hari langsung terisi saat pertama dibuka.

### Tabel Baru v2
| Tabel | Isi Awal | Tujuan |
|---|---|---|
| `sesi_makan` | 94 rows (backfill dari data lama) | Mencegah siapkan sesi duplikat |
| `notifikasi` | 0 (terisi saat demo) | Realtime bell & badge |
| `log_aktivitas` | 0 (terisi saat demo) | Audit trail admin |
| `mutasi_stok` | 0 | Kartu stok bahan |
| `catatan_gizi` | 0 | Catatan ahli gizi |

---

## 6. Skenario Uji Teknis (untuk Penguji / Dosen)

| # | Skenario | Hasil yang Diharapkan |
|---|---|---|
| 1 | Login 5 akun demo | Tiap role melihat sidebar berbeda |
| 2 | Perawat akses `/pengaturan` via URL | Diarahkan ke dashboard |
| 3 | Generate pesanan hari ini | Semua pasien aktif punya 3 pesanan; konflik alergi ditandai |
| 4 | Ahli gizi pilih menu mengandung alergen pasien | Ditolak: `ALERGI: menu mengandung X` |
| 5 | Pasien alergi `ayam`, generate pesanan hari dengan Bubur Ayam | `menu_id = null`, catatan "Konflik alergi (ayam)", badge merah |
| 6 | Koki "Siapkan sesi" dua kali / dua tab bersamaan | Kedua kali ditolak, stok tidak berubah |
| 7 | Siapkan sesi saat ada pesanan tanpa menu | Ditolak: "N pesanan belum punya menu" |
| 8 | Stok bahan tidak cukup saat siapkan sesi | Pesan "Stok X tidak cukup", stok dan status tidak berubah |
| 9 | Perawat ajukan ubah diet setelah cut-off | Ditolak dengan pesan cut-off |
| 10 | Ahli gizi setujui pengajuan | Diet pasien berubah; pesanan mendatang tersinkron |
| 11 | Ahli gizi tolak pengajuan tanpa isi alasan | Tidak bisa disimpan (alasan wajib) |
| 12 | Perawat batalkan pengajuan diet miliknya | Status berubah `dibatalkan` |
| 13 | Koki pilih chip "Nasi Goreng" → pilih semua → Tandai Siap | Seluruh pesanan menu itu menjadi `siap`; toast "N diubah, M dilewati" |
| 14 | Ahli gizi buka Riwayat Makan pasien | Timeline pagi/siang/malam, sisa, kalori harian |
| 15 | Ganti diet pasien, lihat riwayat hari sebelumnya | Hari lama tetap menampilkan diet lama |
| 16 | Catat pengembalian sisa 75% | Muncul di laporan food waste + grafik tren; notifikasi ke ahli gizi |
| 17 | Dashboard admin | KPI, progres sesi, panel peringatan, semua sesuai data |
| 18 | Ekspor CSV Laporan | File terunduh, isi sesuai filter tanggal |
| 19 | Perawat coba ubah stok via console/API | Ditolak RLS |
| 20 | Tambah pasien baru / pulangkan pasien | Pesanan mendatang tersinkron / dibatalkan otomatis |
| 21 | Tambahkan menu natrium tinggi ke Diet Rendah Garam | Ditolak: "Natrium menu melampaui batas diet" |
| 22 | Admin buka Log Aktivitas setelah ubah data pasien | Tercatat dengan nama pelaku, waktu, data lama vs baru |
| 23 | Buka Stok tab Kebutuhan besok | Kebutuhan vs stok per bahan, baris merah jika kurang |
