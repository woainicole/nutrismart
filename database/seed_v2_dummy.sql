-- ====================================================================
-- NUTRISMART - SEED DATA DUMMY FITUR V2 (ADDENDUM V2)
-- Mendukung fitur: Alergen Menu, Batas Gizi Diet, Riwayat Makan & Pasien Perhatian,
-- Pengajuan Diet Baru, Catatan Gizi Klinis, Mutasi Stok, Notifikasi, Log Aktivitas
-- ====================================================================

-- 1. Alergen pada bahan makanan
UPDATE bahan_makanan SET alergen = ARRAY['ikan', 'seafood'] WHERE id = 3;
UPDATE bahan_makanan SET alergen = ARRAY['telur'] WHERE id = 4;
UPDATE bahan_makanan SET alergen = ARRAY['kedelai'] WHERE id IN (5, 6);
UPDATE bahan_makanan SET alergen = ARRAY['kacang', 'kacang tanah'] WHERE id = 9;
UPDATE bahan_makanan SET alergen = ARRAY['udang', 'seafood'] WHERE id = 10;
UPDATE bahan_makanan SET alergen = ARRAY['susu', 'laktosa'] WHERE id = 11;
UPDATE bahan_makanan SET alergen = ARRAY['gluten', 'gandum'] WHERE id = 17;

-- 2. Batas kalori dan natrium jenis diet
UPDATE jenis_diet SET batas_kalori = 700, batas_natrium = 800 WHERE id = 1;
UPDATE jenis_diet SET batas_kalori = 500, batas_natrium = 600 WHERE id = 2;
UPDATE jenis_diet SET batas_kalori = 600, batas_natrium = 300 WHERE id = 3;
UPDATE jenis_diet SET batas_kalori = 550, batas_natrium = 700 WHERE id = 4;
UPDATE jenis_diet SET batas_kalori = 400, batas_natrium = 500 WHERE id = 5;

-- 3. Pengajuan diet dummy (menunggu, ditolak, dibatalkan)
ALTER TABLE pengajuan_diet DISABLE TRIGGER trg_cutoff_diet;

UPDATE pengajuan_diet 
SET alasan_penolakan = 'Pasien belum melewati masa observasi puasa pra-operasi' 
WHERE id = 6;

INSERT INTO pengajuan_diet (pasien_id, diet_lama_id, diet_baru_id, tanggal_berlaku, waktu_makan, alasan, diajukan_oleh, status, created_at)
VALUES (
  8, 4, 5, '2026-11-10', 'pagi',
  'Pasien mengeluh mual berat dan tidak mampu menelan makanan lunak. Rencana ganti ke diet cair berenergi tinggi.',
  '8e8d7b18-2a13-43c3-9e52-31b359181ec0'::uuid, 'menunggu', '2026-11-09 10:15:00+07'
) ON CONFLICT DO NOTHING;

INSERT INTO pengajuan_diet (pasien_id, diet_lama_id, diet_baru_id, tanggal_berlaku, waktu_makan, alasan, diajukan_oleh, status, disetujui_oleh, alasan_penolakan, created_at)
VALUES (
  7, 2, 1, '2026-11-09', 'pagi',
  'Keluarga meminta pasien diberi makanan biasa.',
  '8e8d7b18-2a13-43c3-9e52-31b359181ec0'::uuid, 'ditolak',
  'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid,
  'Kadar glukosa darah sewaktu masih 245 mg/dL. Tetap pertahankan Diet DM sampai hasil lab terkontrol.',
  '2026-11-08 14:20:00+07'
) ON CONFLICT DO NOTHING;

INSERT INTO pengajuan_diet (pasien_id, diet_lama_id, diet_baru_id, tanggal_berlaku, waktu_makan, alasan, diajukan_oleh, status, alasan_penolakan, created_at)
VALUES (
  19, 5, 4, '2026-11-09', 'siang',
  'Rencana uji coba diet bubur saring.',
  '8e8d7b18-2a13-43c3-9e52-31b359181ec0'::uuid, 'dibatalkan',
  'Dibatalkan oleh bangsal: Pasien mengalami demam mendadak dan perlu puasa sementara untuk pemeriksaan USG abdomen.',
  '2026-11-09 09:00:00+07'
) ON CONFLICT DO NOTHING;

ALTER TABLE pengajuan_diet ENABLE TRIGGER trg_cutoff_diet;

-- 4. Catatan Gizi Klinis
INSERT INTO catatan_gizi (pasien_id, tanggal, catatan, dibuat_oleh, created_at) VALUES
(8, '2026-11-07', 'Pasien mengeluh mual dan anoreksia pasca kemoterapi. Asupan oral < 40%. Diet lunak tersisa lebih dari separuh. Diberikan edukasi pola makan porsi kecil.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-07 10:30:00+07'),
(8, '2026-11-08', 'Edukasi keluarga tentang porsi makan kecil tapi sering (small frequent feeding). Hindari makanan berbumbu tajam/pedas dan berbau menyengat.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-08 11:00:00+07'),
(8, '2026-11-09', 'Asupan masih rendah 3 hari berturut-turut (rata-rata sisa 75%). Usul perawat untuk transisi ke diet cair berenergi tinggi disetujui, tambahkan suplemen nutrisi oral (ONS).', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-09 10:45:00+07'),
(19, '2026-11-08', 'Evaluasi diet cair pasca operasi saluran cerna hari ke-3. Toleransi cairan cukup baik, namun intake masih lambat karena kembung.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-08 13:15:00+07'),
(19, '2026-11-09', 'Refluks berkurang. Pasien sempat demam, tunggu hasil konfirmasi dokter penanggung jawab sebelum naik tekstur ke bubur saring.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-09 11:30:00+07'),
(2, '2026-11-08', 'Edukasi diet rendah garam tahap II (natrium < 600 mg). Pasien memahami pantangan makanan olahan dan kaldu instan.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-08 14:00:00+07'),
(2, '2026-11-09', 'Nafsu makan sangat baik, makanan pagi dihabiskan tanpa sisa. Tekanan darah stabil 130/80 mmHg. Teruskan diet.', 'a8becf0c-c5a5-49d2-b669-e2cf5035ce10'::uuid, '2026-11-09 09:15:00+07')
ON CONFLICT DO NOTHING;

-- 5. Mutasi Stok
INSERT INTO mutasi_stok (batch_id, bahan_id, jenis, jumlah, catatan, created_by, created_at) VALUES
(2, 1, 'masuk', 25.0, 'Penerimaan beras premium dari CV Pangan Sejahtera', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-07 08:30:00+07'),
(1, 1, 'keluar', 5.0, 'Pemakaian beras untuk masak pagi (Nasi Tim & Nasi Goreng)', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-09 05:30:00+07'),
(4, 2, 'keluar', 4.0, 'Pemakaian ayam fillet untuk Soto Ayam sesi siang', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-09 10:00:00+07'),
(9, 7, 'keluar', 2.0, 'Pemakaian bayam segar untuk sup pagi', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-09 05:45:00+07'),
(6, 4, 'koreksi', 3.0, 'Penyesuaian stok opname mingguan: 3 butir telur pecah saat pemindahan', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-08 16:00:00+07'),
(7, 5, 'buang', 4.0, 'Pembuangan 4 pcs tahu rusak akibat penurunan suhu showcase', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-08 17:00:00+07'),
(NULL, 11, 'masuk', 15.0, 'Pengadaan darurat susu pasteurisasi 15 liter', '1b728e1d-a6aa-4c64-a8fc-09238d49d6cb'::uuid, '2026-11-09 08:00:00+07');

