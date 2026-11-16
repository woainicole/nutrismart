-- ============================================================
-- Migration 20: Tabel kamar & jadwal operasi dari AdmisiRS
-- ============================================================
-- Tabel ini diisi lewat 2 cara:
--   1. Event masuk `operasi.dijadwalkan` (via ekstensi + RPC terima_event_integrasi)
--   2. Script sinkronisasi (sync_supabase_to_firebase.mjs) untuk data kamar
--
-- Idempoten: aman dijalankan ulang.
-- ============================================================

-- ─── 1. Tabel kamar_integrasi ────────────────────────────────────────────
-- Menyimpan daftar kamar dari AdmisiRS (Firebase) sebagai referensi di NutriSmart.
-- Berguna untuk menampilkan "pasien ini di kamar mana" tanpa harus buka AdmisiRS.

create table if not exists public.kamar_integrasi (
  id            bigint generated always as identity primary key,
  firebase_id   text unique,                        -- document ID di Firestore
  bangsal       text not null,                      -- 'Melati' | 'Mawar' | 'VIP'
  nomor         text not null,                      -- '101A', '301', dll.
  status        text not null default 'kosong'
                check (status in ('kosong','terisi')),
  pasien_no_rm  text,                               -- noRm pasien yang menempati
  sync_at       timestamptz not null default now(),
  unique (bangsal, nomor)
);

comment on table public.kamar_integrasi is
  'Daftar kamar dari AdmisiRS (Firebase). Di-sync lewat script atau event masuk.';

alter table public.kamar_integrasi enable row level security;
drop policy if exists "baca_kamar_integrasi" on public.kamar_integrasi;
create policy "baca_kamar_integrasi" on public.kamar_integrasi
  for select to authenticated using (true);
drop policy if exists "tulis_kamar_integrasi" on public.kamar_integrasi;
create policy "tulis_kamar_integrasi" on public.kamar_integrasi
  for all to authenticated using (true) with check (true);

-- ─── 2. Tabel jadwal_operasi_integrasi ───────────────────────────────────
-- Menyimpan jadwal operasi dari AdmisiRS.
-- Diisi oleh RPC terima_event_integrasi saat menerima event 'operasi.dijadwalkan'.
-- Juga bisa di-sync lewat script.

