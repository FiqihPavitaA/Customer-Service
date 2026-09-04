-- ===========================================================
-- Infarm CS — DATA CONTOH untuk demo (opsional)
-- Dibangkitkan dari web/lib/db/seed.ts pada 4 September 2026.
--
-- ⚠️  INI DATA KARANGAN, BUKAN PERCAKAPAN PELANGGAN SUNGGUHAN.
--
-- Gunanya satu: setelah Supabase menyala, tabel conversations
-- kosong, sehingga halaman Chat terlihat mati saat didemokan ke
-- tim CS. Berkas ini mengisinya dengan percakapan contoh yang
-- sama persis dengan yang selama ini tampil di mode demo.
--
-- JANGAN dijalankan di database yang sudah berisi percakapan
-- pelanggan sungguhan, kecuali Anda memang ingin data contoh
-- ikut muncul di sana.
--
-- Cara pakai : SQL Editor → tempel seluruh isi → Run
-- Cara hapus : jalankan blok DELETE di bagian paling bawah
--
-- Semua baris memakai UUID berpola khusus supaya mudah dikenali
-- dan dihapus tanpa menyentuh data nyata:
--   c0000000-…  percakapan
--   e0000000-…  eskalasi
--   f0000000-…  flag koreksi
--
-- Sifat: idempoten — `on conflict do nothing`, aman diulang.
-- ===========================================================

begin;

