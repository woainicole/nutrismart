-- ============================================================
-- NutriSmart: ALL MIGRATIONS (06-18) - Jalankan sekali di SQL Editor
-- ============================================================


-- ============================================================
-- MIGRATION: 06_fix_alergi_dan_fondasi.sql
-- ============================================================
-- Migration 06: Perbaiki deteksi alergi & fondasi untuk T-30 s.d. T-33
-- Idempotent: aman dijalankan ulang

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

-- ============================================================
-- MIGRATION: 07_siapkan_sesi_sekali.sql
-- ============================================================
-- Migration 07: Siapkan sesi hanya sekali per (tanggal, waktu makan)
-- Idempotent: aman dijalankan ulang
-- Catatan: tabel sesi_makan dibuat di migration 06

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

-- ============================================================
-- MIGRATION: 08_ubah_status_massal.sql
-- ============================================================
-- Migration 08: Filter per menu + ubah status massal di pesanan makan
-- Idempotent: aman dijalankan ulang

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


-- ============================================================
-- MIGRATION: 09_riwayat_makan.sql
-- ============================================================
-- Migration 09: View riwayat makan pasien (permintaan dosen)
-- Idempotent: aman dijalankan ulang

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


-- ============================================================
-- MIGRATION: 10_notifikasi.sql
-- ============================================================
-- Migration 10: Sistem notifikasi (tabel, trigger, RPC, RLS, Realtime)
-- Idempotent: aman dijalankan ulang

