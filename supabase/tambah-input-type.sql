-- ===========================================================
-- Infarm CS — catat SKALA tiap vektor (input_type)
--
-- KENAPA BERKAS INI ADA
--
-- schema-vektor.sql sudah punya kolom `embedding_model`, dan
-- komentarnya tegas:
--
--     "Lebih dari satu model = vektor bercampur dan skornya tidak
--      bisa dipercaya. Bangun ulang seluruhnya bila itu terjadi."
--
-- Peringatan itu benar, tetapi TIDAK LENGKAP. Model bukan satu-
-- satunya hal yang menentukan skala sebuah vektor. `input_type`
-- juga:
--
--     input_type: "document"   skor query-vs-dokumen  0,40 - 0,67
--     input_type: "query"      skor query-vs-query    0,50 - 0,90
--
-- Dua vektor dari model yang SAMA tetapi input_type berbeda tidak
-- bisa dibandingkan. Dan sampai berkas ini dibuat, tidak ada satu
-- pun cara mendeteksinya — tidak ada kolomnya, tidak ada galat,
-- hanya skor yang aneh.
--
-- Itu persis pola kegagalan yang sudah dua kali menghantam proyek
-- ini: ambang 0,93 yang diturunkan dari skala yang salah, dan
-- ambang 0,6 yang membuang kecocokan benar sebelum sempat dinilai.
-- Keduanya mati tanpa satu pun pesan galat.
--
-- Prasyarat : schema-vektor.sql sudah dijalankan.
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang kali.
-- Data      : TIDAK mengubah satu pun vektor. Hanya menambah kolom
--             dan mengisi baris lama dengan skala yang memang
--             dipakai saat itu ('document').
-- ===========================================================

begin;

-- ---------- Kolom baru ----------
alter table public.template_examples
  add column if not exists embedding_input_type text;

comment on column public.template_examples.embedding_input_type is
  'Skala vektor: "document" atau "query". Vektor dengan input_type berbeda TIDAK bisa dibandingkan walau modelnya sama.';

-- Baris yang sudah ada dibuat sebelum berkas ini, dan semuanya
-- disematkan sebagai "document" — itu satu-satunya pilihan yang
-- pernah dipakai bangun-contoh.mjs maupun /api/pengenal/bangun.
--
-- Diisi hanya untuk baris yang PUNYA vektor. Baris tanpa vektor
-- belum punya skala apa pun, dan menandainya akan berbohong.
update public.template_examples
set embedding_input_type = 'document'
where embedding is not null
  and embedding_input_type is null;


-- ===========================================================
-- periksa_vektor() — apakah vektornya masih satu skala?
-- ===========================================================
-- security definer, sama seperti cari_template() dan
-- pustaka_router(): boleh dipanggil dengan kunci anon tanpa membuka
-- tabelnya. Yang dikembalikan hanya HITUNGAN — tidak satu pun teks
-- contoh atau angka vektor ikut keluar.
--
-- Dipakai `npm run periksa-sumber`, dan biayanya Rp 0.

create or replace function public.periksa_vektor()
returns table (
  total            bigint,
  bervektor        bigint,
  belum_bervektor  bigint,
  jumlah_model     bigint,
  jumlah_skala     bigint,
  daftar_model     text,
  daftar_skala     text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    count(*)                                              as total,
    count(embedding)                                      as bervektor,
    count(*) filter (where embedding is null)             as belum_bervektor,
    count(distinct embedding_model)                       as jumlah_model,
    count(distinct embedding_input_type)                  as jumlah_skala,
    coalesce(string_agg(distinct embedding_model, ', '), '-')      as daftar_model,
    coalesce(string_agg(distinct embedding_input_type, ', '), '-') as daftar_skala
  from public.template_examples;
$fn$;

comment on function public.periksa_vektor() is
  'Hitungan kesehatan vektor Gerbang 2. jumlah_skala > 1 berarti vektor bercampur dua input_type dan skornya tidak bisa dipercaya.';

grant execute on function public.periksa_vektor() to anon, authenticated;

commit;

-- ===========================================================
-- Periksa sesudahnya
-- ===========================================================
-- Dari folder web/, gratis:
--
--   npm run periksa-sumber
--
-- Atau langsung:
--
--   select * from public.periksa_vektor();
--
-- Yang WAJIB bernilai 1: jumlah_model dan jumlah_skala.
-- Bernilai 2 berarti vektornya bercampur — bangun ulang seluruhnya,
-- jangan sebagian, karena sebagian justru itulah masalahnya.
