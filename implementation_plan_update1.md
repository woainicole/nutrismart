# Implementation Plan: NutriSmart (untuk AI Agent)

Sistem Manajemen Diet, Menu Pasien & Logistik Bahan Dapur Rumah Sakit.
Proyek tugas kuliah. Prioritas: **berjalan, rapi, mudah dijelaskan**. Bukan sistem produksi.

---

## 0. ATURAN UNTUK AGENT (baca dulu, patuhi selalu)

1. Baca seluruh file ini sebelum mengerjakan apa pun. File ini adalah sumber kebenaran.
2. Kerjakan **satu task (T-xx) per giliran**, urut sesuai nomor, kecuali ada instruksi lain dari pemilik proyek.
3. Setelah task selesai: centang `[x]` pada task, tulis satu baris di **Progress Log** (Bagian 15), lalu berhenti dan laporkan ringkas apa yang dibuat dan cara mengujinya.
4. **Jangan** menambah library di luar daftar Bagian 2 tanpa bertanya.
5. **Jangan** mengubah skema database langsung di kode. Semua perubahan skema ditulis ke file `database/*.sql`, lalu pemilik proyek menjalankannya di Supabase SQL Editor. Kalau skema perlu berubah, update file SQL dan beri tahu.
6. **Jangan** pernah memakai atau menulis `service_role key`. Frontend hanya memakai `anon key` lewat env.
7. **Jangan** hardcode URL/key. Pakai `import.meta.env.VITE_*`.
8. Logika bisnis penting (potong stok, validasi alergi, cut-off, persetujuan) ada di **database** (function/trigger, Bagian 4). Frontend hanya memanggilnya lewat `supabase.rpc()` dan menampilkan pesan error-nya. Jangan menduplikasi logika itu di JavaScript.
9. Semua teks UI dalam **Bahasa Indonesia**. Nama tabel/kolom dan nama variabel domain mengikuti Bahasa Indonesia seperti di skema. Komentar kode Bahasa Indonesia, singkat.
10. Gaya kode: JavaScript (JSX), function component + hooks, tanpa TypeScript, tanpa state management library. Sederhana dan mudah dibaca mahasiswa.
11. Setiap halaman wajib punya: loading state, empty state, dan error state (toast).
12. Kalau instruksi ambigu atau butuh keputusan di luar file ini, **tanya**, jangan menebak.
13. Jangan mengerjakan item berlabel **[BONUS]** sebelum semua item **[WAJIB]** selesai.
14. **Fase perbaikan (T-29 dst., Bagian 14):** database sudah live. Perubahan skema HANYA lewat file baru `database/migrations/NN_*.sql` yang idempotent; jangan edit `01`-`05`.
15. **Bug:** reproduksi dulu, temukan akar masalah, catat di Progress Log, baru perbaiki. Jangan menambal gejala.
16. Urutan prioritas fase perbaikan: **P0 > P1 > P2 > P3** (lihat Bagian 14.2 dan 14.3). Jangan lompat level.

---

## 1. Tujuan & Batasan

### Alur inti (harus selalu berjalan)
```
Pasien dirawat -> punya jenis diet -> ahli gizi atur menu harian per diet
-> generate pesanan makan per pasien -> koki "siapkan" (stok terpotong FEFO)
-> siap -> terkirim -> sisa makanan dicatat -> laporan & grafik
```

### Di luar cakupan (JANGAN dikerjakan)
- Rekam medis lengkap (cukup data pasien sederhana)
- Kalkulator gizi otomatis dari bahan (kalori/natrium diinput manual per menu)
- Email/WhatsApp/push notification
- Upload gambar/file
- Multi bahasa, multi RS
- Unit test otomatis (cukup skenario uji manual Bagian 11)

---

## 2. Keputusan Teknologi (FINAL)

| Hal | Keputusan |
|---|---|
| Build tool | **Vite** |
| UI | **React 18** (JavaScript/JSX) |
| Routing | **react-router-dom** (BrowserRouter) |
| Backend | **Supabase** (PostgreSQL + Auth + RPC) lewat `@supabase/supabase-js` |
| Styling | **Tailwind CSS v4** dengan plugin `@tailwindcss/vite` |
| Grafik | **chart.js** + **react-chartjs-2** |
| Notifikasi UI | **react-hot-toast** |
| Ikon | **lucide-react** |
| Tanggal | Native `Intl` / `Date` (tanpa library tambahan) |
| Ekspor | CSV buatan sendiri (Blob) + cetak PDF via `window.print()` |

Alasan memilih Vite + React (bukan Next.js): tidak ada SSR, tidak ada pemisahan server/client component, auth Supabase cukup lewat `supabase-js` di browser. Lebih sedikit titik error untuk proyek kuliah.

Pakai versi stabil terbaru dari tiap library saat instalasi.

### Environment (`.env.local`, jangan di-commit)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
Sediakan juga `.env.example` berisi nama variabel tanpa nilai.

---

## 3. Struktur Folder

```
nutrismart/
â”œâ”€â”€ README.md
â”œâ”€â”€ implementation_plan.md
â”œâ”€â”€ .env.example
â”œâ”€â”€ database/
â”‚   â”œâ”€â”€ 01_schema.sql        (tabel + constraint)
â”‚   â”œâ”€â”€ 02_functions.sql     (helper, trigger, RPC)
â”‚   â”œâ”€â”€ 03_views.sql         (view untuk dashboard/laporan)
â”‚   â”œâ”€â”€ 04_rls.sql           (row level security)
â”‚   â”œâ”€â”€ 05_seed.sql          (data dummy)
â”‚   â””â”€â”€ migrations/          (perubahan skema setelah v1: 06, 07, ... lihat Bagian 14)
â””â”€â”€ src/
    â”œâ”€â”€ main.jsx
    â”œâ”€â”€ App.jsx                     (definisi route)
    â”œâ”€â”€ index.css                   (import tailwind)
    â”œâ”€â”€ lib/
    â”‚   â”œâ”€â”€ supabaseClient.js
    â”‚   â”œâ”€â”€ roles.js                (ROLE, menu per role, helper canAccess)
    â”‚   â”œâ”€â”€ format.js               (tanggal, angka, persen)
    â”‚   â””â”€â”€ exportCsv.js
    â”œâ”€â”€ context/
    â”‚   â”œâ”€â”€ AuthContext.jsx         (session, profile, role, signIn, signOut)
    â”‚   â””â”€â”€ NotifikasiContext.jsx   (notifikasi realtime + badge)
    â”œâ”€â”€ services/                   (semua panggilan supabase ada di sini)
    â”‚   â”œâ”€â”€ pasienService.js
    â”‚   â”œâ”€â”€ dietService.js
    â”‚   â”œâ”€â”€ menuService.js
    â”‚   â”œâ”€â”€ bahanService.js
    â”‚   â”œâ”€â”€ stokService.js
    â”‚   â”œâ”€â”€ pesananService.js
    â”‚   â”œâ”€â”€ pengajuanService.js
    â”‚   â”œâ”€â”€ pengembalianService.js
    â”‚   â”œâ”€â”€ laporanService.js
    â”‚   â”œâ”€â”€ pengaturanService.js
    â”‚   â”œâ”€â”€ notifikasiService.js
    â”‚   â”œâ”€â”€ riwayatService.js
    â”‚   â””â”€â”€ logService.js
    â”œâ”€â”€ components/
    â”‚   â”œâ”€â”€ layout/ (AppLayout.jsx, Sidebar.jsx, Topbar.jsx)
    â”‚   â”œâ”€â”€ ProtectedRoute.jsx
    â”‚   â””â”€â”€ ui/ (Button, Modal, DataTable, Badge, StatCard, FormField,
    â”‚            ConfirmDialog, EmptyState, Spinner, PageHeader)
    â””â”€â”€ pages/
        â”œâ”€â”€ Login.jsx
        â”œâ”€â”€ Dashboard.jsx
        â”œâ”€â”€ master/ (Pasien.jsx, JenisDiet.jsx, Menu.jsx, Bahan.jsx, Supplier.jsx, Bangsal.jsx)
        â”œâ”€â”€ Stok.jsx
        â”œâ”€â”€ MenuHarian.jsx
        â”œâ”€â”€ PesananMakan.jsx
        â”œâ”€â”€ PengajuanDiet.jsx
        â”œâ”€â”€ PengajuanPembelian.jsx
        â”œâ”€â”€ Pengembalian.jsx
        â”œâ”€â”€ RiwayatMakan.jsx
        â”œâ”€â”€ Notifikasi.jsx
        â”œâ”€â”€ LogAktivitas.jsx
        â”œâ”€â”€ Laporan.jsx
        â”œâ”€â”€ Grafik.jsx
        â”œâ”€â”€ Pengaturan.jsx
        â””â”€â”€ Profil.jsx
```

### Konvensi service
- Satu fungsi = satu operasi. Nama: `getXxx`, `createXxx`, `updateXxx`, `deleteXxx`.
- Selalu mengembalikan `data` atau melempar `Error` dengan `error.message` dari Supabase. Halaman yang menangkap dan menampilkan toast.
- Tidak ada panggilan `supabase.from(...)` langsung di komponen halaman.

---

## 4. Database

> **Catatan v2:** beberapa function/trigger di 4.2 (mis. `validasi_pesanan`, `generate_pesanan_harian`, `siapkan_pesanan`) digantikan oleh migration di Bagian 14 (`06` dst.). Jika bertentangan, **Bagian 14 yang berlaku**.

Jalankan file SQL berurutan di Supabase SQL Editor. Zona waktu bisnis: **Asia/Jakarta**.

### 4.1 `01_schema.sql`

```sql
-- ===== Struktur RS =====
create table bangsal (
  id bigint generated always as identity primary key,
  nama text not null unique,
  lantai int
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null check (role in ('admin','ahli_gizi','koki','perawat','gudang')),
  bangsal_id bigint references bangsal(id)
);

-- ===== Diet & pasien =====
create table jenis_diet (
  id bigint generated always as identity primary key,
  nama text not null unique,
  kalori_maks_per_makan int,
  natrium_maks_per_makan int,
  tekstur text not null default 'biasa' check (tekstur in ('biasa','lunak','saring','cair'))
);

create table pasien (
  id bigint generated always as identity primary key,
  no_rm text not null unique,
  nama text not null,
  bangsal_id bigint references bangsal(id),
  kamar text,
  diagnosa text,
  alergi text[] not null default '{}',          -- simpan huruf kecil, mis. {'kacang','udang'}
  jenis_diet_id bigint references jenis_diet(id),
  status text not null default 'aktif' check (status in ('aktif','pulang')),
  tgl_masuk date not null default current_date
);

-- ===== Menu & resep =====
create table menu (
  id bigint generated always as identity primary key,
  nama text not null,
  kalori int,
  natrium int,
  tekstur text not null default 'biasa' check (tekstur in ('biasa','lunak','saring','cair')),
  mengandung_alergen text[] not null default '{}'  -- huruf kecil
);

create table menu_diet (
  menu_id bigint references menu(id) on delete cascade,
  jenis_diet_id bigint references jenis_diet(id) on delete cascade,
  primary key (menu_id, jenis_diet_id)
);

-- ===== Bahan & stok =====
create table supplier (
  id bigint generated always as identity primary key,
  nama text not null,
  kontak text
);

create table bahan_makanan (
  id bigint generated always as identity primary key,
  nama text not null unique,
  satuan text not null,                          -- kg, liter, pcs
  stok_minimum numeric not null default 0,
  supplier_id bigint references supplier(id)
);

create table resep (
  id bigint generated always as identity primary key,
  menu_id bigint not null references menu(id) on delete cascade,
  bahan_id bigint not null references bahan_makanan(id),
  jumlah_per_porsi numeric not null check (jumlah_per_porsi > 0),
  unique (menu_id, bahan_id)
);

create table stok_batch (
  id bigint generated always as identity primary key,
  bahan_id bigint not null references bahan_makanan(id),
  jumlah_sisa numeric not null check (jumlah_sisa >= 0),
  tgl_masuk date not null default current_date,
  tgl_kedaluwarsa date not null
);

-- ===== Operasional harian =====
-- Ahli gizi menentukan 1 menu per (tanggal, waktu makan, jenis diet)
create table menu_harian (
  id bigint generated always as identity primary key,
  tanggal date not null,
  waktu_makan text not null check (waktu_makan in ('pagi','siang','malam')),
  jenis_diet_id bigint not null references jenis_diet(id),
  menu_id bigint not null references menu(id),
  unique (tanggal, waktu_makan, jenis_diet_id)
);

create table pesanan_makan (
  id bigint generated always as identity primary key,
  tanggal date not null,
  waktu_makan text not null check (waktu_makan in ('pagi','siang','malam')),
  pasien_id bigint not null references pasien(id),
  menu_id bigint references menu(id),            -- null = belum ada menu / perlu menu pengganti
  porsi int not null default 1,
  status text not null default 'menunggu'
    check (status in ('menunggu','disiapkan','siap','terkirim','dibatalkan')),
  catatan text,
  unique (tanggal, waktu_makan, pasien_id)
);

create table pemakaian_bahan (
  id bigint generated always as identity primary key,
  tanggal date not null,
  waktu_makan text not null,
  bahan_id bigint not null references bahan_makanan(id),
  jumlah numeric not null
);

create table pengembalian_makanan (
  id bigint generated always as identity primary key,
  pesanan_id bigint not null unique references pesanan_makan(id),
  persen_sisa int not null check (persen_sisa in (0,25,50,75,100)),
  alasan text not null check (alasan in
    ('mual','menu_tidak_cocok','nafsu_makan_menurun','pasien_pulang','porsi_terlalu_banyak','lainnya')),
  dicatat_oleh uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ===== Pengajuan =====
create table pengajuan_diet (
  id bigint generated always as identity primary key,
  pasien_id bigint not null references pasien(id),
  diet_lama_id bigint references jenis_diet(id),
  diet_baru_id bigint not null references jenis_diet(id),
  tanggal_berlaku date not null,
  waktu_makan text not null check (waktu_makan in ('pagi','siang','malam')),
  alasan text not null,
  diajukan_oleh uuid references profiles(id),
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  disetujui_oleh uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table pengajuan_pembelian (
  id bigint generated always as identity primary key,
  diajukan_oleh uuid references profiles(id),
  status text not null default 'menunggu'
    check (status in ('menunggu','disetujui','ditolak','diterima')),
  catatan text,
  created_at timestamptz not null default now()
);

create table pengajuan_pembelian_item (
  id bigint generated always as identity primary key,
  pengajuan_id bigint not null references pengajuan_pembelian(id) on delete cascade,
  bahan_id bigint not null references bahan_makanan(id),
  jumlah numeric not null check (jumlah > 0)
);

-- ===== Pengaturan =====
create table pengaturan (
  key text primary key,
  value text not null
);
```

