# Panduan Lengkap NutriSmart 🍽️
**Informasi Akun Demo, Alur Operasional Per Role, dan Katalog Data Dummy**

Dokumen ini disusun sebagai panduan demonstrasi dosen/penguji dan panduan teknis pengoperasian sistem NutriSmart.

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

NutriSmart menerapkan **Role-Based Access Control (RBAC)** baik di antarmuka (Sidebar & Route) maupun di tingkat database (Row Level Security):

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
| **Pengajuan Diet** | Full | Setujui / Tolak | ❌ | Buat Form | ❌ |
| **Pengajuan Pembelian** | Full | ❌ | Buat Form | ❌ | Setujui / Terima |
| **Pengembalian Makanan** | Full | Lihat | Lihat | Catat Sisa | ❌ |
| **Laporan & Ekspor CSV** | Full | Full | Full | ❌ | Full |
| **Grafik & Tren** | Full | Full | Full | ❌ | Full |
| **Pengaturan Sistem** | Full | ❌ | ❌ | ❌ | ❌ |
| **Profil & Ganti Password** | Full | Full | Full | Full | Full |

*Keterangan:* `Lihat` = Role dapat membuka halaman, tetapi tombol Tambah/Ubah/Hapus (CUD) otomatis disembunyikan.

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
   - Klik tombol **"Generate Pesanan Hari Ini"**.
   - Sistem memanggil RPC `generate_pesanan_harian(current_date)`.
   - Otomatis terbit 3 pesanan makan (Pagi, Siang, Malam) untuk setiap pasien yang berstatus aktif.
   - **Perhatikan pasien ber-alergi**: Jika ada menu yang mengandung alergen pasien (misal: menu udang untuk pasien alergi udang), pesanan akan bertanda kuning *"Konflik alergi: pilih menu pengganti"*.
   - Ahli gizi dapat memilih menu pengganti yang aman secara langsung di tabel.

---

### Skenario B: Pengolahan Dapur & Pemotongan Stok FEFO (Role Koki)
1. Logout, lalu login sebagai **Koki** (`koki@nutrismart.id` / `koki1234`).
2. Masuk ke menu **Pesanan Makan**:
   - Pilih sesi (misal: Pagi).
   - Klik tombol **"Siapkan Sesi Pagi"**.
   - Sistem memanggil fungsi database `siapkan_pesanan(p_tanggal, p_waktu)`.
   - **Mekanisme Otomatis:**
     - Sistem menghitung total kebutuhan bahan dari resep menu yang dipesan.
     - Mengambil bahan dari `stok_batch` menggunakan metode **FEFO (First Expired, First Out)** — batch yang kedaluwarsanya paling dekat akan dipotong lebih dulu.
     - Mencatat riwayat pemakaian ke tabel `pemakaian_bahan`.
     - Status pesanan berubah menjadi `disiapkan`.
3. Setelah makanan matang dan siap diantar, ubah status pesanan menjadi `siap`, kemudian `terkirim`.

---

### Skenario C: Penerimaan Makanan & Pelaporan Sisa Makanan (Role Perawat)
1. Logout, lalu login sebagai **Perawat** (`perawat@nutrismart.id` / `perawat1`).
2. Buka menu **Pasien**:
   - Suster Ani dapat melihat daftar pasien di Bangsal Melati.
3. Setelah waktu makan selesai, buka menu **Pengembalian**:
   - Pilih tanggal dan waktu makan yang baru saja terkirim.
   - Pilih pesanan pasien, lalu catat **persen sisa makanan** (0%, 25%, 50%, 75%, atau 100%).
   - Pilih **alasan sisa makanan** (misal: *mual*, *nafsu makan menurun*, *porsi terlalu banyak*).
   - Klik Simpan. Data ini otomatis masuk ke analisa **Food Waste**.

---

### Skenario D: Pengajuan Perubahan Diet & Validasi Cut-off (Role Perawat → Ahli Gizi)
1. Masih sebagai **Perawat**, masuk ke menu **Pengajuan Diet**:
   - Klik **"Ajukan Perubahan Diet"**.
   - Pilih pasien (misal: pasien yang kondisinya membaik dan beralih dari Diet Lunak ke Diet Normal).
   - Masukkan tanggal berlaku dan waktu makan.
   - Isi alasan medis.
   - **Uji Coba Cut-off:**
     - Jika mengajukan untuk sesi makan yang jamnya sudah melewati batas cut-off (Pagi 06:00, Siang 09:00, Malam 15:00), sistem database otomatis **MENOLAK** dengan pesan: `"Pengajuan melewati batas waktu (cut-off HH:MM)"`.
     - Ajukan untuk jadwal yang valid (misal: besok pagi). Pengajuan berhasil dengan status `menunggu`.