-- ---------- conversations ----------
-- Kolom chat_count, product_query, order_status, order_courier
-- di mode demo TIDAK ikut: keempatnya tidak punya kolom di
-- schema.sql. chat_count dihitung ulang dari panjang messages,
-- sisanya milik API pesanan marketplace.
insert into public.conversations
  (id, platform, customer_id, customer_name, shop_name, order_id,
   tracking_no, messages, action, handover_summary, handover_detail,
   ai_suggestion, unread, last_message_at, created_at, updated_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'shopee', 'diky', 'dikymarzuki', 'infarmofficialshop · Shopee', '584590031216740091', 'JX1234567890', '[{"role":"assistant","content":"Halo kak, untuk pesanan yang sudah dibayar:\n- Checkout sebelum pukul 10:00 dikirim di hari yang sama.\n- Checkout setelah pukul 10:00 dikirim di hari kerja selanjutnya.\n\nHarap ditunggu balasan minfarm ya 🙏","timestamp":"2026-06-24T14:06:00+07:00"},{"role":"assistant","content":"Halo kak, apa ada yang bisa mimin bantu? 😊🙏","timestamp":"2026-06-24T14:06:00+07:00"}]'::jsonb, 'AUTO_REPLY', NULL, '{"Platform":"Shopee","Kategori":"Konsultasi Produk","Inti Masalah":"Tanya dosis POC Buah","Urgensi":"Normal"}'::jsonb, 'Bisa, Kak. Untuk POC Buah Infarm, dosis resminya 2 ml per 1 liter air, diberikan seminggu sekali saat tanaman memasuki fase berbunga atau berbuah. Hindari menambah dosis agar tanaman tidak kelebihan nutrisi ya, Kak.', false, '2026-06-24T14:06:00+07:00', '2026-06-24T14:06:00+07:00', '2026-06-24T14:06:00+07:00'),
  ('c0000000-0000-4000-8000-000000000002', 'shopee', 'rahma', 'rahmawati_id', 'infarmofficialshop · Shopee', '240611AB12', 'JNE998877', '[{"role":"assistant","content":"Halo Kak, ada yang bisa minfarm bantu? 😊","timestamp":"2026-06-24T14:01:00+07:00"},{"role":"user","content":"Dosis POC Buah buat tomat berapa ya kak?","timestamp":"2026-06-24T14:02:00+07:00"}]'::jsonb, 'AUTO_REPLY', NULL, '{"Platform":"Shopee","Kategori":"Konsultasi Produk","Inti Masalah":"Dosis POC Buah untuk tomat","Urgensi":"Normal"}'::jsonb, 'Untuk tomat, POC Buah Infarm dipakai 2 ml per 1 liter air ya, Kak, disiram seminggu sekali saat fase berbunga dan berbuah. Jangan dilebihkan dosisnya supaya tanaman tidak kelebihan nutrisi.', false, '2026-06-24T14:02:00+07:00', '2026-06-24T14:01:00+07:00', '2026-06-24T14:02:00+07:00'),
  ('c0000000-0000-4000-8000-000000000003', 'shopee', 'budi', 'budi.santoso', 'infarm · Shopee', '240617XXXX', 'JNT112233445', '[{"role":"user","content":"Min, paket saya belum sampai padahal sudah 7 hari 😡","timestamp":"2026-06-24T13:57:00+07:00"},{"role":"user","content":"No pesanan 240617XXXX. Tolong dicek dong","timestamp":"2026-06-24T13:58:00+07:00"}]'::jsonb, 'HANDOVER_TO_CS', 'Pelanggan melaporkan pesanan 240617XXXX belum diterima setelah 7 hari. Resi belum ada pembaruan sejak 2 hari lalu. Perlu pengecekan status ke kurir.', '{"Platform":"Shopee","Kategori":"Komplain Pengiriman","Inti Masalah":"Paket belum sampai > 7 hari","Urgensi":"Tinggi"}'::jsonb, 'Maaf atas kendalanya, Kak 🙏 Karena ini berkaitan dengan pesanan yang belum diterima, kasusnya perlu diperiksa langsung oleh tim CS kami. Saya bantu teruskan beserta ringkasan informasinya ya, Kak.', true, '2026-06-24T13:58:00+07:00', '2026-06-24T13:57:00+07:00', '2026-06-24T13:58:00+07:00'),
  ('c0000000-0000-4000-8000-000000000004', 'tiktok', 'nadia', 'nadia.afifah', 'Infarm Official · TikTok Shop', '240609TT88', 'SPX556677', '[{"role":"user","content":"Kak daun cabai saya menguning, kenapa ya? Apa harus beli pupuk?","timestamp":"2026-06-24T13:51:00+07:00"}]'::jsonb, 'ASK_INFORMATION', NULL, '{"Platform":"TikTok Shop","Kategori":"Konsultasi Tanaman","Inti Masalah":"Daun cabai menguning, data belum lengkap","Urgensi":"Normal"}'::jsonb, 'Boleh kirim foto tanamannya, Kak? Yang keseluruhan dan bagian bawah daunnya sekalian. Sekalian info juga produk serta dosis yang terakhir dipakai dan frekuensi penyiramannya, supaya penyebab daun menguning bisa diperiksa lebih tepat.', true, '2026-06-24T13:51:00+07:00', '2026-06-24T13:51:00+07:00', '2026-06-24T13:51:00+07:00'),
  ('c0000000-0000-4000-8000-000000000005', 'tiktok', 'yoga', 'yoga.pratama', 'Infarm Jakarta · TikTok Shop', '240620YYYY', 'JNE220620X', '[{"role":"user","content":"Kak resi pesanan saya sudah update belum ya? Order 240620YYYY","timestamp":"2026-06-24T13:40:00+07:00"}]'::jsonb, 'CHECK_ORDER_SYSTEM', NULL, '{"Platform":"TikTok Shop","Kategori":"Status Pesanan","Inti Masalah":"Minta update resi","Urgensi":"Normal"}'::jsonb, 'Saya cek dulu status pesanannya ya, Kak. Sebentar… (sistem akan mengambil data resi untuk order 240620YYYY sebelum membalas).', false, '2026-06-24T13:40:00+07:00', '2026-06-24T13:40:00+07:00', '2026-06-24T13:40:00+07:00'),
  ('c0000000-0000-4000-8000-000000000006', 'shopee', 'sari', 'sari.lestari', 'infarmofficialshop · Shopee', '240605SP01', 'SPX889900', '[{"role":"user","content":"Benih melon ini cocok ditanam di pot gak kak?","timestamp":"2026-06-24T13:22:00+07:00"}]'::jsonb, 'AUTO_REPLY', NULL, '{"Platform":"Shopee","Kategori":"Konsultasi Produk","Inti Masalah":"Tanya tanam melon di pot","Urgensi":"Normal"}'::jsonb, 'Cocok, Kak. Benih melon Infarm bisa ditanam di pot/planter bag ukuran minimal 25–40 liter supaya akarnya leluasa, ditempatkan di lokasi yang kena sinar matahari penuh. Pastikan media tanamnya subur dan drainase lancar ya, Kak.', false, '2026-06-24T13:22:00+07:00', '2026-06-24T13:22:00+07:00', '2026-06-24T13:22:00+07:00')