### 4.2 `02_functions.sql`

```sql
-- Role user yang sedang login
create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- Buat profile otomatis saat user dibuat di Auth.
-- Role & nama dibaca dari user_metadata (isi manual saat membuat user di dashboard).
-- PENTING: matikan public signup di Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nama, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'perawat')
  );
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Validasi pesanan: alergi & kesesuaian diet
create or replace function public.validasi_pesanan()
returns trigger language plpgsql as $$
declare p record; m record;
begin
  if new.menu_id is null then return new; end if;
  select alergi, jenis_diet_id into p from pasien where id = new.pasien_id;
  select mengandung_alergen into m from menu where id = new.menu_id;
  if m.mengandung_alergen && p.alergi then
    raise exception 'ALERGI: menu mengandung alergen pasien ini';
  end if;
  if not exists (select 1 from menu_diet
                 where menu_id = new.menu_id and jenis_diet_id = p.jenis_diet_id) then
    raise exception 'Menu tidak sesuai dengan jenis diet pasien';
  end if;
  return new;
end; $$;

create trigger trg_validasi_pesanan
before insert or update of menu_id on pesanan_makan
for each row execute function public.validasi_pesanan();

-- Cut-off pengajuan ubah diet
create or replace function public.cek_cutoff_diet()
returns trigger language plpgsql as $$
declare
  cutoff time;
  sekarang timestamp := now() at time zone 'Asia/Jakarta';
begin
  select value::time into cutoff from pengaturan where key = 'cutoff_' || new.waktu_makan;
  if new.tanggal_berlaku < sekarang::date
     or (new.tanggal_berlaku = sekarang::date and sekarang::time > cutoff) then
    raise exception 'Pengajuan melewati batas waktu (cut-off %)', cutoff;
  end if;
  return new;
end; $$;

create trigger trg_cutoff_diet
before insert on pengajuan_diet
for each row execute function public.cek_cutoff_diet();

-- Generate / sinkronkan pesanan harian dari menu_harian.
-- Aman dijalankan berulang: hanya memperbarui pesanan berstatus 'menunggu'.
create or replace function public.generate_pesanan_harian(p_tanggal date)
returns int language plpgsql security definer set search_path = public as $$
declare jumlah int;
begin
  if current_role_name() not in ('admin','ahli_gizi') then
    raise exception 'Tidak diizinkan';
  end if;

  insert into pesanan_makan (tanggal, waktu_makan, pasien_id, menu_id, catatan)
  select p_tanggal, w.waktu, p.id,
    case when m.id is not null and not (m.mengandung_alergen && p.alergi) then m.id end,
    case when m.id is null then 'Menu harian belum diatur'
         when m.mengandung_alergen && p.alergi then 'Konflik alergi: pilih menu pengganti'
    end
  from pasien p
  cross join (values ('pagi'),('siang'),('malam')) as w(waktu)
  left join menu_harian mh
    on mh.tanggal = p_tanggal and mh.waktu_makan = w.waktu and mh.jenis_diet_id = p.jenis_diet_id
  left join menu m on m.id = mh.menu_id
  where p.status = 'aktif'
  on conflict (tanggal, waktu_makan, pasien_id) do update
    set menu_id = excluded.menu_id, catatan = excluded.catatan
    where pesanan_makan.status = 'menunggu';

  get diagnostics jumlah = row_count;
  return jumlah;
end; $$;

-- Koki menyiapkan 1 sesi makan: cek stok, potong FEFO, ubah status.
-- Jika stok bahan mana pun kurang -> exception -> SEMUA perubahan dibatalkan.
create or replace function public.siapkan_pesanan(p_tanggal date, p_waktu text)
returns void language plpgsql security definer set search_path = public as $$
declare k record; b record; sisa numeric; ambil numeric;
begin
  if current_role_name() not in ('admin','koki') then
    raise exception 'Tidak diizinkan';
  end if;

  for k in
    select r.bahan_id, bm.nama, sum(r.jumlah_per_porsi * pm.porsi) as total
    from pesanan_makan pm
    join resep r on r.menu_id = pm.menu_id
    join bahan_makanan bm on bm.id = r.bahan_id
    where pm.tanggal = p_tanggal and pm.waktu_makan = p_waktu and pm.status = 'menunggu'
    group by r.bahan_id, bm.nama
  loop
    sisa := k.total;
    for b in
      select id, jumlah_sisa from stok_batch
      where bahan_id = k.bahan_id and jumlah_sisa > 0 and tgl_kedaluwarsa >= current_date
      order by tgl_kedaluwarsa, id
      for update
    loop
      exit when sisa <= 0;
      ambil := least(b.jumlah_sisa, sisa);
      update stok_batch set jumlah_sisa = jumlah_sisa - ambil where id = b.id;
      sisa := sisa - ambil;
    end loop;

    if sisa > 0 then
      raise exception 'Stok % tidak cukup (kurang %)', k.nama, sisa;
    end if;

    insert into pemakaian_bahan (tanggal, waktu_makan, bahan_id, jumlah)
    values (p_tanggal, p_waktu, k.bahan_id, k.total);
  end loop;

  update pesanan_makan set status = 'disiapkan'
  where tanggal = p_tanggal and waktu_makan = p_waktu
    and status = 'menunggu' and menu_id is not null;
end; $$;

-- Setujui pengajuan ubah diet -> ubah diet pasien -> sinkronkan pesanan
create or replace function public.setujui_pengajuan_diet(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if current_role_name() not in ('admin','ahli_gizi') then
    raise exception 'Tidak diizinkan';
  end if;
  select * into v from pengajuan_diet where id = p_id and status = 'menunggu';
  if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;

  update pengajuan_diet set status = 'disetujui', disetujui_oleh = auth.uid() where id = p_id;
  update pasien set jenis_diet_id = v.diet_baru_id where id = v.pasien_id;
  perform generate_pesanan_harian(v.tanggal_berlaku);
end; $$;

-- Terima barang dari pengajuan pembelian -> buat batch stok baru
-- p_items contoh: [{"bahan_id":1,"jumlah":20,"tgl_kedaluwarsa":"2026-12-31"}]
create or replace function public.terima_pembelian(p_id bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if current_role_name() not in ('admin','gudang') then
    raise exception 'Tidak diizinkan';
  end if;
  if (select status from pengajuan_pembelian where id = p_id) <> 'disetujui' then
    raise exception 'Pengajuan belum disetujui';
  end if;
  for it in select value from jsonb_array_elements(p_items) loop
    insert into stok_batch (bahan_id, jumlah_sisa, tgl_kedaluwarsa)
    values ((it->>'bahan_id')::bigint, (it->>'jumlah')::numeric, (it->>'tgl_kedaluwarsa')::date);
  end loop;
  update pengajuan_pembelian set status = 'diterima' where id = p_id;
end; $$;
```

### 4.3 `03_views.sql`

Semua view memakai `security_invoker = true` agar RLS tetap berlaku.

```sql
create view v_stok_bahan with (security_invoker = true) as
select b.id, b.nama, b.satuan, b.stok_minimum,
  coalesce(sum(s.jumlah_sisa) filter (where s.tgl_kedaluwarsa >= current_date), 0) as stok_total
from bahan_makanan b
left join stok_batch s on s.bahan_id = b.id
group by b.id;

create view v_near_expiry with (security_invoker = true) as
select s.id as batch_id, b.nama as bahan, b.satuan, s.jumlah_sisa, s.tgl_kedaluwarsa,
  (s.tgl_kedaluwarsa - current_date) as sisa_hari
from stok_batch s
join bahan_makanan b on b.id = s.bahan_id
where s.jumlah_sisa > 0
  and s.tgl_kedaluwarsa <= current_date +
      coalesce((select value::int from pengaturan where key = 'batas_hari_kedaluwarsa'), 3);

create view v_kebutuhan_diet with (security_invoker = true) as
select pm.tanggal, pm.waktu_makan, d.nama as diet, count(*) as jumlah
from pesanan_makan pm
join pasien p on p.id = pm.pasien_id
join jenis_diet d on d.id = p.jenis_diet_id
where pm.status <> 'dibatalkan'
group by pm.tanggal, pm.waktu_makan, d.nama;

create view v_status_bangsal with (security_invoker = true) as
select pm.tanggal, pm.waktu_makan, bg.id as bangsal_id, bg.nama as bangsal,
  pm.status, count(*) as jumlah
from pesanan_makan pm
join pasien p on p.id = pm.pasien_id
join bangsal bg on bg.id = p.bangsal_id
group by pm.tanggal, pm.waktu_makan, bg.id, bg.nama, pm.status;

create view v_food_waste with (security_invoker = true) as
select pm.tanggal, pm.waktu_makan, bg.id as bangsal_id, bg.nama as bangsal,
  m.nama as menu, d.nama as diet, pk.persen_sisa, pk.alasan
from pengembalian_makanan pk
join pesanan_makan pm on pm.id = pk.pesanan_id
join pasien p on p.id = pm.pasien_id
left join bangsal bg on bg.id = p.bangsal_id
left join menu m on m.id = pm.menu_id
left join jenis_diet d on d.id = p.jenis_diet_id;
```

### 4.4 `04_rls.sql`

```sql
-- Aktifkan RLS + semua user login boleh membaca
do $$
declare t text;
begin
  for t in select unnest(array[
    'bangsal','profiles','jenis_diet','pasien','menu','menu_diet','supplier',
    'bahan_makanan','resep','stok_batch','menu_harian','pesanan_makan',
    'pemakaian_bahan','pengembalian_makanan','pengajuan_diet',
    'pengajuan_pembelian','pengajuan_pembelian_item','pengaturan'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "baca_%s" on %I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- Tulis: per tabel, per role (pola: for all = insert/update/delete)
create policy "tulis_bangsal" on bangsal for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

create policy "tulis_pasien" on pasien for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_jenis_diet" on jenis_diet for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_menu" on menu for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_menu_diet" on menu_diet for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_resep" on resep for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_menu_harian" on menu_harian for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_supplier" on supplier for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "tulis_bahan" on bahan_makanan for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "tulis_stok_batch" on stok_batch for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));

-- pesanan_makan: koki mengubah status siap/terkirim; ahli gizi memilih menu pengganti
create policy "tulis_pesanan" on pesanan_makan for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki'))
  with check (current_role_name() in ('admin','ahli_gizi','koki'));

-- Pengembalian makanan
create policy "tulis_pengembalian" on pengembalian_makanan for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki','perawat'))
  with check (current_role_name() in ('admin','ahli_gizi','koki','perawat'));

-- Pengajuan diet: perawat membuat; persetujuan lewat RPC setujui_pengajuan_diet
create policy "buat_pengajuan_diet" on pengajuan_diet for insert to authenticated
  with check (current_role_name() in ('admin','perawat'));
create policy "tolak_pengajuan_diet" on pengajuan_diet for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

-- Pengajuan pembelian
create policy "buat_pembelian" on pengajuan_pembelian for insert to authenticated
  with check (current_role_name() in ('admin','koki'));
create policy "proses_pembelian" on pengajuan_pembelian for update to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "buat_item_pembelian" on pengajuan_pembelian_item for insert to authenticated
  with check (current_role_name() in ('admin','koki'));

-- Pengaturan: hanya admin
create policy "tulis_pengaturan" on pengaturan for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- Profil: admin kelola semua; user lain hanya boleh ubah dirinya TANPA mengubah role
create policy "admin_kelola_profiles" on profiles for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');
create policy "ubah_profil_sendiri" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = current_role_name());
```

Catatan: insert ke `pesanan_makan`, `pemakaian_bahan`, dan perubahan stok oleh alur utama dilakukan lewat RPC `security definer`, jadi tidak perlu policy insert langsung.

### 4.5 `05_seed.sql` (data dummy minimum)

Agent wajib menulis seed berisi:
- `pengaturan`: `cutoff_pagi='06:00'`, `cutoff_siang='09:00'`, `cutoff_malam='15:00'`, `batas_hari_kedaluwarsa='3'`
- 3 bangsal (mis. Melati lt.1, Mawar lt.2, VIP lt.3)
- 5 jenis diet: Normal (biasa), Diet DM, Rendah Garam, Diet Lunak, Diet Cair (dengan batas kalori/natrium)
- 15 bahan makanan (beras, ayam, ikan, telur, tahu, tempe, sayur bayam, wortel, kacang tanah, udang, susu, gula, minyak, garam, buah) + 3 supplier
- 10 menu, tiap menu punya resep 2-4 bahan, `menu_diet` terisi, beberapa menu memiliki `mengandung_alergen` (mis. `{kacang}`, `{udang}`)
- Stok batch: tiap bahan 1-2 batch, **minimal 2 batch hampir kedaluwarsa (<=3 hari)** dan **1 bahan stok di bawah minimum** (untuk demo alert)
- 20 pasien aktif tersebar di 3 bangsal, beberapa dengan alergi
- `menu_harian` untuk hari ini dan 6 hari ke depan
- Data `pengembalian_makanan` historis Â±30 hari (untuk grafik tren). Agar ada pesanan lama, seed boleh insert langsung ke `pesanan_makan` dengan tanggal lampau berstatus `terkirim`.

### 4.6 Setup akun (manual oleh pemilik proyek)
- Supabase > Authentication > matikan **Allow new users to sign up** dan matikan **Confirm email** (untuk development).
- Buat 5 user lewat dashboard dengan **User Metadata**, contoh: `{"nama":"Dina Ahli Gizi","role":"ahli_gizi"}`.
- Akun demo: `admin@nutrismart.test`, `gizi@nutrismart.test`, `koki@nutrismart.test`, `perawat@nutrismart.test`, `gudang@nutrismart.test`.

---

## 5. Role, Menu & Route

Definisikan di `src/lib/roles.js`. `ProtectedRoute` menerima prop `allow` (array role) dan mengarahkan ke `/dashboard` jika tidak berhak. Sidebar hanya menampilkan menu yang boleh diakses role aktif.

