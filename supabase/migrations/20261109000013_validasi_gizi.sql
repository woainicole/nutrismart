-- NutriSmart Migration: 13_validasi_gizi.sql
-- Validasi batas gizi saat menu ditambahkan ke jenis diet
-- File: 13_validasi_gizi.sql

-- Trigger validasi: kalori & natrium tidak boleh melampaui batas jenis diet
CREATE OR REPLACE FUNCTION _validasi_menu_diet()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_menu    record;
  v_diet    record;
  v_pesan   text;
BEGIN
  SELECT kalori, natrium INTO v_menu FROM menu WHERE id = NEW.menu_id;
  SELECT batas_kalori, batas_natrium, nama INTO v_diet FROM jenis_diet WHERE id = NEW.jenis_diet_id;

  -- Hanya validasi jika batas diset (tidak null)
  IF v_diet.batas_kalori IS NOT NULL AND v_menu.kalori > v_diet.batas_kalori THEN
    v_pesan := format('Kalori menu (%s kkal) melebihi batas diet %s (%s kkal)',
      v_menu.kalori, v_diet.nama, v_diet.batas_kalori);
    RAISE EXCEPTION '%', v_pesan;
  END IF;

  IF v_diet.batas_natrium IS NOT NULL AND v_menu.natrium > v_diet.batas_natrium THEN
    v_pesan := format('Natrium menu (%s mg) melebihi batas diet %s (%s mg)',
      v_menu.natrium, v_diet.nama, v_diet.batas_natrium);
    RAISE EXCEPTION '%', v_pesan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validasi_menu_diet ON menu_diet;
CREATE TRIGGER trg_validasi_menu_diet
  BEFORE INSERT OR UPDATE ON menu_diet
  FOR EACH ROW EXECUTE FUNCTION _validasi_menu_diet();

-- Tambah kolom batas gizi ke jenis_diet jika belum ada
ALTER TABLE jenis_diet
  ADD COLUMN IF NOT EXISTS batas_kalori integer,
  ADD COLUMN IF NOT EXISTS batas_natrium integer;