on conflict (id) do nothing;

-- ---------- escalations ----------
insert into public.escalations
  (id, conversation_id, reason, status, assigned_to, created_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Paket belum sampai > 7 hari, resi tidak update', 'open', 'Infarm.sales', '2026-06-24T13:58:00+07:00')
on conflict (id) do nothing;

-- ---------- ai_flags ----------
-- reporter_id & reviewed_by sengaja NULL: keduanya foreign key ke
-- public.profiles, dan profil demo tidak punya baris di auth.users.
-- Nama pelapornya tetap terbaca lewat kolom teks reporter_name.
insert into public.ai_flags
  (id, code, customer_message, ai_answer, ai_action, correct_answer,
   category, reporter_id, reporter_name, note, status, reject_reason,
   created_at, reviewed_at, reviewed_by)
values
  ('f0000000-0000-4000-8000-000000000001', 'FLG-0001', 'POC Buah boleh dicampur sama pestisida gak kak?', 'Boleh saja Kak, dicampur dalam satu tangki tidak masalah.', 'AUTO_REPLY', 'Sebaiknya tidak dicampur, Kak. Catatan resmi POC Buah: hindari pencampuran dengan pestisida.', 'produk', NULL, 'CSINFARM2', 'Bertentangan dengan catatan di products.json', 'menunggu', NULL, '2026-06-24T11:20:00+07:00', NULL, NULL),
  ('f0000000-0000-4000-8000-000000000002', 'FLG-0002', 'Ongkir ke Papua berapa kak?', 'Ongkir ke Papua Rp 45.000 flat, Kak.', 'AUTO_REPLY', 'Ongkir mengikuti perhitungan marketplace saat checkout, Kak — tidak ada tarif flat.', 'kebijakan', NULL, 'CSINFARM2', 'AI mengarang angka; tidak ada di Knowledge Base', 'disetujui', NULL, '2026-06-23T10:05:00+07:00', '2026-06-23T15:30:00+07:00', NULL),
  ('f0000000-0000-4000-8000-000000000003', 'FLG-0003', 'Harga Furadan 1 kg berapa kak?', 'Harga Furadan 1 Kg sekitar Rp 25.000, Kak.', 'AUTO_REPLY', 'AI tidak punya data harga real-time dan tidak boleh menyebut harga tanpa data sistem — seharusnya diarahkan ke halaman produk marketplace.', 'harga', NULL, 'CSINFARM2', 'Harga pada jawaban AI tidak sesuai harga toko saat ini.', 'ditolak', 'Duplikat — sudah diperbaiki lewat laporan sebelumnya.', '2026-06-20T09:12:00+07:00', '2026-06-21T14:40:00+07:00', NULL)
on conflict (id) do nothing;

commit;

-- ===========================================================
-- Periksa hasilnya
-- ===========================================================
-- select count(*) as percakapan from public.conversations;
-- select count(*) as eskalasi   from public.escalations;
-- select count(*) as flag       from public.ai_flags;


-- ===========================================================
-- HAPUS SELURUH DATA CONTOH
-- ===========================================================
-- Hapus tanda komentar di bawah, lalu Run. Hanya baris berpola
-- UUID data contoh yang terhapus — percakapan pelanggan sungguhan
-- tidak tersentuh. escalations ikut terhapus lewat ON DELETE
-- CASCADE, tetapi ditulis eksplisit supaya jelas.
--
-- begin;
--   delete from public.ai_flags     where id::text like 'f0000000-%';
--   delete from public.escalations  where id::text like 'e0000000-%';
--   delete from public.conversations where id::text like 'c0000000-%';
-- commit;