2. Logout, login kembali sebagai **Ahli Gizi**:
   - Buka menu **Pengajuan Diet**.
   - Terlihat daftar pengajuan berstatus `menunggu`.
   - Klik **"Setujui"**.
   - Database otomatis mengubah jenis diet di data pasien dan menyinkronkan menu pesanan berikutnya!

---

### Skenario E: Pengajuan Pembelian & Logistik Stok (Koki → Gudang)
1. Login sebagai **Koki** (`koki@nutrismart.id` / `koki1234`):
   - Buka menu **Pengajuan Pembelian**.
   - Terlihat banner peringatan bahan di bawah stok minimum (misal: *Kacang Tanah*).
   - Klik **"Ajukan Pembelian"**, tambahkan bahan yang dibutuhkan (bisa menggunakan tombol saran cepat), masukkan jumlah, dan catatan opsional.
   - Klik **"Kirim Pengajuan"**. Pengajuan masuk dengan status `menunggu`.
2. Logout, lalu login sebagai **Gudang** (`gudang@nutrismart.id` / `gudang12`):
   - Buka menu **Pengajuan Pembelian**.
   - Klik tombol hijau **"Setujui"** pada pengajuan yang masuk. Status berubah menjadi `disetujui`.
   - Saat supplier mengantar barang ke RS, klik tombol biru **"Terima Barang"**.
   - Masukkan tanggal kedaluwarsa untuk tiap bahan yang diterima, lalu klik **"Terima & Tambah ke Stok"**.
   - Sistem memanggil RPC `terima_pembelian()` yang otomatis membuat batch stok baru (FEFO) dan status berubah menjadi `diterima`!
3. Buka menu **Stok**:
   - Di tab **Ringkasan Stok**, terlihat jumlah stok bahan yang baru diterima sudah bertambah.
   - Di tab **Batch (FEFO)**, batch baru sudah tercatat rapi beserta tanggal kedaluwarsanya.

---

### Skenario F: Analisis, Ekspor, & Konfigurasi (Role Admin)
1. Logout, login sebagai **Admin** (`admin@nutrismart.id` / `admin123`).
2. Buka **Dashboard**:
   - Menampilkan total pasien aktif, porsi pesanan hari ini, dan total bahan aktif.
   - Kartu Peringatan Kedaluwarsa (Near Expiry): Menyorot batch bahan yang kedaluwarsa dalam ≤ 3 hari.
   - Kartu Stok Menipis: Menyorot bahan yang stoknya di bawah batas aman.
   - Grafik distribusi jenis diet dan status pesanan per bangsal.
3. Buka **Laporan**:
   - Laporan Rekap Distribusi Makanan Harian.
   - Laporan Food Waste (Sisa Makanan) per Bangsal.
   - Laporan Pemakaian Bahan Makanan.
   - Uji tombol **"Ekspor CSV"** (file terunduh otomatis) dan **"Cetak PDF"** (sidebar otomatis tersembunyi saat dicetak).
4. Buka **Grafik**:
   - Grafik Garis Tren Food Waste 30 Hari Terakhir.
   - Grafik Donat Distribusi Diet Pasien.
   - Grafik Batang Top 10 Bahan Makanan Paling Banyak Dikonsumsi.
5. Buka **Pengaturan**:
   - Mengatur jam cut-off pemesanan diet (Pagi, Siang, Malam).
   - Mengatur ambang batas peringatan hari kedaluwarsa.
   - Mengelola profil dan role staf rumah sakit.

---

## 4. Katalog Data Dummy di Database Supabase

Seluruh tabel telah diisi dengan data awal yang realistis untuk mendukung skenario pengujian:

### 1. Tabel `pengaturan` (Konfigurasi Global)
- `cutoff_pagi`: `06:00`
- `cutoff_siang`: `09:00`
- `cutoff_malam`: `15:00`
- `batas_hari_kedaluwarsa`: `3` hari

### 2. Tabel `bangsal` (3 Ruang Perawatan)
- ID 1: **Melati** (Lantai 1)
- ID 2: **Mawar** (Lantai 2)
- ID 3: **VIP** (Lantai 3)

### 3. Tabel `jenis_diet` (5 Kategori Diet Medis)
- **Normal**: Maks 700 kkal, 800 mg natrium, tekstur biasa.
- **Diet DM (Diabetes Melitus)**: Maks 500 kkal, 600 mg natrium, tekstur biasa.
- **Rendah Garam**: Maks 600 kkal, 300 mg natrium (pasien hipertensi/ginjal).
- **Diet Lunak**: Maks 550 kkal, 700 mg natrium, tekstur lunak (bubur).
- **Diet Cair**: Maks 400 kkal, 500 mg natrium, tekstur cair (susu/jus).

