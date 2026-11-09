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
