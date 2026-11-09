-- Migration 08: Filter per menu + ubah status massal di pesanan makan
-- Idempotent: aman dijalankan ulang

create or replace function public.ubah_status_pesanan(p_ids bigint[], p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids bigint[]; diubah int; total int;
begin
  if current_role_name() not in ('admin','koki') then
    raise exception 'Tidak diizinkan';
  end if;
  if p_status not in ('siap','terkirim') then
    raise exception 'Status tujuan tidak valid';
  end if;
  total := coalesce(array_length(p_ids, 1), 0);

  with u as (
    update pesanan_makan set
      status = p_status,
      siap_at = case when p_status = 'siap' then now()
                     when p_status = 'terkirim' then coalesce(siap_at, now())
                     else siap_at end,
      terkirim_at = case when p_status = 'terkirim' then now() else terkirim_at end,
      diubah_oleh = auth.uid()
    where id = any(p_ids)
      and ((p_status = 'siap' and status = 'disiapkan')
        or (p_status = 'terkirim' and status in ('disiapkan','siap')))
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from u;

  diubah := cardinality(v_ids);
  return jsonb_build_object('diubah', diubah, 'dilewati', total - diubah);
end; $$;

