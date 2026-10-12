-- ===========================================================
-- Infarm CS — jadwal sinkronisasi lewat pg_cron + pg_net
--
-- Fase 4 integrasi Shopee (12 Okt 2026).
--
-- KENAPA BUKAN VERCEL CRON
--
-- Paket Vercel Hobby membatasi cron paling sering SEKALI SEHARI, dan
-- menolak deploy yang vercel.json-nya meminta lebih sering. Jadwal
-- 15 menit karena itu dijalankan dari database: pg_cron menjadwalkan,
-- pg_net memanggil endpoint sync di Vercel dengan header rahasia.
-- Satu penjadwal, bukan dua — dua penjadwal berarti sinkronisasi
-- ganda yang saling berebut kunci refresh token.
--
-- SEBELUM MENJALANKAN — dua hal yang HARUS Anda ganti di bawah:
--
--   GANTI_URL_VERCEL   mis. https://customer-service-teal.vercel.app
--   GANTI_CRON_SECRET  nilai CRON_SECRET yang sama persis dengan di
--                      Vercel. Dibuat dengan: openssl rand -hex 32
--
-- Rahasia itu tersimpan di tabel cron.job, yang hanya bisa dibaca
-- peran postgres (pemilik project). Itu sebanding dengan tempat
-- rahasia lain di project ini. Kalau nanti ingin lebih rapat, pindah
-- ke Supabase Vault dan baca lewat vault.decrypted_secrets.
--
-- Kedua ekstensi biasanya harus dinyalakan dulu lewat Dashboard:
-- Database -> Extensions -> cari "pg_cron" dan "pg_net" -> Enable.
-- Kalau sudah, dua baris create extension di bawah tidak melakukan
-- apa-apa.
--
-- Idempoten: jadwal lama dengan nama yang sama dicabut dulu.
-- ===========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cabut jadwal lama bila ada (aman walau belum ada)
select cron.unschedule(jobid)
from cron.job
where jobname in ('shopee-orders-15m', 'shopee-tokens-harian');

-- 1. Pesanan — tiap 15 menit
select cron.schedule(
  'shopee-orders-15m',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url     := 'GANTI_URL_VERCEL/api/sync/shopee-orders',
      headers := '{"Authorization": "Bearer GANTI_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);

-- 2. Token — sekali sehari pukul 03.00 WIB (= 20.00 UTC hari sebelumnya).
--    pg_cron memakai UTC. Jam sepi dipilih supaya tidak berebut kunci
--    refresh dengan sinkronisasi pesanan yang sedang ramai.
select cron.schedule(
  'shopee-tokens-harian',
  '0 20 * * *',
  $job$
    select net.http_post(
      url     := 'GANTI_URL_VERCEL/api/sync/shopee-tokens',
      headers := '{"Authorization": "Bearer GANTI_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);


-- ===========================================================
-- CEK 1 — kedua jadwal terdaftar
-- ===========================================================
select jobname, schedule, active
from cron.job
where jobname in ('shopee-orders-15m', 'shopee-tokens-harian')
order by jobname;


-- ===========================================================
-- CEK 2 — sesudah >= 15 menit: apakah panggilannya benar-benar jalan
-- dan dijawab 200? Kalau status_code 401, rahasianya tidak cocok
-- dengan CRON_SECRET di Vercel. Kalau baris kosong, pg_net belum
-- menyala atau URL-nya salah.
-- ===========================================================
select created, status_code, left(content::text, 200) as isi
from net._http_response
order by created desc
limit 5;
