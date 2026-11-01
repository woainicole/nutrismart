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