| Route | Halaman | admin | ahli_gizi | koki | perawat | gudang |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `/login` | Login | publik | | | | |
| `/dashboard` | Dashboard | v | v | v | v | v |
| `/pasien` | Master pasien | v | v | - | lihat | - |
| `/diet` | Jenis diet | v | v | lihat | lihat | - |
| `/menu` | Menu & resep | v | v | lihat | - | - |
| `/bahan` | Bahan & supplier | v | lihat | lihat | - | v |
| `/bangsal` | Bangsal | v | - | - | - | - |
| `/stok` | Stok & barang masuk | v | lihat | lihat | - | v |
| `/menu-harian` | Menu harian per diet | v | v | lihat | - | - |
| `/pesanan` | Pesanan makan & status | v | v | v | lihat | - |
| `/pengajuan-diet` | Pengajuan ubah diet | v | v | - | v | - |
| `/pengajuan-pembelian` | Pengajuan pembelian | v | - | v | - | v |
| `/pengembalian` | Pengembalian makanan | v | v | v | v | - |
| `/riwayat-makan` | Riwayat makan pasien | v | v | - | lihat | - |
| `/notifikasi` | Notifikasi | v | v | v | v | v |
| `/log-aktivitas` | Log aktivitas | v | - | - | - | - |
| `/laporan` | Laporan | v | v | v | - | v |
| `/grafik` | Grafik | v | v | v | - | v |
| `/pengaturan` | Pengaturan & user | v | - | - | - | - |
| `/profil` | Profil | v | v | v | v | v |

"lihat" = bisa membuka halaman tetapi tombol tambah/ubah/hapus disembunyikan. Pembatasan sebenarnya tetap dijaga RLS.

---

## 6. Perilaku Tiap Modul (spesifikasi UI)

> **Catatan v2:** spesifikasi Pesanan Makan, Pengajuan Diet, Laporan, Dashboard, Notifikasi, dan Riwayat Makan diperbarui di Bagian 14 (T-29 s.d. T-44). Jika bertentangan, **Bagian 14 yang berlaku**.

**Dashboard**
- Kartu ringkasan: total pasien aktif, total porsi hari ini, jumlah bahan di bawah stok minimum, jumlah batch near-expiry.
- Tabel/kartu "Kebutuhan diet hari ini" dari `v_kebutuhan_diet` (filter tanggal hari ini, per waktu makan).
- "Status penyiapan per bangsal" dari `v_status_bangsal` (menunggu / disiapkan / siap / terkirim), tampil sebagai badge berwarna.
- Panel alert: `v_near_expiry` dan `v_stok_bahan` yang `stok_total < stok_minimum`.
- Tampilan sedikit berbeda per role: perawat melihat bangsalnya (dari `profiles.bangsal_id`) saja; gudang menonjolkan alert stok; koki menonjolkan pesanan menunggu.

**Master data (pasien, diet, menu, bahan, supplier, bangsal)**
- Pola sama: `DataTable` dengan pencarian, tombol Tambah, Edit/Hapus via `Modal` + `FormField`.
- Pasien: input alergi sebagai tag; simpan huruf kecil dan trim.
- Menu: form menu + pilih diet yang diizinkan (multi-select) + editor resep (baris bahan + jumlah per porsi).

**Stok**
- Tab 1: daftar stok per bahan (`v_stok_bahan`) dengan badge `Aman` / `Menipis` / `Habis`.
- Tab 2: daftar batch urut `tgl_kedaluwarsa` naik (FEFO), batch near-expiry diberi warna.
- Tombol "Barang masuk": form bahan, jumlah, tanggal kedaluwarsa -> insert `stok_batch`.

**Menu harian**
- Pilih tanggal; grid baris = jenis diet, kolom = pagi/siang/malam; tiap sel dropdown menu (hanya menu yang terdaftar di `menu_diet` untuk diet tsb). Simpan = upsert ke `menu_harian`.

**Pesanan makan**
- Pilih tanggal + waktu makan. Tombol "Generate / sinkronkan pesanan" -> RPC `generate_pesanan_harian`.
- Tabel pesanan per pasien: bangsal, kamar, diet, alergi (badge merah), menu, status, catatan. Baris dengan `menu_id` null dan catatan konflik ditandai kuning; ahli gizi bisa memilih menu pengganti (update `menu_id`, error trigger ditampilkan).
- Tombol "Siapkan sesi ini" (koki) -> RPC `siapkan_pesanan`. Jika error stok, tampilkan pesan dari database.
- Tombol ubah status `disiapkan -> siap -> terkirim` (koki), per bangsal atau per baris.
- Tombol "Cetak label nampan" **[BONUS]**: tampilan cetak (`@media print`) berisi nama, ruang, diet, alergi, menu.

**Pengajuan ubah diet**
- Perawat: form pilih pasien (dibatasi bangsalnya), diet baru, tanggal & waktu makan berlaku, alasan. Error cut-off dari trigger ditampilkan apa adanya.
- Ahli gizi: daftar status `menunggu` dengan tombol Setujui (RPC `setujui_pengajuan_diet`) dan Tolak (update status = `ditolak`).

**Pengajuan pembelian** **[BONUS bila waktu mepet]**
- Koki: form header + baris item (bahan, jumlah). Saran otomatis: bahan di bawah stok minimum.
- Gudang/admin: setujui/tolak; untuk status `disetujui` ada tombol "Terima barang" -> input tanggal kedaluwarsa per item -> RPC `terima_pembelian`.

**Pengembalian makanan**
- Pilih tanggal/waktu, tampil pesanan berstatus `terkirim` yang belum punya catatan pengembalian. Isi `persen_sisa` (0/25/50/75/100) dan `alasan`. Satu pesanan hanya boleh satu catatan.

**Laporan** (semua dengan filter rentang tanggal, tombol "Ekspor CSV" dan "Cetak")
1. Rekap distribusi makanan harian: dari `pesanan_makan` dikelompokkan per tanggal, waktu makan, bangsal, status.
2. Food waste per bangsal: dari `v_food_waste`, rata-rata `persen_sisa`, jumlah kejadian, alasan terbanyak.
3. Pembelian & pemakaian bahan: pemakaian dari `pemakaian_bahan` (jumlah per bahan), pembelian dari `pengajuan_pembelian` + item berstatus `diterima`.

**Grafik** (chart.js)
1. Tren food waste: line, rata-rata `persen_sisa` per hari (toggle harian/bulanan).
2. Distribusi jenis diet: doughnut/pie dari pasien aktif per diet.
3. Konsumsi bahan utama: bar horizontal, top 10 bahan berdasarkan `pemakaian_bahan`.
4. **[BONUS]** Alasan pengembalian terbanyak: bar.

**Pengaturan** (admin)
- Kelola user: daftar `profiles` + ubah role/bangsal. (Pembuatan akun baru dilakukan di dashboard Supabase; jelaskan di UI.)
- Konfigurasi: edit `pengaturan` (cut-off tiap waktu makan, batas hari near-expiry). Batas kalori/natrium diedit di halaman Jenis Diet, tautkan dari sini.

**Profil**
- Lihat nama, role, bangsal. Ubah nama. Ganti password (`supabase.auth.updateUser`).

---

## 7. Daftar Task (kerjakan berurutan)

Format: `[ ] T-xx judul` | file utama | **Selesai kalau**.

### Fase 0: Setup
- [x] **T-01** Inisialisasi proyek Vite + React, install dependency Bagian 2, setup Tailwind v4, `.env.example`, `.gitignore` | `package.json`, `vite.config.js`, `src/index.css` | `npm run dev` jalan dan halaman tes bergaya Tailwind tampil.
- [x] **T-02** Buat folder struktur Bagian 3 dan `supabaseClient.js` | `src/lib/supabaseClient.js` | Client terbaca dari env, tidak ada key di kode.
- [x] **T-03** Tulis `database/01_schema.sql` s.d. `05_seed.sql` sesuai Bagian 4 | `database/*.sql` | Pemilik proyek bisa menjalankan berurutan tanpa error dan tabel terisi seed.

### Fase 1: Auth & Layout
- [x] **T-04** `AuthContext` (session, profile, role, signIn, signOut, loading) | `src/context/AuthContext.jsx` | Setelah login, `profile.role` tersedia; refresh halaman tetap login.
- [x] **T-05** Halaman Login | `pages/Login.jsx` | Login benar masuk ke `/dashboard`, login salah menampilkan toast error.
- [x] **T-06** `roles.js`, `ProtectedRoute`, `AppLayout`, `Sidebar`, `Topbar` | `lib/roles.js`, `components/*` | Sidebar berbeda per role; akses URL terlarang diarahkan ke dashboard.
- [x] **T-07** Komponen UI dasar (Button, Modal, DataTable, Badge, StatCard, FormField, ConfirmDialog, EmptyState, Spinner, PageHeader) | `components/ui/*` | Dipakai ulang di halaman berikutnya, DataTable punya pencarian dan paginasi sederhana.

### Fase 2: Data Master
- [x] **T-08** CRUD Bangsal + Jenis Diet | `pages/master/*`, `services/dietService.js` | Tambah/ubah/hapus berfungsi, tombol disembunyikan untuk role "lihat".
- [x] **T-09** CRUD Pasien (alergi sebagai tag, pilih bangsal & diet) | `pages/master/Pasien.jsx` | Alergi tersimpan huruf kecil; filter per bangsal.
- [x] **T-10** CRUD Supplier + Bahan makanan | `pages/master/Bahan.jsx` | Bahan terhubung ke supplier, satuan wajib.
- [x] **T-11** CRUD Menu + relasi diet + editor resep | `pages/master/Menu.jsx` | Satu menu bisa punya banyak diet dan banyak bahan resep.

### Fase 3: Stok
- [x] **T-12** Halaman Stok: tab ringkasan (`v_stok_bahan`) + tab batch FEFO | `pages/Stok.jsx` | Badge Aman/Menipis/Habis benar; batch urut kedaluwarsa.
- [x] **T-13** Form barang masuk | `pages/Stok.jsx` | Barang masuk menambah batch dan ringkasan stok ter-update.

### Fase 4: Alur Utama
- [x] **T-14** Halaman Menu harian (grid diet x waktu makan) | `pages/MenuHarian.jsx` | Dropdown hanya menampilkan menu valid untuk diet tsb; upsert tersimpan.
- [x] **T-15** Halaman Pesanan makan: generate, tabel, ubah menu pengganti | `pages/PesananMakan.jsx` | Generate mengisi pesanan semua pasien aktif; konflik alergi ditandai.
- [x] **T-16** Tombol "Siapkan sesi" (RPC) + ubah status siap/terkirim | `pages/PesananMakan.jsx`, `services/pesananService.js` | Stok terpotong dari batch paling cepat kedaluwarsa; stok kurang -> pesan error dan tidak ada perubahan.

### Fase 5: Pengajuan & Pengembalian
- [x] **T-17** Pengajuan ubah diet (form perawat + persetujuan ahli gizi) | `pages/PengajuanDiet.jsx` | Pengajuan lewat cut-off ditolak dengan pesan jelas; yang disetujui mengubah diet pasien dan menyinkronkan pesanan.
- [x] **T-18** Pengembalian makanan | `pages/Pengembalian.jsx` | Satu pesanan hanya satu catatan; data muncul di `v_food_waste`.
- [x] **T-19** **[BONUS]** Pengajuan pembelian + penerimaan barang | `pages/PengajuanPembelian.jsx` | Barang diterima membuat batch stok baru.

### Fase 6: Dashboard, Laporan, Grafik
- [x] **T-20** Dashboard (kartu, kebutuhan diet, status bangsal, alert) | `pages/Dashboard.jsx` | Angka cocok dengan data tabel; alert near-expiry dan stok minimum tampil.
- [x] **T-21** Laporan 1-3 + filter tanggal + ekspor CSV + cetak | `pages/Laporan.jsx`, `lib/exportCsv.js` | CSV terunduh dengan kolom benar; cetak menyembunyikan sidebar.
- [x] **T-22** Grafik 1-3 | `pages/Grafik.jsx` | Grafik tampil dari data seed dan berubah mengikuti data.

### Fase 7: Pengaturan, Profil, Keamanan
- [x] **T-23** Pengaturan (user & role, cut-off, near-expiry) | `pages/Pengaturan.jsx` | Mengubah cut-off langsung berpengaruh ke validasi pengajuan.
- [x] **T-24** Profil (ubah nama, ganti password) | `pages/Profil.jsx` | Password baru bisa dipakai login ulang.
- [x] **T-25** Jalankan `04_rls.sql` dan uji tiap role | - | Semua skenario Bagian 11 lulus dengan RLS aktif.

### Fase 8: Finishing
- [x] **T-26** Rapikan UI: loading/empty/error state konsisten, responsif (tablet/HP), judul halaman | semua halaman | Tidak ada halaman blank saat data kosong atau error.
- [ ] **T-27** **[BONUS]** Cetak label nampan, log aktivitas, dark mode | - | Opsional.
- [x] **T-28** README (cara setup, akun demo, urutan SQL, cara menjalankan) + deploy opsional (Vercel/Netlify, tambahkan SPA redirect) | `README.md` | Orang lain bisa menjalankan proyek dari README saja.

### Fase 9: Perbaikan bug (P0) â€” kerjakan paling dulu
Detail lengkap tiap task ada di **Bagian 14.4**.
- [x] **T-29** **[P0]** Perbaiki deteksi alergi (alergen diturunkan dari nama menu, bahan resep, tag alergen) | `database/migrations/06_*.sql`, form Bahan & Pasien & Menu | Alergi `ayam` dan alergi lain terdeteksi; pesanan lama terkoreksi.
- [x] **T-30** **[P0]** "Siapkan Sesi" hanya sekali per tanggal + waktu makan | `database/migrations/07_*.sql`, `pages/PesananMakan.jsx` | Klik kedua ditolak, tombol disabled, stok tidak berubah.
- [ ] **T-31** **[P0]** Perbaiki pencarian (akar masalah di `DataTable`) | `components/ui/DataTable.jsx`, `PesananMakan.jsx`, `PengajuanDiet.jsx`, tabel lain | Pencarian berfungsi di semua halaman paginasi.

### Fase 10: Fitur diminta (P1)
- [x] **T-32** **[P1]** Filter per menu + pilih banyak + ubah status massal | `database/migrations/08_*.sql`, `PesananMakan.jsx` | Satu klik mengubah status seluruh pesanan satu menu.
- [x] **T-33** **[P1]** Riwayat makan pasien untuk ahli gizi **(permintaan dosen)** | `database/migrations/09_*.sql`, `pages/RiwayatMakan.jsx`, `services/riwayatService.js` | Timeline pagi/siang/malam per hari + sisa + kalori; diet lama tetap tersimpan.
- [x] **T-34** **[P1]** Notifikasi: tabel, trigger, RPC, RLS, realtime | `database/migrations/10_*.sql` | Aksi di Bagian 14.5 membuat notifikasi ke penerima yang tepat.
- [ ] **T-35** **[P1]** Notifikasi: lonceng di Topbar, badge di Sidebar, halaman `/notifikasi` | `context/NotifikasiContext.jsx`, `Topbar.jsx`, `Sidebar.jsx`, `pages/Notifikasi.jsx` | Notifikasi muncul tanpa refresh; badge hilang saat halaman dibuka.
- [ ] **T-36** **[P1]** Paginasi tabel Laporan (CSV dan cetak tetap memuat semua data) | `pages/Laporan.jsx` | Tabel per halaman seperti tabel Pasien.

