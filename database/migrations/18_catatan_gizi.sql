-- NutriSmart Migration: 18_catatan_gizi.sql
-- Catatan ahli gizi per pasien per tanggal

CREATE TABLE IF NOT EXISTS catatan_gizi (
  id          bigserial PRIMARY KEY,
  pasien_id   integer NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
  tanggal     date NOT NULL DEFAULT hari_ini(),
  catatan     text NOT NULL,
  dibuat_oleh uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(pasien_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_catatan_gizi_pasien ON catatan_gizi(pasien_id);
CREATE INDEX IF NOT EXISTS idx_catatan_gizi_tanggal ON catatan_gizi(tanggal DESC);

ALTER TABLE catatan_gizi ENABLE ROW LEVEL SECURITY;

-- Ahli gizi dan admin bisa baca + tulis; perawat bisa baca saja
DROP POLICY IF EXISTS catatan_gizi_baca ON catatan_gizi;
CREATE POLICY catatan_gizi_baca ON catatan_gizi
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi','perawat'))
  );

DROP POLICY IF EXISTS catatan_gizi_tulis ON catatan_gizi;
CREATE POLICY catatan_gizi_tulis ON catatan_gizi
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi'))
  );

DROP POLICY IF EXISTS catatan_gizi_update ON catatan_gizi;
CREATE POLICY catatan_gizi_update ON catatan_gizi
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi'))
  );

