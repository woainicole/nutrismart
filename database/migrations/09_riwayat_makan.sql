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