### Fase 11: Peningkatan detail (P2)
- [x] **T-37** **[P2]** Sinkron otomatis saat pasien masuk/pulang/alergi/diet berubah | `database/migrations/11_*.sql` | Pesanan `menunggu` mengikuti perubahan pasien.
- [x] **T-38** **[P2]** Pemantauan asupan: panel "Pasien perlu perhatian" | `database/migrations/12_*.sql`, dashboard, Riwayat Makan | Pasien dengan sisa tinggi ditandai.
- [x] **T-39** **[P2]** Validasi batas kalori/natrium/tekstur diet terhadap menu | `database/migrations/13_*.sql`, form Menu | Menu tidak cocok ditolak dengan pesan jelas.
- [x] **T-40** **[P2]** Log aktivitas + halaman `/log-aktivitas` | `database/migrations/14_*.sql`, `pages/LogAktivitas.jsx` | Siapa mengubah apa dan kapan terlihat oleh admin.
- [x] **T-41** **[P2]** Proyeksi kebutuhan bahan untuk hari berikutnya | `database/migrations/15_*.sql`, `pages/Stok.jsx` | Kebutuhan vs stok dan tombol buat pengajuan pembelian.
- [ ] **T-42** **[P2]** Evaluasi menu berbasis food waste | `pages/Grafik.jsx`, `laporanService.js` | Menu sisa tertinggi + badge "Perlu dievaluasi".
- [x] **T-43** **[P2]** Penyempurnaan Pengajuan Diet (batal, alasan penolakan, filter status) | `database/migrations/16_*.sql`, `PengajuanDiet.jsx` | Pengajuan bisa dibatalkan; penolakan wajib alasan.
- [ ] **T-44** **[P2]** Redesign Dashboard (per role, KPI, progres sesi, alert, grafik, aktivitas) | `pages/Dashboard.jsx` | Rapi di desktop dan HP; angka cocok dengan data.

### Fase 12: Bonus (P3)
- [ ] **T-45** **[P3 BONUS]** Cetak label nampan | `PesananMakan.jsx` | Label per pasien siap cetak.
- [x] **T-46** **[P3 BONUS]** Kartu stok & buang batch kedaluwarsa | migration baru, `Stok.jsx` | Saldo berjalan per bahan.
- [x] **T-47** **[P3 BONUS]** Catatan ahli gizi & dark mode | migration baru | Opsional.

---

## 8. Prioritas

| Level | Task |
|---|---|
| **WAJIB** | T-01 s.d. T-18, T-20, T-21 (min. 1 laporan), T-22 (min. 1 grafik), T-23, T-24, T-25, T-28 |
| **PENTING** | Laporan & grafik lengkap, T-26 |
| **BONUS** | T-19, T-27, grafik alasan pengembalian |
| **Fase perbaikan** | **P0:** T-29, T-30, T-31 -> **P1:** T-32 s.d. T-36 -> **P2:** T-37 s.d. T-44 -> **P3:** T-45 s.d. T-47 (lihat Bagian 14.2 dan 14.3) |

---

## 9. Konvensi Kode

- Satu komponen satu file, nama file = nama komponen (PascalCase). Service dan helper camelCase.
- Pola halaman: `useEffect` memanggil service -> simpan ke state `{data, loading, error}`.
- Penanganan error: `try { ... } catch (e) { toast.error(e.message) }`.
- Format tanggal: simpan `YYYY-MM-DD` ke database, tampilkan `DD MMM YYYY` (locale `id-ID`).
- Tanggal "hari ini" untuk logika bisnis diambil dari zona Asia/Jakarta, bukan UTC.
- Status ditampilkan sebagai `Badge`: menunggu (abu), disiapkan (biru), siap (kuning), terkirim (hijau), dibatalkan (merah).
- Jangan menyalin-tempel CRUD berulang kali tanpa dasar: buat pola `DataTable` + `Modal` + `FormField` yang dipakai ulang.
- Commit Git per task: `feat(T-09): CRUD pasien`.

---

## 10. Keamanan (versi kuliah, tetap wajib)

- Hanya `anon key` di frontend; `.env.local` masuk `.gitignore`.
- Public signup dimatikan; akun dibuat admin.
- RLS aktif di semua tabel (Bagian 4.4). Selama development boleh dinonaktifkan sementara, tetapi **T-25 wajib** mengaktifkannya kembali dan menguji.
- Semua operasi sensitif (potong stok, setujui diet, terima barang) lewat RPC yang memeriksa role di dalamnya.

---

## 11. Skenario Uji Manual

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Login 5 akun demo | Tiap role melihat sidebar berbeda |
| 2 | Perawat membuka `/pengaturan` lewat URL | Diarahkan ke dashboard |
| 3 | Generate pesanan untuk hari ini | Semua pasien aktif punya 3 pesanan; pasien beralergi pada menu berkonflik bertanda "perlu menu pengganti" |
| 4 | Ahli gizi memilih menu mengandung alergen pasien secara manual | Ditolak dengan pesan ALERGI |
| 5 | Koki "Siapkan sesi" dengan stok cukup | Status jadi `disiapkan`; stok berkurang dari batch kedaluwarsa terdekat; `pemakaian_bahan` terisi |
| 6 | Koki "Siapkan sesi" dengan stok kurang | Pesan "Stok X tidak cukup"; stok dan status tidak berubah sama sekali |
| 7 | Perawat mengajukan ubah diet sebelum cut-off | Berhasil, status `menunggu` |
| 8 | Perawat mengajukan ubah diet setelah cut-off | Ditolak dengan pesan cut-off |
| 9 | Ahli gizi menyetujui pengajuan | Diet pasien berubah; pesanan `menunggu` ikut ter-sinkron ke menu diet baru |
| 10 | Catat pengembalian 50% alasan "mual" | Muncul di laporan food waste dan grafik tren |
| 11 | Dashboard | Alert near-expiry dan stok minimum sesuai data seed |
| 12 | Ekspor CSV laporan | File terunduh, isi sesuai filter tanggal |
| 13 | Perawat mencoba ubah data stok lewat console/API | Ditolak RLS |
| 14 | Pasien beralergi `ayam`, generate pesanan untuk hari dengan Bubur Ayam | `menu_id` kosong + catatan "Konflik alergi (ayam)", badge merah |
| 15 | Ahli gizi memilih manual Bubur Ayam untuk pasien alergi ayam | Ditolak: `ALERGI: menu mengandung ayam` |
| 16 | Cari nama pasien / no. RM / menu / status di Pesanan Makan dan Pengajuan Diet | Baris tersaring benar di semua halaman paginasi; hapus pencarian mengembalikan semua |
| 17 | Koki menekan "Siapkan sesi" pagi dua kali (juga dari dua tab) | Kedua kali ditolak, tombol disabled, stok tidak berubah |
| 18 | Siapkan sesi saat masih ada pesanan tanpa menu | Ditolak dengan pesan jumlah pesanan belum bermenu |
| 19 | Koki pilih chip menu "Nasi Goreng" -> pilih semua -> Tandai Siap | Seluruh pesanan menu itu menjadi `siap` sekaligus; toast "N diubah, M dilewati"; `siap_at` terisi |
| 20 | Coba memilih baris berstatus `menunggu` | Checkbox disabled |
| 21 | Ahli gizi membuka Riwayat Makan seorang pasien | Timeline pagi/siang/malam per hari, sisa makanan, kalori harian |
| 22 | Ganti diet pasien lalu lihat riwayat hari sebelumnya | Hari lama tetap menampilkan diet lama |
| 23 | Perawat membuat pengajuan diet | Akun ahli gizi: lonceng +1 dan badge di menu Pengajuan Diet tanpa refresh; hilang setelah halaman dibuka; perawat dinotifikasi saat disetujui/ditolak |
| 24 | Laporan dengan data > 10 baris | Tabel berpaginasi; CSV dan cetak memuat seluruh data |
| 25 | Tambah pasien baru / ubah pasien jadi pulang | Pesanan sesi belum disiapkan tersinkron / dibatalkan |
| 26 | Tautkan menu bernatrium tinggi ke Diet Rendah Garam | Ditolak dengan pesan batas natrium |
| 27 | Admin membuka Log Aktivitas setelah mengubah data pasien | Tercatat dengan nama pelaku, waktu, data lama vs baru |
| 28 | Atur menu harian besok lalu buka tab Kebutuhan di Stok | Kebutuhan, stok, dan kekurangan per bahan tampil |

---

## 12. Risiko & Penanganan

| Risiko | Penanganan |
|---|---|
| Scope terlalu besar | Patuhi prioritas Bagian 8; jangan kerjakan BONUS lebih dulu |
| Data tidak muncul setelah RLS aktif | Cek policy `select` dan role user; gunakan view `security_invoker` |
| RPC error tidak jelas di UI | Tampilkan `error.message` apa adanya (sudah berbahasa Indonesia dari database) |
| Zona waktu salah (cut-off, "hari ini") | Pakai Asia/Jakarta di database; di frontend hitung tanggal lokal, bukan `toISOString()` |
| Seed tidak cukup untuk demo grafik | Pastikan seed memuat data Â±30 hari |
| Agent menambah fitur di luar rencana | Aturan Bagian 0 poin 4, 12, 13 |

---

## 13. Definition of Done

- [x] Semua task WAJIB tercentang
- [x] 9 syarat tugas bisa didemokan: dashboard, database, pengaturan, profil, pengajuan, stock, pengembalian, laporan, grafik
- [x] Skenario uji Bagian 11 lulus dengan RLS aktif
- [x] README lengkap, `.env` tidak ter-commit
- [x] Skenario demo (alur inti) bisa dijalankan dari awal sampai akhir tanpa error
- [ ] Semua task **P0 dan P1** (T-29 s.d. T-36) selesai dan skenario uji 14-24 lulus
- [ ] Task **P2** (T-37 s.d. T-44) selesai dan skenario uji 25-28 lulus
- [ ] Riwayat makan pasien (permintaan dosen) bisa didemokan oleh ahli gizi

---

## 14. Addendum v2: Bug, Penyesuaian & Peningkatan (kerjakan SETELAH T-01 s.d. T-28)

Aplikasi v1 sudah berjalan dan database sudah terisi. Bagian ini berisi bug yang ditemukan pemilik proyek, fitur tambahan (termasuk permintaan dosen), dan hasil audit celah fitur. Semua task di sini bernomor **T-29 dst.** dan mengikuti aturan Bagian 0.

### 14.1 Aturan khusus fase ini

1. **Database sudah live. Jangan edit `01_schema.sql` s.d. `05_seed.sql`.** Semua perubahan skema/function/trigger/view ditulis sebagai file baru di `database/migrations/` dengan nama `NN_nama_singkat.sql` (nomor lanjut dari 06). Pemilik proyek menjalankannya di Supabase SQL Editor.
2. Setiap migration harus **idempotent** (aman dijalankan ulang): `create or replace`, `add column if not exists`, `create table if not exists`, `drop policy if exists` + `create policy`, `drop trigger if exists` + `create trigger`.
3. Satu migration per task. Jika task butuh perubahan function lama, tulis ulang function itu utuh dengan `create or replace` (jangan mengubah signature tanpa `drop function` yang dijelaskan ke pemilik proyek).
4. **Bug: reproduksi dulu, cari akar masalah, baru perbaiki.** Tulis akar masalah satu kalimat di Progress Log. Jangan menambal gejala.
5. Untuk logika tanggal "hari ini" di function baru pakai `hari_ini()` (zona Asia/Jakarta, dibuat di migration 06), bukan `current_date`.
6. Setelah tiap task, jalankan skenario uji terkait di Bagian 11 (baris 14 dst.) dan laporkan hasilnya.
7. Urutan prioritas: **P0** (bug keselamatan/integritas data) > **P1** (diminta pemilik proyek/dosen) > **P2** (peningkatan detail) > **P3** (bonus). Jangan lompat ke level berikutnya sebelum level di atasnya selesai.

### 14.2 Ringkasan masalah, hasil audit & prioritas

**A. Dari pemilik proyek**

| ID | Masalah / permintaan | Prioritas | Task |
|---|---|:-:|---|
| B1 | Alergi "ayam" tidak terdeteksi (hanya kacang & udang) | **P0** | T-29 |
| B2 | "Siapkan Sesi" bisa ditekan berulang meski batch stok sudah terpakai | **P0** | T-30 |
| B3 | Pencarian di Pesanan Makan dan Pengajuan Diet tidak berfungsi | **P0** | T-31 |
| F1 | Koki bisa filter per menu + pilih banyak/semua lalu ubah status sekaligus | **P1** | T-32 |
| F2 | Ahli gizi bisa melihat riwayat makan pasien (pagi/siang/malam) **[permintaan dosen]** | **P1** | T-33 |
| F3 | Notifikasi (lonceng + badge di sidebar) untuk semua role | **P1** | T-34, T-35 |
| F4 | Tabel di Laporan terlalu panjang: beri paginasi seperti tabel Pasien | **P1** | T-36 |
| F5 | Tampilan dashboard ditingkatkan | P2 | T-44 |

**B. Hasil audit celah fitur (agar lebih detail sesuai harapan dosen)**

