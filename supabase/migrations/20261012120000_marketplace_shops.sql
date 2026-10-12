-- ===========================================================
-- Infarm CS — marketplace_shops: toko yang terhubung + tokennya
--
-- Fase 2 integrasi Shopee (12 Okt 2026). Cara pakai sama dengan
-- berkas lain di supabase/: SQL Editor -> tempel seluruh isi -> Run.
-- Idempoten; aman dijalankan berulang kali.
--
-- KENAPA TABEL INI TIDAK PUNYA SATU PUN POLICY
--
-- Isinya access_token dan refresh_token toko. Siapa pun yang bisa
-- membaca satu baris di sini bisa bertindak sebagai toko itu di
-- Shopee. Tidak ada akun console — CS maupun admin — yang butuh
-- membaca token mentah; yang mereka butuhkan hanya "toko mana yang
-- terhubung dan sampai kapan", dan itu diberikan lewat route handler
-- yang memilih kolomnya sendiri.
--
-- Maka: RLS dinyalakan, policy TIDAK dibuat. Di PostgreSQL, RLS
-- tanpa policy berarti nol baris untuk semua peran kecuali pemilik
-- tabel dan peran yang melewati RLS (service_role). Satu-satunya
-- pembaca dan penulis adalah lib/supabase/admin.ts di server.
--
-- KENAPA ADA REVOKE PADAHAL RLS SUDAH MENUTUP
--
-- grants.sql memasang `alter default privileges ... grant select,
-- insert, update, delete on tables to authenticated`. Artinya tabel
-- baru OTOMATIS mendapat GRANT penuh untuk authenticated begitu
-- dibuat — persis temuan SEC-010. RLS memang masih menolak barisnya,
-- tetapi penolakan RLS berbunyi "berhasil, nol baris", sedangkan
-- penolakan GRANT berbunyi "permission denied". Untuk tabel berisi
-- token, kegagalan yang berisik lebih baik daripada yang sunyi, dan
-- dua lapis lebih baik daripada satu.
-- ===========================================================

begin;

create table if not exists public.marketplace_shops (
  id                        uuid primary key default gen_random_uuid(),
  -- Konektor berikutnya (Tokopedia, Blibli, Lazada) memakai tabel
  -- yang sama; yang membedakan hanya nilai kolom ini.
  platform                  text not null
                            check (platform in ('shopee', 'tokopedia', 'blibli', 'lazada')),
  -- shop_id dari marketplace, disimpan sebagai teks supaya tidak ada
  -- asumsi soal lebar angka antar platform.
  external_shop_id          text not null,
  shop_name                 text,
  access_token              text,
  refresh_token             text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  -- Kunci penyegaran. Diisi now()+30 detik oleh proses yang sedang
  -- menyegarkan token; proses lain yang melihat nilai di masa depan
  -- menunggu, bukan ikut menyegarkan. Lihat lib/shopee/token.ts (Fase 3).
  refreshing_until          timestamptz,
  -- false = refresh_token hangus; toko harus diotorisasi ulang dari
  -- halaman Pengaturan. Sinkronisasi melewati toko yang nonaktif.
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (platform, external_shop_id)
);

-- Ditambahkan sesudah membaca dokumentasi get_shop_info (12 Okt 2026):
-- `expire_time` di sana adalah kapan OTORISASI toko habis — berbeda
-- dari umur token, dan tidak bisa diperbaiki dengan refresh. Ditulis
-- sebagai ALTER terpisah supaya tetap berlaku untuk database yang
-- sudah menjalankan CREATE TABLE di atas sebelum kolom ini ada.
alter table public.marketplace_shops
  add column if not exists region text,
  add column if not exists authorization_expires_at timestamptz;

comment on table public.marketplace_shops is
  'Toko marketplace yang terhubung beserta tokennya. SENGAJA tanpa policy RLS: hanya service_role (lib/supabase/admin.ts) yang membaca/menulis.';
comment on column public.marketplace_shops.refreshing_until is
  'Kunci penyegaran token: now()+30s saat sedang disegarkan. Proses lain menunggu bila nilainya masih di masa depan.';

alter table public.marketplace_shops enable row level security;

-- Dua lapis, lihat kepala berkas. Peran yang tidak disebut di sini
-- (postgres, service_role) tidak terpengaruh.
revoke all on public.marketplace_shops from anon, authenticated;
grant all on public.marketplace_shops to service_role;

drop trigger if exists marketplace_shops_touch on public.marketplace_shops;
create trigger marketplace_shops_touch
  before update on public.marketplace_shops
  for each row execute function public.touch_updated_at();

commit;


-- ===========================================================
-- CEK — jalankan sesudah bagian atas berhasil
--
-- Harus menghasilkan satu baris dengan KEEMPAT kolom bernilai false:
-- authenticated dan anon tidak bisa membaca maupun menulis tabel ini
-- sama sekali, bahkan sebelum RLS ikut bicara.
-- ===========================================================

select
  has_table_privilege('authenticated', 'public.marketplace_shops', 'select') as auth_baca,
  has_table_privilege('authenticated', 'public.marketplace_shops', 'update') as auth_ubah,
  has_table_privilege('anon',          'public.marketplace_shops', 'select') as anon_baca,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'marketplace_shops') > 0 as ada_policy;
