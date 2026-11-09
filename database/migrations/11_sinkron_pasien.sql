-- NutriSmart Migration: 11_sinkron_pasien.sql
-- Trigger: sinkron pesanan otomatis saat pasien diubah
-- File: 11_sinkron_pasien.sql

-- Trigger function: batalkan pesanan menunggu jika pulang, sinkron jika alergi/diet berubah
CREATE OR REPLACE FUNCTION _trigger_sinkron_pasien()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d date;
BEGIN
  -- Jika pasien pulang: batalkan semua pesanan menunggu
  IF NEW.status = 'pulang' AND OLD.status <> 'pulang' THEN
    UPDATE pesanan_makan
    SET status = 'dibatalkan'
    WHERE pasien_id = NEW.id AND status = 'menunggu';
  END IF;

  -- Jika aktif dan alergi/diet berubah: sinkron pesanan mendatang
  IF NEW.status = 'aktif' AND (
    NEW.alergi IS DISTINCT FROM OLD.alergi OR
    NEW.jenis_diet_id IS DISTINCT FROM OLD.jenis_diet_id
  ) THEN
    FOR d IN
      SELECT DISTINCT tanggal FROM menu_harian
      WHERE tanggal >= hari_ini()
      ORDER BY tanggal
    LOOP
      PERFORM _sinkron_pesanan(d);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pasien_sinkron ON pasien;
CREATE TRIGGER trg_pasien_sinkron
  AFTER UPDATE OF alergi, jenis_diet_id, status ON pasien
  FOR EACH ROW EXECUTE FUNCTION _trigger_sinkron_pasien();
