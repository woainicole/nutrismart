-- ============================================================
-- Migration 19: Integrasi AdmisiRS ↔ NutriSmart
-- ============================================================
-- Sesuai admisiRS_plan.md Lampiran 13 (sisi NutriSmart):
--   • Tabel integrasi_log untuk deduplikasi event (idempoten by event_id)
--   • RPC terima_event_integrasi(p_event jsonb) — security definer
--   • Listener postMessage di frontend memanggil RPC ini
--   • Emit diet.diperbarui setelah setujui_pengajuan_diet sukses
--
-- Idempoten: aman dijalankan ulang.
-- Jalankan di Supabase SQL Editor atau via supabase db push.
-- ============================================================

-- ─── 1. Tabel log integrasi (deduplikasi by event_id UUID) ───

create table if not exists public.integrasi_log (
  id            bigint generated always as identity primary key,
  event_id      text not null unique,          -- UUID dari envelope AdmisiRS
  jenis         text not null,                 -- mis. 'pasien.masuk'
  sumber        text not null,                 -- 'admisirs' | 'nutrismart' | 'simulator'
  arah          text not null default 'masuk'  -- 'masuk' | 'keluar'
                check (arah in ('masuk','keluar')),
  status        text not null default 'diterima'
                check (status in ('diterima','gagal','diabaikan','menunggu')),
  no_rm         text,
  pesan         text,
  payload       jsonb,                         -- seluruh envelope JSON
  dibuat_oleh   uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

comment on table public.integrasi_log is
  'Log event integrasi dua arah NutriSmart ↔ AdmisiRS. event_id unik → deduplikasi otomatis.';

-- RLS
alter table public.integrasi_log enable row level security;

drop policy if exists "baca_integrasi_log" on public.integrasi_log;
create policy "baca_integrasi_log" on public.integrasi_log
  for select to authenticated using (true);

drop policy if exists "tulis_integrasi_log" on public.integrasi_log;
create policy "tulis_integrasi_log" on public.integrasi_log
  for insert to authenticated with check (true);

-- Index untuk pencarian cepat
create index if not exists integrasi_log_no_rm_idx on public.integrasi_log (no_rm);
create index if not exists integrasi_log_jenis_idx on public.integrasi_log (jenis);

-- ─── 2. Helper: cari bangsal_id dari nama bangsal ───

-- Nama bangsal di AdmisiRS persis sama: Melati, Mawar, VIP (Bagian 6.3 kontrak)
create or replace function public._integ_bangsal_id(p_nama text)
returns bigint language sql stable security definer set search_path = public as $$
  select id from bangsal where lower(trim(nama)) = lower(trim(p_nama)) limit 1;
$$;

-- ─── 3. Helper: cari jenis_diet_id dari nama diet ───

-- Nama diet di AdmisiRS: 'Normal','Diet DM','Rendah Garam','Diet Lunak','Diet Cair'
-- Nama diet di NutriSmart: lihat tabel jenis_diet; fungsi ini coba exact match dulu,
--   lalu fallback ke substring.
create or replace function public._integ_diet_id(p_nama text)
returns bigint language sql stable security definer set search_path = public as $$
  select id from jenis_diet
  where lower(trim(nama)) = lower(trim(p_nama))
     or lower(trim(nama)) like '%' || lower(trim(p_nama)) || '%'
  order by case when lower(trim(nama)) = lower(trim(p_nama)) then 0 else 1 end
  limit 1;
$$;

-- ─── 4. RPC utama: terima_event_integrasi ───

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
  v_pasien_id bigint;
  v_bangsal_id bigint;
  v_diet_id   bigint;
  v_tgl_masuk date;
  v_pesan     text;
begin
  -- ── Validasi envelope ──
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

  -- ── Cek duplikat (idempoten) ──
  if exists (select 1 from integrasi_log where event_id = v_event_id) then
    return jsonb_build_object('ok', true, 'pesan', 'Duplikat, diabaikan.', 'status', 'diabaikan');
  end if;

  -- ── Proses berdasarkan jenis event ──
  v_no_rm := v_data->>'noRm';

  -- ──────────────────────────────────────────────────────────
  -- pasien.masuk → upsert pasien berdasarkan no_rm
  -- ──────────────────────────────────────────────────────────
  if v_jenis in ('pasien.masuk', 'pasien.diperbarui') then
    if v_no_rm is null or v_no_rm !~ '^RM\d{3,}$' then
      v_pesan := 'noRm tidak valid: ' || coalesce(v_no_rm, 'null');
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm, v_pesan, p_event);
      return jsonb_build_object('ok', false, 'pesan', v_pesan);
    end if;

    -- Cari bangsal_id
    v_bangsal_id := _integ_bangsal_id(v_data->>'bangsal');
    if v_bangsal_id is null and (v_data->>'bangsal') is not null then
      -- bangsal tidak dikenal → tetap simpan pasien tanpa bangsal_id (tidak error fatal)
      v_bangsal_id := null;
    end if;

    -- Cari jenis_diet_id
    v_diet_id := _integ_diet_id(v_data->>'dietAwal');

    -- Parse tgl_masuk
    begin
      v_tgl_masuk := (v_data->>'tglMasuk')::date;
    exception when others then
      v_tgl_masuk := current_date;
    end;

    -- Upsert pasien berdasarkan no_rm (unik)
    insert into pasien (
      no_rm, nama, jenis_kelamin, tgl_lahir, bangsal_id, kamar,
      diagnosa, alergi, jenis_diet_id, status, tgl_masuk
    ) values (
      v_no_rm,
      v_data->>'nama',
      coalesce(v_data->>'jenisKelamin', 'L'),
      coalesce((v_data->>'tglLahir')::date, '2000-01-01'),
      v_bangsal_id,
      coalesce(v_data->>'kamar', ''),
      coalesce(v_data->>'diagnosa', ''),
      coalesce(
        array(select jsonb_array_elements_text(v_data->'alergi')),
        '{}'::text[]
      ),
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

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Pasien ' || v_no_rm || ' berhasil disimpan/diperbarui.', p_event);

    return jsonb_build_object('ok', true, 'pesan', 'Pasien ' || v_no_rm || ' diperbarui.', 'noRm', v_no_rm);

  -- ──────────────────────────────────────────────────────────
  -- pasien.pulang → ubah status menjadi 'pulang'
  -- ──────────────────────────────────────────────────────────
  elsif v_jenis = 'pasien.pulang' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib untuk pasien.pulang.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk pasien.pulang.');
    end if;

    update pasien set status = 'pulang',
      tgl_pulang = coalesce((v_data->>'tglPulang')::date, current_date)
    where no_rm = v_no_rm;

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

  -- ──────────────────────────────────────────────────────────
  -- diet.diperbarui → update jenis_diet_id pasien
  -- ──────────────────────────────────────────────────────────
  elsif v_jenis = 'diet.diperbarui' then
    if v_no_rm is null then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', null, 'noRm wajib untuk diet.diperbarui.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'noRm wajib untuk diet.diperbarui.');
    end if;

    v_diet_id := _integ_diet_id(v_data->>'jenisDiet');

    update pasien set jenis_diet_id = v_diet_id
    where no_rm = v_no_rm;

    if not found then
      insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
      values (v_event_id, v_jenis, v_sumber, 'masuk', 'gagal', v_no_rm,
              'Pasien ' || v_no_rm || ' tidak ditemukan.', p_event);
      return jsonb_build_object('ok', false, 'pesan', 'Pasien ' || v_no_rm || ' tidak ditemukan.');
    end if;

    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Diet pasien ' || v_no_rm || ' diperbarui ke ' || coalesce(v_data->>'jenisDiet','?') || '.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Diet pasien ' || v_no_rm || ' diperbarui.',
                              'noRm', v_no_rm, 'jenisDiet', v_data->>'jenisDiet');

  -- ──────────────────────────────────────────────────────────
  -- operasi.dijadwalkan → catat di log saja (NutriSmart tidak punya tabel operasi)
  -- ──────────────────────────────────────────────────────────
  elsif v_jenis = 'operasi.dijadwalkan' then
    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, v_jenis, v_sumber, 'masuk', 'diterima', v_no_rm,
            'Operasi pasien ' || coalesce(v_no_rm,'?') || ' dicatat di log.', p_event);
    return jsonb_build_object('ok', true, 'pesan', 'Operasi dicatat di log NutriSmart.', 'noRm', v_no_rm);

  end if;

  -- Jenis tidak tertangani (seharusnya tidak sampai sini karena sudah divalidasi atas)
  return jsonb_build_object('ok', false, 'pesan', 'Jenis event tidak ditangani: ' || coalesce(v_jenis,'null'));

