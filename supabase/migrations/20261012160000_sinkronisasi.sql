-- ===========================================================
-- Infarm CS — titik sinkronisasi pesanan per toko
--
-- Fase 4 integrasi Shopee (12 Okt 2026). SQL Editor -> tempel ->
-- Run. Idempoten. Sesudah 20261012150000_orders_pembeli.sql.
--
-- orders_synced_until: sampai kapan pesanan toko ini sudah ditarik.
-- Dimajukan HANYA setelah semua baris jendela itu tersimpan, jadi
-- proses yang mati di tengah mengulang jendela yang sama — aman,
-- karena semuanya upsert. null = belum pernah; sinkronisasi pertama
-- menarik 1 hari ke belakang. Untuk menarik riwayat lebih lama,
-- mundurkan nilainya secara manual (contoh di dasar berkas).
-- ===========================================================

begin;

alter table public.marketplace_shops
  add column if not exists orders_synced_until timestamptz;

comment on column public.marketplace_shops.orders_synced_until is
  'Sampai kapan pesanan toko sudah ditarik (lib/shopee/sinkron.ts). null = belum pernah -> 1 hari ke belakang.';

commit;


-- CEK — satu baris, data_type = timestamp with time zone
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'marketplace_shops'
  and column_name = 'orders_synced_until';


-- Menarik ulang 14 hari ke belakang untuk SATU toko (opsional):
-- update public.marketplace_shops
--   set orders_synced_until = now() - interval '14 days'
-- where external_shop_id = '227948354';
