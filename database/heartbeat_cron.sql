-- ===== heartbeat_cron.sql =====
-- NutriSmart: Supabase Heartbeat / Keep-Alive Cron Job
-- Mencegah Supabase Free Tier dibekukan (auto-pause) karena inaktivitas 7 hari.
-- Jalankan script ini di Supabase SQL Editor (sebagai postgres/admin).

-- 1. Aktifkan ekstensi pg_cron dan pg_net
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Buat tabel keep_alive untuk mencatat ping/heartbeat
create table if not exists public.keep_alive (
    id int primary key default 1,
    last_ping timestamptz not null default now(),
    notes text default 'nutrismart heartbeat'
);

-- Inisialisasi baris pertama jika belum ada
insert into public.keep_alive (id, last_ping, notes)
values (1, now(), 'nutrismart heartbeat')
on conflict (id) do update set last_ping = now();

-- 3. RLS untuk tabel keep_alive (bisa dibaca oleh anon agar API ping berhasil)
alter table public.keep_alive enable row level security;

drop policy if exists "Allow anon read keep_alive" on public.keep_alive;
create policy "Allow anon read keep_alive"
on public.keep_alive for select
to anon, authenticated
using (true);

-- 4. Bersihkan cron job lama jika sudah ada (agar idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-supabase-heartbeat') then
    perform cron.unschedule('daily-supabase-heartbeat');
  end if;
  if exists (select 1 from cron.job where jobname = 'daily-supabase-api-ping') then
    perform cron.unschedule('daily-supabase-api-ping');
  end if;
exception
  when others then null;
end $$;

-- 5. Jadwalkan Heartbeat 1: Write Operation ke database (Setiap hari pukul 02:00 UTC / 09:00 WIB)
-- Melakukan update timestamp untuk memastikan ada aktivitas write di PostgreSQL
select cron.schedule(
    'daily-supabase-heartbeat',
    '0 2 * * *',
    $$
    update public.keep_alive
    set last_ping = now()
    where id = 1;
    $$
);

-- 6. Jadwalkan Heartbeat 2: HTTP GET ke Supabase API Gateway via pg_net (Setiap hari pukul 08:00 UTC / 15:00 WIB)
-- Supabase Free Tier mendeteksi inaktivitas melalui REST API/PostgREST.
-- Request ini mensimulasikan panggilan API langsung ke endpoint /rest/v1/keep_alive.
select cron.schedule(
    'daily-supabase-api-ping',
    '0 8 * * *',
    $$
    select net.http_get(
        url := 'https://wkiiposeoztrdlpuzznh.supabase.co/rest/v1/keep_alive?select=id&limit=1',
        headers := jsonb_build_object(
            'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndraWlwb3Nlb3p0cmRscHV6em5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDcyMzYsImV4cCI6MjEwOTAyMzIzNn0.ja_XQA6EZZ10LmzNA8PUnEAx3pjILyu_ChjDSFzQC8w',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndraWlwb3Nlb3p0cmRscHV6em5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDcyMzYsImV4cCI6MjEwOTAyMzIzNn0.ja_XQA6EZZ10LmzNA8PUnEAx3pjILyu_ChjDSFzQC8w'
        )
    );
    $$
);

-- 7. Query verifikasi untuk melihat jadwal cron yang aktif:
-- select * from cron.job;
-- select * from public.keep_alive;

