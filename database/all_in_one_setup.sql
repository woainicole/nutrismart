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

-- ===== 02_functions.sql =====
-- NutriSmart: Helper functions, triggers, RPC
-- Jalankan setelah 01_schema.sql

-- Role user yang sedang login
create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- Buat profile otomatis saat user dibuat di Auth
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

-- Generate / sinkronkan pesanan harian dari menu_harian
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

-- Koki menyiapkan 1 sesi makan: cek stok, potong FEFO, ubah status
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

-- ===== 03_views.sql =====
-- NutriSmart: View untuk dashboard/laporan
-- Jalankan setelah 02_functions.sql

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

-- ===== 04_rls.sql =====
-- NutriSmart: Row Level Security
-- Jalankan setelah 03_views.sql
-- PENTING: Selama development boleh dinonaktifkan, tapi T-25 wajib aktif

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

-- Tulis: per tabel, per role
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

create policy "tulis_pesanan" on pesanan_makan for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki'))
  with check (current_role_name() in ('admin','ahli_gizi','koki'));

create policy "tulis_pengembalian" on pengembalian_makanan for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki','perawat'))
  with check (current_role_name() in ('admin','ahli_gizi','koki','perawat'));

create policy "buat_pengajuan_diet" on pengajuan_diet for insert to authenticated
  with check (current_role_name() in ('admin','perawat'));
create policy "tolak_pengajuan_diet" on pengajuan_diet for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "buat_pembelian" on pengajuan_pembelian for insert to authenticated
  with check (current_role_name() in ('admin','koki'));
create policy "proses_pembelian" on pengajuan_pembelian for update to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "buat_item_pembelian" on pengajuan_pembelian_item for insert to authenticated
  with check (current_role_name() in ('admin','koki'));

create policy "tulis_pengaturan" on pengaturan for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

create policy "admin_kelola_profiles" on profiles for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');
create policy "ubah_profil_sendiri" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = current_role_name());

-- ===== 05_seed.sql =====
-- NutriSmart: Data dummy minimum
-- Jalankan setelah 04_rls.sql (atau sebelumnya kalau RLS belum aktif)
-- Tanggal relatif: current_date = "hari ini"

-- Pengaturan
insert into pengaturan (key, value) values
  ('cutoff_pagi', '06:00'),
  ('cutoff_siang', '09:00'),
  ('cutoff_malam', '15:00'),
  ('batas_hari_kedaluwarsa', '3');

-- Bangsal
insert into bangsal (nama, lantai) values
  ('Melati', 1),
  ('Mawar', 2),
  ('VIP', 3);

-- Jenis diet
insert into jenis_diet (nama, kalori_maks_per_makan, natrium_maks_per_makan, tekstur) values
  ('Normal', 700, 800, 'biasa'),
  ('Diet DM', 500, 600, 'biasa'),
  ('Rendah Garam', 600, 300, 'biasa'),
  ('Diet Lunak', 550, 700, 'lunak'),
  ('Diet Cair', 400, 500, 'cair');

-- Supplier
insert into supplier (nama, kontak) values
  ('PT Segar Jaya', '021-5551234'),
  ('UD Tani Makmur', '081234567890'),
  ('CV Laut Biru', '022-4445678');

-- Bahan makanan (15 item)
insert into bahan_makanan (nama, satuan, stok_minimum, supplier_id) values
  ('Beras', 'kg', 20, 1),
  ('Ayam', 'kg', 10, 1),
  ('Ikan', 'kg', 8, 3),
  ('Telur', 'pcs', 50, 2),
  ('Tahu', 'pcs', 30, 2),
  ('Tempe', 'pcs', 30, 2),
  ('Bayam', 'kg', 5, 2),
  ('Wortel', 'kg', 5, 2),
  ('Kacang Tanah', 'kg', 3, 2),
  ('Udang', 'kg', 5, 3),
  ('Susu', 'liter', 10, 1),
  ('Gula', 'kg', 5, 1),
  ('Minyak', 'liter', 10, 1),
  ('Garam', 'kg', 3, 1),
  ('Buah', 'kg', 8, 2);

