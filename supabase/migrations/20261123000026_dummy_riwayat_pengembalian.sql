-- Migration 26: Data dummy untuk Riwayat Makan & Pengembalian Makanan
-- Idempotent: pakai DO block + EXISTS check, tidak hardcode UUID
-- Hanya insert jika belum ada data terkirim di 7 hari terakhir

-- CATATAN: SQL ini sudah diperbaiki berdasarkan schema aktual Supabase.
-- Constraint yang ditemukan:
--   pasien.status = 'aktif' (bukan kolom 'aktif')
--   pengembalian_makanan.persen_sisa IN (0, 25, 50, 75, 100)
--   pengembalian_makanan.alasan IN ('mual','menu_tidak_cocok','nafsu_makan_menurun','pasien_pulang','porsi_terlalu_banyak','lainnya')
--   menu harus match jenis_diet pasien via tabel menu_diet (ada trigger validasi_pesanan)
--   unique(tanggal, waktu_makan, pasien_id) di pesanan_makan

DO $dummy$
DECLARE
  v_profile_id  uuid;
  v_pesanan_id  bigint;
  v_persen      int;
  v_alasan      text;
  r             record;
  i             int;
  v_waktu       text;
  waktus        text[] := ARRAY['pagi','siang','malam'];
  alasans       text[] := ARRAY[
    'mual','menu_tidak_cocok','nafsu_makan_menurun',
    'pasien_pulang','porsi_terlalu_banyak','lainnya'
  ];
  persens       int[]  := ARRAY[0, 25, 50, 75, 100];
BEGIN
  SELECT id INTO v_profile_id FROM profiles LIMIT 1;

  FOR i IN 0..6 LOOP
    FOREACH v_waktu IN ARRAY waktus LOOP

      FOR r IN
        SELECT DISTINCT ON (p.id)
          p.id AS pasien_id,
          p.jenis_diet_id,
          md.menu_id
        FROM pasien p
        JOIN menu_diet md ON md.jenis_diet_id = p.jenis_diet_id
        WHERE p.status = 'aktif'
          AND cardinality(konflik_alergi(md.menu_id, COALESCE(p.alergi, '{}'))) = 0
        ORDER BY p.id,
          ((ABS(HASHTEXT(p.id::text || i::text || v_waktu)) % 20) + md.menu_id)
        LIMIT 5
      LOOP

        -- Skip jika sudah ada pesanan apapun untuk slot ini (unique constraint)
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM pesanan_makan
          WHERE pasien_id = r.pasien_id
            AND tanggal = CURRENT_DATE - i
            AND waktu_makan = v_waktu
        );

        INSERT INTO pesanan_makan
          (pasien_id, tanggal, waktu_makan, menu_id, jenis_diet_id, status,
           porsi, disiapkan_at, siap_at, terkirim_at)
        VALUES
          (r.pasien_id, CURRENT_DATE - i, v_waktu, r.menu_id, r.jenis_diet_id, 'terkirim',
           1,
           (CURRENT_DATE - i) + INTERVAL '5 hours',
           (CURRENT_DATE - i) + INTERVAL '6 hours',
           (CURRENT_DATE - i) + INTERVAL '7 hours')
        RETURNING id INTO v_pesanan_id;

        IF (ABS(HASHTEXT(v_pesanan_id::text)) % 10) < 6 THEN
          v_persen := persens[1 + (ABS(HASHTEXT(v_pesanan_id::text || 'p')) % 5)];
          v_alasan := alasans[1 + (ABS(HASHTEXT(v_pesanan_id::text || 'a')) % 6)];

          IF NOT EXISTS (SELECT 1 FROM pengembalian_makanan WHERE pesanan_id = v_pesanan_id) THEN
            INSERT INTO pengembalian_makanan (pesanan_id, persen_sisa, alasan, dicatat_oleh)
            VALUES (v_pesanan_id, v_persen, v_alasan, v_profile_id);
          END IF;
        END IF;

      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Dummy data selesai.';
END $dummy$;
