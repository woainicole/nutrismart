-- ===== 01_schema.sql =====
-- NutriSmart: Tabel + constraint
-- Jalankan pertama di Supabase SQL Editor

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
  alergi text[] not null default '{}',
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
  mengandung_alergen text[] not null default '{}'
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
  satuan text not null,
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
  menu_id bigint references menu(id),
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

