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