| ID | Celah yang ditemukan | Dampak | Prioritas | Task |
|---|---|---|:-:|---|
| G1 | Alergen menu hanya diinput manual, tidak diturunkan dari bahan resep | Keselamatan pasien (akar B1) | P0 | T-29 |
| G2 | Pesanan `menunggu` tanpa menu (konflik alergi belum dibereskan) lolos "Siapkan Sesi", pasien tidak dapat makan | Integritas alur | P0 | T-30 |
| G3 | Diet pasien tidak disimpan per pesanan: kalau diet berubah, riwayat lama ikut berubah | Riwayat tidak akurat | P1 | T-33 |
| G4 | Pasien baru masuk / pulang / alergi atau diet diubah setelah pesanan dibuat tidak tersinkron otomatis | Data pesanan basi | P2 | T-37 |
| G5 | Tidak ada pemantauan asupan: pasien yang makannya terus sisa tidak ditandai | Nilai klinis (inti gizi RS) | P2 | T-38 |
| G6 | Batas kalori/natrium dan tekstur diet belum divalidasi terhadap menu (hanya tersimpan) | Aturan diet tidak ditegakkan | P2 | T-39 |
| G7 | Tidak ada jejak audit: siapa mengubah apa dan kapan; status pesanan tanpa waktu | Akuntabilitas RS | P2 | T-32, T-40 |
| G8 | Tidak ada proyeksi kebutuhan bahan untuk hari berikutnya | Nyambung stok dan pembelian | P2 | T-41 |
| G9 | Food waste belum dipakai untuk mengevaluasi menu | Analisis berguna untuk dosen | P2 | T-42 |
| G10 | Pengajuan diet tidak bisa dibatalkan perawat; penolakan tanpa alasan | Alur kurang lengkap | P2 | T-43 |
| G11 | Label nampan, kartu stok, buang batch kedaluwarsa, catatan ahli gizi | Pelengkap | P3 | T-45 s.d. T-47 |

### 14.3 Urutan eksekusi

```
P0  T-29 alergi  ->  T-30 sesi sekali  ->  T-31 pencarian
P1  T-32 filter+bulk status  ->  T-33 riwayat makan  ->  T-34 notifikasi (DB)
    ->  T-35 notifikasi (UI)  ->  T-36 paginasi laporan
P2  T-37 sinkron pasien  ->  T-38 asupan  ->  T-39 validasi gizi  ->  T-40 log aktivitas
    ->  T-41 kebutuhan bahan  ->  T-42 evaluasi menu  ->  T-43 pengajuan diet  ->  T-44 dashboard
P3  T-45, T-46, T-47 (bonus)
```

Alasan urutan: T-29 menyangkut keselamatan pasien; T-30 melindungi stok; T-31 memperbaiki komponen bersama (`DataTable`) yang dipakai T-32 dan seterusnya; T-32 menambah kolom waktu status yang dipakai T-33; T-34/T-35 harus ada sebelum dashboard (T-44) agar feed aktivitas bisa dipakai. Dashboard boleh dipercepat setelah T-35 bila pemilik proyek menginginkan, widget yang bergantung task lain ditambahkan menyusul.

---

### 14.4 Spesifikasi per task

#### T-29 [P0] Perbaiki deteksi alergi

**Akar masalah (hasil analisis):** konflik alergi dihitung dari `menu.mengandung_alergen && pasien.alergi`. `mengandung_alergen` diisi manual dan di seed hanya berisi `kacang` dan `udang`. Alergi lain (ayam, telur, dll.) tidak pernah terdeteksi walau bahan resep jelas mengandungnya.

**Solusi:** alergen menu **diturunkan otomatis** dari: (1) tag manual menu, (2) nama menu, (3) nama bahan di resep, (4) tag `alergen` baru di bahan. Pencocokan memakai substring huruf kecil (alergi `ayam` cocok dengan bahan `Daging Ayam` dan menu `Bubur Ayam`). Ini sengaja konservatif (lebih baik peringatan berlebih daripada terlewat), contoh: alergi `kacang` juga cocok dengan `kacang hijau`.

**Migration `06_fix_alergi_dan_fondasi.sql`** (berisi juga fondasi untuk T-30 s.d. T-33):

```sql
-- Hari ini versi Asia/Jakarta
create or replace function public.hari_ini()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

-- Tag alergen pada bahan (opsional, tambahan di luar nama bahan)
alter table bahan_makanan add column if not exists alergen text[] not null default '{}';

-- Semua istilah alergen efektif sebuah menu
create or replace function public.alergen_menu(p_menu_id bigint)
returns text[] language sql stable as $$
  select coalesce(array_agg(distinct lower(trim(a))), '{}')
  from (
    select unnest(m.mengandung_alergen) as a from menu m where m.id = p_menu_id
    union all select m.nama from menu m where m.id = p_menu_id
    union all select b.nama from resep r join bahan_makanan b on b.id = r.bahan_id where r.menu_id = p_menu_id
    union all select unnest(b.alergen) from resep r join bahan_makanan b on b.id = r.bahan_id where r.menu_id = p_menu_id
  ) x
  where a is not null and trim(a) <> ''
$$;

-- Daftar alergi pasien yang bentrok dengan menu ('{}' = aman)
create or replace function public.konflik_alergi(p_menu_id bigint, p_alergi text[])
returns text[] language sql stable as $$
  select coalesce(array_agg(distinct t), '{}')
  from (select lower(trim(x)) as t from unnest(p_alergi) x) q
  where t <> ''
    and exists (select 1 from unnest(alergen_menu(p_menu_id)) a where a like '%' || t || '%')
$$;

-- Trigger validasi pesanan (menggantikan versi lama)
create or replace function public.validasi_pesanan()
returns trigger language plpgsql as $$
declare p record; bentrok text[];
begin
  if new.menu_id is null then return new; end if;
  select alergi, jenis_diet_id into p from pasien where id = new.pasien_id;
  bentrok := konflik_alergi(new.menu_id, p.alergi);
  if cardinality(bentrok) > 0 then
    raise exception 'ALERGI: menu mengandung % (alergi pasien)', array_to_string(bentrok, ', ');
  end if;
  if not exists (select 1 from menu_diet
                 where menu_id = new.menu_id and jenis_diet_id = p.jenis_diet_id) then
    raise exception 'Menu tidak sesuai dengan jenis diet pasien';
  end if;
  return new;
end; $$;

-- Fondasi pesanan: snapshot diet + waktu & pelaku perubahan status
alter table pesanan_makan
  add column if not exists jenis_diet_id bigint references jenis_diet(id),
  add column if not exists disiapkan_at timestamptz,
  add column if not exists siap_at timestamptz,
  add column if not exists terkirim_at timestamptz,
  add column if not exists diubah_oleh uuid references profiles(id);

update pesanan_makan pm set jenis_diet_id = p.jenis_diet_id
from pasien p where p.id = pm.pasien_id and pm.jenis_diet_id is null;

-- Sesi makan yang sudah disiapkan (1 baris = 1 tanggal + waktu makan, hanya sekali)
create table if not exists sesi_makan (
  id bigint generated always as identity primary key,
  tanggal date not null,
  waktu_makan text not null check (waktu_makan in ('pagi','siang','malam')),
  disiapkan_oleh uuid references profiles(id),
  disiapkan_at timestamptz not null default now(),
  jumlah_pesanan int,
  unique (tanggal, waktu_makan)
);
alter table sesi_makan enable row level security;
drop policy if exists "baca_sesi_makan" on sesi_makan;
create policy "baca_sesi_makan" on sesi_makan for select to authenticated using (true);

-- Data lama: sesi yang pesanannya sudah diproses dianggap sudah disiapkan
insert into sesi_makan (tanggal, waktu_makan, jumlah_pesanan)
select tanggal, waktu_makan, count(*) from pesanan_makan
where status in ('disiapkan','siap','terkirim')
group by tanggal, waktu_makan
on conflict do nothing;

-- Sinkronisasi pesanan (tanpa cek role, dipakai internal & trigger)
create or replace function public._sinkron_pesanan(p_tanggal date)
returns int language plpgsql security definer set search_path = public as $$
declare jumlah int;
begin
  insert into pesanan_makan (tanggal, waktu_makan, pasien_id, menu_id, catatan, jenis_diet_id)
  select p_tanggal, w.waktu, p.id,
    case when m.id is not null and cardinality(konflik_alergi(m.id, p.alergi)) = 0 then m.id end,
    case when m.id is null then 'Menu harian belum diatur'
         when cardinality(konflik_alergi(m.id, p.alergi)) > 0
           then 'Konflik alergi (' || array_to_string(konflik_alergi(m.id, p.alergi), ', ')
                || '): pilih menu pengganti'
    end,
    p.jenis_diet_id
  from pasien p
  cross join (values ('pagi'),('siang'),('malam')) as w(waktu)
  left join menu_harian mh
    on mh.tanggal = p_tanggal and mh.waktu_makan = w.waktu and mh.jenis_diet_id = p.jenis_diet_id
  left join menu m on m.id = mh.menu_id
  where p.status = 'aktif'
    and not exists (select 1 from sesi_makan s
                    where s.tanggal = p_tanggal and s.waktu_makan = w.waktu)
  on conflict (tanggal, waktu_makan, pasien_id) do update
    set menu_id = excluded.menu_id, catatan = excluded.catatan,
        jenis_diet_id = excluded.jenis_diet_id
    where pesanan_makan.status = 'menunggu';
  get diagnostics jumlah = row_count;
  return jumlah;
end; $$;

create or replace function public.generate_pesanan_harian(p_tanggal date)
returns int language plpgsql security definer set search_path = public as $$
begin
  if current_role_name() not in ('admin','ahli_gizi') then
    raise exception 'Tidak diizinkan';
  end if;
  return _sinkron_pesanan(p_tanggal);
end; $$;

-- Koreksi data lama: sinkronkan ulang semua pesanan yang masih 'menunggu'
do $$
declare d date;
begin
  for d in select distinct tanggal from pesanan_makan where status = 'menunggu' loop
    perform _sinkron_pesanan(d);
  end loop;
end $$;
```

**Perubahan frontend:**
- Form **Bahan makanan**: tambah field "Alergen (tag, opsional)" dengan saran (kacang, udang, telur, susu, ikan, ayam, gluten, kedelai); simpan huruf kecil.
- Form **Pasien**: input alergi tetap tag bebas, simpan `trim().toLowerCase()`. Tampilkan saran (datalist) dari gabungan nama bahan + tag alergen yang ada. Beri teks bantuan: "Alergi dicocokkan dengan nama menu, nama bahan, dan tag alergen."
- Form **Menu**: field `mengandung_alergen` tetap ada tetapi diberi keterangan bahwa alergen dari bahan resep terdeteksi otomatis.
- Halaman **Pesanan makan**: konflik alergi tampil sebagai badge merah berisi nama alergi yang bentrok (ambil dari kolom `catatan`).

**Selesai kalau:** pasien dengan alergi `ayam` mendapat pesanan `menu_id = null` + catatan konflik pada menu berbahan/bernama ayam (mis. Bubur Ayam); memilih menu itu manual ditolak dengan pesan `ALERGI: menu mengandung ayam`; alergi `telur`, `ikan`, `susu` juga terdeteksi; pesanan lama yang masih `menunggu` ikut terkoreksi.

#### T-30 [P0] "Siapkan Sesi" hanya bisa sekali per sesi

**Akar masalah:** tidak ada penanda bahwa suatu (tanggal, waktu makan) sudah disiapkan; UI selalu memanggil RPC dan menampilkan toast sukses; pesanan susulan berstatus `menunggu` bisa memicu pemotongan stok lagi.

**Aturan:** satu (tanggal, waktu makan) hanya boleh disiapkan **satu kali**. Pesanan susulan setelah sesi disiapkan tidak dibuat/diubah oleh sinkronisasi (sudah ditangani `_sinkron_pesanan` di T-29).

**Migration `07_siapkan_sesi_sekali.sql`:**

```sql
create or replace function public.siapkan_pesanan(p_tanggal date, p_waktu text)
returns void language plpgsql security definer set search_path = public as $$
declare k record; b record; sisa numeric; ambil numeric; n int; n_tanpa_menu int;
begin
  if current_role_name() not in ('admin','koki') then
    raise exception 'Tidak diizinkan';
  end if;

  -- cegah klik ganda / dua koki bersamaan
  perform pg_advisory_xact_lock(hashtext('siapkan_' || p_tanggal::text || '_' || p_waktu));

  if exists (select 1 from sesi_makan where tanggal = p_tanggal and waktu_makan = p_waktu) then
    raise exception 'Sesi % tanggal % sudah pernah disiapkan dan tidak bisa diulang', p_waktu, p_tanggal;
  end if;

  select count(*) into n_tanpa_menu from pesanan_makan
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is null;
  if n_tanpa_menu > 0 then
    raise exception '% pesanan belum punya menu (konflik alergi / menu harian belum diatur). Selesaikan dulu sebelum menyiapkan sesi', n_tanpa_menu;
  end if;

  select count(*) into n from pesanan_makan
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is not null;
  if n = 0 then
    raise exception 'Tidak ada pesanan yang bisa disiapkan untuk sesi ini';
  end if;

  for k in
    select r.bahan_id, bm.nama, sum(r.jumlah_per_porsi * pm.porsi) as total
    from pesanan_makan pm
    join resep r on r.menu_id = pm.menu_id
    join bahan_makanan bm on bm.id = r.bahan_id
    where pm.tanggal = p_tanggal and pm.waktu_makan = p_waktu and pm.status = 'menunggu'
    group by r.bahan_id, bm.nama
  loop
    sisa := k.total;
    for b in
      select id, jumlah_sisa from stok_batch
      where bahan_id = k.bahan_id and jumlah_sisa > 0 and tgl_kedaluwarsa >= hari_ini()
      order by tgl_kedaluwarsa, id
      for update
    loop
      exit when sisa <= 0;
      ambil := least(b.jumlah_sisa, sisa);
      update stok_batch set jumlah_sisa = jumlah_sisa - ambil where id = b.id;
      sisa := sisa - ambil;
    end loop;

    if sisa > 0 then
      raise exception 'Stok % tidak cukup (kurang %)', k.nama, sisa;
    end if;

    insert into pemakaian_bahan (tanggal, waktu_makan, bahan_id, jumlah)
    values (p_tanggal, p_waktu, k.bahan_id, k.total);
  end loop;

  update pesanan_makan
  set status = 'disiapkan', disiapkan_at = now(), diubah_oleh = auth.uid()
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is not null;

  insert into sesi_makan (tanggal, waktu_makan, disiapkan_oleh, jumlah_pesanan)
  values (p_tanggal, p_waktu, auth.uid(), n);
end; $$;
```

**Perubahan frontend (`PesananMakan.jsx`):**
- Ambil `sesi_makan` untuk tanggal terpilih. Tiap tab waktu makan menampilkan lencana: `Belum disiapkan` atau `Sudah disiapkan oleh {nama} pukul {HH:mm}`.
- Jika sesi sudah ada: tombol "Siapkan sesi ini" **dinonaktifkan** (disabled) dengan teks "Sesi sudah disiapkan". Tombol "Generate / sinkronkan" untuk sesi itu juga memberi peringatan bahwa pesanan tidak akan berubah.
- Saat klik: tombol langsung `loading` + disabled sampai RPC selesai (cegah klik ganda). Toast sukses **hanya** bila RPC sukses; jika error tampilkan pesan database apa adanya.
- Jika ada pesanan tanpa menu di sesi itu: tampilkan banner kuning "N pesanan belum punya menu" + tombol "Tampilkan yang bermasalah" (set filter), dan tombol Siapkan disabled.

