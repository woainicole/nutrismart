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
      SUM(r.jumlah * por.jumlah) AS total_kebutuhan
    FROM menu_harian mh
    JOIN menu_diet md ON md.jenis_diet_id = mh.jenis_diet_id AND md.waktu_makan = mh.waktu_makan
    JOIN resep r ON r.menu_id = md.menu_id
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
