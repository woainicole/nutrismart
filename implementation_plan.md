
# Implementation Plan: NutriSmart (untuk AI Agent)

Sistem Manajemen Diet, Menu Pasien & Logistik Bahan Dapur Rumah Sakit.
Proyek tugas kuliah. Prioritas: **berjalan, rapi, mudah dijelaskan**. Bukan sistem produksi.

---

## 0. ATURAN UNTUK AGENT (baca dulu, patuhi selalu)

1. Baca seluruh file ini sebelum mengerjakan apa pun. File ini adalah sumber kebenaran.
2. Kerjakan **satu task (T-xx) per giliran**, urut sesuai nomor, kecuali ada instruksi lain dari pemilik proyek.
3. Setelah task selesai: centang `[x]` pada task, tulis satu baris di **Progress Log** (Bagian 14), lalu berhenti dan laporkan ringkas apa yang dibuat dan cara mengujinya.
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
├── README.md
├── implementation_plan.md
├── .env.example
├── database/
│   ├── 01_schema.sql        (tabel + constraint)
│   ├── 02_functions.sql     (helper, trigger, RPC)
│   ├── 03_views.sql         (view untuk dashboard/laporan)
│   ├── 04_rls.sql           (row level security)
│   └── 05_seed.sql          (data dummy)
└── src/
    ├── main.jsx
    ├── App.jsx                     (definisi route)
    ├── index.css                   (import tailwind)
    ├── lib/
    │   ├── supabaseClient.js
    │   ├── roles.js                (ROLE, menu per role, helper canAccess)
    │   ├── format.js               (tanggal, angka, persen)
    │   └── exportCsv.js
    ├── context/
    │   └── AuthContext.jsx         (session, profile, role, signIn, signOut)
    ├── services/                   (semua panggilan supabase ada di sini)
    │   ├── pasienService.js
    │   ├── dietService.js
    │   ├── menuService.js
    │   ├── bahanService.js
    │   ├── stokService.js
    │   ├── pesananService.js
    │   ├── pengajuanService.js
    │   ├── pengembalianService.js
    │   ├── laporanService.js
    │   └── pengaturanService.js
    ├── components/
    │   ├── layout/ (AppLayout.jsx, Sidebar.jsx, Topbar.jsx)
    │   ├── ProtectedRoute.jsx
    │   └── ui/ (Button, Modal, DataTable, Badge, StatCard, FormField,
    │            ConfirmDialog, EmptyState, Spinner, PageHeader)
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── master/ (Pasien.jsx, JenisDiet.jsx, Menu.jsx, Bahan.jsx, Supplier.jsx, Bangsal.jsx)
        ├── Stok.jsx
        ├── MenuHarian.jsx
        ├── PesananMakan.jsx
        ├── PengajuanDiet.jsx
        ├── PengajuanPembelian.jsx
        ├── Pengembalian.jsx
        ├── Laporan.jsx
        ├── Grafik.jsx
        ├── Pengaturan.jsx
        └── Profil.jsx
```

### Konvensi service
- Satu fungsi = satu operasi. Nama: `getXxx`, `createXxx`, `updateXxx`, `deleteXxx`.
- Selalu mengembalikan `data` atau melempar `Error` dengan `error.message` dari Supabase. Halaman yang menangkap dan menampilkan toast.
- Tidak ada panggilan `supabase.from(...)` langsung di komponen halaman.

---

## 4. Database

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
- Data `pengembalian_makanan` historis ±30 hari (untuk grafik tren). Agar ada pesanan lama, seed boleh insert langsung ke `pesanan_makan` dengan tanggal lampau berstatus `terkirim`.

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
| `/laporan` | Laporan | v | v | v | - | v |
| `/grafik` | Grafik | v | v | v | - | v |
| `/pengaturan` | Pengaturan & user | v | - | - | - | - |
| `/profil` | Profil | v | v | v | v | v |

"lihat" = bisa membuka halaman tetapi tombol tambah/ubah/hapus disembunyikan. Pembatasan sebenarnya tetap dijaga RLS.

---

## 6. Perilaku Tiap Modul (spesifikasi UI)

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

---

## 8. Prioritas

| Level | Task |
|---|---|
| **WAJIB** | T-01 s.d. T-18, T-20, T-21 (min. 1 laporan), T-22 (min. 1 grafik), T-23, T-24, T-25, T-28 |
| **PENTING** | Laporan & grafik lengkap, T-26 |
| **BONUS** | T-19, T-27, grafik alasan pengembalian |

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

---

## 12. Risiko & Penanganan

| Risiko | Penanganan |
|---|---|
| Scope terlalu besar | Patuhi prioritas Bagian 8; jangan kerjakan BONUS lebih dulu |
| Data tidak muncul setelah RLS aktif | Cek policy `select` dan role user; gunakan view `security_invoker` |
| RPC error tidak jelas di UI | Tampilkan `error.message` apa adanya (sudah berbahasa Indonesia dari database) |
| Zona waktu salah (cut-off, "hari ini") | Pakai Asia/Jakarta di database; di frontend hitung tanggal lokal, bukan `toISOString()` |
| Seed tidak cukup untuk demo grafik | Pastikan seed memuat data ±30 hari |
| Agent menambah fitur di luar rencana | Aturan Bagian 0 poin 4, 12, 13 |

---

## 13. Definition of Done

- [x] Semua task WAJIB tercentang
- [x] 9 syarat tugas bisa didemokan: dashboard, database, pengaturan, profil, pengajuan, stock, pengembalian, laporan, grafik
- [x] Skenario uji Bagian 11 lulus dengan RLS aktif
- [x] README lengkap, `.env` tidak ter-commit
- [x] Skenario demo (alur inti) bisa dijalankan dari awal sampai akhir tanpa error

---

## 14. Progress Log (agent mengisi di bawah ini)

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
2026-10-31 | T-14 | Menu Harian: grid diet × waktu makan | Upsert ke DB
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
```
