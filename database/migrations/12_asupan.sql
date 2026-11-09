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
LEFT JOIN pengembalian pen ON pen.pesanan_id = pm.id
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