exception when others then
  v_pesan := sqlerrm;
  -- Coba catat error ke log
  begin
    insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
    values (v_event_id, coalesce(v_jenis,'?'), coalesce(v_sumber,'?'), 'masuk', 'gagal',
            v_no_rm, 'Error: ' || v_pesan, p_event)
    on conflict (event_id) do nothing;
  exception when others then null; end;
  return jsonb_build_object('ok', false, 'pesan', 'Error internal: ' || v_pesan);
end;
$$;

comment on function public.terima_event_integrasi(jsonb) is
  'RPC integrasi AdmisiRS → NutriSmart. Menerima envelope event JSON (Bagian 6.1 admisiRS_plan.md). Idempoten by event_id.';

-- Grant eksekusi ke authenticated user (anon tidak boleh)
grant execute on function public.terima_event_integrasi(jsonb) to authenticated;
revoke execute on function public.terima_event_integrasi(jsonb) from anon;

-- ─── 5. Tambah kolom tgl_pulang ke tabel pasien jika belum ada ───
alter table public.pasien add column if not exists tgl_pulang date;
alter table public.pasien add column if not exists jenis_kelamin text
  check (jenis_kelamin in ('L','P'));

-- ─── 6. Fungsi emit_diet_diperbarui ───
-- Dipanggil oleh frontend NutriSmart setelah setujui_pengajuan_diet sukses.
-- Mengembalikan envelope JSON siap dikirim ke ekstensi browser via postMessage.

