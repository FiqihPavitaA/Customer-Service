-- ===========================================================
-- Infarm CS — hak akses tabel untuk peran `authenticated`
--
-- KENAPA BERKAS INI ADA
--
-- schema.sql dan schema-kb.sql memasang 19 kebijakan RLS, tetapi
-- tidak satu pun pernyataan GRANT. Itu lubang yang gejalanya
-- membingungkan, karena PostgreSQL memeriksa DUA hal yang terpisah:
--
--   1. GRANT  -> boleh menyentuh tabelnya sama sekali?
--                Gagal = galat keras "permission denied for table X".
--   2. RLS    -> baris mana yang boleh dilihat/diubah?
--                Gagal = diam-diam nol baris, TANPA galat.
--
-- Tanpa GRANT, permintaan berhenti di langkah 1 dan tidak pernah
-- sampai ke kebijakan RLS. Semua kebijakan itu menjaga pintu yang
-- memang tidak pernah bisa dibuka.
--
-- Biasanya Supabase memasang GRANT ini sendiri lewat `alter default
-- privileges`, tetapi itu hanya berlaku bila tabelnya dibuat oleh
-- peran yang persis sama dengan yang diatur di sana. Pada proyek
-- yang skemanya dijalankan lewat SQL Editor, hal itu tidak selalu
-- terjadi — dan pada proyek ini memang tidak terjadi.
--
-- Cara pakai : SQL Editor -> tempel seluruh isi -> Run
-- Sifat      : idempoten, aman dijalankan berulang kali.
-- ===========================================================

begin;

-- Tanpa ini, peran authenticated bahkan tidak boleh "melihat" isi
-- schema, apa pun hak tabelnya.
grant usage on schema public to anon, authenticated;

-- Hak penuh atas tabel, RLS yang membatasi barisnya.
--
-- Ini memang model Supabase, dan aman DI SINI karena setiap tabel
-- pada proyek ini sudah menyalakan RLS dan punya kebijakannya
-- sendiri. Kalau nanti ada tabel baru: nyalakan RLS-nya lebih dulu,
-- baru jalankan berkas ini. Tabel tanpa RLS akan terbuka penuh.
--
-- `all tables` di PostgreSQL mencakup view, jadi v_routing_harian
-- ikut kebagian. View itu dibuat dengan security_invoker = true,
-- sehingga izin routing_log tetap diperiksa terhadap pemanggilnya.
grant select, insert, update, delete
  on all tables in schema public to authenticated;

-- anon SENGAJA tidak diberi hak tabel apa pun.
--
-- Seluruh kebijakan RLS proyek ini berbunyi `to authenticated`, jadi
-- pengunjung tanpa sesi tidak akan pernah lolos. Membiarkannya tanpa
-- GRANT membuat kegagalannya berbunyi keras ("permission denied")
-- alih-alih pulang dengan tangan kosong secara diam-diam — jauh
-- lebih mudah ditelusuri, seperti yang baru saja terbukti.

-- is_admin() dipanggil dari dalam kebijakan RLS dan dieksekusi
-- dengan hak pemanggil. PostgreSQL memang memberi EXECUTE ke PUBLIC
-- secara bawaan, tetapi ditulis eksplisit supaya tidak ada tembok
-- kedua yang tersembunyi.
grant execute on function public.is_admin() to authenticated;

-- Tabel yang dibuat SESUDAH ini ikut kebagian otomatis, sehingga
-- migrasi berikutnya tidak mengulangi lubang yang sama.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

commit;

-- ===========================================================
-- Periksa hasilnya
-- ===========================================================
-- Harus mengembalikan 11 baris (5 tabel schema.sql + 5 tabel
-- schema-kb.sql + 1 view), semuanya dengan select = true:
--
-- select table_name,
--        has_table_privilege('authenticated', 'public.' || table_name, 'select') as bisa_baca,
--        has_table_privilege('authenticated', 'public.' || table_name, 'update') as bisa_ubah
-- from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
