-- NutriSmart Migration: 14_log_aktivitas.sql
-- Log aktivitas pengguna
-- File: 14_log_aktivitas.sql

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nama_tabel  text NOT NULL,
  aksi        text NOT NULL CHECK (aksi IN ('INSERT','UPDATE','DELETE')),
  baris_id    text,
  data_lama   jsonb,
  data_baru   jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_user ON log_aktivitas(user_id);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_tabel ON log_aktivitas(nama_tabel);
CREATE INDEX IF NOT EXISTS idx_log_aktivitas_created ON log_aktivitas(created_at DESC);

-- RLS: hanya admin yang bisa baca
ALTER TABLE log_aktivitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_admin_only ON log_aktivitas;
CREATE POLICY log_admin_only ON log_aktivitas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role bisa insert (trigger akan memakai ini)
DROP POLICY IF EXISTS log_insert_service ON log_aktivitas;
CREATE POLICY log_insert_service ON log_aktivitas
  FOR INSERT WITH CHECK (true);

-- Fungsi trigger catat log
CREATE OR REPLACE FUNCTION _catat_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO log_aktivitas(user_id, nama_tabel, aksi, baris_id, data_lama, data_baru)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Pasang trigger ke tabel-tabel penting
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pasien','menu','menu_harian','stok_batch','bahan_makanan','pengajuan_diet','pengajuan_pembelian','pengaturan'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_%I ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_log_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION _catat_log()',
      t, t
    );
  END LOOP;
END;
$$;
