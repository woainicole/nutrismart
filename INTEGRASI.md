# Panduan Integrasi NutriSmart ↔ AdmisiRS

> Dokumen ini menjelaskan cara kerja integrasi dua aplikasi melalui ekstensi browser Chrome,
> sesuai kontrak di `admisiRS_plan.md` Bagian 6.

---

## Gambaran Umum

```
NutriSmart (Supabase/PostgreSQL)          AdmisiRS (Firebase Firestore)
        |                                          |
        |   ←── ekstensi browser Chrome ──→        |
        |                                          |
  Ahli gizi ubah diet  ──EVENT_KELUAR──→  AdmisiRS update dietSaatIni
  Terima pasien baru   ←──EVENT_MASUK──   AdmisiRS daftarkan pasien
```

Kedua aplikasi **tidak berbagi database**. Data berpindah lewat pesan JSON yang dibawa ekstensi browser.

---

## File yang Ditambahkan

| File | Keterangan |
|---|---|
| `src/services/integrasiService.js` | Service integrasi: validasi event, panggil RPC, emit diet |
| `src/context/IntegrasiContext.jsx` | Context listener postMessage + antrean saat belum login |
| `supabase/migrations/20261116000019_terima_integrasi.sql` | Migration: tabel `integrasi_log`, RPC `terima_event_integrasi`, fungsi `emit_diet_diperbarui` |
| `scripts/sync_supabase_to_firebase.mjs` | Script sinkronisasi satu arah: Supabase → Firestore |

---

## Langkah Setup

### 1. Jalankan migration di Supabase SQL Editor

Buka `supabase/migrations/20261116000019_terima_integrasi.sql` dan jalankan seluruh isinya di Supabase SQL Editor.

Ini membuat:
- Tabel `integrasi_log` (deduplikasi event by `event_id`)
- RPC `terima_event_integrasi(jsonb)` — dipanggil frontend saat menerima event dari AdmisiRS
- Fungsi `emit_diet_diperbarui(text, text, date)` — dipanggil setelah ahli gizi menyetujui diet

### 2. Sinkronisasi data pasien ke Firestore (opsional, satu kali)

```bash
node scripts/sync_supabase_to_firebase.mjs
```

Script ini menyalin semua pasien dari Supabase ke Firestore AdmisiRS.
Field `dietSaatIni` dan `kamarId` tidak ditimpa (dikelola AdmisiRS).

### 3. Pasang IntegrasiProvider di App.jsx

Sudah ditambahkan. `IntegrasiContext` mendengarkan `window.postMessage` dari ekstensi dan memanggil RPC otomatis.

---

## Alur Event

### NutriSmart → AdmisiRS: `diet.diperbarui`

Terpicu saat ahli gizi menyetujui pengajuan diet di halaman **Pengajuan Diet**.

1. `handleSetujui()` memanggil `emitDietDiperbarui(noRm, jenisDiet, berlaku)`
2. Service memanggil RPC `emit_diet_diperbarui` → dapat envelope JSON
3. Envelope dikirim via `window.postMessage({channel:'rs-integrasi', tipe:'EVENT_KELUAR', event})`
4. Ekstensi browser menangkap dan meneruskan ke tab AdmisiRS
5. AdmisiRS update `pasien.dietSaatIni`

### AdmisiRS → NutriSmart: `pasien.masuk`, `pasien.diperbarui`, `pasien.pulang`

1. AdmisiRS emit event lewat `window.postMessage` (ExtensiRS menangkap)
2. Ekstensi meneruskan ke tab NutriSmart sebagai `EVENT_MASUK`
3. `IntegrasiContext` di NutriSmart menangkap event
4. Memanggil RPC `terima_event_integrasi(envelope)` di Supabase
5. RPC melakukan upsert pasien berdasarkan `no_rm`, catat ke `integrasi_log`

---

## Uji Tanpa Ekstensi (Simulator)

Gunakan halaman **Integrasi** di AdmisiRS:
1. Tombol **Kirim contoh event keluar** → salin JSON
2. Buka console browser di NutriSmart
3. Jalankan:
   ```js
   window.postMessage({ channel: 'rs-integrasi', tipe: 'EVENT_MASUK', event: <paste JSON> }, window.location.origin)
   ```
4. Toast muncul di NutriSmart + data pasien/diet terupdate

Atau gunakan Simulator **Impor JSON** di halaman Integrasi AdmisiRS untuk menguji arah sebaliknya.

---

## Kontrak (jangan diubah sepihak)

Lihat `admisiRS_plan.md` Bagian 6 untuk:
- Format envelope (`versi`, `eventId`, `jenis`, `sumber`, `waktu`, `data`)
- Daftar jenis event dan field wajibnya
- Kosakata bersama (bangsal, diet, format no. RM, tanggal)
- Protokol postMessage (`channel: 'rs-integrasi'`)

---

## Tabel `integrasi_log` (Supabase)

| Kolom | Keterangan |
|---|---|
| `event_id` | UUID dari envelope, UNIQUE → deduplikasi otomatis |
| `jenis` | `pasien.masuk`, `diet.diperbarui`, dll. |
| `arah` | `masuk` (dari AdmisiRS) atau `keluar` (dari NutriSmart) |
| `status` | `diterima`, `gagal`, `diabaikan`, `menunggu` |
| `no_rm` | Nomor RM untuk pencarian cepat |
| `payload` | Seluruh envelope JSON |
