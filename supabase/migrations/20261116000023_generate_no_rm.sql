-- ============================================================
-- Migration 23: RPC generate_no_rm — auto-increment RM
-- ============================================================
-- Mengambil no_rm tertinggi dari tabel pasien lalu mengembalikan
-- no_rm berikutnya (RM001, RM002, ...).
-- Idempoten: aman dijalankan ulang.
-- ============================================================

create or replace function public.generate_no_rm()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'RM' || lpad(
    (coalesce(
      max(nullif(regexp_replace(no_rm, '\D', '', 'g'), '')),
      '0'
    )::int + 1)::text,
    3, '0'
  )
  from pasien;
$$;

comment on function public.generate_no_rm() is
  'Mengembalikan no_rm berikutnya berformat RM001, RM002, ... berdasarkan max yang ada.';

grant execute on function public.generate_no_rm() to authenticated;
revoke execute on function public.generate_no_rm() from anon;

do $$
begin
  raise notice 'Migration 23: generate_no_rm() siap.';
end $$;