-- Menu (10 menu)
insert into menu (nama, kalori, natrium, tekstur, mengandung_alergen) values
  ('Nasi Tim Ayam', 450, 350, 'biasa', '{}'),
  ('Nasi Goreng Telur', 500, 400, 'biasa', '{}'),
  ('Sup Ikan Wortel', 350, 250, 'biasa', '{}'),
  ('Bubur Ayam', 400, 300, 'lunak', '{}'),
  ('Tumis Tahu Tempe', 300, 200, 'biasa', '{}'),
  ('Soto Ayam', 420, 380, 'biasa', '{kacang}'),
  ('Nasi Udang Saus', 480, 450, 'biasa', '{udang}'),
  ('Bubur Kacang Hijau', 350, 150, 'lunak', '{kacang}'),
  ('Sup Bayam Telur', 280, 200, 'biasa', '{}'),
  ('Jus Buah Susu', 300, 100, 'cair', '{}');

-- Menu-diet (relasi menu cocok untuk diet mana)
insert into menu_diet (menu_id, jenis_diet_id) values
  -- Nasi Tim Ayam: Normal, Diet DM
  (1, 1), (1, 2),
  -- Nasi Goreng Telur: Normal
  (2, 1),
  -- Sup Ikan Wortel: Normal, Rendah Garam, Diet DM
  (3, 1), (3, 3), (3, 2),
  -- Bubur Ayam: Diet Lunak, Normal
  (4, 4), (4, 1),
  -- Tumis Tahu Tempe: Normal, Diet DM, Rendah Garam
  (5, 1), (5, 2), (5, 3),
  -- Soto Ayam: Normal (mengandung kacang)
  (6, 1),
  -- Nasi Udang Saus: Normal (mengandung udang)
  (7, 1),
  -- Bubur Kacang Hijau: Diet Lunak (mengandung kacang)
  (8, 4),
  -- Sup Bayam Telur: Normal, Diet DM, Rendah Garam
  (9, 1), (9, 2), (9, 3),
  -- Jus Buah Susu: Diet Cair
  (10, 5);

-- Resep (tiap menu 2-4 bahan)
insert into resep (menu_id, bahan_id, jumlah_per_porsi) values
  -- Nasi Tim Ayam: beras 0.15kg, ayam 0.1kg, wortel 0.05kg
  (1, 1, 0.15), (1, 2, 0.10), (1, 8, 0.05),
  -- Nasi Goreng Telur: beras 0.15kg, telur 2pcs, minyak 0.02L
  (2, 1, 0.15), (2, 4, 2), (2, 13, 0.02),
  -- Sup Ikan Wortel: ikan 0.12kg, wortel 0.08kg, garam 0.005kg
  (3, 3, 0.12), (3, 8, 0.08), (3, 14, 0.005),
  -- Bubur Ayam: beras 0.1kg, ayam 0.08kg, garam 0.003kg
  (4, 1, 0.10), (4, 2, 0.08), (4, 14, 0.003),
  -- Tumis Tahu Tempe: tahu 2pcs, tempe 2pcs, minyak 0.02L
  (5, 5, 2), (5, 6, 2), (5, 13, 0.02),
  -- Soto Ayam: ayam 0.12kg, kacang tanah 0.03kg, garam 0.005kg
  (6, 2, 0.12), (6, 9, 0.03), (6, 14, 0.005),
  -- Nasi Udang Saus: beras 0.15kg, udang 0.12kg, minyak 0.03L
  (7, 1, 0.15), (7, 10, 0.12), (7, 13, 0.03),
  -- Bubur Kacang Hijau: kacang tanah 0.05kg, gula 0.03kg, susu 0.1L
  (8, 9, 0.05), (8, 12, 0.03), (8, 11, 0.10),
  -- Sup Bayam Telur: bayam 0.1kg, telur 1pcs, garam 0.003kg
  (9, 7, 0.10), (9, 4, 1), (9, 14, 0.003),
  -- Jus Buah Susu: buah 0.15kg, susu 0.2L, gula 0.02kg
  (10, 15, 0.15), (10, 11, 0.20), (10, 12, 0.02);

