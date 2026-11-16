# Implementation Plan: AdmisiRS (untuk AI Agent)

Sistem Admisi & Rawat Inap sederhana, **pasangan integrasi** untuk NutriSmart (manajemen diet & gizi RS).
Proyek tugas kuliah. Prioritas: **berjalan, rapi, mudah dijelaskan**. Tujuan utama proyek ini adalah **integrasi antar aplikasi**, bukan kelengkapan fitur rumah sakit.

---

## 0. ATURAN UNTUK AGENT (baca dulu, patuhi selalu)

1. Baca seluruh file ini sebelum mengerjakan apa pun. File ini adalah sumber kebenaran.
2. Kerjakan **satu task (T-xx) per giliran**, urut nomor, kecuali ada instruksi lain dari pemilik proyek.
3. Setelah task selesai: centang `[x]`, tulis satu baris di **Progress Log** (Bagian 14), lalu berhenti dan laporkan ringkas apa yang dibuat dan cara mengujinya.
4. **Jangan** menambah library di luar daftar Bagian 2 tanpa bertanya.
5. **Jangan** memakai Firebase Admin SDK, service account key, atau file `serviceAccountKey.json`. Frontend hanya memakai config web Firebase lewat `import.meta.env.VITE_*`.
6. **Jangan** memakai Cloud Functions, Cloud Storage, atau Firebase Extensions. Proyek ini harus jalan di **paket Spark (gratis)**. Semua logika berjalan di frontend + Firestore Security Rules.
7. Perubahan keamanan data hanya lewat file `firebase/firestore.rules`. Pemilik proyek yang menempelkannya ke Firebase Console (atau `firebase deploy --only firestore:rules`).
8. Semua teks UI **Bahasa Indonesia**. Nama field/koleksi mengikuti Bagian 4 (camelCase, Bahasa Indonesia). Komentar kode Bahasa Indonesia, singkat.
9. Gaya kode: JavaScript (JSX), function component + hooks, tanpa TypeScript, tanpa state management library. Sederhana dan mudah dibaca mahasiswa.
10. Semua panggilan Firebase ada di `src/services/`. Komponen halaman tidak boleh memanggil `getDoc/setDoc/...` langsung.
11. Setiap halaman wajib punya: loading state, empty state, dan error state (toast).
12. **Kontrak integrasi (Bagian 6) tidak boleh diubah sepihak.** NutriSmart dan ekstensi browser bergantung padanya. Kalau perlu perubahan, tanya pemilik proyek.
13. Kalau instruksi ambigu, **tanya**, jangan menebak.
14. Jangan mengerjakan item **[BONUS]** sebelum semua item **[WAJIB]** selesai.
15. Jangan menambah fitur rumah sakit di luar Bagian 1 (billing, rekam medis, resep, dsb.).

---

## 1. Tujuan & Batasan

### Peran aplikasi
AdmisiRS adalah **sumber data identitas pasien** (di sini pasien didaftarkan dan nomor RM dibuat). NutriSmart memakai data itu untuk diet dan menu. Kedua aplikasi **punya database sendiri-sendiri** (AdmisiRS = Firebase Firestore, NutriSmart = Supabase PostgreSQL). Data berpindah lewat pesan JSON (Bagian 6) yang dibawa oleh **ekstensi browser**.

### Alur inti
```
Petugas daftarkan pasien di AdmisiRS (diagnosa, alergi, kamar, perlu operasi?)
 -> AdmisiRS membuat event "pasien.masuk" (JSON)
 -> ekstensi browser menangkap event, petugas pilih tujuan: NutriSmart
 -> NutriSmart membuat/memperbarui pasien (upsert by no. RM)
 -> ahli gizi di NutriSmart mengganti diet
 -> NutriSmart mengirim "diet.diperbarui" balik -> AdmisiRS menampilkan diet saat ini
```

### Fitur (sengaja minimal)
1. Login 2 role (`admin`, `petugas`)
2. Kamar (daftar + status kosong/terisi)
3. Pasien: daftarkan, ubah, pulangkan
4. Jadwal operasi (daftar sederhana)
5. **Integrasi**: kirim event keluar, terima event masuk, log, simulator uji
6. Dashboard ringkas

### Di luar cakupan (JANGAN dikerjakan)
Rekam medis, billing/kasir, resep/farmasi, upload file/foto, notifikasi email/WA, multi RS, multi bahasa, unit test otomatis (cukup skenario Bagian 10), Cloud Functions, Storage.

> **Catatan:** ekstensi browser **bukan bagian plan ini** (dibuat di proyek terpisah). Plan ini hanya menyiapkan sisi website: memancarkan dan menerima pesan sesuai Bagian 6, plus halaman uji agar integrasi bisa dites **tanpa** ekstensi.

---

## 2. Keputusan Teknologi (FINAL)