### 4. Tabel `pasien` (20 Pasien Aktif)
Contoh data pasien yang dapat dijadikan studi kasus saat demo:
- **Andi Pratama** (`RM001`, Bangsal Melati, Kamar 101A) → Diagnosa: Diabetes Melitus, Diet: Diet DM.
- **Budi Santoso** (`RM002`, Bangsal Melati, Kamar 101B) → Diagnosa: Hipertensi, Diet: Rendah Garam.
- **Dian Kusuma** (`RM004`, Bangsal Melati, Kamar 102B) → Alergi: `kacang`.
- **Fajar Rahman** (`RM006`, Bangsal Melati, Kamar 103B) → Alergi: `udang`.
- **Haris Munandar** (`RM008`, Bangsal Mawar, Kamar 201B) → Alergi ganda: `kacang, udang`, Diet: Lunak.
- **Rizky Firmansyah** (`RM018`, Bangsal Melati, Kamar 104A) → Diet Cair.

### 5. Tabel `supplier` (3 Pemasok)
- **PT Segar Jaya**: Beras, daging ayam, susu, gula, minyak.
- **UD Tani Makmur**: Telur, tahu, tempe, bayam, wortel, kacang, buah.
- **CV Laut Biru**: Ikan segar, udang.

### 6. Tabel `bahan_makanan` (15 Komoditas Dapur)
Beras (kg), Daging Ayam (kg), Ikan (kg), Telur (pcs), Tahu (pcs), Tempe (pcs), Bayam (kg), Wortel (kg), Kacang Tanah (kg), Udang (kg), Susu Segar (liter), Gula Pasir (kg), Minyak Goreng (liter), Garam Dapur (kg), Buah Segar (kg).

### 7. Tabel `stok_batch` (18 Batch Bahan - Uji Kasus Nyata)
- **Kasus Batch Hampir Kedaluwarsa (Near-Expiry Alert)**:
  - Ayam: Sisa 3 kg, kedaluwarsa 2 hari lagi *(muncul di dashboard)*.
  - Bayam: Sisa 2 kg, kedaluwarsa 1 hari lagi *(muncul di dashboard)*.
- **Kasus Bahan di Bawah Minimum (Low Stock Alert)**:
  - Kacang Tanah: Stok minimum 3 kg, sisa hanya 1.5 kg *(muncul badge kuning/merah di dashboard)*.
- Batch lainnya dalam kondisi aman dengan tanggal kedaluwarsa bervariasi hingga 180 hari ke depan.

### 8. Tabel `menu` & `resep` (10 Menu Masakan Rumah Sakit)
1. **Nasi Tim Ayam** (Diet Normal, DM) → Beras 0.15kg, Ayam 0.1kg, Wortel 0.05kg.
2. **Nasi Goreng Telur** (Diet Normal) → Beras 0.15kg, Telur 2pcs, Minyak 0.02L.
3. **Sup Ikan Wortel** (Diet Normal, Rendah Garam, DM) → Ikan 0.12kg, Wortel 0.08kg, Garam 0.005kg.
4. **Bubur Ayam** (Diet Lunak, Normal) → Beras 0.1kg, Ayam 0.08kg, Garam 0.003kg.
5. **Tumis Tahu Tempe** (Diet Normal, DM, Rendah Garam) → Tahu 2pcs, Tempe 2pcs, Minyak 0.02L.
6. **Soto Ayam** *(Mengandung Alergen: Kacang)*.
7. **Nasi Udang Saus** *(Mengandung Alergen: Udang)*.
8. **Bubur Kacang Hijau** *(Mengandung Alergen: Kacang)*.
9. **Sup Bayam Telur** (Diet Normal, DM, Rendah Garam).
10. **Jus Buah Susu** (Diet Cair).

### 9. Tabel `pesanan_makan` & `pengembalian_makanan` (450 Data Historis)
- Telah diisi data simulasi selama 30 hari ke belakang (5 pasien x 3 sesi makan x 30 hari = 450 transaksi).
- Sekitar 40% dari pesanan historis dilengkapi pencatatan evaluasi food waste (persentase sisa 0%, 25%, 50%, 75%, 100%) dengan variasi alasan klinis.
- Data ini membuat **Laporan Food Waste** dan **Grafik Tren 30 Hari** langsung terisi grafik visual yang informatif saat pertama kali dibuka.

