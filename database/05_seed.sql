-- ===== 05_seed.sql =====
-- NutriSmart: Data dummy minimum
-- Jalankan setelah 04_rls.sql (atau sebelumnya kalau RLS belum aktif)
-- Tanggal relatif: current_date = "hari ini"

truncate table supplier, bangsal, jenis_diet, pasien, menu, menu_diet, bahan_makanan, resep, stok_batch, menu_harian, pesanan_makan, pemakaian_bahan, pengembalian_makanan, pengajuan_diet, pengajuan_pembelian, pengajuan_pembelian_item, pengaturan restart identity cascade;

-- Pengaturan
insert into pengaturan (key, value) values
  ('cutoff_pagi', '06:00'),
  ('cutoff_siang', '09:00'),
  ('cutoff_malam', '15:00'),
  ('batas_hari_kedaluwarsa', '3');

-- Bangsal
insert into bangsal (nama, lantai) values
  ('Melati', 1),
  ('Mawar', 2),
  ('VIP', 3);

-- Jenis diet
insert into jenis_diet (nama, kalori_maks_per_makan, natrium_maks_per_makan, tekstur) values
  ('Normal', 700, 800, 'biasa'),
  ('Diet DM', 500, 600, 'biasa'),
  ('Rendah Garam', 600, 300, 'biasa'),
  ('Diet Lunak', 550, 700, 'lunak'),
  ('Diet Cair', 400, 500, 'cair');

-- Supplier
insert into supplier (nama, kontak) values
  ('PT Segar Jaya', '021-5551234'),
  ('UD Tani Makmur', '081234567890'),
  ('CV Laut Biru', '022-4445678');

-- Bahan makanan (15 item)
insert into bahan_makanan (nama, satuan, stok_minimum, supplier_id) values
  ('Beras', 'kg', 20, 1),
  ('Ayam', 'kg', 10, 1),
  ('Ikan', 'kg', 8, 3),
  ('Telur', 'pcs', 50, 2),
  ('Tahu', 'pcs', 30, 2),
  ('Tempe', 'pcs', 30, 2),
  ('Bayam', 'kg', 5, 2),
  ('Wortel', 'kg', 5, 2),
  ('Kacang Tanah', 'kg', 3, 2),
  ('Udang', 'kg', 5, 3),
  ('Susu', 'liter', 10, 1),
  ('Gula', 'kg', 5, 1),
  ('Minyak', 'liter', 10, 1),
  ('Garam', 'kg', 3, 1),
  ('Buah', 'kg', 8, 2);

-- Menu (10 menu)
insert into menu (nama, kalori, natrium, tekstur, mengandung_alergen) values
  ('Nasi Tim Ayam', 450, 350, 'biasa', '{}'),
  ('Nasi Goreng Telur', 500, 400, 'biasa', '{}'),
  ('Sup Ikan Wortel', 350, 250, 'biasa', '{}'),
  ('Bubur Ayam', 400, 300, 'lunak', '{}'),
  ('Tumis Tahu Tempe', 300, 200, 'biasa', '{}'),
  ('Soto Ayam', 420, 380, 'biasa', '{kacang}'),
  ('Nasi Udang Saus', 480, 450, 'biasa', '{udang}'),
  ('Bubur Kacang Hijau', 350, 150, 'lunak', '{kacang}'),
  ('Sup Bayam Telur', 280, 200, 'biasa', '{}'),
  ('Jus Buah Susu', 300, 100, 'cair', '{}');

-- Menu-diet (relasi menu cocok untuk diet mana)
insert into menu_diet (menu_id, jenis_diet_id) values
  -- Nasi Tim Ayam: Normal, Diet DM
  (1, 1), (1, 2),
  -- Nasi Goreng Telur: Normal
  (2, 1),
  -- Sup Ikan Wortel: Normal, Rendah Garam, Diet DM
  (3, 1), (3, 3), (3, 2),
  -- Bubur Ayam: Diet Lunak, Normal
  (4, 4), (4, 1),
  -- Tumis Tahu Tempe: Normal, Diet DM, Rendah Garam
  (5, 1), (5, 2), (5, 3),
  -- Soto Ayam: Normal (mengandung kacang)
  (6, 1),
  -- Nasi Udang Saus: Normal (mengandung udang)
  (7, 1),
  -- Bubur Kacang Hijau: Diet Lunak (mengandung kacang)
  (8, 4),
  -- Sup Bayam Telur: Normal, Diet DM, Rendah Garam
  (9, 1), (9, 2), (9, 3),
  -- Jus Buah Susu: Diet Cair
  (10, 5);