**Selesai kalau:** menekan "Siapkan sesi" kedua kali (termasuk dari dua tab browser bersamaan) selalu ditolak dan stok tidak berubah; tiap hari tiga sesi (pagi, siang, malam) masing-masing bisa disiapkan tepat sekali; sesi dengan pesanan tanpa menu tidak bisa disiapkan.

#### T-31 [P0] Perbaiki pencarian (Pesanan Makan, Pengajuan Diet, dan tabel lain)

**Dugaan akar masalah (agent wajib memverifikasi):** `DataTable` hanya mencari pada properti string tingkat atas, sedangkan data halaman ini berupa objek relasi (`pasien.nama`, `menu.nama`, `diet.nama`) atau kolom dengan `render` kustom; atau input search tidak terhubung ke state filter; atau pencarian hanya memfilter halaman yang sedang tampil.

**Spesifikasi:**
- Perbaiki di komponen bersama `DataTable` agar semua halaman ikut sembuh. Tambah prop `searchFields` (array string path seperti `'pasien.nama'` atau fungsi `(row) => string`). Jika tidak diberi, fallback: gabungkan semua nilai primitif baris (rekursif satu level).
- Pencarian: case-insensitive, `trim`, cocok sebagian, memfilter **seluruh data** (bukan hanya halaman aktif), lalu halaman direset ke 1.
- Field pencarian per halaman:
  - Pesanan Makan: nama pasien, no. RM, kamar, bangsal, menu, diet, status, catatan.
  - Pengajuan Diet: nama pasien, no. RM, diet lama, diet baru, alasan, status, pengaju.
  - Periksa dan perbaiki juga: Pengembalian, Pengajuan Pembelian, Stok (batch), Pasien, Menu, Bahan.
- Tampilkan "Tidak ada hasil untuk '{kata}'" (EmptyState) bila kosong, dan tombol "Hapus pencarian".

**Selesai kalau:** mengetik nama pasien, no. RM, nama menu, atau status di Pesanan Makan dan Pengajuan Diet menyaring baris dengan benar di semua halaman paginasi; skenario uji 16 lulus.

#### T-32 [P1] Pesanan Makan: filter per menu + pilih banyak + ubah status massal

**Kebutuhan:** koki memfilter pasien per menu (mis. pagi ada Nasi Goreng, Bubur Ayam, Soto), memilih beberapa atau semua, lalu mengubah status sekaligus tanpa klik satu per satu.

**Aturan status:** `menunggu` -> `disiapkan` hanya lewat "Siapkan sesi" (T-30). Setelah itu koki mengubah `disiapkan` -> `siap` -> `terkirim` (boleh langsung `disiapkan` -> `terkirim`). Tidak ada mundur. Status `menunggu` dan `dibatalkan` tidak bisa dipilih untuk perubahan massal.

**Migration `08_ubah_status_massal.sql`:**

```sql
create or replace function public.ubah_status_pesanan(p_ids bigint[], p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids bigint[]; diubah int; total int;
begin
  if current_role_name() not in ('admin','koki') then
    raise exception 'Tidak diizinkan';
  end if;
  if p_status not in ('siap','terkirim') then
    raise exception 'Status tujuan tidak valid';
  end if;
  total := coalesce(array_length(p_ids, 1), 0);

  with u as (
    update pesanan_makan set
      status = p_status,
      siap_at = case when p_status = 'siap' then now()
                     when p_status = 'terkirim' then coalesce(siap_at, now())
                     else siap_at end,
      terkirim_at = case when p_status = 'terkirim' then now() else terkirim_at end,
      diubah_oleh = auth.uid()
    where id = any(p_ids)
      and ((p_status = 'siap' and status = 'disiapkan')
        or (p_status = 'terkirim' and status in ('disiapkan','siap')))
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from u;

  diubah := cardinality(v_ids);
  return jsonb_build_object('diubah', diubah, 'dilewati', total - diubah);
end; $$;
```

**Frontend (`PesananMakan.jsx`):**
- Filter bar: Tanggal, Waktu makan (tab), Bangsal, Diet, Status, **Menu**, dan kolom pencarian (sudah diperbaiki di T-31).
- **Filter Menu** berbentuk deretan chip di atas tabel: `Semua (45)`, `Nasi Goreng (18)`, `Bubur Ayam (15)`, `Soto (12)`. Jumlah dihitung dari data tanggal + waktu makan terpilih sebelum filter menu; klik chip memfilter tabel; chip aktif diberi warna. Tambahkan juga baris ringkas "Rekap produksi" (menu x jumlah porsi) agar koki tahu berapa yang dimasak.
- Kolom **checkbox** di tiap baris. Header checkbox = pilih semua hasil filter (lintas halaman paginasi). Tampilkan teks "24 dipilih dari 24 (semua halaman)" dengan tautan "Hanya halaman ini". Pilihan dipertahankan saat pindah halaman dan direset saat filter/tanggal/waktu berubah. Baris berstatus `menunggu`/`dibatalkan` punya checkbox disabled dengan tooltip.
- **Bulk action bar** (sticky di atas/bawah tabel, muncul bila ada yang dipilih): `N dipilih`, tombol **Tandai Siap**, **Tandai Terkirim**, **Batal pilih**. Tombol memanggil RPC `ubah_status_pesanan`. Jika > 20 baris, minta konfirmasi (`ConfirmDialog`). Tampilkan toast "12 diubah, 2 dilewati".
- Pintasan per chip menu: tombol kecil "Pilih semua {menu}" untuk memilih seluruh pesanan menu itu.
- Pilihan ukuran halaman: 10 / 25 / 50 / 100.
- Hanya `koki` dan `admin` melihat checkbox dan bulk bar. Role lain hanya filter dan lihat.

**Selesai kalau:** koki memilih chip "Nasi Goreng", memilih semua, menekan "Tandai Siap" dan seluruh pesanan nasi goreng sesi itu berubah dalam satu klik; baris di status tidak valid dilewati dan dilaporkan; kolom `siap_at`/`terkirim_at`/`diubah_oleh` terisi.

#### T-33 [P1] Riwayat makan pasien untuk ahli gizi (permintaan dosen)

**Kebutuhan:** ahli gizi dapat melihat apa saja yang dimakan pasien, terlacak pagi/siang/malam per hari, beserta sisa makanan dan perubahan diet.

**Migration `09_riwayat_makan.sql`:**

```sql
create or replace view v_riwayat_makan with (security_invoker = true) as
select pm.id as pesanan_id, pm.pasien_id, p.no_rm, p.nama as pasien,
  pm.tanggal, pm.waktu_makan, pm.status,
  m.nama as menu, m.kalori, m.natrium, d.nama as diet,
  pk.persen_sisa, pk.alasan,
  case when pk.persen_sisa is null or m.kalori is null then null
       else round(m.kalori * (100 - pk.persen_sisa) / 100.0) end as kalori_dikonsumsi,
  case when pk.persen_sisa is null or m.natrium is null then null
       else round(m.natrium * (100 - pk.persen_sisa) / 100.0) end as natrium_dikonsumsi,
  pm.catatan, pm.disiapkan_at, pm.siap_at, pm.terkirim_at
from pesanan_makan pm
join pasien p on p.id = pm.pasien_id
left join menu m on m.id = pm.menu_id
left join jenis_diet d on d.id = coalesce(pm.jenis_diet_id, p.jenis_diet_id)
left join pengembalian_makanan pk on pk.pesanan_id = pm.id;
```

**Halaman baru `/riwayat-makan` (`pages/RiwayatMakan.jsx`, `services/riwayatService.js`):**
- Akses: `ahli_gizi`, `admin`; `perawat` lihat saja. Tautan "Riwayat makan" juga ada di baris tabel halaman Pasien (`/riwayat-makan?pasien=ID`).
- **Pemilih pasien** dengan pencarian (nama / no. RM / kamar) dan filter bangsal. **Rentang tanggal** (default 7 hari, preset 7/14/30 hari + kustom).
- **Kartu profil pasien**: nama, no. RM, bangsal/kamar, diagnosa, alergi (badge merah), diet saat ini, tanggal masuk.
- **Kartu ringkasan** (rentang terpilih): rata-rata sisa makanan (%), rata-rata kalori dikonsumsi per hari, jumlah makan tercatat, jumlah makan **belum dicatat** (terkirim tapi belum ada data pengembalian).
- **Timeline per hari**: satu baris per tanggal dengan tiga kolom Pagi | Siang | Malam. Tiap sel: nama menu, badge status, bar persen sisa + alasan, kalori. Sel kosong tampil "-". Baris total harian (kalori, natrium, rata-rata sisa). Tanggal terbaru di atas, paginasi bila panjang.
- **Grafik** (chart.js): batang kalori dikonsumsi per hari + garis rata-rata sisa (%).
- **Riwayat perubahan diet**: daftar `pengajuan_diet` berstatus `disetujui` untuk pasien itu (tanggal, diet lama -> baru, alasan, disetujui oleh).
- Tombol Ekspor CSV dan Cetak (ringkasan + timeline).
- Di halaman **Pengembalian**: tambah aksi massal "Catat semua habis (0%)" untuk pesanan terkirim yang belum dicatat pada filter aktif, supaya data riwayat tidak kosong karena perawat belum sempat input.

**Selesai kalau:** ahli gizi memilih seorang pasien dan melihat menu pagi/siang/malam tiap hari, sisa makanan, dan total kalori harian; saat diet pasien diganti, hari-hari sebelumnya tetap menampilkan diet lamanya (berkat snapshot `pesanan_makan.jenis_diet_id`).

#### T-34 [P1] Notifikasi: database

**Desain:** satu baris notifikasi **per penerima** (fan-out), dibuat oleh trigger/RPC bertipe `security definer`. Penerima hanya bisa membaca dan menandai-dibaca notifikasinya sendiri.

**Migration `10_notifikasi.sql`:**

```sql
create table if not exists notifikasi (
  id bigint generated always as identity primary key,
  penerima_id uuid not null references profiles(id) on delete cascade,
  judul text not null,
  pesan text,
  rute text not null,                 -- mis. '/pengajuan-diet' (dipakai badge sidebar)
  tipe text not null default 'info' check (tipe in ('info','sukses','peringatan','bahaya')),
  dibaca boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_penerima
  on notifikasi (penerima_id, dibaca, created_at desc);

alter table notifikasi enable row level security;
drop policy if exists "baca_notif_sendiri" on notifikasi;
create policy "baca_notif_sendiri" on notifikasi for select to authenticated
  using (penerima_id = auth.uid());
drop policy if exists "ubah_notif_sendiri" on notifikasi;
create policy "ubah_notif_sendiri" on notifikasi for update to authenticated
  using (penerima_id = auth.uid()) with check (penerima_id = auth.uid());

-- Aktifkan Realtime untuk tabel ini
do $$ begin
  alter publication supabase_realtime add table notifikasi;
exception when duplicate_object then null;
end $$;

-- Kirim notifikasi ke role tertentu / user tertentu (pelaku aksi tidak ikut dinotifikasi)
create or replace function public.kirim_notifikasi(
  p_roles text[], p_judul text, p_pesan text, p_rute text,
  p_tipe text default 'info', p_bangsal_id bigint default null,
  p_user_id uuid default null, p_dedupe boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifikasi (penerima_id, judul, pesan, rute, tipe)
  select pr.id, p_judul, p_pesan, p_rute, p_tipe
  from profiles pr
  where pr.id is distinct from auth.uid()
    and ( (pr.role = any(p_roles)
           and (p_bangsal_id is null or pr.role <> 'perawat' or pr.bangsal_id = p_bangsal_id))
          or pr.id = p_user_id )
    and ( not p_dedupe or not exists (
          select 1 from notifikasi n
          where n.penerima_id = pr.id and n.dibaca = false
            and n.judul = p_judul and n.pesan is not distinct from p_pesan) );
end; $$;

-- Cek stok menipis (dipanggil setelah stok berkurang)
create or replace function public.cek_stok_menipis()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select nama, satuan, stok_total, stok_minimum
           from v_stok_bahan where stok_total < stok_minimum loop
    perform kirim_notifikasi(array['gudang','admin','koki'],
      'Stok menipis: ' || r.nama,
      'Sisa ' || r.stok_total || ' ' || r.satuan || ' (minimum ' || r.stok_minimum || ')',
      '/stok', 'peringatan', null, null, true);
  end loop;
end; $$;

-- Trigger: pengajuan diet
create or replace function public.trg_notif_pengajuan_diet()
returns trigger language plpgsql security definer set search_path = public as $$
declare nama_pasien text;
begin
  select nama into nama_pasien from pasien where id = new.pasien_id;
  if tg_op = 'INSERT' then
    perform kirim_notifikasi(array['ahli_gizi','admin'], 'Pengajuan ubah diet baru',
      'Pasien ' || nama_pasien || ' diajukan ubah diet', '/pengajuan-diet', 'info');
  elsif new.status is distinct from old.status then
    perform kirim_notifikasi(array[]::text[], 'Pengajuan diet ' || new.status,
      'Pasien ' || nama_pasien, '/pengajuan-diet',
      case when new.status = 'disetujui' then 'sukses' else 'peringatan' end,
      null, new.diajukan_oleh);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notif_pengajuan_diet on pengajuan_diet;
create trigger trg_notif_pengajuan_diet after insert or update on pengajuan_diet
  for each row execute function public.trg_notif_pengajuan_diet();

-- Trigger: pengajuan pembelian
create or replace function public.trg_notif_pembelian()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform kirim_notifikasi(array['gudang','admin'], 'Pengajuan pembelian baru',
      'Pengajuan #' || new.id || ' menunggu persetujuan', '/pengajuan-pembelian', 'info');
  elsif new.status is distinct from old.status then
    perform kirim_notifikasi(array[]::text[], 'Pembelian ' || new.status,
      'Pengajuan #' || new.id, '/pengajuan-pembelian',
      case when new.status in ('disetujui','diterima') then 'sukses' else 'peringatan' end,
      null, new.diajukan_oleh);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notif_pembelian on pengajuan_pembelian;
create trigger trg_notif_pembelian after insert or update on pengajuan_pembelian
  for each row execute function public.trg_notif_pembelian();

-- Trigger: pengembalian dengan sisa tinggi
create or replace function public.trg_notif_pengembalian()
returns trigger language plpgsql security definer set search_path = public as $$
declare nama_pasien text;
begin
  if new.persen_sisa >= 75 then
    select p.nama into nama_pasien from pesanan_makan pm
      join pasien p on p.id = pm.pasien_id where pm.id = new.pesanan_id;
    perform kirim_notifikasi(array['ahli_gizi'], 'Sisa makanan tinggi',
      nama_pasien || ': sisa ' || new.persen_sisa || '% (' || new.alasan || ')',
      '/pengembalian', 'peringatan');
  end if;
  return new;
end; $$;
drop trigger if exists trg_notif_pengembalian on pengembalian_makanan;
create trigger trg_notif_pengembalian after insert on pengembalian_makanan
  for each row execute function public.trg_notif_pengembalian();

-- Trigger: menu harian diubah (hanya untuk hari ini/besok)
create or replace function public.trg_notif_menu_harian()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tanggal between hari_ini() and hari_ini() + 1 then
    perform kirim_notifikasi(array['koki'], 'Menu harian diperbarui',
      'Tanggal ' || to_char(new.tanggal, 'DD/MM/YYYY'), '/menu-harian', 'info', null, null, true);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notif_menu_harian on menu_harian;
create trigger trg_notif_menu_harian after insert or update on menu_harian
  for each row execute function public.trg_notif_menu_harian();
```