| Hal | Keputusan |
|---|---|
| Build tool | **Vite** |
| UI | **React 18** (JavaScript/JSX) |
| Routing | **react-router-dom** (BrowserRouter) |
| Backend | **Firebase** modular SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`) |
| Database | **Cloud Firestore** (mode Native) |
| Auth | **Firebase Authentication**, Email/Password |
| Styling | **Tailwind CSS v4** dengan `@tailwindcss/vite` |
| Notifikasi UI | **react-hot-toast** |
| Ikon | **lucide-react** |
| Tanggal | Native `Intl` / `Date` |
| Hosting (opsional) | Firebase Hosting (paket Spark) |

Stack front-end sengaja **sama dengan NutriSmart** (Vite + React + Tailwind) agar gaya kode dan komponen konsisten. Yang berbeda hanya backend (Firebase vs Supabase), dan itulah inti demo "database berbeda tapi terintegrasi".

Alasan Firebase (ringkas, untuk dijelaskan ke dosen): paket Spark gratis tanpa kartu, Firestore + Auth + Hosting sudah cukup, listener realtime bawaan, dan membuktikan integrasi lintas teknologi database.

Konsekuensi yang harus diterima (sudah dirancang di plan ini):
- Spark tidak mendukung Cloud Functions baru dan Cloud Storage -> **tidak dipakai**.
- Firestore tidak punya JOIN, auto-increment, atau full-text search -> data didenormalisasi seperlunya, nomor RM dibuat lewat transaksi, pencarian dilakukan di sisi klien (data kecil).
- Tidak ada trigger seperti SQL -> validasi dilakukan di service + Security Rules.

### Environment (`.env.local`, jangan di-commit)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```
Sediakan `.env.example` berisi nama variabel tanpa nilai. (Config web Firebase memang tidak rahasia; keamanan data dijaga oleh Security Rules, bukan oleh kerahasiaan key.)

---

## 3. Struktur Folder

```
admisirs/
├── README.md
├── implementation_plan.md
├── .env.example
├── firebase/
│   ├── firestore.rules          (Bagian 5)
│   └── SETUP.md                 (langkah manual di Firebase Console)
└── src/
    ├── main.jsx
    ├── App.jsx                  (definisi route)
    ├── index.css
    ├── lib/
    │   ├── firebase.js          (initializeApp, auth, db)
    │   ├── roles.js             (ROLE, menu per role)
    │   ├── format.js            (tanggal Asia/Jakarta, hariIni())
    │   └── integrasi.js         (kontrak: buatEvent, validasiEvent, kirimKeluar)
    ├── context/
    │   ├── AuthContext.jsx      (user, profile, role, signIn, signOut, loading)
    │   └── IntegrasiContext.jsx (listener pesan masuk + antrean + ACK)
    ├── services/
    │   ├── kamarService.js
    │   ├── pasienService.js
    │   ├── operasiService.js
    │   ├── integrasiService.js  (log + terapkan event masuk)
    │   └── seedService.js
    ├── components/
    │   ├── layout/ (AppLayout.jsx, Sidebar.jsx, Topbar.jsx)
    │   ├── ProtectedRoute.jsx
    │   └── ui/ (Button, Modal, DataTable, Badge, FormField, ConfirmDialog,
    │            EmptyState, Spinner, PageHeader, StatCard)
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Pasien.jsx
        ├── Kamar.jsx
        ├── Operasi.jsx
        └── Integrasi.jsx
```

### Konvensi service
- Satu fungsi = satu operasi: `getXxx`, `createXxx`, `updateXxx`, `deleteXxx`, atau `subscribeXxx` (untuk `onSnapshot`, mengembalikan fungsi unsubscribe).
- Melempar `Error` berpesan jelas (Bahasa Indonesia); halaman menangkap dan menampilkan toast.
- Hindari query gabungan yang butuh composite index. Ambil koleksi dengan `orderBy` satu field + `limit`, lalu filter di klien.

---

## 4. Model Data Firestore

Semua tanggal bisnis disimpan sebagai string `YYYY-MM-DD` (zona **Asia/Jakarta**; jangan pakai `toISOString()` untuk tanggal bisnis). Waktu sistem memakai `serverTimestamp()`.

### `users/{uid}`
```
nama: string
role: 'admin' | 'petugas'
```
Dokumen dibuat **manual** oleh pemilik proyek (ID = UID akun Auth). Akun Auth tanpa dokumen `users` tidak bisa membaca/menulis apa pun (diatur rules).

### `kamar/{id}`
```
bangsal: 'Melati' | 'Mawar' | 'VIP'     // nama SAMA dengan NutriSmart
nomor: string                            // mis. '101A'
status: 'kosong' | 'terisi'
pasienId: string | null
```

### `pasien/{id}`
```
noRm: string                // 'RM023' (unik; dibuat lewat counter)
nama: string
jenisKelamin: 'L' | 'P'
tglLahir: string            // YYYY-MM-DD
diagnosa: string
alergi: string[]            // huruf kecil, trim: ['kacang','udang']
bangsal: string             // salinan dari kamar
kamar: string               // salinan nomor kamar
kamarId: string | null
dietAwal: string            // salah satu daftar diet (Bagian 6.3); default 'Normal'
dietSaatIni: string | null  // diisi dari event masuk diet.diperbarui
perluOperasi: boolean
status: 'dirawat' | 'pulang'
tglMasuk: string
tglPulang: string | null
dibuatOleh: string          // uid
createdAt, updatedAt: timestamp
```

