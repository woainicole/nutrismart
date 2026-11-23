-- Migration 25: Tambah kolom dibaca_at ke tabel notifikasi
-- Root cause: kode frontend pakai dibaca_at (timestamptz) tapi schema lama hanya punya dibaca (boolean)
-- Solusi: tambah dibaca_at, backfill, trigger sync, update indeks & trigger dedup

-- 1. Tambah kolom (idempotent)
alter table notifikasi add column if not exists dibaca_at timestamptz;

-- 2. Backfill: baris yang sudah dibaca=true tapi dibaca_at masih NULL
update notifikasi
set dibaca_at = created_at
where dibaca = true and dibaca_at is null;

-- 3. Trigger: saat dibaca_at diisi → otomatis set dibaca=true
create or replace function public.sync_dibaca_at()
returns trigger language plpgsql as $$
begin
  if new.dibaca_at is not null then
    new.dibaca := true;
  end if;
  return new;
end; $$;

drop trigger if exists trg_sync_dibaca_at on notifikasi;
create trigger trg_sync_dibaca_at
  before update on notifikasi
  for each row execute function public.sync_dibaca_at();

-- 4. Update indeks agar query .is('dibaca_at', null) tetap efisien
drop index if exists idx_notif_penerima;
create index if not exists idx_notif_penerima
  on notifikasi (penerima_id, dibaca_at, created_at desc);

-- 5. Update fungsi kirim_notifikasi: dedup pakai dibaca_at
create or replace function public.kirim_notifikasi(
  p_roles text[], p_judul text, p_pesan text, p_rute text,
  p_tipe text default 'info', p_bangsal_id bigint default null,
  p_user_id uuid default null, p_dedupe boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifikasi (penerima_id, judul, pesan, rute, tipe)
  select pr.id, p_judul, p_pesan, p_rute, p_tipe
  from profiles pr
  where pr.id is distinct from auth.uid()
    and ( (pr.role = any(p_roles)
           and (p_bangsal_id is null or pr.role <> 'perawat' or pr.bangsal_id = p_bangsal_id))
          or pr.id = p_user_id )
    and ( not p_dedupe or not exists (
          select 1 from notifikasi n
          where n.penerima_id = pr.id and n.dibaca_at is null
            and n.judul = p_judul and n.pesan is not distinct from p_pesan) );
end; $$;
