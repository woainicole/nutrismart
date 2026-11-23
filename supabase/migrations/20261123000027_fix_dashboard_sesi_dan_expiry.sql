-- Migration 27: Fix dashboard sesi makan (n_disiapkan/n_siap/n_terkirim/aktif)
-- dan fix v_near_expiry agar tidak tampilkan yang sudah expired (sisa_hari negatif)
-- + fungsi buang_batch_kadaluwarsa untuk membersihkan stok yang sudah lewat

-- ─── 1. View sesi harian: agregasi status pesanan per sesi ───────────────────
-- Dashboard pakai: s.aktif, s.n_disiapkan, s.n_siap, s.n_terkirim
-- sesi_makan hanya punya tanggal + waktu_makan (sesi yang sudah "disiapkan" koki)
-- kita join dengan hitungan pesanan dari pesanan_makan

CREATE OR REPLACE VIEW v_sesi_harian
WITH (security_invoker = true) AS
SELECT
  sm.id,
  sm.tanggal,
  sm.waktu_makan,
  sm.jumlah_pesanan,
  sm.disiapkan_at,
  true AS aktif,                          -- ada di sesi_makan = sudah diaktifkan koki
  COUNT(pm.id) FILTER (WHERE pm.status = 'disiapkan') AS n_disiapkan,
  COUNT(pm.id) FILTER (WHERE pm.status = 'siap')      AS n_siap,
  COUNT(pm.id) FILTER (WHERE pm.status = 'terkirim')  AS n_terkirim
FROM sesi_makan sm
LEFT JOIN pesanan_makan pm
  ON pm.tanggal    = sm.tanggal
 AND pm.waktu_makan = sm.waktu_makan
 AND pm.status NOT IN ('dibatalkan')
GROUP BY sm.id, sm.tanggal, sm.waktu_makan, sm.jumlah_pesanan, sm.disiapkan_at;

-- RLS: semua authenticated bisa baca
ALTER VIEW v_sesi_harian OWNER TO postgres;
GRANT SELECT ON v_sesi_harian TO authenticated;

-- ─── 2. Fix v_near_expiry: pisahkan antara "hampir" dan "sudah" kedaluwarsa ──
-- Sebelumnya tidak ada filter sisa_hari >= 0, jadi yang sudah lewat ikut masuk

CREATE OR REPLACE VIEW v_near_expiry
WITH (security_invoker = true) AS
SELECT
  s.id          AS batch_id,
  b.nama        AS bahan,
  b.satuan,
  s.jumlah_sisa,
  s.tgl_kedaluwarsa,
  (s.tgl_kedaluwarsa - current_date) AS sisa_hari
FROM stok_batch s
JOIN bahan_makanan b ON b.id = s.bahan_id
WHERE s.jumlah_sisa > 0
  AND s.tgl_kedaluwarsa >= current_date                     -- hanya yang belum expired
  AND s.tgl_kedaluwarsa <= current_date +
      COALESCE(
        (SELECT value::int FROM pengaturan WHERE key = 'batas_hari_kedaluwarsa'),
        7                                                   -- default 7 hari (lebih berguna dari 3)
      );

-- ─── 3. View v_sudah_kadaluwarsa: batch yang sudah lewat tanggal ─────────────
-- Dipakai halaman Stok untuk tombol "Buang Semua Kedaluwarsa"

CREATE OR REPLACE VIEW v_sudah_kadaluwarsa
WITH (security_invoker = true) AS
SELECT
  s.id          AS batch_id,
  b.id          AS bahan_id,
  b.nama        AS bahan,
  b.satuan,
  s.jumlah_sisa,
  s.tgl_kedaluwarsa,
  (current_date - s.tgl_kedaluwarsa) AS hari_lewat
FROM stok_batch s
JOIN bahan_makanan b ON b.id = s.bahan_id
WHERE s.jumlah_sisa > 0
  AND s.tgl_kedaluwarsa < current_date;

ALTER VIEW v_sudah_kadaluwarsa OWNER TO postgres;
GRANT SELECT ON v_sudah_kadaluwarsa TO authenticated;

-- ─── 4. Fungsi buang_batch_kadaluwarsa ───────────────────────────────────────
-- Set jumlah_sisa = 0 untuk semua batch yang sudah lewat tanggal kedaluwarsa
-- Hanya admin & gudang yang bisa

CREATE OR REPLACE FUNCTION public.buang_batch_kadaluwarsa()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE jumlah int;
BEGIN
  -- Hanya admin & gudang
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','gudang')
  ) THEN
    RAISE EXCEPTION 'Tidak diizinkan: hanya admin/gudang yang bisa membuang stok kadaluwarsa';
  END IF;

  UPDATE stok_batch
  SET jumlah_sisa = 0
  WHERE jumlah_sisa > 0
    AND tgl_kedaluwarsa < current_date;

  GET DIAGNOSTICS jumlah = ROW_COUNT;
  RETURN jumlah;
END; $$;

REVOKE ALL ON FUNCTION public.buang_batch_kadaluwarsa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buang_batch_kadaluwarsa() TO authenticated;
