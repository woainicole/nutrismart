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

