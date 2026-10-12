-- ===========================================================
-- Infarm CS — orders: pengenal pembeli untuk panel kanan halaman Chat
--
-- Diminta pemilik proyek 12 Okt 2026, sebelum Fase 4. SQL Editor ->
-- tempel seluruh isi -> Run. Idempoten. Dijalankan SESUDAH
-- 20261012120100_orders.sql.
--
-- UNTUK APA
--
-- Panel kanan halaman Chat harus bisa menjawab "pembeli yang sedang
-- chat ini punya pesanan apa saja?". conversations tidak menyimpan
-- nomor pesanan secara andal (chat Shopee tidak selalu membawanya),
-- jadi penghubungnya adalah PEMBELI: dari percakapan diketahui
-- siapa yang mengirim, lalu pesanannya dicari di sini lewat
-- (shop_id, buyer_user_id) atau (shop_id, buyer_username).
--
-- Dua kolom, bukan satu, karena keduanya punya kelemahan yang
-- berbeda: username bisa diganti pemiliknya, user_id tidak pernah —
-- tetapi user_id belum tentu tersedia di setiap jalur (chat
-- marketplace lain mungkin hanya memberi nama tampilan). Keduanya
-- selalu dicari dengan shop_id, karena satu pembeli bisa berbelanja
-- di beberapa toko dan panel Chat selalu dalam konteks satu toko.
--
-- CATATAN DATA PRIBADI
--
-- Ini pengenal pembeli pertama di tabel yang bisa dibaca semua akun
-- login. Keduanya pengenal ringan (nama akun dan nomor id), bukan
-- nama asli, telepon, atau alamat — yang tetap hanya ada di
-- orders_raw. Dicatat di sini supaya keputusan itu terlihat, bukan
-- terjadi diam-diam.
--
-- SUMBER NILAINYA (Fase 4, sinkronisasi)
--
-- TODO(dokumentasi get_order_detail): diyakini kedua nilai ada di
-- response_optional_fields sebagai `buyer_user_id` (int64) dan
-- `buyer_username` (string). Nama field BELUM dicocokkan dengan
-- halaman dokumentasinya — konfirmasi sebelum pemeta Fase 4 ditulis.
-- buyer_user_id disimpan sebagai text supaya platform lain yang
-- memakai id non-numerik tetap muat.
-- ===========================================================

begin;

alter table public.orders
  add column if not exists buyer_user_id  text,
  add column if not exists buyer_username text;

comment on column public.orders.buyer_user_id is
  'Id pembeli dari marketplace, sebagai teks. Penghubung ke percakapan di panel Chat. Dari get_order_detail (Fase 4).';
comment on column public.orders.buyer_username is
  'Nama akun pembeli di marketplace. Bisa berubah; buyer_user_id yang tetap.';

-- Keduanya diawali shop_id: pencarian dari panel Chat selalu dalam
-- konteks satu toko, dan satu pembeli bisa berbelanja di beberapa toko.
create index if not exists orders_shop_buyer_id_idx
  on public.orders (shop_id, buyer_user_id);
create index if not exists orders_shop_buyer_username_idx
  on public.orders (shop_id, buyer_username);

commit;


-- ===========================================================
-- CEK — jalankan sesudah bagian atas berhasil
--
-- Harus menghasilkan 4 baris: dua kolom (bertipe text) dan dua index.
-- ===========================================================

select 'kolom' as jenis, column_name as nama, data_type as keterangan
from information_schema.columns
where table_schema = 'public' and table_name = 'orders'
  and column_name in ('buyer_user_id', 'buyer_username')
union all
select 'index', indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'orders'
  and indexname in ('orders_shop_buyer_id_idx', 'orders_shop_buyer_username_idx')
order by 1, 2;