### `jadwalOperasi/{id}`
```
pasienId: string
noRm: string                // denormalisasi
namaPasien: string          // denormalisasi
tindakan: string
tanggal: string
jam: string                 // 'HH:mm'
dokter: string              // teks bebas
status: 'terjadwal' | 'selesai' | 'batal'
catatan: string
createdAt: timestamp
```

### `integrasiLog/{eventId}`
ID dokumen = `eventId` (UUID) sehingga otomatis idempoten.
```
arah: 'keluar' | 'masuk'
jenis: string               // mis. 'pasien.masuk'
mitra: string               // 'nutrismart' / 'ekstensi' / 'simulator'
status: 'menunggu' | 'diterima' | 'gagal' | 'diabaikan'
pesan: string               // alasan/hasil, Bahasa Indonesia
noRm: string | null         // untuk pencarian cepat
event: map                  // seluruh envelope (Bagian 6.1)
createdAt: timestamp
oleh: string                // uid
```

### `meta/counter`
```
noRmTerakhir: number        // nilai awal 22 (NutriSmart sudah memakai RM001-RM022)
```

---

## 5. Firestore Security Rules (`firebase/firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function aktif() {
      return request.auth != null
        && exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function admin() { return aktif() && role() == 'admin'; }

    match /users/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || admin());
      allow write: if admin();
    }

    match /kamar/{id} {
      allow read: if aktif();
      allow update: if aktif();           // status kamar berubah saat pasien masuk/pulang
      allow create, delete: if admin();
    }

    match /pasien/{id} {
      allow read, create, update: if aktif();
      allow delete: if admin();
    }

    match /jadwalOperasi/{id} {
      allow read, create, update: if aktif();
      allow delete: if admin();
    }

    match /integrasiLog/{id} {
      allow read, create, update: if aktif();
      allow delete: if admin();
    }

    match /meta/{doc} {
      allow read, write: if aktif();
    }
  }
}
```

Catatan untuk agent: rules di atas sengaja sederhana. Jangan memperlonggar (`if true`). Validasi isi data (format alergi, status valid) dilakukan di service sebelum menulis.

---

## 6. KONTRAK INTEGRASI v1 (jangan diubah sepihak)

Integrasi memakai **pesan JSON** dan **`window.postMessage`**. Ekstensi browser bertindak sebagai kurir:

```
[Website A] --EVENT_KELUAR--> [content script ekstensi] -> chrome.storage
                                      |
            (pengguna pilih tujuan di popup ekstensi)
                                      v
