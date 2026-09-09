-- ===========================================================
-- Infarm CS — pindahkan vektor contoh ke skala "query"
--
-- Berkas ini MENGOSONGKAN seluruh vektor contoh pertanyaan supaya
-- bisa dibangun ulang dengan input_type "query". Teks contohnya
-- TIDAK tersentuh sama sekali — yang dibuang hanya angkanya, dan
-- angka itu data turunan yang bisa dihitung ulang kapan saja.
--
-- ⚠️  PRASYARAT: supabase/tambah-input-type.sql sudah dijalankan.
-- Tanpa kolom `embedding_input_type`, vektor yang bercampur dua
-- skala tidak bisa dideteksi sama sekali — dan campurannya tidak
-- pernah muncul sebagai galat, hanya sebagai skor yang aneh.
--
-- ===========================================================
-- KENAPA DIPINDAH
-- ===========================================================
-- Penanda document/query dirancang untuk pencarian ASIMETRIS:
-- pertanyaan pendek dicocokkan ke paragraf panjang berisi jawaban.
-- Yang kita simpan bukan paragraf jawaban melainkan CONTOH
-- PERTANYAAN — bentuknya sama dengan pesan pelanggan yang masuk.
-- Itu tugas simetris.
--
-- Diukur, bukan ditebak (`npm run uji-input-type`, 19 kalimat,
-- Rp 0,13):
--
--                                 query<->dok   query<->query
--   juara benar                   17/19         18/19
--   margin BENAR median           0,173         0,318
--   margin SALAH terbesar         0,061         0,051
--   dijawab tanpa satu pun salah  12            17
--
-- Rincian & batas ketelitiannya: docs/hasil-uji-input-type.md
--
-- ===========================================================
-- APA YANG TERJADI SELAMA JEDA
-- ===========================================================
-- Antara berkas ini dijalankan dan vektornya dibangun ulang,
-- cari_template() menyaring `where e.embedding is not null` dan
-- mengembalikan NOL BARIS. Gerbang 2 akan melapor "lewat".
--
-- Itu AMAN: "lewat" berarti pesan diteruskan ke Claude persis
-- seperti sebelum Gerbang 2 ada. Tidak ada pelanggan yang dirugikan,
-- terlebih karena Gerbang 2 masih mode bayangan.
--
-- Yang perlu diingat: kalau pembangunan ulang lupa dikerjakan,
-- Gerbang 2 akan diam selamanya tanpa satu pun peringatan. Periksa
-- dengan `npm run periksa-sumber` sesudahnya.
--
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang kali.
-- ===========================================================

begin;

update public.template_examples
set embedding           = null,
    embedding_model     = null,
    embedding_input_type = null,
    embedding_dibuat    = null
where embedding is not null;

commit;

-- ===========================================================
-- LANGKAH BERIKUTNYA — WAJIB, JANGAN BERHENTI DI SINI
-- ===========================================================
-- 1. Buka Pengaturan -> Knowledge Base -> Template Jawaban
-- 2. Gulir ke bawah, kotak "⚡ Bangun vektor contoh pertanyaan"
-- 3. Tekan "1. Hitung dulu (gratis)"  -> lihat berapa & berapa rupiah
-- 4. Tekan "2. Bangun sekarang"       -> BERBAYAR, ~Rp 0,01 untuk 36
--
-- Lalu pastikan, gratis:
--
--   npm run periksa-sumber
--
-- Yang harus terbaca:
--   belum bervektor    : 0
--   skala (input_type) : query      <- hanya SATU nilai
--
-- ===========================================================
-- MEMBATALKAN
-- ===========================================================
-- Kalau ternyata skala lama lebih baik:
--
--   1. git revert commit pemindahannya (2 baris + ambang)
--   2. jalankan supabase/seed-contoh.sql  -> 36 contoh bawaan kembali
--      ke vektor "document" yang lama, TANPA memanggil Voyage (Rp 0)
--   3. contoh yang ditambahkan tim CS sesudah pemindahan: jalankan
--      berkas ini lagi, lalu bangun ulang (~Rp 0,01 per 36 contoh)
--
-- Setelah membatalkan, `npm run periksa-sumber` harus kembali
-- menunjukkan satu skala saja — kali ini "document".
