# Cross-Check: Tabel Pasien Supabase ↔ Firestore

## Tabel `pasien` di Supabase (NutriSmart) — Skema Aktual

Dari `01_schema.sql` + migration `19_terima_integrasi.sql`:

| Kolom | Tipe | Ada? | Catatan |
|---|---|:-:|---|
| `id` | bigint PK | ✅ | auto-increment |
| `no_rm` | text UNIQUE | ✅ | |
| `nama` | text | ✅ | |
| `bangsal_id` | bigint FK | ✅ | FK ke `bangsal(id)` |
| `kamar` | text | ✅ | nomor kamar, mis. "101A" |
| `diagnosa` | text | ✅ | |
| `alergi` | text[] | ✅ | default `{}` |
| `jenis_diet_id` | bigint FK | ✅ | FK ke `jenis_diet(id)` |
| `status` | text | ✅ | 'aktif' \| 'pulang' |
| `tgl_masuk` | date | ✅ | |
| `tgl_pulang` | date | ✅ | ditambah migration 19 |
| `jenis_kelamin` | text | ✅ | ditambah migration 19 (check L/P) |
| **`tgl_lahir`** | **date** | ❌ | **BELUM ADA — perlu ditambahkan!** |

---

## Koleksi `pasien` di Firestore (AdmisiRS)

Dari `admisiRS_plan.md` Bagian 4:

| Field | Tipe | Ada? | Catatan |
|---|---|:-:|---|
| `noRm` | string | ✅ | format `RM001` |
| `nama` | string | ✅ | |
| `jenisKelamin` | string | ✅ | 'L' \| 'P' |
| `tglLahir` | string | ✅ | format YYYY-MM-DD |
| `diagnosa` | string | ✅ | |
| `alergi` | string[] | ✅ | huruf kecil |
| `bangsal` | string | ✅ | nama bangsal ('Melati', dll.) |
| `kamar` | string | ✅ | nomor kamar |
| `kamarId` | string | ✅ | doc ID kamar di Firestore |
| `dietAwal` | string | ✅ | nama diet |
| `dietSaatIni` | string\|null | ✅ | diisi dari event NutriSmart |
| `perluOperasi` | boolean | ✅ | |
| `status` | string | ✅ | 'dirawat' \| 'pulang' |
| `tglMasuk` | string | ✅ | YYYY-MM-DD |
| `tglPulang` | string\|null | ✅ | |
| `dibuatOleh` | string | ✅ | uid user AdmisiRS |
| `createdAt` | timestamp | ✅ | serverTimestamp |
| `updatedAt` | timestamp | ✅ | serverTimestamp |

---

## Perbedaan & Gap

| Field Firestore | Field Supabase | Status | Solusi |
|---|---|:-:|---|
| `noRm` | `no_rm` | ✅ cocok (rename) | |
| `nama` | `nama` | ✅ | |
| `jenisKelamin` | `jenis_kelamin` | ✅ ada (migration 19) | |
| **`tglLahir`** | **`tgl_lahir`** | ❌ **BELUM ADA** | **Migration 21** |
| `diagnosa` | `diagnosa` | ✅ | |
| `alergi` | `alergi` | ✅ | |
| `bangsal` (nama) | `bangsal_id` (FK) | ⚠️ beda tipe | RPC resolve nama→id |
| `kamar` | `kamar` | ✅ | |
| `dietAwal` (nama) | `jenis_diet_id` (FK) | ⚠️ beda tipe | RPC resolve nama→id |
| `perluOperasi` | — | ❌ tidak ada | Opsional, bisa tambah |
| `status` ('dirawat') | `status` ('aktif') | ⚠️ **beda nilai!** | RPC sudah handle mapping |
| `tglMasuk` | `tgl_masuk` | ✅ | |
| `tglPulang` | `tgl_pulang` | ✅ ada (migration 19) | |
| `dietSaatIni` | — | ❌ tidak ada di pasien | Di NutriSmart = `jenis_diet_id` |
| `kamarId` | — | ❌ tidak relevan | Hanya ada di Firestore |
| `createdAt/updatedAt` | — | ❌ tidak ada | Opsional |

---

## Yang Perlu Diperbaiki

### 1. `tgl_lahir` — WAJIB (kamu yang lapor)
Kolom ini ada di Firestore (`tglLahir`) tapi **tidak ada** di tabel `pasien` Supabase.

**Fix:** Jalankan migration 21 di bawah.

### 2. `perlu_operasi` — Opsional
Field `perluOperasi` di AdmisiRS tidak ada padanannya di NutriSmart.
Bisa ditambahkan sebagai informasi tambahan.

### 3. Status mapping — Sudah ditangani
Firestore: `'dirawat'` ↔ Supabase: `'aktif'` → RPC `terima_event_integrasi` sudah handle ini.