**Tambahan di function lama** (tulis ulang utuh dengan `create or replace`, tambahkan baris `perform` di bagian akhir):
- `generate_pesanan_harian`: simpan hasil `_sinkron_pesanan` ke variabel `jumlah`; jika `jumlah > 0` -> `kirim_notifikasi(array['koki','admin'], 'Pesanan makan diperbarui', jumlah || ' pesanan untuk ' || to_char(p_tanggal,'DD/MM/YYYY'), '/pesanan', 'info', null, null, true)`. Hitung juga pesanan `menunggu` dengan `menu_id is null` dan `catatan like 'Konflik alergi%'` pada tanggal itu; jika > 0 -> notifikasi `bahaya` ke `ahli_gizi` dan `admin` ("N pesanan butuh menu pengganti karena alergi", rute `/pesanan`, dedupe true).
- `siapkan_pesanan` (di akhir): notifikasi `info` ke `perawat` ("Sesi {waktu} {tanggal} mulai disiapkan", `/pesanan`), lalu `perform cek_stok_menipis();`.
- `ubah_status_pesanan` (setelah update): loop per bangsal dari `v_ids` (join `pasien` -> `bangsal`) lalu `kirim_notifikasi(array['perawat'], 'Makanan ' || p_status, 'Bangsal ' || nama_bangsal, '/pesanan', 'sukses', bangsal_id)`.

**Selesai kalau:** dengan SQL Editor/akun uji, aksi di tabel Bagian 14.5 menghasilkan baris `notifikasi` untuk penerima yang tepat dan **tidak** untuk pelaku aksi; user hanya bisa membaca notifikasinya sendiri (RLS).

#### T-35 [P1] Notifikasi: antarmuka (lonceng + badge sidebar)

- `services/notifikasiService.js`: `getNotifikasi(limit)`, `getJumlahBelumDibaca()` (dikelompokkan per `rute`), `tandaiDibaca(ids)`, `tandaiDibacaRute(rute)`, `tandaiSemuaDibaca()`.
- `context/NotifikasiContext.jsx`: menyimpan daftar terbaru, total belum dibaca, dan peta `{rute: jumlah}`. Berlangganan **Supabase Realtime** (`postgres_changes`, event INSERT, tabel `notifikasi`, filter `penerima_id=eq.{user.id}`); saat ada notifikasi baru: perbarui state dan munculkan toast singkat. Cadangan: polling tiap 30 detik bila channel gagal tersambung. Bersihkan channel saat logout/unmount.
- **Topbar**: ikon lonceng (lucide `Bell`) dengan badge merah jumlah belum dibaca (`99+` bila banyak). Klik membuka dropdown berisi 15 notifikasi terbaru: ikon sesuai `tipe`, judul tebal bila belum dibaca, pesan, waktu relatif ("5 menit lalu"). Klik item -> tandai dibaca + navigasi ke `rute`. Footer: "Tandai semua dibaca" dan "Lihat semua" (-> `/notifikasi`).
- **Sidebar**: badge angka kecil pada item menu yang `rute`-nya punya notifikasi belum dibaca (mis. Pengajuan Diet `2`). Saat user membuka halaman itu, panggil `tandaiDibacaRute(rute)` setelah halaman termuat sehingga badge hilang.
- **Halaman `/notifikasi`** (semua role): daftar lengkap dengan `DataTable` (paginasi, pencarian, filter belum dibaca/semua).
- Tambahkan `/notifikasi` ke `roles.js` dan route table.

**Selesai kalau:** perawat membuat pengajuan diet -> di akun ahli gizi (browser lain) lonceng bertambah 1, item "Pengajuan Diet" di sidebar berbadge 1 tanpa refresh; membuka halaman itu menghapus badge; ahli gizi menyetujui -> perawat menerima notifikasi "Pengajuan diet disetujui".

#### T-36 [P1] Paginasi tabel Laporan

- Tiga tabel di `/laporan` (Distribusi Makanan, Food Waste, Pemakaian Bahan) memakai `DataTable` dengan paginasi seperti tabel Pasien: default 10 baris/halaman, pilihan 10/25/50/100, penunjuk "Menampilkan 1-10 dari 134", tombol sebelumnya/berikutnya. Tabel tidak boleh memanjang tanpa batas.
- **Ekspor CSV** mengekspor **semua** baris hasil filter tanggal, bukan hanya halaman aktif.
- **Cetak**: sebelum `window.print()`, set state `printing=true` agar semua baris dirender (tanpa paginasi) dan reset di `onafterprint`. Sidebar/topbar/kontrol paginasi disembunyikan saat cetak.
- Tiap tabel punya kolom total/ringkasan singkat di atasnya (mis. total porsi, rata-rata sisa).

**Selesai kalau:** data > 10 baris tampil per halaman; CSV berisi seluruh data; cetak berisi seluruh data.

#### T-37 [P2] Sinkron otomatis saat pasien berubah

**Masalah:** pasien baru masuk, pulang, atau alergi/diet-nya diubah setelah pesanan dibuat tidak memperbarui pesanan yang masih `menunggu`.

**Migration `11_sinkron_pasien.sql`:**

```sql
create or replace function public.trg_pasien_sinkron()
returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if tg_op = 'UPDATE' and new.status = 'pulang' and old.status <> 'pulang' then
    update pesanan_makan
    set status = 'dibatalkan', catatan = 'Pasien pulang'
    where pasien_id = new.id and status = 'menunggu' and tanggal >= hari_ini();
    return new;
  end if;
  if new.status <> 'aktif' then return new; end if;
  for d in select distinct tanggal from menu_harian where tanggal >= hari_ini() loop
    perform _sinkron_pesanan(d);
  end loop;
  return new;
end; $$;

drop trigger if exists trg_pasien_sinkron on pasien;
create trigger trg_pasien_sinkron
after insert or update of alergi, jenis_diet_id, status on pasien
for each row execute function public.trg_pasien_sinkron();
```

**Frontend:** pada form Pasien, saat mengubah alergi/diet/status tampilkan toast info "Pesanan yang belum diproses disesuaikan otomatis". Pesanan yang sudah masuk sesi yang disiapkan tidak berubah (sesuai T-30); untuk pasien pulang setelah makanan disiapkan, perawat mencatat pengembalian dengan alasan `pasien_pulang`.

**Selesai kalau:** menambah pasien baru langsung membuat pesanannya untuk sesi yang belum disiapkan; menambah alergi `ayam` mengosongkan menu pesanan berbahan ayam yang masih `menunggu`; mengubah status pasien jadi `pulang` membatalkan pesanan `menunggu`-nya.

#### T-38 [P2] Pemantauan asupan pasien

**Migration `12_asupan.sql`:**

```sql
create or replace view v_asupan_harian with (security_invoker = true) as
select r.pasien_id, r.pasien, r.no_rm, r.tanggal,
  count(r.persen_sisa) as jumlah_tercatat,
  sum(r.kalori_dikonsumsi) as kalori_total,
  sum(r.natrium_dikonsumsi) as natrium_total,
  round(avg(r.persen_sisa)) as rata_persen_sisa
from v_riwayat_makan r
where r.status <> 'dibatalkan'
group by r.pasien_id, r.pasien, r.no_rm, r.tanggal;

-- Pasien yang perlu perhatian ahli gizi: rata-rata sisa >= 50% selama 3 hari terakhir
create or replace view v_pasien_perhatian with (security_invoker = true) as
select r.pasien_id, r.pasien, r.no_rm,
  round(avg(r.persen_sisa)) as rata_sisa_3_hari, count(r.persen_sisa) as jumlah_tercatat
from v_riwayat_makan r
join pasien p on p.id = r.pasien_id and p.status = 'aktif'
where r.tanggal >= hari_ini() - 2 and r.persen_sisa is not null
group by r.pasien_id, r.pasien, r.no_rm
having avg(r.persen_sisa) >= 50 and count(r.persen_sisa) >= 3;
```

**Frontend:** panel "Pasien perlu perhatian" di dashboard ahli gizi dan di halaman Riwayat Makan (daftar + tautan ke riwayat pasien). Di halaman Riwayat Makan tampilkan badge `Asupan rendah` bila pasien masuk view tersebut. Ambang (50%, 3 hari) boleh dipindah ke tabel `pengaturan` (`ambang_sisa_perhatian`) bila sempat.

**Selesai kalau:** pasien dengan data sisa tinggi di seed muncul di panel; pasien dengan asupan baik tidak.

#### T-39 [P2] Validasi batas gizi & tekstur diet terhadap menu

**Masalah:** `jenis_diet.kalori_maks_per_makan`, `natrium_maks_per_makan`, dan `tekstur` tersimpan tapi tidak pernah ditegakkan.

**Langkah wajib sebelum membuat trigger:** jalankan query audit dan tunjukkan hasilnya ke pemilik proyek; **jangan menghapus data diam-diam**.

```sql
select m.nama as menu, d.nama as diet, m.kalori, d.kalori_maks_per_makan,
       m.natrium, d.natrium_maks_per_makan, m.tekstur as tekstur_menu, d.tekstur as tekstur_diet
from menu_diet md
join menu m on m.id = md.menu_id
join jenis_diet d on d.id = md.jenis_diet_id
where (d.kalori_maks_per_makan is not null and m.kalori > d.kalori_maks_per_makan)
   or (d.natrium_maks_per_makan is not null and m.natrium > d.natrium_maks_per_makan)
   or m.tekstur <> d.tekstur;
```

**Migration `13_validasi_gizi.sql`** (setelah data diperbaiki lewat UI/seed oleh pemilik proyek):

```sql
create or replace function public.validasi_menu_diet()
returns trigger language plpgsql as $$
declare m record; d record;
begin
  select nama, kalori, natrium, tekstur into m from menu where id = new.menu_id;
  select nama, kalori_maks_per_makan as kmax, natrium_maks_per_makan as nmax, tekstur
    into d from jenis_diet where id = new.jenis_diet_id;
  if d.kmax is not null and m.kalori > d.kmax then
    raise exception 'Kalori menu % (%) melebihi batas diet % (%)', m.nama, m.kalori, d.nama, d.kmax;
  end if;
  if d.nmax is not null and m.natrium > d.nmax then
    raise exception 'Natrium menu % (%) melebihi batas diet % (%)', m.nama, m.natrium, d.nama, d.nmax;
  end if;
  if m.tekstur <> d.tekstur then
    raise exception 'Tekstur menu % (%) tidak sesuai diet % (%)', m.nama, m.tekstur, d.nama, d.tekstur;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validasi_menu_diet on menu_diet;
create trigger trg_validasi_menu_diet before insert or update on menu_diet
  for each row execute function public.validasi_menu_diet();
```

**Frontend:** di form Menu, saat memilih diet yang diizinkan, tampilkan peringatan inline (kalori/natrium/tekstur tidak cocok) dan tampilkan pesan error trigger bila simpan ditolak.

**Selesai kalau:** menautkan menu bernatrium tinggi ke Diet Rendah Garam ditolak dengan pesan jelas; data seed yang ada sudah konsisten.

#### T-40 [P2] Log aktivitas (jejak audit)

**Migration `14_log_aktivitas.sql`:**

```sql
create table if not exists log_aktivitas (
  id bigint generated always as identity primary key,
  user_id uuid,
  tabel text not null,
  aksi text not null,                 -- INSERT / UPDATE / DELETE
  baris_id text,
  data_lama jsonb,
  data_baru jsonb,
  waktu timestamptz not null default now()
);
create index if not exists idx_log_waktu on log_aktivitas (waktu desc);

alter table log_aktivitas enable row level security;
drop policy if exists "baca_log_admin" on log_aktivitas;
create policy "baca_log_admin" on log_aktivitas for select to authenticated
  using (current_role_name() = 'admin');

create or replace function public.catat_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare baris jsonb;
begin
  baris := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into log_aktivitas (user_id, tabel, aksi, baris_id, data_lama, data_baru)
  values (auth.uid(), tg_table_name, tg_op, baris->>'id',
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

-- Pasang pada tabel penting (BUKAN pesanan_makan: terlalu ramai, dicatat lewat RPC)
do $$
declare t text;
begin
  for t in select unnest(array['pasien','menu','menu_harian','stok_batch','bahan_makanan',
                               'pengajuan_diet','pengajuan_pembelian','pengaturan','profiles'])
  loop
    execute format('drop trigger if exists trg_log_%1$s on %1$I', t);
    execute format('create trigger trg_log_%1$s after insert or update or delete on %1$I
                    for each row execute function public.catat_log()', t);
  end loop;
end $$;
```

- Tambahkan satu baris log ringkasan (tabel `pesanan_makan`, aksi `UPDATE`, `data_baru` berisi jumlah dan status) di akhir RPC `siapkan_pesanan` dan `ubah_status_pesanan`.
- Halaman `/log-aktivitas` (admin): `DataTable` berpaginasi dengan filter user, tabel, aksi, rentang tanggal; klik baris membuka modal diff (data lama vs baru). Tambahkan ke `roles.js`.
- Ini menggantikan bagian "log aktivitas" dari T-27.

**Selesai kalau:** mengubah alergi pasien atau menyetujui pengajuan muncul di log lengkap dengan nama pelaku dan waktu.

#### T-41 [P2] Proyeksi kebutuhan bahan untuk hari berikutnya

**Migration `15_kebutuhan_bahan.sql`:**