-- Resep (tiap menu 2-4 bahan)
insert into resep (menu_id, bahan_id, jumlah_per_porsi) values
  -- Nasi Tim Ayam: beras 0.15kg, ayam 0.1kg, wortel 0.05kg
  (1, 1, 0.15), (1, 2, 0.10), (1, 8, 0.05),
  -- Nasi Goreng Telur: beras 0.15kg, telur 2pcs, minyak 0.02L
  (2, 1, 0.15), (2, 4, 2), (2, 13, 0.02),
  -- Sup Ikan Wortel: ikan 0.12kg, wortel 0.08kg, garam 0.005kg
  (3, 3, 0.12), (3, 8, 0.08), (3, 14, 0.005),
  -- Bubur Ayam: beras 0.1kg, ayam 0.08kg, garam 0.003kg
  (4, 1, 0.10), (4, 2, 0.08), (4, 14, 0.003),
  -- Tumis Tahu Tempe: tahu 2pcs, tempe 2pcs, minyak 0.02L
  (5, 5, 2), (5, 6, 2), (5, 13, 0.02),
  -- Soto Ayam: ayam 0.12kg, kacang tanah 0.03kg, garam 0.005kg
  (6, 2, 0.12), (6, 9, 0.03), (6, 14, 0.005),
  -- Nasi Udang Saus: beras 0.15kg, udang 0.12kg, minyak 0.03L
  (7, 1, 0.15), (7, 10, 0.12), (7, 13, 0.03),
  -- Bubur Kacang Hijau: kacang tanah 0.05kg, gula 0.03kg, susu 0.1L
  (8, 9, 0.05), (8, 12, 0.03), (8, 11, 0.10),
  -- Sup Bayam Telur: bayam 0.1kg, telur 1pcs, garam 0.003kg
  (9, 7, 0.10), (9, 4, 1), (9, 14, 0.003),
  -- Jus Buah Susu: buah 0.15kg, susu 0.2L, gula 0.02kg
  (10, 15, 0.15), (10, 11, 0.20), (10, 12, 0.02);

-- Stok batch: 1-2 batch per bahan
-- 2 batch hampir kedaluwarsa (<=3 hari), 1 bahan di bawah minimum
insert into stok_batch (bahan_id, jumlah_sisa, tgl_masuk, tgl_kedaluwarsa) values
  -- Beras: cukup
  (1, 15, current_date - 10, current_date + 30),
  (1, 10, current_date - 5, current_date + 60),
  -- Ayam: batch hampir kedaluwarsa!
  (2, 3, current_date - 5, current_date + 2),
  (2, 8, current_date - 1, current_date + 7),
  -- Ikan: cukup
  (3, 10, current_date - 3, current_date + 5),
  -- Telur: cukup
  (4, 60, current_date - 2, current_date + 14),
  -- Tahu: cukup
  (5, 40, current_date - 1, current_date + 5),
  -- Tempe: cukup
  (6, 35, current_date - 1, current_date + 4),
  -- Bayam: batch hampir kedaluwarsa!
  (7, 2, current_date - 3, current_date + 1),
  (7, 4, current_date - 1, current_date + 5),
  -- Wortel: cukup
  (8, 8, current_date - 4, current_date + 10),
  -- Kacang Tanah: DI BAWAH MINIMUM (stok_minimum=3, sisa=1.5)
  (9, 1.5, current_date - 10, current_date + 60),
  -- Udang: cukup
  (10, 6, current_date - 2, current_date + 4),
  -- Susu: cukup
  (11, 12, current_date - 1, current_date + 7),
  -- Gula: cukup
  (12, 6, current_date - 5, current_date + 90),
  -- Minyak: cukup
  (13, 12, current_date - 3, current_date + 60),
  -- Garam: cukup
  (14, 4, current_date - 7, current_date + 180),
  -- Buah: cukup
  (15, 10, current_date - 1, current_date + 5);

