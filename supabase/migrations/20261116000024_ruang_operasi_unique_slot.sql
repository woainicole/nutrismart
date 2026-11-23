-- ============================================================
-- Migration 24: Unique constraint ruang operasi per slot
-- (ruang_operasi, tanggal, jam) tidak boleh bentrok.
-- ============================================================

-- ─── 1. Hapus baris duplikat sebelum tambah constraint ───────────────────
-- Jaga baris dengan id terkecil per slot, hapus sisanya.
delete from public.jadwal_operasi_integrasi
where id in (
  select id from (
    select id,
           row_number() over (
             partition by ruang_operasi, tanggal, jam
             order by id
           ) as rn
    from public.jadwal_operasi_integrasi
    where ruang_operasi is not null
      and ruang_operasi <> ''
  ) sub
  where rn > 1
);

-- ─── 2. Tambah unique constraint ─────────────────────────────────────────
-- Hanya berlaku jika ruang_operasi terisi (tidak null / kosong).
-- Pakai partial index supaya baris tanpa ruang_operasi tetap boleh masuk.
create unique index if not exists uq_jadwal_operasi_slot
  on public.jadwal_operasi_integrasi (ruang_operasi, tanggal, jam)
  where ruang_operasi is not null
    and ruang_operasi <> '';

comment on index public.uq_jadwal_operasi_slot is
  '1 ruang operasi hanya boleh 1 jadwal per slot (tanggal + jam).';

-- ─── 3. Update RPC – tolak jika slot ruangan sudah terpakai ──────────────
create or replace function public.terima_event_integrasi(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id    text;
  v_jenis       text;
  v_sumber      text;
  v_data        jsonb;
  v_no_rm       text;
  v_bangsal_id  bigint;
  v_diet_id     bigint;
  v_tgl_masuk   date;
  v_pesan       text;
  v_ruang       text;
  v_tanggal     date;
  v_jam         text;
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

  -- Cek duplikat event
  if exists (select 1 from integrasi_log where event_id = v_event_id) then
    return jsonb_build_object('ok', true, 'pesan', 'Duplikat, diabaikan.', 'status', 'diabaikan');
  end if;

  v_no_rm := v_data->>'noRm';

  -- ── pasien.masuk / pasien.diperbarui ─────────────────────────────────
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

  -- ── pasien.pulang ─────────────────────────────────────────────────────
  elsif v_jenis = 'pasien.pulang' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk pasien.pulang.');
    end if;

    update pasien set status = 'pulang',
      tgl_pulang = coalesce((v_data->>'tglPulang')::date, current_date)
    where no_rm = v_no_rm;

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

  -- ── operasi.dijadwalkan ───────────────────────────────────────────────
  elsif v_jenis = 'operasi.dijadwalkan' then
    v_ruang   := coalesce(nullif(trim(v_data->>'ruangOperasi'), ''), null);
    v_tanggal := coalesce((v_data->>'tanggal')::date, current_date);
    v_jam     := coalesce(v_data->>'jam', '00:00');

    -- ── Cek konflik slot ruangan ──────────────────────────────────────
    if v_ruang is not null then
      if exists (
        select 1 from jadwal_operasi_integrasi
        where ruang_operasi = v_ruang
          and tanggal       = v_tanggal
          and jam           = v_jam
          and status        <> 'batal'
      ) then
        v_pesan := 'Ruang ' || v_ruang || ' sudah terpakai pada '
                   || to_char(v_tanggal, 'DD Mon YYYY') || ' jam ' || v_jam || '.';
        insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
        values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm, v_pesan, p_event);
        return jsonb_build_object('ok', false, 'pesan', v_pesan, 'kode', 'RUANG_TERPAKAI',
                                  'ruang', v_ruang, 'tanggal', v_tanggal, 'jam', v_jam);
      end if;
    end if;

    -- ── Simpan jadwal ────────────────────────────────────────────────
    insert into jadwal_operasi_integrasi (
      no_rm, nama_pasien, tindakan, tanggal, jam, dokter,
      ruang_operasi, catatan, sync_at
    ) values (
      v_no_rm,
      v_data->>'nama',
      coalesce(v_data->>'tindakan', 'Tidak disebutkan'),
      v_tanggal,
      v_jam,
      coalesce(v_data->>'dokter', ''),
      v_ruang,
      coalesce(v_data->>'catatan', ''),
      now()
    );

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Jadwal operasi ' || coalesce(v_no_rm,'?') || ' disimpan di '
            || coalesce(v_ruang, 'ruang tidak disebutkan') || '.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Jadwal operasi disimpan.',
                              'noRm', v_no_rm, 'ruang', v_ruang);

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
  raise notice 'Migration 24 selesai:';
  raise notice '  • Partial unique index uq_jadwal_operasi_slot dibuat (ruang_operasi, tanggal, jam)';
  raise notice '  • RPC terima_event_integrasi: tolak event jika ruangan sudah terpakai di slot yang sama';
  raise notice '  • Status batal dikecualikan dari pengecekan konflik';
end $$;
