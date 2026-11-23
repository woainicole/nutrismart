-- ============================================================
-- Migration 22: Tambah ruang_operasi & fix kamar integrasi
-- ============================================================

-- ─── 1. Tambah kolom ruang_operasi ke jadwal_operasi_integrasi ───────────
alter table public.jadwal_operasi_integrasi
  add column if not exists ruang_operasi text;

comment on column public.jadwal_operasi_integrasi.ruang_operasi is
  'Ruang/kamar operasi yang digunakan (OK 1, OK 2, OK 3, ICU, dll.)';

-- ─── 2. Update RPC terima_event_integrasi untuk baca ruang_operasi ────────
-- Hanya update bagian operasi.dijadwalkan, sisanya tidak berubah.
-- Ini full replace karena PostgreSQL tidak support partial function edit.

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

  if exists (select 1 from integrasi_log where event_id = v_event_id) then
    return jsonb_build_object('ok', true, 'pesan', 'Duplikat, diabaikan.', 'status', 'diabaikan');
  end if;

  v_no_rm := v_data->>'noRm';

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

  elsif v_jenis = 'pasien.pulang' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk pasien.pulang.');
    end if;

    update pasien set status = 'pulang',
      tgl_pulang = coalesce((v_data->>'tglPulang')::date, current_date)
    where no_rm = v_no_rm;

    -- Kosongkan kamar_integrasi (fix akurasi kamar)
    update kamar_integrasi
      set status = 'kosong', pasien_no_rm = null, sync_at = now()
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

  elsif v_jenis = 'operasi.dijadwalkan' then
    -- Simpan ke jadwal_operasi_integrasi termasuk ruang_operasi
    insert into jadwal_operasi_integrasi (
      no_rm, nama_pasien, tindakan, tanggal, jam, dokter, ruang_operasi, catatan, sync_at
    ) values (
      v_no_rm,
      v_data->>'nama',
      coalesce(v_data->>'tindakan', 'Tidak disebutkan'),
      coalesce((v_data->>'tanggal')::date, current_date),
      coalesce(v_data->>'jam', '00:00'),
      coalesce(v_data->>'dokter', ''),
      coalesce(v_data->>'ruangOperasi', ''),
      coalesce(v_data->>'catatan', ''),
      now()
    )
    on conflict do nothing;

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

-- ─── 3. Konfirmasi ───────────────────────────────────────────────────────
do $$
begin
  raise notice 'Migration 22 selesai:';
  raise notice '  • Kolom ruang_operasi ditambahkan ke jadwal_operasi_integrasi';
  raise notice '  • RPC terima_event_integrasi diperbarui (handle ruang_operasi + fix kamar pulang)';
end $$;