create table if not exists public.jadwal_operasi_integrasi (
  id            bigint generated always as identity primary key,
  firebase_id   text unique,                        -- document ID di Firestore (opsional)
  no_rm         text not null,
  nama_pasien   text,
  tindakan      text not null,
  tanggal       date not null,
  jam           text not null,                      -- 'HH:mm'
  dokter        text,
  status        text not null default 'terjadwal'
                check (status in ('terjadwal','selesai','batal')),
  catatan       text,
  sync_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table public.jadwal_operasi_integrasi is
  'Jadwal operasi dari AdmisiRS. Diisi via event operasi.dijadwalkan atau script sync.';

alter table public.jadwal_operasi_integrasi enable row level security;
drop policy if exists "baca_jadwal_operasi_integrasi" on public.jadwal_operasi_integrasi;
create policy "baca_jadwal_operasi_integrasi" on public.jadwal_operasi_integrasi
  for select to authenticated using (true);
drop policy if exists "tulis_jadwal_operasi_integrasi" on public.jadwal_operasi_integrasi;
create policy "tulis_jadwal_operasi_integrasi" on public.jadwal_operasi_integrasi
  for all to authenticated using (true) with check (true);

-- Index untuk pencarian cepat
create index if not exists jadwal_operasi_integrasi_no_rm_idx   on public.jadwal_operasi_integrasi (no_rm);
create index if not exists jadwal_operasi_integrasi_tanggal_idx on public.jadwal_operasi_integrasi (tanggal);

-- ─── 3. Update RPC terima_event_integrasi untuk jadwal operasi ───────────
-- Ganti bagian 'operasi.dijadwalkan' supaya menyimpan ke tabel di atas.

create or replace function public.terima_event_integrasi(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id  text;
  v_jenis     text;
  v_sumber    text;
  v_data      jsonb;
  v_no_rm     text;
  v_bangsal_id bigint;
  v_diet_id   bigint;
  v_tgl_masuk date;
  v_pesan     text;
begin
  v_event_id := p_event->>'eventId';
  v_jenis    := p_event->>'jenis';
  v_sumber   := p_event->>'sumber';
  v_data     := p_event->'data';

  -- Validasi envelope
  if v_event_id is null or v_event_id = '' then
    return jsonb_build_object('ok', false, 'pesan', 'eventId wajib diisi.');
  end if;
  if p_event->>'versi' is distinct from '1' then
    return jsonb_build_object('ok', false, 'pesan', 'Versi event tidak dikenal: ' || coalesce(p_event->>'versi','null'));
  end if;
  if v_sumber not in ('admisirs','nutrismart','simulator') then
    return jsonb_build_object('ok', false, 'pesan', 'Sumber tidak dikenal: ' || coalesce(v_sumber,'null'));
  end if;
  if v_jenis not in ('pasien.masuk','pasien.diperbarui','pasien.pulang','operasi.dijadwalkan','diet.diperbarui') then
    return jsonb_build_object('ok', false, 'pesan', 'Jenis event tidak dikenal: ' || coalesce(v_jenis,'null'));
  end if;
  if v_data is null or jsonb_typeof(v_data) <> 'object' then
    return jsonb_build_object('ok', false, 'pesan', 'Field data harus berupa objek JSON.');
  end if;

  -- Cek duplikat
  if exists (select 1 from integrasi_log where event_id = v_event_id) then
    return jsonb_build_object('ok', true, 'pesan', 'Duplikat, diabaikan.', 'status', 'diabaikan');
  end if;

  v_no_rm := v_data->>'noRm';

  -- ── pasien.masuk / pasien.diperbarui ──────────────────────────────────
  if v_jenis in ('pasien.masuk', 'pasien.diperbarui') then
    if v_no_rm is null or v_no_rm !~ '^RM\d{3,}$' then
      v_pesan := 'noRm tidak valid: ' || coalesce(v_no_rm, 'null');
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm, v_pesan, p_event);
      return jsonb_build_object('ok', false, 'pesan', v_pesan);
    end if;

    v_bangsal_id := _integ_bangsal_id(v_data->>'bangsal');
    v_diet_id    := _integ_diet_id(v_data->>'dietAwal');

    begin v_tgl_masuk := (v_data->>'tglMasuk')::date;
    exception when others then v_tgl_masuk := current_date; end;

    insert into pasien (
      no_rm, nama, jenis_kelamin, tgl_lahir, bangsal_id, kamar,
      diagnosa, alergi, jenis_diet_id, status, tgl_masuk
    ) values (
      v_no_rm,
      v_data->>'nama',
      coalesce(v_data->>'jenisKelamin','L'),
      coalesce((v_data->>'tglLahir')::date, '2000-01-01'),
      v_bangsal_id,
      coalesce(v_data->>'kamar',''),
      coalesce(v_data->>'diagnosa',''),
      coalesce(array(select jsonb_array_elements_text(v_data->'alergi')), '{}'::text[]),
      v_diet_id,
      'aktif',
      v_tgl_masuk
    )
    on conflict (no_rm) do update set
      nama          = excluded.nama,
      jenis_kelamin = excluded.jenis_kelamin,
      tgl_lahir     = excluded.tgl_lahir,
      bangsal_id    = coalesce(excluded.bangsal_id, pasien.bangsal_id),
      kamar         = excluded.kamar,
      diagnosa      = excluded.diagnosa,
      alergi        = excluded.alergi,
      jenis_diet_id = coalesce(excluded.jenis_diet_id, pasien.jenis_diet_id),
      status        = case when pasien.status = 'pulang' then 'aktif' else pasien.status end,
      tgl_masuk     = excluded.tgl_masuk;

    -- Update juga kamar_integrasi jika ada info bangsal + kamar
    if (v_data->>'bangsal') is not null and (v_data->>'kamar') is not null then
      insert into kamar_integrasi (bangsal, nomor, status, pasien_no_rm, sync_at)
      values (v_data->>'bangsal', v_data->>'kamar', 'terisi', v_no_rm, now())
      on conflict (bangsal, nomor) do update set
        status       = 'terisi',
        pasien_no_rm = v_no_rm,
        sync_at      = now();
    end if;

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Pasien ' || v_no_rm || ' diperbarui.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Pasien ' || v_no_rm || ' diperbarui.', 'noRm', v_no_rm);

  -- ── pasien.pulang ──────────────────────────────────────────────────────
  elsif v_jenis = 'pasien.pulang' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk pasien.pulang.');
    end if;

    update pasien set status = 'pulang',
      tgl_pulang = coalesce((v_data->>'tglPulang')::date, current_date)
    where no_rm = v_no_rm;

    -- Kosongkan kamar
    update kamar_integrasi set status = 'kosong', pasien_no_rm = null, sync_at = now()
    where pasien_no_rm = v_no_rm;

    if not found then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm,
              'Pasien ' || v_no_rm || ' tidak ditemukan.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'Pasien ' || v_no_rm || ' tidak ditemukan.');
    end if;

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Pasien ' || v_no_rm || ' dipulangkan.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Pasien ' || v_no_rm || ' dipulangkan.');

  -- ── diet.diperbarui ───────────────────────────────────────────────────
  elsif v_jenis = 'diet.diperbarui' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk diet.diperbarui.');
    end if;

    v_diet_id := _integ_diet_id(v_data->>'jenisDiet');
    update pasien set jenis_diet_id = v_diet_id where no_rm = v_no_rm;

    if not found then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm,
              'Pasien ' || v_no_rm || ' tidak ditemukan.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'Pasien ' || v_no_rm || ' tidak ditemukan.');
    end if;

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Diet ' || v_no_rm || ' → ' || coalesce(v_data->>'jenisDiet','?') || '.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Diet pasien ' || v_no_rm || ' diperbarui.',
                              'noRm', v_no_rm, 'jenisDiet', v_data->>'jenisDiet');

  -- ── operasi.dijadwalkan → simpan ke jadwal_operasi_integrasi ──────────
  elsif v_jenis = 'operasi.dijadwalkan' then
    insert into jadwal_operasi_integrasi (
      no_rm, nama_pasien, tindakan, tanggal, jam, dokter, catatan, sync_at
    ) values (
      v_no_rm,
      v_data->>'nama',
      coalesce(v_data->>'tindakan', 'Tidak disebutkan'),
      coalesce((v_data->>'tanggal')::date, current_date),
      coalesce(v_data->>'jam', '00:00'),
      coalesce(v_data->>'dokter', ''),
      coalesce(v_data->>'catatan', ''),
      now()
    )
    on conflict do nothing;  -- firebase_id null, tidak bisa upsert by id; terima saja

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Jadwal operasi ' || coalesce(v_no_rm,'?') || ' disimpan.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Jadwal operasi disimpan.', 'noRm', v_no_rm);

  end if;

  return jsonb_build_object('ok', false, 'pesan', 'Jenis tidak ditangani: ' || coalesce(v_jenis,'null'));

exception when others then
  v_pesan := sqlerrm;
  begin
    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, coalesce(v_jenis,'?'), coalesce(v_sumber,'?'), 'masuk', 'gagal',
            v_no_rm, 'Error: ' || v_pesan, p_event)
    on conflict (event_id) do nothing;
  exception when others then null; end;
  return jsonb_build_object('ok', false, 'pesan', 'Error internal: ' || v_pesan);
end;
$$;

grant execute on function public.terima_event_integrasi(jsonb) to authenticated;
revoke execute on function public.terima_event_integrasi(jsonb) from anon;

-- ─── 4. Konfirmasi ───────────────────────────────────────────────────────
do $$
begin
  raise notice 'Migration 20 selesai:';
  raise notice '  • Tabel kamar_integrasi dibuat';
  raise notice '  • Tabel jadwal_operasi_integrasi dibuat';
  raise notice '  • RPC terima_event_integrasi diperbarui (handle operasi.dijadwalkan + update kamar)';
end $$;
