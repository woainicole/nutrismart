-- NutriSmart Migration: 17_mutasi_stok.sql
-- Tabel kartu stok untuk tracking semua mutasi batch

CREATE TABLE IF NOT EXISTS mutasi_stok (
  id          bigserial PRIMARY KEY,
  batch_id    integer REFERENCES stok_batch(id) ON DELETE SET NULL,
  bahan_id    integer REFERENCES bahan_makanan(id),
  jenis       text NOT NULL CHECK (jenis IN ('masuk','keluar','buang','koreksi')),
  jumlah      numeric NOT NULL,
  catatan     text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mutasi_stok_batch  ON mutasi_stok(batch_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_stok_bahan  ON mutasi_stok(bahan_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_stok_created ON mutasi_stok(created_at DESC);

ALTER TABLE mutasi_stok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mutasi_stok_baca ON mutasi_stok;
CREATE POLICY mutasi_stok_baca ON mutasi_stok
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ahli_gizi','koki','gudang'))
  );

DROP POLICY IF EXISTS mutasi_stok_tulis ON mutasi_stok;
CREATE POLICY mutasi_stok_tulis ON mutasi_stok
  FOR INSERT WITH CHECK (true);

