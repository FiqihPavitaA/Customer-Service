-- ===========================================================
-- Infarm CS — orders: pesanan dari semua marketplace, format internal
--
-- Fase 2 integrasi Shopee (12 Okt 2026). SQL Editor -> tempel seluruh
-- isi -> Run. Idempoten. WAJIB dijalankan SESUDAH
-- 20261012120000_marketplace_shops.sql (ada foreign key ke sana).
--
-- SIAPA BOLEH APA
--
--   membaca   semua akun yang login — halaman Pesanan dan panel Chat
--             memang dibaca seluruh tim CS, sama seperti conversations
--   menulis   hanya service_role, lewat sinkronisasi di server. Tidak
--             ada jalur dari peramban untuk mengubah pesanan, karena
--             sumber kebenarannya adalah marketplace, bukan console
--
-- KENAPA JAWABAN MENTAH DISIMPAN DI TABEL TERPISAH, BUKAN KOLOM `raw`
--
-- Brief meminta kolom `raw jsonb` di tabel ini. Jawaban asli
-- get_order_detail bisa memuat nama, telepon, dan alamat pembeli —
-- data yang kolom terstruktur di sini sengaja TIDAK punya. Menaruhnya
-- sebagai kolom berarti setiap akun yang boleh membaca pesanan ikut
-- membaca data pribadi lewat pintu belakang.
--
-- Pilihan pertama adalah GRANT SELECT per kolom tanpa `raw`. Itu
-- ditolak karena dua hal: `.select("*")` dari peramban akan gagal
-- dengan cara yang membingungkan, dan Supabase Realtime memeriksa
-- hak baca dengan kueri atas seluruh tabel — hak per kolom bisa
-- membuat peristiwa Realtime diam-diam tidak pernah sampai.
--
-- Maka `raw` pindah ke tabel orders_raw: satu baris per pesanan,
-- tanpa GRANT ke authenticated sama sekali, hanya service_role.
-- Tabel orders tetap biasa: SELECT penuh, Realtime bekerja normal.
--
-- STATUS
--
-- `status` memakai kosakata internal dan dijaga CHECK, supaya satu
-- nilai Shopee yang tidak dikenal tidak diam-diam masuk sebagai
-- status baru. Pemeta di lib/marketplace/ (Fase 4) adalah satu-
-- satunya yang tahu nilai asli marketplace; nilai aslinya disimpan
-- apa adanya di `raw_status`.
-- ===========================================================

begin;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null,
  -- restrict, bukan cascade: menghapus baris toko tidak boleh ikut
  -- menghapus riwayat pesanannya diam-diam. Nonaktifkan tokonya
  -- (is_active = false) kalau memang tidak dipakai lagi.
  shop_id            uuid not null references public.marketplace_shops (id) on delete restrict,
  -- order_sn Shopee; nama kolom netral supaya platform lain muat.
  external_order_id  text not null,
  status             text not null
                     check (status in (
                       'menunggu_pembayaran',
                       'perlu_dikirim',
                       'diproses',
                       'dalam_pengiriman',
                       'selesai',
                       'proses_batal',
                       'dibatalkan',
                       'menunggu_invoice',
                       'lainnya'
                     )),
  raw_status         text,
  buyer_username     text,
  total_amount       numeric(14, 2),
  currency           text,
  shipping_carrier   text,
  tracking_number    text,
  -- Ringkasan barang: [{nama, sku, qty, harga}] — bentuk pastinya
  -- ditentukan pemeta di Fase 4. Tidak memuat data pembeli.
  items              jsonb not null default '[]'::jsonb,
  ship_by_date       timestamptz,
  order_created_at   timestamptz,
  order_updated_at   timestamptz,
  synced_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (platform, external_order_id)
);

comment on table public.orders is
  'Pesanan semua marketplace dalam format internal, tanpa data pribadi pembeli. Ditulis hanya oleh sinkronisasi (service_role); dibaca semua akun login. Jawaban mentah ada di orders_raw.';

create index if not exists orders_shop_status_idx
  on public.orders (shop_id, status);
create index if not exists orders_created_idx
  on public.orders (order_created_at desc);
-- Pencarian nomor pesanan dari topbar dan papan croscek.
create index if not exists orders_external_idx
  on public.orders (external_order_id);

alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (true);
-- Tidak ada policy insert/update/delete — sengaja. RLS tanpa policy
-- untuk sebuah aksi berarti aksi itu ditolak untuk semua peran yang
-- tunduk RLS.

-- GRANT: bersihkan apa pun yang diberikan default privileges
-- (grants.sql), lalu beri tepat yang dibutuhkan. anon tidak dapat
-- apa-apa; authenticated hanya SELECT.
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------
-- orders_raw — jawaban asli marketplace, hanya untuk debug
-- -----------------------------------------------------------
-- cascade di sini memang benar: baris mentah tidak punya arti tanpa
-- pesanannya. (orders -> marketplace_shops tetap restrict.)

create table if not exists public.orders_raw (
  order_id    uuid primary key references public.orders (id) on delete cascade,
  raw         jsonb not null,
  synced_at   timestamptz not null default now()
);

comment on table public.orders_raw is
  'Jawaban asli marketplace per pesanan, untuk debug. Bisa memuat data pribadi pembeli: TANPA policy, TANPA grant ke authenticated. Hanya service_role.';

alter table public.orders_raw enable row level security;
revoke all on public.orders_raw from anon, authenticated;
grant all on public.orders_raw to service_role;

commit;


-- ===========================================================
-- Realtime — supaya perubahan status langsung tampil di halaman
-- Pesanan tanpa refresh. Pola yang sama dengan schema.sql §8.
-- orders_raw SENGAJA tidak masuk publikasi.
-- ===========================================================

do $blk$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end
$blk$;


-- ===========================================================
-- CEK — jalankan sesudah bagian atas berhasil
--
-- Baris yang diharapkan:
--   auth_baca_orders   true    tim CS bisa membaca pesanan
--   auth_tulis_orders  false   tidak ada jalur tulis dari peramban
--   auth_baca_raw      false   jawaban mentah TIDAK terbaca  <- penting
--   anon_baca_orders   false
--   realtime_orders    true
--   realtime_raw       false
-- ===========================================================

select
  has_table_privilege('authenticated', 'public.orders',     'select') as auth_baca_orders,
  has_table_privilege('authenticated', 'public.orders',     'insert') as auth_tulis_orders,
  has_table_privilege('authenticated', 'public.orders_raw', 'select') as auth_baca_raw,
  has_table_privilege('anon',          'public.orders',     'select') as anon_baca_orders,
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'orders')     as realtime_orders,
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'orders_raw') as realtime_raw;