create or replace function public.emit_diet_diperbarui(
  p_no_rm      text,
  p_jenis_diet text,
  p_berlaku    date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text := gen_random_uuid()::text;
  v_envelope jsonb;
  v_waktu    text;
begin
  v_waktu := to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS+07:00');

  v_envelope := jsonb_build_object(
    'versi',   1,
    'eventId', v_event_id,
    'jenis',   'diet.diperbarui',
    'sumber',  'nutrismart',
    'waktu',   v_waktu,
    'data',    jsonb_build_object(
      'noRm',        p_no_rm,
      'jenisDiet',   p_jenis_diet,
      'berlakuSejak', p_berlaku::text
    )
  );

  -- Catat ke log sebagai event keluar
  insert into integrasi_log (event_id, jenis, sumber, arah, status, no_rm, pesan, payload)
  values (v_event_id, 'diet.diperbarui', 'nutrismart', 'keluar', 'menunggu',
          p_no_rm, 'Siap diteruskan ke AdmisiRS lewat ekstensi.', v_envelope)
  on conflict (event_id) do nothing;

  return v_envelope;
end;
$$;

comment on function public.emit_diet_diperbarui(text, text, date) is
  'Buat envelope event diet.diperbarui untuk dikirim ke AdmisiRS lewat ekstensi browser. '
  'Frontend memanggil ini lalu kirim hasilnya via window.postMessage({channel:''rs-integrasi'', tipe:''EVENT_KELUAR'', event}).';

grant execute on function public.emit_diet_diperbarui(text, text, date) to authenticated;
revoke execute on function public.emit_diet_diperbarui(text, text, date) from anon;

-- ─── 7. Konfirmasi deployment ───
do $$
begin
  raise notice 'Migration 19 integrasi AdmisiRS ↔ NutriSmart berhasil dijalankan.';
  raise notice '  • Tabel integrasi_log dibuat';
  raise notice '  • RPC terima_event_integrasi(jsonb) siap dipanggil dari frontend';
  raise notice '  • Fungsi emit_diet_diperbarui(text,text,date) siap dipakai frontend';
end $$;