-- Stok batch: 1-2 batch per bahan
-- 2 batch hampir kedaluwarsa (<=3 hari), 1 bahan di bawah minimum
insert into stok_batch (bahan_id, jumlah_sisa, tgl_masuk, tgl_kedaluwarsa) values
  -- Beras: cukup
  (1, 15, current_date - 10, current_date + 30),
  (1, 10, current_date - 5, current_date + 60),
  -- Ayam: batch hampir kedaluwarsa!
  (2, 3, current_date - 5, current_date + 2),
  (2, 8, current_date - 1, current_date + 7),
  -- Ikan: cukup
  (3, 10, current_date - 3, current_date + 5),
  -- Telur: cukup
  (4, 60, current_date - 2, current_date + 14),
  -- Tahu: cukup
  (5, 40, current_date - 1, current_date + 5),
  -- Tempe: cukup
  (6, 35, current_date - 1, current_date + 4),
  -- Bayam: batch hampir kedaluwarsa!
  (7, 2, current_date - 3, current_date + 1),
  (7, 4, current_date - 1, current_date + 5),
  -- Wortel: cukup
  (8, 8, current_date - 4, current_date + 10),
  -- Kacang Tanah: DI BAWAH MINIMUM (stok_minimum=3, sisa=1.5)
  (9, 1.5, current_date - 10, current_date + 60),
  -- Udang: cukup
  (10, 6, current_date - 2, current_date + 4),
  -- Susu: cukup
  (11, 12, current_date - 1, current_date + 7),
  -- Gula: cukup
  (12, 6, current_date - 5, current_date + 90),
  -- Minyak: cukup
  (13, 12, current_date - 3, current_date + 60),
  -- Garam: cukup
  (14, 4, current_date - 7, current_date + 180),
  -- Buah: cukup
  (15, 10, current_date - 1, current_date + 5);

-- 20 pasien aktif, tersebar 3 bangsal, beberapa alergi
insert into pasien (no_rm, nama, bangsal_id, kamar, diagnosa, alergi, jenis_diet_id, status) values
  ('RM001', 'Andi Pratama', 1, '101A', 'Diabetes Melitus', '{}', 2, 'aktif'),
  ('RM002', 'Budi Santoso', 1, '101B', 'Hipertensi', '{}', 3, 'aktif'),
  ('RM003', 'Citra Dewi', 1, '102A', 'Post-op Apendektomi', '{}', 4, 'aktif'),
  ('RM004', 'Dian Kusuma', 1, '102B', 'Gastritis', '{kacang}', 1, 'aktif'),
  ('RM005', 'Eka Wijaya', 1, '103A', 'Fraktur Femur', '{}', 1, 'aktif'),
  ('RM006', 'Fajar Rahman', 1, '103B', 'Pneumonia', '{udang}', 1, 'aktif'),
  ('RM007', 'Gita Purnama', 2, '201A', 'Diabetes Melitus', '{}', 2, 'aktif'),
  ('RM008', 'Haris Munandar', 2, '201B', 'Stroke Ringan', '{kacang,udang}', 4, 'aktif'),
  ('RM009', 'Indah Lestari', 2, '202A', 'Demam Tifoid', '{}', 4, 'aktif'),
  ('RM010', 'Joko Widodo', 2, '202B', 'PPOK', '{}', 1, 'aktif'),
  ('RM011', 'Kartika Sari', 2, '203A', 'Hepatitis A', '{}', 3, 'aktif'),
  ('RM012', 'Lukman Hakim', 2, '203B', 'Gagal Ginjal', '{}', 3, 'aktif'),
  ('RM013', 'Maya Anggraini', 3, '301', 'Diabetes Melitus', '{kacang}', 2, 'aktif'),
  ('RM014', 'Nanda Putra', 3, '302', 'Hipertensi', '{}', 3, 'aktif'),
  ('RM015', 'Olivia Tan', 3, '303', 'Post-op Caesar', '{}', 4, 'aktif'),
  ('RM016', 'Pandu Setiawan', 3, '304', 'Dengue Fever', '{}', 1, 'aktif'),
  ('RM017', 'Qori Amalia', 3, '305', 'Asma Berat', '{udang}', 1, 'aktif'),
  ('RM018', 'Rizky Firmansyah', 1, '104A', 'Gangguan Menelan', '{}', 5, 'aktif'),
  ('RM019', 'Siti Nurhaliza', 2, '204A', 'Pasca Operasi Mulut', '{}', 5, 'aktif'),
  ('RM020', 'Taufik Hidayat', 3, '306', 'Disfagia', '{}', 5, 'aktif');

