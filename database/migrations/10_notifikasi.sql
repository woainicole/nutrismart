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