```sql
create or replace function public.kebutuhan_bahan(p_tanggal date)
returns table (bahan_id bigint, bahan text, satuan text,
               kebutuhan numeric, stok numeric, kekurangan numeric)
language sql stable as $$
  with porsi as (
    select mh.menu_id, count(p.id) as jumlah
    from menu_harian mh
    join pasien p on p.jenis_diet_id = mh.jenis_diet_id and p.status = 'aktif'
    where mh.tanggal = p_tanggal
    group by mh.id, mh.menu_id
  ), need as (
    select r.bahan_id, sum(r.jumlah_per_porsi * po.jumlah) as kebutuhan
    from porsi po join resep r on r.menu_id = po.menu_id
    group by r.bahan_id
  )
  select b.id, b.nama, b.satuan, n.kebutuhan, s.stok_total,
         greatest(n.kebutuhan - s.stok_total, 0)
  from need n
  join bahan_makanan b on b.id = n.bahan_id
  join v_stok_bahan s on s.id = b.id
  order by 6 desc, 2
$$;
```

**Frontend:**
- Halaman Stok: tab baru "Kebutuhan" dengan pemilih tanggal (default besok), tabel kebutuhan vs stok, baris kekurangan berwarna merah, label "Perkiraan (belum menghitung pesanan konflik alergi)".
- Tombol "Buat pengajuan pembelian dari kekurangan" (koki/admin) membuka form Pengajuan Pembelian dengan item terisi otomatis.
- Kartu di dashboard koki/gudang: "Bahan kurang untuk besok: N".

**Selesai kalau:** menu harian besok sudah diatur -> tabel menunjukkan kebutuhan per bahan dan kekurangannya; tombol menghasilkan draf pengajuan pembelian.

#### T-42 [P2] Evaluasi menu berbasis food waste

Tanpa migration baru: agregasi dari `v_food_waste` di `laporanService.js` (sesuai filter tanggal).
- Halaman Grafik: bar horizontal "Menu dengan sisa tertinggi" (10 teratas, rata-rata `persen_sisa`) dan tabel menu: jumlah catatan, rata-rata sisa, alasan terbanyak.
- Beri badge **Perlu dievaluasi** bila rata-rata sisa >= 40% dan jumlah catatan >= 5.
- Tambahkan juga grafik **alasan pengembalian** (bar) yang sebelumnya bonus.

**Selesai kalau:** menu dengan sisa tinggi di seed muncul paling atas dengan badge evaluasi.

#### T-43 [P2] Penyempurnaan Pengajuan Diet

**Migration `16_pengajuan_diet_lengkap.sql`:**

```sql
alter table pengajuan_diet add column if not exists alasan_penolakan text;
alter table pengajuan_diet drop constraint if exists pengajuan_diet_status_check;
alter table pengajuan_diet add constraint pengajuan_diet_status_check
  check (status in ('menunggu','disetujui','ditolak','dibatalkan'));

drop policy if exists "batal_pengajuan_diet" on pengajuan_diet;
create policy "batal_pengajuan_diet" on pengajuan_diet for update to authenticated
  using (diajukan_oleh = auth.uid() and status = 'menunggu')
  with check (diajukan_oleh = auth.uid() and status = 'dibatalkan');
```

- Perawat: tombol **Batalkan** pada pengajuan miliknya yang masih `menunggu`.
- Ahli gizi: **Tolak** membuka modal dengan kolom alasan wajib; alasan tampil di daftar dan di notifikasi perawat.
- Filter status (Semua/Menunggu/Disetujui/Ditolak/Dibatalkan) dan pencarian (sudah diperbaiki di T-31); badge status berwarna.
- Perawat hanya melihat pengajuan bangsalnya (filter via pasien -> bangsal).

**Selesai kalau:** pengajuan bisa dibatalkan; penolakan tanpa alasan tidak bisa disimpan; perawat melihat alasan penolakan.

#### T-44 [P2] Redesign Dashboard

Tujuan: dashboard terlihat profesional dan informatif, tetap hanya memakai library yang ada (Tailwind, lucide-react, chart.js).

**Gaya visual (berlaku untuk dashboard dan boleh dipakai ulang di halaman lain):**
- Palet: warna utama teal/emerald (nuansa kesehatan), latar halaman slate muda, kartu putih `rounded-xl border shadow-sm`, jarak konsisten (`gap-4`/`gap-6`). Warna status mengikuti Bagian 9.
- Hierarki tipografi jelas: judul halaman, judul kartu (kecil, abu-abu), angka besar (KPI). Ikon lucide pada setiap kartu.
- Responsif: 1 kolom (HP), 2 kolom (tablet), 4 kolom KPI (desktop). Skeleton loading, bukan spinner kosong. Empty state informatif pada tiap widget.

**Susunan:**
1. **Header**: "Selamat pagi/siang/sore, {nama}", tanggal lengkap (id-ID), badge role, tombol "Segarkan" (dan auto-refresh tiap 60 detik). Tombol aksi cepat sesuai role (koki: ke Pesanan Makan; ahli gizi: ke Pengajuan Diet / Riwayat Makan; perawat: Ajukan Ubah Diet; gudang: Barang Masuk; admin: Pengaturan).
2. **Baris KPI (4 kartu)**: Pasien aktif; Total porsi hari ini; Progres terkirim (% + bar); Peringatan (stok menipis + near-expiry + konflik alergi). Tiap kartu punya ikon dan perbandingan kecil dengan kemarin bila ada.
3. **Progres penyiapan hari ini**: tiga kartu (Pagi/Siang/Malam). Tiap kartu: bar bertumpuk status (menunggu/disiapkan/siap/terkirim), angka per status, lencana "Sesi disiapkan oleh X pukul HH:mm" atau "Belum disiapkan" (data `sesi_makan`), tombol "Buka Pesanan" untuk koki.
4. **Grid dua kolom**:
   - Kiri: **Kebutuhan diet hari ini** (doughnut + legenda jumlah) dan **Status per bangsal** (kartu kecil dengan progress bar per bangsal).
   - Kanan: **Panel peringatan** berkelompok: stok di bawah minimum, batch hampir kedaluwarsa (dengan sisa hari), pesanan konflik alergi belum beres, pasien perlu perhatian (T-38), bahan kurang untuk besok (T-41). Tiap item bisa diklik menuju halaman terkait.
5. **Baris bawah**: **Tren sisa makanan 7 hari** (line chart kecil) dan **Aktivitas terbaru** (5-8 notifikasi terakhir milik user, dari T-34/T-35).
6. **Penekanan per role**: perawat hanya melihat bangsalnya; koki menonjolkan sesi & pesanan menunggu; gudang menonjolkan stok & kedaluwarsa & kebutuhan besok; ahli gizi menonjolkan konflik alergi, pengajuan menunggu, pasien perlu perhatian; admin melihat ringkasan semua.

**Selesai kalau:** dashboard tiap role tampil rapi di desktop dan HP, semua angka cocok dengan tabel asal, widget yang datanya kosong menampilkan empty state (bukan error).

#### T-45 [P3 BONUS] Cetak label nampan
Tombol "Cetak label" pada Pesanan Makan (untuk baris terpilih atau hasil filter). Layout cetak berisi nama, no. RM, bangsal/kamar, diet, alergi (huruf tebal merah), menu, waktu makan, tanggal; satu label per pasien, 8-10 label per halaman A4 (`@media print`).

#### T-46 [P3 BONUS] Kartu stok & buang batch kedaluwarsa
Tabel `mutasi_stok` (bahan_id, batch_id, tipe `masuk|keluar|buang|koreksi`, jumlah, referensi, user_id, waktu) diisi oleh `siapkan_pesanan`, `terima_pembelian`, form barang masuk, dan aksi baru "Buang batch kedaluwarsa" (alasan wajib). Halaman Stok: tab "Kartu stok" per bahan dengan saldo berjalan.

#### T-47 [P3 BONUS] Catatan ahli gizi & dark mode
Tabel `catatan_gizi` (pasien_id, ahli_gizi_id, catatan, created_at) tampil di halaman Riwayat Makan (tambah/lihat). Dark mode (sisa dari T-27) memakai variabel warna Tailwind.

---

### 14.5 Matriks notifikasi

| Kejadian | Penerima | Rute (badge sidebar) | Tipe |
|---|---|---|---|
| Perawat membuat pengajuan ubah diet | ahli_gizi, admin | `/pengajuan-diet` | info |
| Pengajuan diet disetujui / ditolak / dibatalkan | perawat pengaju | `/pengajuan-diet` | sukses / peringatan |
| Pesanan harian digenerate / disinkronkan | koki, admin | `/pesanan` | info (dedupe) |
| Pesanan konflik alergi butuh menu pengganti | ahli_gizi, admin | `/pesanan` | bahaya (dedupe) |
| Menu harian hari ini/besok diubah | koki | `/menu-harian` | info (dedupe) |
| Sesi makan mulai disiapkan | perawat | `/pesanan` | info |
| Status makanan menjadi siap / terkirim | perawat bangsal terkait | `/pesanan` | sukses |
| Stok bahan di bawah minimum | gudang, admin, koki | `/stok` | peringatan (dedupe) |
| Pengajuan pembelian baru | gudang, admin | `/pengajuan-pembelian` | info |
| Pembelian disetujui / ditolak / diterima | koki pengaju | `/pengajuan-pembelian` | sukses / peringatan |
| Pengembalian dengan sisa >= 75% | ahli_gizi | `/pengembalian` | peringatan |

Catatan: perawat tanpa `bangsal_id` tidak menerima notifikasi per bangsal. Pastikan seed mengisi `profiles.bangsal_id` untuk akun perawat dan Pengaturan admin bisa mengubahnya.

---

## 15. Progress Log (agent mengisi di bawah ini)

Format: `YYYY-MM-DD | T-xx | ringkasan singkat | catatan/kendala`

```
2026-10-31 | T-01 | Project init: Vite + React, semua dependency, Tailwind v4, .env.example, .gitignore | Build OK
2026-10-31 | T-02 | Folder structure + supabaseClient, roles, format, exportCsv | Sesuai Bagian 3
2026-10-31 | T-03 | 5 file SQL: schema, functions, views, RLS, seed | 30 hari data historis
2026-10-31 | T-04 | AuthContext: session, profile, role, signIn, signOut | -
2026-10-31 | T-05 | Login page | Toast error + redirect dashboard
2026-10-31 | T-06 | Layout + routing: Sidebar, Topbar, AppLayout, ProtectedRoute | Menu per role
2026-10-31 | T-07 | 10 komponen UI: Spinner, Button, Badge, StatCard, dll | DataTable dengan search + pagination
2026-10-31 | T-08 | CRUD Bangsal + Jenis Diet | View-only untuk role tertentu
2026-10-31 | T-09 | CRUD Pasien | Alergi tags, filter bangsal
2026-10-31 | T-10 | CRUD Bahan + Supplier (tabbed) | -
2026-10-31 | T-11 | CRUD Menu + relasi diet + editor resep | Dynamic resep rows
2026-10-31 | T-12 | Stok: ringkasan + batch FEFO | Badge Aman/Menipis/Habis
2026-10-31 | T-13 | Stok: form barang masuk | -
2026-10-31 | T-14 | Menu Harian: grid diet Ã— waktu makan | Upsert ke DB
2026-10-31 | T-15 | Pesanan Makan: generate + tabel + menu pengganti | RPC generate_pesanan_harian
2026-10-31 | T-16 | Pesanan: siapkan sesi + status changes | RPC siapkan_pesanan, FEFO
2026-10-31 | T-17 | Pengajuan Diet: form perawat + approval ahli gizi | Cut-off validation
2026-10-31 | T-18 | Pengembalian makanan | 1 pesanan = 1 catatan
2026-11-01 | T-19 | Pengajuan Pembelian [BONUS]: form Koki saran menipis, approval Gudang, terima barang batch FEFO | Build OK 2148 modules
2026-10-31 | T-20 | Dashboard: stat cards, alerts, distribusi | Near-expiry + stok minimum
2026-10-31 | T-21 | Laporan: 3 report + CSV + cetak | Distribusi, food waste, pemakaian bahan
2026-10-31 | T-22 | Grafik: 3 chart | Line, doughnut, bar
2026-10-31 | T-23 | Pengaturan: config + user management | -
2026-10-31 | T-24 | Profil: ubah nama + ganti password | -
2026-10-31 | T-25 | Supabase migration 01-05, demo users, RLS verified | Database aktif & terisi
2026-10-31 | T-26 | UI polish: print CSS, App.jsx routing final | Build OK 2147 modules
2026-10-31 | T-28 | README.md lengkap | Setup, akun demo, SQL, deploy
2026-11-09 | T-29 | DB: migration 06 - fix alergi otomatis dari nama bahan/resep + sesi_makan + fondasi kolom pesanan | ✓ Applied ke Supabase
2026-11-09 | T-30 | DB: migration 07 - siapkan_pesanan hanya sekali + advisory lock | ✓ Applied ke Supabase
2026-11-09 | T-32 | DB: migration 08 - ubah_status_pesanan massal (siap/terkirim) | ✓ Applied ke Supabase
2026-11-09 | T-33 | DB: migration 09 - view v_riwayat_makan | ✓ Applied ke Supabase
2026-11-09 | T-34 | DB: migration 10 - tabel notifikasi + RLS + Realtime + 4 trigger + generate/siapkan updated | ✓ Applied ke Supabase
2026-11-09 | T-37 | DB: migration 11 - trigger trg_pasien_sinkron (batalkan/sinkron pesanan otomatis) | ✓ Applied ke Supabase
2026-11-09 | T-38 | DB: migration 12 - view v_asupan_harian + v_pasien_perhatian | ✓ Applied ke Supabase
2026-11-09 | T-39 | DB: migration 13 - trigger trg_validasi_menu_diet + kolom batas_kalori/natrium di jenis_diet | ✓ Applied ke Supabase
2026-11-09 | T-40 | DB: migration 14 - tabel log_aktivitas + trigger _catat_log ke 8 tabel | ✓ Applied ke Supabase
2026-11-09 | T-41 | DB: migration 15 - function kebutuhan_bahan(p_tanggal) | ✓ Applied ke Supabase
2026-11-09 | T-43 | DB: migration 16 - kolom alasan_penolakan + status 'dibatalkan' di pengajuan_diet | ✓ Applied ke Supabase
2026-11-09 | T-46 | DB: migration 17 - tabel mutasi_stok + RLS | ✓ Applied ke Supabase
2026-11-09 | T-47 | DB: migration 18 - tabel catatan_gizi + RLS | ✓ Applied ke Supabase
```