-- 20 pasien aktif, tersebar 3 bangsal, beberapa alergi
insert into pasien (no_rm, nama, bangsal_id, kamar, diagnosa, alergi, jenis_diet_id, status) values
  ('RM001', 'Andi Pratama', 1, '101A', 'Diabetes Melitus', '{}', 2, 'aktif'),
  ('RM002', 'Budi Santoso', 1, '101B', 'Hipertensi', '{}', 3, 'aktif'),
  ('RM003', 'Citra Dewi', 1, '102A', 'Post-op Apendektomi', '{}', 4, 'aktif'),
  ('RM004', 'Dian Kusuma', 1, '102B', 'Gastritis', '{kacang}', 1, 'aktif'),
  ('RM005', 'Eka Wijaya', 1, '103A', 'Fraktur Femur', '{}', 1, 'aktif'),
  ('RM006', 'Fajar Rahman', 1, '103B', 'Pneumonia', '{udang}', 1, 'aktif'),
  ('RM007', 'Gita Purnama', 2, '201A', 'Diabetes Melitus', '{}', 2, 'aktif'),
  ('RM008', 'Haris Munandar', 2, '201B', 'Stroke Ringan', '{kacang,udang}', 4, 'aktif'),
  ('RM009', 'Indah Lestari', 2, '202A', 'Demam Tifoid', '{}', 4, 'aktif'),
  ('RM010', 'Joko Widodo', 2, '202B', 'PPOK', '{}', 1, 'aktif'),
  ('RM011', 'Kartika Sari', 2, '203A', 'Hepatitis A', '{}', 3, 'aktif'),
  ('RM012', 'Lukman Hakim', 2, '203B', 'Gagal Ginjal', '{}', 3, 'aktif'),
  ('RM013', 'Maya Anggraini', 3, '301', 'Diabetes Melitus', '{kacang}', 2, 'aktif'),
  ('RM014', 'Nanda Putra', 3, '302', 'Hipertensi', '{}', 3, 'aktif'),
  ('RM015', 'Olivia Tan', 3, '303', 'Post-op Caesar', '{}', 4, 'aktif'),
  ('RM016', 'Pandu Setiawan', 3, '304', 'Dengue Fever', '{}', 1, 'aktif'),
  ('RM017', 'Qori Amalia', 3, '305', 'Asma Berat', '{udang}', 1, 'aktif'),
  ('RM018', 'Rizky Firmansyah', 1, '104A', 'Gangguan Menelan', '{}', 5, 'aktif'),
  ('RM019', 'Siti Nurhaliza', 2, '204A', 'Pasca Operasi Mulut', '{}', 5, 'aktif'),
  ('RM020', 'Taufik Hidayat', 3, '306', 'Disfagia', '{}', 5, 'aktif');

-- Menu harian: hari ini + 6 hari ke depan
-- Pagi / Siang / Malam per jenis diet
do $$
declare
  d date;
  i int;
begin
  for i in 0..6 loop
    d := current_date + i;
    -- Normal (diet_id=1)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 1, 1),   -- Nasi Tim Ayam
      (d, 'siang', 1, 2),  -- Nasi Goreng Telur
      (d, 'malam', 1, 3);  -- Sup Ikan Wortel
    -- Diet DM (diet_id=2)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 2, 1),   -- Nasi Tim Ayam
      (d, 'siang', 2, 5),  -- Tumis Tahu Tempe
      (d, 'malam', 2, 9);  -- Sup Bayam Telur
    -- Rendah Garam (diet_id=3)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 3, 3),   -- Sup Ikan Wortel
      (d, 'siang', 3, 5),  -- Tumis Tahu Tempe
      (d, 'malam', 3, 9);  -- Sup Bayam Telur
    -- Diet Lunak (diet_id=4)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 4, 4),   -- Bubur Ayam
      (d, 'siang', 4, 4),  -- Bubur Ayam
      (d, 'malam', 4, 8);  -- Bubur Kacang Hijau
    -- Diet Cair (diet_id=5)
    insert into menu_harian (tanggal, waktu_makan, jenis_diet_id, menu_id) values
      (d, 'pagi', 5, 10),  -- Jus Buah Susu
      (d, 'siang', 5, 10), -- Jus Buah Susu
      (d, 'malam', 5, 10); -- Jus Buah Susu
  end loop;
end $$;

-- Data historis: pesanan 30 hari lalu untuk grafik tren
-- Insert pesanan lampau + pengembalian
do $$
declare
  d date;
  i int;
  wm text;
  p_id bigint;
  m_id bigint;
  pes_id bigint;
  rand_persen int;
  rand_alasan text;
  alasan_arr text[] := array['mual','menu_tidak_cocok','nafsu_makan_menurun','porsi_terlalu_banyak','lainnya'];
  persen_arr int[] := array[0,25,50,75,100];
begin
  for i in 1..30 loop
    d := current_date - i;
    for wm in select unnest(array['pagi','siang','malam']) loop
      -- Ambil 5 pasien untuk pesanan historis
      for p_id in select id from pasien where status = 'aktif' order by id limit 5 loop
        -- Cari menu yang sesuai dengan jenis diet pasien dan tidak alergi
        select md.menu_id into m_id
        from menu_diet md
        join menu m on m.id = md.menu_id
        join pasien p on p.id = p_id
        where md.jenis_diet_id = p.jenis_diet_id
          and not (m.mengandung_alergen && p.alergi)
        order by md.menu_id
        limit 1;

        if m_id is not null then
          -- Insert pesanan berstatus terkirim
          insert into pesanan_makan (tanggal, waktu_makan, pasien_id, menu_id, status)
          values (d, wm, p_id, m_id, 'terkirim')
          on conflict (tanggal, waktu_makan, pasien_id) do nothing
          returning id into pes_id;

          -- Sebagian punya pengembalian (sekitar 40%)
          if pes_id is not null and random() < 0.4 then
            rand_persen := persen_arr[1 + floor(random() * 5)::int];
            rand_alasan := alasan_arr[1 + floor(random() * 5)::int];
            insert into pengembalian_makanan (pesanan_id, persen_sisa, alasan)
            values (pes_id, rand_persen, rand_alasan)
            on conflict do nothing;
          end if;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

