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