create table if not exists notifikasi (
  id bigint generated always as identity primary key,
  penerima_id uuid not null references profiles(id) on delete cascade,
  judul text not null,
  pesan text,
  rute text not null,
  tipe text not null default 'info' check (tipe in ('info','sukses','peringatan','bahaya')),
  dibaca boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_penerima on notifikasi (penerima_id, dibaca, created_at desc);

alter table notifikasi enable row level security;
drop policy if exists "baca_notif_sendiri" on notifikasi;
create policy "baca_notif_sendiri" on notifikasi for select to authenticated
  using (penerima_id = auth.uid());
drop policy if exists "ubah_notif_sendiri" on notifikasi;
create policy "ubah_notif_sendiri" on notifikasi for update to authenticated
  using (penerima_id = auth.uid()) with check (penerima_id = auth.uid());

-- Aktifkan Realtime
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

-- generate_pesanan_harian + notifikasi konflik alergi
create or replace function public.generate_pesanan_harian(p_tanggal date)
returns int language plpgsql security definer set search_path = public as $$
declare jumlah int; n_konflik int;
begin
  if current_role_name() not in ('admin','ahli_gizi') then
    raise exception 'Tidak diizinkan';
  end if;
  jumlah := _sinkron_pesanan(p_tanggal);
  if jumlah > 0 then
    perform kirim_notifikasi(array['koki','admin'], 'Pesanan makan diperbarui',
      jumlah || ' pesanan untuk ' || to_char(p_tanggal, 'DD/MM/YYYY'),
      '/pesanan', 'info', null, null, true);
  end if;
  select count(*) into n_konflik from pesanan_makan
  where tanggal = p_tanggal and status = 'menunggu' and menu_id is null
    and catatan like 'Konflik alergi%';
  if n_konflik > 0 then
    perform kirim_notifikasi(array['ahli_gizi','admin'], n_konflik || ' pesanan butuh menu pengganti',
      'Konflik alergi ditemukan pada ' || to_char(p_tanggal, 'DD/MM/YYYY'),
      '/pesanan', 'bahaya', null, null, true);
  end if;
  return jumlah;
end; $$;

-- siapkan_pesanan + notifikasi
create or replace function public.siapkan_pesanan(p_tanggal date, p_waktu text)
returns void language plpgsql security definer set search_path = public as $$
declare k record; b record; sisa numeric; ambil numeric; n int; n_tanpa_menu int;
begin
  if current_role_name() not in ('admin','koki') then
    raise exception 'Tidak diizinkan';
  end if;
  perform pg_advisory_xact_lock(hashtext('siapkan_' || p_tanggal::text || '_' || p_waktu));
  if exists (select 1 from sesi_makan where tanggal = p_tanggal and waktu_makan = p_waktu) then
    raise exception 'Sesi % tanggal % sudah pernah disiapkan dan tidak bisa diulang', p_waktu, p_tanggal;
  end if;
  select count(*) into n_tanpa_menu from pesanan_makan
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is null;
  if n_tanpa_menu > 0 then
    raise exception '% pesanan belum punya menu. Selesaikan dulu sebelum menyiapkan sesi', n_tanpa_menu;
  end if;
  select count(*) into n from pesanan_makan
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is not null;
  if n = 0 then raise exception 'Tidak ada pesanan yang bisa disiapkan untuk sesi ini'; end if;

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
      order by tgl_kedaluwarsa, id for update
    loop
      exit when sisa <= 0;
      ambil := least(b.jumlah_sisa, sisa);
      update stok_batch set jumlah_sisa = jumlah_sisa - ambil where id = b.id;
      sisa := sisa - ambil;
    end loop;
    if sisa > 0 then raise exception 'Stok % tidak cukup (kurang %)', k.nama, sisa; end if;
    insert into pemakaian_bahan (tanggal, waktu_makan, bahan_id, jumlah) values (p_tanggal, p_waktu, k.bahan_id, k.total);
  end loop;

  update pesanan_makan set status = 'disiapkan', disiapkan_at = now(), diubah_oleh = auth.uid()
  where tanggal = p_tanggal and waktu_makan = p_waktu and status = 'menunggu' and menu_id is not null;
  insert into sesi_makan (tanggal, waktu_makan, disiapkan_oleh, jumlah_pesanan) values (p_tanggal, p_waktu, auth.uid(), n);

  -- Notifikasi ke perawat + cek stok menipis
  perform kirim_notifikasi(array['perawat'], 'Sesi ' || p_waktu || ' mulai disiapkan',
    to_char(p_tanggal, 'DD/MM/YYYY'), '/pesanan', 'info');
  perform cek_stok_menipis();
end; $$;


-- ============================================================
-- MIGRATION: 11_sinkron_pasien.sql
-- ============================================================
-- NutriSmart Migration: 11_sinkron_pasien.sql
-- Trigger: sinkron pesanan otomatis saat pasien diubah
-- File: 11_sinkron_pasien.sql

-- Trigger function: batalkan pesanan menunggu jika pulang, sinkron jika alergi/diet berubah
CREATE OR REPLACE FUNCTION _trigger_sinkron_pasien()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d date;
BEGIN
  -- Jika pasien pulang: batalkan semua pesanan menunggu
  IF NEW.status = 'pulang' AND OLD.status <> 'pulang' THEN
    UPDATE pesanan_makan
    SET status = 'dibatalkan'
    WHERE pasien_id = NEW.id AND status = 'menunggu';
  END IF;

  -- Jika aktif dan alergi/diet berubah: sinkron pesanan mendatang
  IF NEW.status = 'aktif' AND (
    NEW.alergi IS DISTINCT FROM OLD.alergi OR
    NEW.jenis_diet_id IS DISTINCT FROM OLD.jenis_diet_id
  ) THEN
    FOR d IN
      SELECT DISTINCT tanggal FROM menu_harian
      WHERE tanggal >= hari_ini()
      ORDER BY tanggal
    LOOP
      PERFORM _sinkron_pesanan(d);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pasien_sinkron ON pasien;
CREATE TRIGGER trg_pasien_sinkron
  AFTER UPDATE OF alergi, jenis_diet_id, status ON pasien
  FOR EACH ROW EXECUTE FUNCTION _trigger_sinkron_pasien();

-- ============================================================
-- MIGRATION: 12_asupan.sql
-- ============================================================
-- NutriSmart Migration: 12_asupan.sql
-- Pemantauan asupan harian pasien
-- File: 12_asupan.sql

-- View asupan harian dari riwayat makan
CREATE OR REPLACE VIEW v_asupan_harian AS
SELECT
  pm.pasien_id,
  pa.nama AS nama_pasien,
  b.nama   AS nama_bangsal,
  pm.tanggal,
  COUNT(*) AS total_porsi,
  COUNT(pen.id) AS total_dicatat,
  ROUND(AVG(pen.persen_sisa)::numeric, 1) AS rata_sisa,
  SUM(CASE WHEN pen.persen_sisa >= 50 THEN 1 ELSE 0 END) AS porsi_banyak_sisa
FROM pesanan_makan pm
JOIN pasien pa ON pa.id = pm.pasien_id
LEFT JOIN bangsal b ON b.id = pa.bangsal_id
LEFT JOIN pengembalian_makanan pen ON pen.pesanan_id = pm.id
WHERE pm.status = 'terkirim'
GROUP BY pm.pasien_id, pa.nama, b.nama, pm.tanggal;

-- View pasien perlu perhatian: rata sisa >= 50%, minimal 3 hari, >= 3 catatan
CREATE OR REPLACE VIEW v_pasien_perhatian AS
SELECT
  pasien_id,
  nama_pasien,
  nama_bangsal,
  COUNT(DISTINCT tanggal) AS hari_dicatat,
  ROUND(AVG(rata_sisa)::numeric, 1) AS avg_sisa,
  SUM(total_dicatat) AS total_catatan
FROM v_asupan_harian
WHERE tanggal >= (hari_ini() - INTERVAL '3 days')
  AND rata_sisa >= 50
GROUP BY pasien_id, nama_pasien, nama_bangsal
HAVING COUNT(DISTINCT tanggal) >= 3
   AND SUM(total_dicatat) >= 3
ORDER BY avg_sisa DESC;

-- ============================================================
-- MIGRATION: 13_validasi_gizi.sql
-- ============================================================
-- NutriSmart Migration: 13_validasi_gizi.sql
-- Validasi batas gizi saat menu ditambahkan ke jenis diet
-- File: 13_validasi_gizi.sql

-- Trigger validasi: kalori & natrium tidak boleh melampaui batas jenis diet
CREATE OR REPLACE FUNCTION _validasi_menu_diet()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_menu    record;
  v_diet    record;
  v_pesan   text;
BEGIN
  SELECT kalori, natrium INTO v_menu FROM menu WHERE id = NEW.menu_id;
  SELECT batas_kalori, batas_natrium, nama INTO v_diet FROM jenis_diet WHERE id = NEW.jenis_diet_id;

  -- Hanya validasi jika batas diset (tidak null)
  IF v_diet.batas_kalori IS NOT NULL AND v_menu.kalori > v_diet.batas_kalori THEN
    v_pesan := format('Kalori menu (%s kkal) melebihi batas diet %s (%s kkal)',
      v_menu.kalori, v_diet.nama, v_diet.batas_kalori);
    RAISE EXCEPTION '%', v_pesan;
  END IF;

  IF v_diet.batas_natrium IS NOT NULL AND v_menu.natrium > v_diet.batas_natrium THEN
    v_pesan := format('Natrium menu (%s mg) melebihi batas diet %s (%s mg)',
      v_menu.natrium, v_diet.nama, v_diet.batas_natrium);
    RAISE EXCEPTION '%', v_pesan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validasi_menu_diet ON menu_diet;
CREATE TRIGGER trg_validasi_menu_diet
  BEFORE INSERT OR UPDATE ON menu_diet
  FOR EACH ROW EXECUTE FUNCTION _validasi_menu_diet();

-- Tambah kolom batas gizi ke jenis_diet jika belum ada
ALTER TABLE jenis_diet
  ADD COLUMN IF NOT EXISTS batas_kalori integer,
  ADD COLUMN IF NOT EXISTS batas_natrium integer;

-- ============================================================
-- MIGRATION: 14_log_aktivitas.sql
-- ============================================================
-- NutriSmart Migration: 14_log_aktivitas.sql
-- Log aktivitas pengguna
-- File: 14_log_aktivitas.sql

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nama_tabel  text NOT NULL,
  aksi        text NOT NULL CHECK (aksi IN ('INSERT','UPDATE','DELETE')),
  baris_id    text,
  data_lama   jsonb,
  data_baru   jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_user ON log_aktivitas(user_id);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_tabel ON log_aktivitas(nama_tabel);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_created ON log_aktivitas(created_at DESC);

-- RLS: hanya admin yang bisa baca
ALTER TABLE log_aktivitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_admin_only ON log_aktivitas;
CREATE POLICY log_admin_only ON log_aktivitas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role bisa insert (trigger akan memakai ini)
DROP POLICY IF EXISTS log_insert_service ON log_aktivitas;
CREATE POLICY log_insert_service ON log_aktivitas
  FOR INSERT WITH CHECK (true);

-- Fungsi trigger catat log
CREATE OR REPLACE FUNCTION _catat_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO log_aktivitas(user_id, nama_tabel, aksi, baris_id, data_lama, data_baru)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Pasang trigger ke tabel-tabel penting
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pasien','menu','menu_harian','stok_batch','bahan_makanan','pengajuan_diet','pengajuan_pembelian','pengaturan'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_%I ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_log_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION _catat_log()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- MIGRATION: 15_kebutuhan_bahan.sql
-- ============================================================
-- NutriSmart Migration: 15_kebutuhan_bahan.sql
-- Proyeksi kebutuhan bahan untuk tanggal tertentu

CREATE OR REPLACE FUNCTION kebutuhan_bahan(p_tanggal date DEFAULT NULL)
RETURNS TABLE(
  bahan_id    integer,
  nama_bahan  text,
  satuan      text,
  kebutuhan   numeric,
  stok        numeric,
  kekurangan  numeric
) LANGUAGE sql STABLE AS $$
  WITH tgl AS (SELECT COALESCE(p_tanggal, hari_ini() + 1) AS d),
  -- Hitung total porsi per jenis diet per sesi untuk tanggal tsb
  porsi AS (
    SELECT
      pm.waktu_makan,
      p.jenis_diet_id,
      COUNT(*) AS jumlah
    FROM pesanan_makan pm
    JOIN pasien p ON p.id = pm.pasien_id
    WHERE pm.tanggal = (SELECT d FROM tgl)
      AND pm.status IN ('menunggu','disiapkan')
    GROUP BY pm.waktu_makan, p.jenis_diet_id
  ),
  -- Kebutuhan bahan dari resep menu yang terjadwal
  kebutuhan_raw AS (
    SELECT
      r.bahan_id,
      SUM(r.jumlah_per_porsi * por.jumlah) AS total_kebutuhan
    FROM menu_harian mh
    JOIN menu_diet md ON md.menu_id = mh.menu_id AND md.jenis_diet_id = mh.jenis_diet_id
    JOIN resep r ON r.menu_id = mh.menu_id
    JOIN porsi por ON por.jenis_diet_id = mh.jenis_diet_id AND por.waktu_makan = mh.waktu_makan
    WHERE mh.tanggal = (SELECT d FROM tgl)
    GROUP BY r.bahan_id
  )
  SELECT
    b.id AS bahan_id,
    b.nama AS nama_bahan,
    b.satuan,
    ROUND(k.total_kebutuhan::numeric, 2) AS kebutuhan,
    COALESCE(sv.stok_total, 0)::numeric AS stok,
    GREATEST(0, ROUND((k.total_kebutuhan - COALESCE(sv.stok_total, 0))::numeric, 2)) AS kekurangan
  FROM kebutuhan_raw k
  JOIN bahan_makanan b ON b.id = k.bahan_id
  LEFT JOIN (
    SELECT bahan_id, SUM(jumlah_sisa) AS stok_total
    FROM stok_batch WHERE jumlah_sisa > 0
    GROUP BY bahan_id
  ) sv ON sv.bahan_id = k.bahan_id
  ORDER BY kekurangan DESC, nama_bahan;
$$;

-- ============================================================
-- MIGRATION: 16_pengajuan_diet_lengkap.sql
-- ============================================================
-- NutriSmart Migration: 16_pengajuan_diet_lengkap.sql

-- Tambah kolom alasan_penolakan jika belum ada
ALTER TABLE pengajuan_diet
  ADD COLUMN IF NOT EXISTS alasan_penolakan text;

-- Tambah status 'dibatalkan' ke constraint check jika belum ada
-- (Drop constraint lama, buat baru)
ALTER TABLE pengajuan_diet
  DROP CONSTRAINT IF EXISTS pengajuan_diet_status_check;

ALTER TABLE pengajuan_diet
  ADD CONSTRAINT pengajuan_diet_status_check
  CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan'));

-- Policy: perawat boleh update status='dibatalkan' pada pengajuan miliknya yang statusnya 'menunggu'
DROP POLICY IF EXISTS pengajuan_diet_perawat_batalkan ON pengajuan_diet;
CREATE POLICY pengajuan_diet_perawat_batalkan ON pengajuan_diet
  FOR UPDATE USING (
    diajukan_oleh = auth.uid()
    AND status = 'menunggu'
  )
  WITH CHECK (status = 'dibatalkan');

-- ============================================================
-- MIGRATION: 17_mutasi_stok.sql
-- ============================================================
-- NutriSmart Migration: 17_mutasi_stok.sql
-- Tabel kartu stok untuk tracking semua mutasi batch

CREATE TABLE IF NOT EXISTS mutasi_stok (
  id          bigserial PRIMARY KEY,
  batch_id    integer REFERENCES stok_batch(id) ON DELETE SET NULL,
  bahan_id    integer REFERENCES bahan_makanan(id),
  jenis       text NOT NULL CHECK (jenis IN ('masuk','keluar','buang','koreksi')),
  jumlah      numeric NOT NULL,
  catatan     text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mutasi_stok_batch  ON mutasi_stok(batch_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_stok_bahan  ON mutasi_stok(bahan_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_stok_created ON mutasi_stok(created_at DESC);

ALTER TABLE mutasi_stok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mutasi_stok_baca ON mutasi_stok;
CREATE POLICY mutasi_stok_baca ON mutasi_stok
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi','koki','gudang'))
  );

DROP POLICY IF EXISTS mutasi_stok_tulis ON mutasi_stok;
CREATE POLICY mutasi_stok_tulis ON mutasi_stok
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- MIGRATION: 18_catatan_gizi.sql
-- ============================================================
-- NutriSmart Migration: 18_catatan_gizi.sql
-- Catatan ahli gizi per pasien per tanggal

CREATE TABLE IF NOT EXISTS catatan_gizi (
  id          bigserial PRIMARY KEY,
  pasien_id   integer NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
  tanggal     date NOT NULL DEFAULT hari_ini(),
  catatan     text NOT NULL,
  dibuat_oleh uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(pasien_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_catatan_gizi_pasien ON catatan_gizi(pasien_id);
CREATE INDEX IF NOT EXISTS idx_catatan_gizi_tanggal ON catatan_gizi(tanggal DESC);

ALTER TABLE catatan_gizi ENABLE ROW LEVEL SECURITY;

-- Ahli gizi dan admin bisa baca + tulis; perawat bisa baca saja
DROP POLICY IF EXISTS catatan_gizi_baca ON catatan_gizi;
CREATE POLICY catatan_gizi_baca ON catatan_gizi
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi','perawat'))
  );

DROP POLICY IF EXISTS catatan_gizi_tulis ON catatan_gizi;
CREATE POLICY catatan_gizi_tulis ON catatan_gizi
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi'))
  );

DROP POLICY IF EXISTS catatan_gizi_update ON catatan_gizi;
CREATE POLICY catatan_gizi_update ON catatan_gizi
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi'))
  );