-- Menu harian: hari ini + 6 hari ke depan
-- Pagi / Siang / Malam per jenis diet
do $$
declare
  d date;
  i int;
begin
  for i in 0..6 loop
    d := current_date + i;
    -- Normal (diet_id=1)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 1, 1),   -- Nasi Tim Ayam
      (d, 'siang', 1, 2),  -- Nasi Goreng Telur
      (d, 'malam', 1, 3);  -- Sup Ikan Wortel
    -- Diet DM (diet_id=2)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 2, 1),   -- Nasi Tim Ayam
      (d, 'siang', 2, 5),  -- Tumis Tahu Tempe
      (d, 'malam', 2, 9);  -- Sup Bayam Telur
    -- Rendah Garam (diet_id=3)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 3, 3),   -- Sup Ikan Wortel
      (d, 'siang', 3, 5),  -- Tumis Tahu Tempe
      (d, 'malam', 3, 9);  -- Sup Bayam Telur
    -- Diet Lunak (diet_id=4)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 4, 4),   -- Bubur Ayam
      (d, 'siang', 4, 4),  -- Bubur Ayam
      (d, 'malam', 4, 8);  -- Bubur Kacang Hijau
    -- Diet Cair (diet_id=5)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 5, 10),  -- Jus Buah Susu
      (d, 'siang', 5, 10), -- Jus Buah Susu
      (d, 'malam', 5, 10); -- Jus Buah Susu
  end loop;
end $$;

-- Data historis: pesanan 30 hari lalu untuk grafik tren
-- Insert pesanan lampau + pengembalian
do $$
declare
  d date;
  i int;
  wm text;
  p_id bigint;
  m_id bigint;
  pes_id bigint;
  rand_persen int;
  rand_alasan text;
  alasan_arr text[] := array['mual','menu_tidak_cocok','nafsu_makan_menurun','porsi_terlalu_banyak','lainnya'];
  persen_arr int[] := array[0,25,50,75,100];
begin
  for i in 1..30 loop
    d := current_date - i;
    for wm in select unnest(array['pagi','siang','malam']) loop
      -- Ambil 5 pasien untuk pesanan historis
      for p_id in select id from pasien where status = 'aktif' order by id limit 5 loop
        -- Cari menu yang sesuai dengan jenis diet pasien dan tidak alergi
        select md.menu_id into m_id
        from menu_diet md
        join menu m on m.id = md.menu_id
        join pasien p on p.id = p_id
        where md.jenis_diet_id = p.jenis_diet_id
          and not (m.mengandung_alergen && p.alergi)
        order by md.menu_id
        limit 1;

        if m_id is not null then
          -- Insert pesanan berstatus terkirim
          insert into pesanan_makan (tanggal, waktu_makan, pasien_id, menu_id, status)
          values (d, wm, p_id, m_id, 'terkirim')
          on conflict (tanggal, waktu_makan, pasien_id) do nothing
          returning id into pes_id;

          -- Sebagian punya pengembalian (sekitar 40%)
          if pes_id is not null and random() < 0.4 then
            rand_persen := persen_arr[1 + floor(random() * 5)::int];
            rand_alasan := alasan_arr[1 + floor(random() * 5)::int];
            insert into pengembalian_makanan (pesanan_id, persen_sisa, alasan)
            values (pes_id, rand_persen, rand_alasan)
            on conflict do nothing;
          end if;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

