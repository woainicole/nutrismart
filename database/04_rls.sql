-- ===== 04_rls.sql =====
-- NutriSmart: Row Level Security
-- Jalankan setelah 03_views.sql
-- PENTING: Selama development boleh dinonaktifkan, tapi T-25 wajib aktif

-- Aktifkan RLS + semua user login boleh membaca
do $$
declare t text;
begin
  for t in select unnest(array[
    'bangsal','profiles','jenis_diet','pasien','menu','menu_diet','supplier',
    'bahan_makanan','resep','stok_batch','menu_harian','pesanan_makan',
    'pemakaian_bahan','pengembalian_makanan','pengajuan_diet',
    'pengajuan_pembelian','pengajuan_pembelian_item','pengaturan'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "baca_%s" on %I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- Tulis: per tabel, per role
create policy "tulis_bangsal" on bangsal for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

create policy "tulis_pasien" on pasien for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_jenis_diet" on jenis_diet for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_menu" on menu for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_menu_diet" on menu_diet for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_resep" on resep for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));
create policy "tulis_menu_harian" on menu_harian for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "tulis_supplier" on supplier for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "tulis_bahan" on bahan_makanan for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "tulis_stok_batch" on stok_batch for all to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));

create policy "tulis_pesanan" on pesanan_makan for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki'))
  with check (current_role_name() in ('admin','ahli_gizi','koki'));

create policy "tulis_pengembalian" on pengembalian_makanan for all to authenticated
  using (current_role_name() in ('admin','ahli_gizi','koki','perawat'))
  with check (current_role_name() in ('admin','ahli_gizi','koki','perawat'));

create policy "buat_pengajuan_diet" on pengajuan_diet for insert to authenticated
  with check (current_role_name() in ('admin','perawat'));
create policy "tolak_pengajuan_diet" on pengajuan_diet for update to authenticated
  using (current_role_name() in ('admin','ahli_gizi'))
  with check (current_role_name() in ('admin','ahli_gizi'));

create policy "buat_pembelian" on pengajuan_pembelian for insert to authenticated
  with check (current_role_name() in ('admin','koki'));
create policy "proses_pembelian" on pengajuan_pembelian for update to authenticated
  using (current_role_name() in ('admin','gudang'))
  with check (current_role_name() in ('admin','gudang'));
create policy "buat_item_pembelian" on pengajuan_pembelian_item for insert to authenticated
  with check (current_role_name() in ('admin','koki'));

create policy "tulis_pengaturan" on pengaturan for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

create policy "admin_kelola_profiles" on profiles for all to authenticated
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');
create policy "ubah_profil_sendiri" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = current_role_name());