[Website B] <--EVENT_MASUK-- [content script ekstensi di tab tujuan]
[Website B] --ACK--> ekstensi --ACK_BALIK--> [Website A]   (opsional)
```

Tidak ada database yang dibagi. Tiap website hanya perlu (1) memancarkan event keluar dan (2) mendengarkan event masuk.

### 6.1 Envelope event
```json
{
  "versi": 1,
  "eventId": "b3f1c2e4-....-uuid",
  "jenis": "pasien.masuk",
  "sumber": "admisirs",
  "waktu": "2026-11-16T09:30:00+07:00",
  "data": { }
}
```
- `eventId`: `crypto.randomUUID()`. Penerima **wajib** mengabaikan eventId yang sudah pernah diproses.
- `sumber`: `admisirs` | `nutrismart`.
- `waktu`: ISO 8601 dengan offset +07:00.

### 6.2 Jenis event & `data`

**Keluar dari AdmisiRS (dikirim ke NutriSmart):**

| `jenis` | `data` |
|---|---|
| `pasien.masuk` | `{ noRm, nama, jenisKelamin, tglLahir, bangsal, kamar, diagnosa, alergi[], dietAwal, perluOperasi, tglMasuk }` |
| `pasien.diperbarui` | field yang sama dengan `pasien.masuk` (kirim data lengkap, bukan selisih) |
| `pasien.pulang` | `{ noRm, tglPulang }` |
| `operasi.dijadwalkan` | `{ noRm, nama, tindakan, tanggal, jam }` |

**Masuk ke AdmisiRS (dikirim dari NutriSmart):**

| `jenis` | `data` | Efek di AdmisiRS |
|---|---|---|
| `diet.diperbarui` | `{ noRm, jenisDiet, berlakuSejak }` | `pasien.dietSaatIni = jenisDiet` |
| `pasien.perhatian` **[BONUS]** | `{ noRm, rataSisa, hari }` | tampilkan badge "Asupan rendah" di Pasien |

### 6.3 Kosakata bersama (HARUS persis sama di kedua aplikasi)
- **Bangsal:** `Melati`, `Mawar`, `VIP`
- **Jenis diet:** `Normal`, `Diet DM`, `Rendah Garam`, `Diet Lunak`, `Diet Cair`
- **Alergi:** huruf kecil, tanpa spasi berlebih (`kacang`, `udang`, `ayam`, ...)
- **No. RM:** format `RM` + 3 digit (`RM023`). **AdmisiRS adalah pemilik nomor RM**; NutriSmart melakukan upsert berdasarkan `noRm`.
- **Tanggal:** `YYYY-MM-DD`. **Jenis kelamin:** `L` / `P`.

### 6.4 Protokol `postMessage`
Semua pesan memakai `channel: 'rs-integrasi'`. Kirim dan terima hanya di window yang sama (`targetOrigin = window.location.origin`).

| Arah | Bentuk pesan | Pengirim -> penerima |
|---|---|---|
| Event keluar | `{ channel, tipe: 'EVENT_KELUAR', event }` | website -> ekstensi |
| Event masuk | `{ channel, tipe: 'EVENT_MASUK', event }` | ekstensi -> website tujuan |
| Konfirmasi | `{ channel, tipe: 'ACK', eventId, ok, pesan }` | website tujuan -> ekstensi |
| Konfirmasi balik | `{ channel, tipe: 'ACK_BALIK', eventId, mitra, ok, pesan }` | ekstensi -> website asal **(opsional)** |

Aturan listener (wajib):
1. Abaikan jika `e.source !== window`, `e.data?.channel !== 'rs-integrasi'`, atau `tipe` tak dikenal.
2. Abaikan `EVENT_KELUAR` milik sendiri (itu untuk ekstensi).
3. Jalankan `validasiEvent()` (Bagian 6.5). Jika gagal -> log `gagal` + kirim `ACK {ok:false}`.
4. Cek duplikat: jika dokumen `integrasiLog/{eventId}` sudah ada -> status `diabaikan`, `ACK {ok:true, pesan:'Duplikat, diabaikan'}`.
5. Jika pengguna **belum login**, simpan event di `sessionStorage` (`antreanIntegrasi`) dan proses setelah login.
6. Jangan pernah memakai `eval`, `innerHTML`, atau menjalankan isi event sebagai kode.

### 6.5 `validasiEvent(event)`
Menolak jika: `versi !== 1`; `eventId` bukan string; `jenis` tidak ada di whitelist 6.2; `sumber` salah; `data` bukan objek; field wajib tiap jenis kosong; `noRm` tidak cocok `^RM\d{3,}$`; `bangsal`/`dietAwal`/`jenisDiet` di luar kosakata 6.3. Mengembalikan `{ ok, pesan }` (pesan Bahasa Indonesia).

> Keterbatasan yang diakui (cukup untuk tugas kuliah): script lain di halaman yang sama secara teori bisa memalsukan pesan. Mitigasi: wajib login, whitelist jenis event, validasi ketat, dan Security Rules.

---

## 7. Role, Route & Perilaku Halaman

| Route | Halaman | admin | petugas |
|---|---|:-:|:-:|
| `/login` | Login | publik | publik |
| `/dashboard` | Dashboard | v | v |
| `/pasien` | Pasien | v | v |
| `/kamar` | Kamar | v (kelola) | lihat |
| `/operasi` | Jadwal operasi | v | v |
| `/integrasi` | Integrasi & log | v | v |

`ProtectedRoute` mengarahkan ke `/login` bila belum login dan ke `/dashboard` bila role tidak berhak. "Lihat" = tombol tambah/ubah/hapus disembunyikan.

**Pasien**
- Tabel: no. RM, nama, bangsal/kamar, diagnosa, alergi (badge merah), diet saat ini (dari NutriSmart, "-" bila kosong), badge operasi, status, **status sinkron** (dari log event terakhir pasien itu: `menunggu` abu / `diterima` hijau / `gagal` merah). Pencarian klien (nama, no. RM, diagnosa, kamar) + filter status/bangsal.
- Tombol **Daftarkan Pasien**: form (nama, jenis kelamin, tgl lahir, diagnosa, alergi sebagai tag huruf kecil, kamar dari daftar kamar **kosong**, diet awal, checkbox "Perlu operasi"). Simpan = **satu transaksi Firestore**: naikkan `meta/counter`, buat `pasien`, set kamar `terisi`. Gagal -> tidak ada yang berubah. Setelah sukses: emit `pasien.masuk`.
- **Ubah**: boleh ubah diagnosa, alergi, kamar (pindah kamar = kamar lama `kosong`, kamar baru `terisi`, juga transaksi), diet awal, perluOperasi. Emit `pasien.diperbarui`.
- **Pulangkan** (ConfirmDialog): status `pulang`, `tglPulang` = hari ini, kamar `kosong`. Emit `pasien.pulang`.
- Setelah emit tampil toast: "Data siap diteruskan. Buka ekstensi browser untuk memilih tujuan." dan tombol kecil "Lihat JSON".

**Kamar**: daftar per bangsal dengan badge kosong/terisi dan nama pasien. Admin: tambah/hapus kamar (hanya bila kosong).

**Jadwal operasi**: tabel (tanggal, jam, pasien, tindakan, dokter, status). Form pilih pasien (hanya `dirawat`), tindakan, tanggal, jam, dokter, catatan. Simpan -> set `pasien.perluOperasi = true` dan emit `operasi.dijadwalkan`. Ubah status: terjadwal -> selesai / batal.

**Integrasi** (inti proyek)
1. **Log event**: tabel `integrasiLog` (waktu, arah, jenis, mitra, no. RM, status, pesan) + modal "Lihat JSON". Filter arah/status.
2. **Simulator uji (tanpa ekstensi)**:
   - Tombol "Kirim contoh event keluar" (pilih jenis -> tampilkan JSON -> tombol **Salin JSON**).
   - Kotak **Impor JSON** (tempel envelope -> tombol "Proses sebagai event masuk"). Ini jalur uji yang identik dengan `EVENT_MASUK` dari ekstensi.
3. **Panel kontrak**: tabel ringkas Bagian 6.2 dan 6.3 supaya dosen bisa melihat format pesan.
4. Tombol **Tandai diterima** manual pada event keluar berstatus `menunggu` (untuk demo bila ekstensi belum mengirim `ACK_BALIK`).
5. Admin: tombol **Isi data contoh** (Bagian 8).

**Dashboard**: kartu pasien dirawat, kamar kosong/terisi, operasi hari ini, event menunggu/gagal; daftar 5 event terakhir; daftar operasi terdekat.

---

## 8. Data Contoh (seed lewat aplikasi, bukan skrip admin)

Tombol "Isi data contoh" (admin, di halaman Integrasi) memakai `seedService.js` dengan client SDK biasa. **Idempoten**: berhenti dengan toast bila koleksi `kamar` sudah berisi data.

- `meta/counter.noRmTerakhir = 22`
- Kamar: Melati `101A 101B 102A 102B 103A 103B 104A 104B`; Mawar `201A 201B 202A 202B`; VIP `301 302`
- 6 pasien yang **sama dengan data demo NutriSmart** (agar integrasi bisa dites tanpa input ulang), status `dirawat`:

| noRm | Nama | Kamar | Alergi | dietAwal | Diagnosa (contoh) |
|---|---|---|---|---|---|
| RM001 | Andi Pratama | Melati 101A | - | Diet DM | Diabetes melitus |
| RM002 | Budi Santoso | Melati 101B | - | Rendah Garam | Hipertensi |
| RM004 | Dian Kusuma | Melati 102B | kacang | Normal | Observasi |
| RM006 | Fajar Rahman | Melati 103B | udang | Normal | Observasi |
| RM008 | Haris Munandar | Mawar 201B | kacang, udang | Diet Lunak | Pasca operasi |
| RM018 | Rizky Firmansyah | Melati 104A | - | Diet Cair | Gangguan menelan |

- 2 jadwal operasi (hari ini dan besok) untuk pasien di atas.
- Nomor RM berikutnya yang dibuat aplikasi harus **RM023** (tidak bentrok dengan NutriSmart).

Akun demo (dibuat manual di Firebase Console, lalu buat dokumen `users/{uid}` sesuai Bagian 4):
`admin@admisi.id` (role `admin`) dan `petugas@admisi.id` (role `petugas`).

---

## 9. Daftar Task (kerjakan berurutan)

Format: `[ ] T-xx judul` | file utama | **Selesai kalau**.

### Fase 0: Setup
- [x] **T-01** Inisialisasi Vite + React, install dependency Bagian 2, Tailwind v4, `.env.example`, `.gitignore` | `package.json`, `vite.config.js` | `npm run dev` jalan, halaman tes bergaya Tailwind.
- [x] **T-02** Struktur folder Bagian 3, `lib/firebase.js`, `lib/format.js` (`hariIni()` zona Asia/Jakarta), `lib/roles.js` | `src/lib/*` | Config terbaca dari env, tidak ada key di kode.
- [x] **T-03** Tulis `firebase/firestore.rules` (Bagian 5) dan `firebase/SETUP.md` (langkah: buat project, aktifkan Firestore, aktifkan Auth Email/Password, matikan pendaftaran mandiri bila opsinya ada, buat 2 akun + dokumen `users`, tempel rules, daftar web app untuk config) | `firebase/*` | Pemilik proyek bisa mengikuti SETUP.md sampai rules aktif.

### Fase 1: Auth & Layout
- [x] **T-04** `AuthContext` (`onAuthStateChanged`, ambil `users/{uid}`, `signIn`, `signOut`, `loading`). Akun tanpa dokumen `users` -> otomatis logout + toast "Akun belum terdaftar" | `context/AuthContext.jsx` | Refresh halaman tetap login; role tersedia.
- [x] **T-05** Halaman Login | `pages/Login.jsx` | Login benar -> `/dashboard`; salah -> toast error.
- [x] **T-06** `ProtectedRoute`, `AppLayout`, `Sidebar`, `Topbar` | `components/*` | Sidebar sesuai role; URL terlarang diarahkan.
- [x] **T-07** Komponen UI dasar (Button, Modal, DataTable dengan pencarian klien + paginasi + `searchFields`, Badge, FormField, ConfirmDialog, EmptyState, Spinner, PageHeader, StatCard) | `components/ui/*` | Dipakai ulang di halaman berikutnya; pencarian memfilter seluruh data, bukan hanya halaman aktif.

### Fase 2: Data inti
- [x] **T-08** `seedService` + tombol "Isi data contoh" (sementara di Dashboard) + halaman Kamar | `services/seedService.js`, `pages/Kamar.jsx` | Seed Bagian 8 berjalan sekali; kamar tampil per bangsal dengan status.
- [x] **T-09** Halaman Pasien: daftar, **Daftarkan Pasien** (transaksi counter + kamar), pencarian & filter | `services/pasienService.js`, `pages/Pasien.jsx` | Pasien baru bernomor `RM023`; kamar jadi terisi; gagal di tengah tidak meninggalkan data setengah jadi.

### Fase 3: Integrasi (INTI, kerjakan sebelum fitur lain)
- [x] **T-10** `lib/integrasi.js`: `buatEvent`, `validasiEvent`, `kirimKeluar` (tulis log `menunggu` + `window.postMessage EVENT_KELUAR`), konstanta kosakata Bagian 6.3 | `lib/integrasi.js`, `services/integrasiService.js` | Memanggil `kirimKeluar` membuat dokumen `integrasiLog/{eventId}` dan memancarkan pesan; `validasiEvent` menolak payload salah dengan pesan jelas.
- [x] **T-11** Hubungkan T-09 ke integrasi: emit `pasien.masuk` setelah daftar, toast + "Lihat JSON", badge status sinkron di tabel Pasien | `Pasien.jsx` | Mendaftarkan pasien menghasilkan event berformat Bagian 6.2 (alergi huruf kecil, bangsal sesuai kosakata).
- [x] **T-12** `IntegrasiContext`: listener `message` sesuai aturan 6.4, antrean `sessionStorage` saat belum login, dedupe by eventId, `applyEventMasuk` untuk `diet.diperbarui`, kirim `ACK`, tangani `ACK_BALIK` (ubah log keluar jadi `diterima`/`gagal`) | `context/IntegrasiContext.jsx`, `services/integrasiService.js` | Pesan `EVENT_MASUK` valid memperbarui `pasien.dietSaatIni` dan membuat log `diterima`; duplikat -> `diabaikan`; pasien tak ditemukan -> `gagal` dengan pesan jelas.
- [x] **T-13** Halaman Integrasi: log + modal JSON + filter, simulator (kirim contoh, **Salin JSON**, **Impor JSON**), panel kontrak, tombol "Tandai diterima" | `pages/Integrasi.jsx` | Seluruh skenario uji 5-9 Bagian 10 bisa dijalankan **tanpa ekstensi**.

### Fase 4: Melengkapi alur pasien
- [x] **T-14** Ubah pasien (termasuk pindah kamar, transaksi) + Pulangkan | `Pasien.jsx`, `pasienService.js` | Event `pasien.diperbarui` dan `pasien.pulang` terbentuk; kamar lama/baru berstatus benar.
- [x] **T-15** Jadwal operasi | `services/operasiService.js`, `pages/Operasi.jsx` | Menjadwalkan operasi mengirim `operasi.dijadwalkan` dan menandai `perluOperasi`.

### Fase 5: Finishing
- [x] **T-16** Dashboard (Bagian 7) | `pages/Dashboard.jsx` | Angka cocok dengan data; empty state tidak error.
- [x] **T-17** Rapikan UI: loading/empty/error konsisten, responsif tablet/HP | semua halaman | Tidak ada halaman blank saat data kosong/error.
- [x] **T-18** README (setup Firebase, akun demo, cara menjalankan, **cara menguji integrasi tanpa ekstensi**, deploy opsional Firebase Hosting dengan rewrite SPA) | `README.md` | Orang lain bisa menjalankan proyek dari README saja.

### Fase 6: Bonus
- [ ] **T-19** **[BONUS]** Event masuk `pasien.perhatian` + badge "Asupan rendah" | `integrasiService.js`, `Pasien.jsx` | Event simulasi menampilkan badge.
- [ ] **T-20** **[BONUS]** Ekspor CSV pasien/log, cetak gelang pasien sederhana | - | Opsional.

---

## 10. Skenario Uji Manual

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Login 2 akun demo | Admin bisa kelola kamar; petugas hanya lihat |
| 2 | Akun Auth tanpa dokumen `users` mencoba login | Ditolak/logout dengan pesan jelas; Firestore menolak baca |
| 3 | Daftarkan pasien baru | `noRm = RM023`, kamar jadi terisi, event `pasien.masuk` tercatat `menunggu` |
| 4 | Daftarkan dua pasien nyaris bersamaan (dua tab) | Nomor RM berbeda (tidak ada duplikat) |
| 5 | Simulator: salin JSON `pasien.masuk` | JSON sesuai Bagian 6.1/6.2; alergi huruf kecil |
| 6 | Impor JSON `diet.diperbarui` untuk RM001 | `dietSaatIni` pasien berubah; log masuk `diterima` |
| 7 | Impor JSON yang sama untuk kedua kalinya | Log `diabaikan` (duplikat), data tidak berubah |
| 8 | Impor JSON dengan `noRm` tidak ada / `versi: 2` / jenis asing | Log `gagal` dengan pesan jelas, data tidak berubah |
| 9 | Kirim `EVENT_MASUK` lewat `window.postMessage` dari console | Diproses sama seperti impor JSON; pesan dari window lain diabaikan |
| 10 | Kirim event saat belum login lalu login | Event diproses setelah login |
| 11 | Ubah alergi/kamar pasien | Event `pasien.diperbarui` berisi data lengkap; kamar lama kosong, baru terisi |
| 12 | Pulangkan pasien | Status `pulang`, kamar kosong, event `pasien.pulang` |
| 13 | Jadwalkan operasi | `perluOperasi = true`, event `operasi.dijadwalkan` |
| 14 | Pasien baru dari AdmisiRS diteruskan ke NutriSmart (dengan ekstensi) | Pasien muncul di NutriSmart dengan bangsal, alergi, diet awal sesuai |
| 15 | Ahli gizi NutriSmart menyetujui pengajuan diet | `dietSaatIni` di AdmisiRS ikut berubah |
| 16 | Pencarian di tabel Pasien (nama, no. RM, kamar) | Menyaring seluruh data, bukan hanya halaman aktif |

---

## 11. Risiko & Penanganan

| Risiko | Penanganan |
|---|---|
| Scope melebar ke fitur RS lain | Patuhi Bagian 1 dan aturan 15 |
| Nomor RM bentrok dengan NutriSmart | Counter dimulai dari 22; AdmisiRS pemilik nomor RM |
| Penulisan data setengah jadi (pasien dibuat, kamar belum terisi) | Selalu pakai transaksi / batch untuk operasi multi-dokumen |
| Rules salah -> data tidak muncul | Cek dokumen `users/{uid}` ada dan role benar sebelum menyalahkan kode |
| Biaya tak terduga | Tetap di Spark; jangan upgrade ke Blaze; jangan pakai Functions/Storage |
| Kuota Firestore habis saat demo | Hindari listener `onSnapshot` pada koleksi besar tanpa `limit`; pakai `limit(200)` |
| Ekstensi belum siap saat demo | Pakai Simulator (Salin/Impor JSON); ini sengaja disediakan |
| Format pesan beda antar aplikasi | Bagian 6 adalah kontrak tunggal; agent NutriSmart dan ekstensi membacanya juga |

---

## 12. Definition of Done

- [ ] Login 2 role dan Security Rules aktif
- [ ] Pasien bisa didaftarkan, diubah, dipulangkan; kamar konsisten
- [ ] Event keluar berformat Bagian 6 terbentuk untuk masuk, perbarui, pulang, operasi
- [ ] Event masuk `diet.diperbarui` diproses (valid, duplikat, gagal) dan tercatat di log
- [ ] Skenario uji 1-13 dan 16 lulus **tanpa ekstensi**
- [ ] Skenario 14-15 lulus bersama NutriSmart + ekstensi
- [ ] README lengkap, `.env.local` tidak ter-commit, tidak ada service account di repo

---

## 13. Lampiran: yang harus dikerjakan di SISI LAIN (bukan oleh agent ini)

Agent proyek ini **tidak** mengerjakan bagian berikut, tetapi perlu tahu supaya kontrak cocok.

**A. NutriSmart (Supabase)** - proyek terpisah, task terpisah:
- Migration baru `19_terima_integrasi.sql`: RPC `terima_event_integrasi(p_event jsonb)` (`security definer`, role `admin`/`ahli_gizi`). `pasien.masuk`/`pasien.diperbarui` -> upsert `pasien` berdasarkan `no_rm` (cari `bangsal_id` dari nama bangsal, `jenis_diet_id` dari nama diet; `alergi` huruf kecil). `pasien.pulang` -> `status='pulang'` (trigger yang sudah ada membatalkan pesanan `menunggu`). Tabel kecil `integrasi_log` (event_id unik) untuk dedupe.
- Listener `postMessage` di frontend NutriSmart (pola sama dengan Bagian 6.4) yang memanggil RPC tersebut.
- Emit `diet.diperbarui` setelah RPC `setujui_pengajuan_diet` sukses.

**B. Ekstensi browser (Chrome Manifest V3)** - proyek terpisah:
- Content script di kedua website: tangkap `EVENT_KELUAR` -> `chrome.storage.local`; di tab tujuan kirim `EVENT_MASUK`, terima `ACK`, teruskan `ACK_BALIK`.
- Popup di kanan atas: daftar event tertunda + daftar tujuan (nama, URL) dari file konfigurasi.

---

## 14. Progress Log (agent mengisi di bawah ini)

Format: `YYYY-MM-DD | T-xx | ringkasan singkat | catatan/kendala`

```
2026-11-16 | T-01 | Vite+React+Tailwind v4 terpasang, .env.example & .gitignore dibuat, halaman uji tampil, `npm run build` sukses | Firebase MCP aktif; project `admisirs-rs` dibuat (project `admisirs-app` kelebihan, hapus manual di Console)
2026-11-16 | T-02 | Struktur folder Bagian 3, `lib/firebase.js` (env), `lib/format.js`, `lib/roles.js`, `.env.local` dari SDK config MCP | Project final `admisirs-app`, web app "AdmisiRS Web"; `format.js` diuji via node, config terbukti di browser (projectId tampil)
2026-11-16 | T-03 | `firebase/firestore.rules` (Bagian 5) + `firebase/SETUP.md`; Firestore Native `asia-southeast2` + Auth Email/Password + rules di-deploy lewat MCP; `firebase.json`, `.firebaserc`, `firestore.indexes.json` | Bukti: rules aktif identik dengan file, REST baca tanpa auth -> 403, signIn bohong -> INVALID_LOGIN_CREDENTIALS (provider aktif)
2026-11-16 | T-03b | Akun demo + dokumen `users` dibuat otomatis (rules bootstrap sementara, lalu dikembalikan): `admin@admisi.id`/`admins123`, `petugas@admisi.id`/`petugas123` | Bukti: login 2 akun OK, admin baca `pasien` -> 200, petugas tulis `users` -> 403, tanpa auth -> 403; bootstrap.rules sudah dihapus
2026-11-16 | T-04 | `context/AuthContext.jsx`: `onAuthStateChanged`, profil `users/{uid}`, `signIn` (pesan error Bahasa Indonesia), `signOut`, `loading`; Toaster dipasang di `main.jsx` | Bukti browser: login admin tampil nama+role, reload tetap login, logout OK, akun `tanpa-dokumen@admisi.id` ditolak + toast "Akun belum terdaftar". `main.jsx` masih halaman uji sementara
2026-11-16 | T-05 | `pages/Login.jsx` + `App.jsx` (route sementara) + `main.jsx` pakai `BrowserRouter` | Bukti browser: password salah -> toast "Email atau password salah" dan tetap di `/login`; benar -> pindah `/dashboard` + toast "Berhasil masuk"; buka `/login` saat sudah login -> dilempar ke `/dashboard`; `npm run build` sukses
2026-11-16 | T-06 | `ProtectedRoute` (auth + cek menu role lewat URL), `AppLayout`/`Sidebar`/`Topbar` (sidebar off-canvas, logout) | Bukti browser: menu & tombol sesuai role; petugas tidak melihat tambah/hapus kamar maupun "Isi data contoh"
2026-11-16 | T-07 | `components/ui/*` (Button, Badge, Modal, DataTable, EmptyState, FormField, ConfirmDialog, Spinner, PageHeader, StatCard) + `JsonModal` | Bukti: DataTable menyaring seluruh data (log 2 halaman, cari "pasien.masuk" yang ada di halaman 2 tetap muncul)
2026-11-16 | T-08 | `seedService.isiDataContoh` (14 kamar, 6 pasien RM001–RM018, 2 operasi, counter 22) + `pages/Kamar.jsx` per bangsal; tombol seed final di halaman Integrasi (admin) | Bukti browser: seed sekali jalan, 14 kartu kamar (6 terisi); tambah kamar 105A lalu hapus OK
2026-11-16 | T-09 | `pages/Pasien.jsx`: tabel + filter status/bangsal, form daftar (transaksi counter + kamar), badge sinkron dari log | Bukti browser: pasien baru RM023, kamar 102A terisi, event `pasien.masuk` menunggu. Bug ditemukan & diperbaiki: form memakai `alergiTeks`, service butuh `alergi[]`
2026-11-16 | T-10 | `lib/integrasi.js` (kontrak murni: envelope, validasi, kosakata, postMessage) + `integrasiService.kirimKeluar` (log menunggu + EVENT_KELUAR) | Bukti: aksi pasien & simulator membuat dokumen log ber-ID eventId; JSON sesuai Bagian 6.2 (alergi huruf kecil)
2026-11-16 | T-11 | Emisi `pasien.masuk` setelah daftar + toast & tombol Lihat JSON + badge sinkron | Bukti: event RM023 berisi data lengkap, badge "Menunggu" di tabel
2026-11-16 | T-12 | `IntegrasiContext`: listener channel + `source===window`, antrean sessionStorage, dedupe, ACK, ACK_BALIK; `terapkanEventMasuk` untuk `diet.diperbarui` | Bukti: EVENT_MASUK RM002 diterima + ACK; pesan dari iframe diabaikan; event saat logout ditahan lalu diproses setelah login
2026-11-16 | T-13 | `pages/Integrasi.jsx`: log + filter + JSON, simulator keluar, Impor JSON, panel kontrak, Tandai diterima, Isi data contoh (admin) | Bukti: diet RM001 -> `dietSaatIni` "Diet Cair"; duplikat `diabaikan`; versi 2 / RM999 `gagal`; ACK_BALIK & tandai manual -> `diterima`
2026-11-16 | T-14 | Ubah pasien + pindah kamar (transaksi) + pulangkan di `pages/Pasien.jsx` | Bukti: RM023 pindah 102A -> VIP 301 (102A kosong, 301 terisi), alergi `["kacang","debu"]`, lalu pulang -> kamar kosong, event `pasien.pulang`
2026-11-16 | T-15 | `pages/Operasi.jsx` + `operasiService` (batch: jadwal + `perluOperasi`) | Bukti: operasi RM018 terjadwal, event `operasi.dijadwalkan` benar, badge perlu operasi muncul, status -> selesai
2026-11-16 | T-16 | `pages/Dashboard.jsx`: 4 kartu, 5 event terakhir, operasi terdekat; empty state | Bukti: 6 dirawat, kamar 8/6, operasi hari ini 1, event perhatian 7 — cocok dengan data
2026-11-16 | T-17 | Loading/empty/error konsisten di semua halaman; tabel scroll horizontal; sidebar off-canvas; grid responsif | Error = toast + banner; empty state teruji saat DB kosong. Uji visual HP belum dijalankan (tidak ada alat resize)
2026-11-16 | T-18 | `README.md`: setup Firebase, akun demo, seed, cara uji integrasi tanpa ekstensi, kontrak, deploy Hosting | `npm run build` sukses
```
