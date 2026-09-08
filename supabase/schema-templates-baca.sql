-- ===========================================================
-- Infarm CS — jalan baca template untuk router (/api/chat)
--
-- KENAPA BERKAS INI ADA
--
-- schema-kb.sql memberi tabel `templates` kebijakan baca:
--
--     create policy templates_read on public.templates
--       for select to authenticated using (true);
--
-- "to authenticated" — dan /api/chat TIDAK authenticated. Sesi login
-- console disimpan di localStorage peramban (lihat catatan di
-- web/lib/supabase/client.ts), jadi route handler di server tidak
-- pernah melihatnya. Ia memanggil Supabase dengan kunci anon
-- telanjang.
--
-- Akibatnya, tanpa berkas ini router tidak bisa membaca satu baris
-- pun dari tabel yang seharusnya jadi sumbernya.
--
-- TIGA JALAN KELUAR, DAN KENAPA YANG INI YANG DIPILIH
--
--   1. Pakai service_role di /api/chat.
--      Ditolak. Kunci itu menembus SELURUH RLS untuk keuntungan
--      yang tidak dibutuhkan — router hanya perlu membaca teks
--      balasan yang memang akan dikirim ke pelanggan.
--
--   2. Tambah kebijakan select untuk anon.
--      Ditolak. Itu membuka SEMUA baris, termasuk template yang
--      sengaja dimatikan ([REKENING], [CS WA], [CS KOMPLAIN] berisi
--      nomor rekening & telepon) kepada siapa pun yang memegang
--      anon key — yaitu setiap pengunjung halaman.
--
--   3. Fungsi security definer yang menyaring lebih dulu. <-- ini
--      Anon tidak diberi hak atas tabelnya sama sekali; yang boleh
--      ia panggil hanya fungsi ini, dan fungsi ini hanya
--      mengembalikan template yang aktif, tidak sensitif, dan masih
--      dalam masa berlaku. Pola yang sama sudah dipakai
--      cari_template() di schema-vektor.sql.
--
-- Prasyarat : schema.sql, schema-kb.sql, dan grants.sql sudah jalan.
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang kali.
-- ===========================================================

begin;

-- ===========================================================
-- pustaka_router() — template aktif beserta aturan pemicunya
-- ===========================================================
-- Satu fungsi, bukan dua, supaya router mendapat pustaka dan aturan
-- dari SATU potret yang konsisten. Dua panggilan terpisah bisa
-- jatuh di dua sisi sebuah penyuntingan: aturan menunjuk kode yang
-- pustakanya belum ikut berubah.
--
-- Template tanpa aturan tetap ikut terbawa (LEFT JOIN, priority
-- null). Itu disengaja: 108 dari 151 template memang belum punya
-- pemicu, dan Gerbang 2 (Voyage) tetap perlu teks balasannya.

create or replace function public.pustaka_router()
returns table (
  code            text,
  body            text,
  action          text,
  category_slug   text,
  priority        integer,
  when_patterns   text[],
  also_pattern    text,
  unless_patterns text[],
  flags           text,
  why             text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    t.code,
    t.body,
    t.action,
    t.category_slug,
    r.priority,
    r.when_patterns,
    r.also_pattern,
    r.unless_patterns,
    r.flags,
    r.why
  from public.templates t
  left join public.template_rules r
    on r.template_id = t.id
   and r.is_active
  where t.is_active
    -- Nomor rekening & nomor telepon tidak boleh keluar lewat jalan
    -- ini. claude-core.md melarang mengarahkan transaksi ke luar
    -- marketplace, jadi ketiganya memang tidak untuk balasan otomatis.
    and not t.is_sensitive
    -- Promo bertanggal (12.12, IDUL FITRI, NATAL) harus mati sendiri.
    -- Tanpa dua baris ini, template promo lama tetap terkirim
    -- berbulan-bulan setelah promonya habis.
    and (t.active_from  is null or t.active_from  <= current_date)
    and (t.active_until is null or t.active_until >= current_date)
  -- Urutan aturan ADALAH logika: "cara pakai miracle powder" jatuh ke
  -- [MIRACLE POWDER] dan bukan [PRODUK MIRACLE] semata karena aturan
  -- pemakaian dinilai lebih dulu. Router menjaga urutan yang datang
  -- dari sini apa adanya.
  order by r.priority nulls last, t.code;
$fn$;

comment on function public.pustaka_router() is
  'Pustaka template + aturan pemicu untuk router /api/chat. security definer supaya bisa dipanggil dengan kunci anon tanpa membuka tabel templates ke anon. Hanya mengembalikan baris yang aktif, tidak sensitif, dan masih berlaku.';

-- Anon boleh memanggil INI, tetapi tetap tidak punya hak atas
-- tabelnya. Itulah seluruh maksud berkas ini.
grant execute on function public.pustaka_router() to anon, authenticated;


-- ===========================================================
-- Pemeriksaan cepat sesudah Run
-- ===========================================================
-- Cara termudah, gratis, dari folder web/:
--
--   npm run periksa-sumber
--   npm run periksa-sumber -- "DITERUSKAN"
--
-- Atau langsung di SQL Editor:
--
--   select count(*) from public.templates;        -- harap 154
--   select count(*) from public.pustaka_router(); -- harap 151
--   select code, priority from public.pustaka_router()
--     where priority is not null order by priority limit 10;
--
-- Selisih 3 antara kedua hitungan pertama adalah [REKENING],
-- [CS WA], dan [CS KOMPLAIN] — ketiganya is_sensitive=true dan
-- is_active=false karena memuat nomor rekening atau telepon.
-- Selisih itu WAJAR; nanti bisa bertambah bila ada template promo
-- yang masa berlakunya lewat.
--
-- Yang TIDAK wajar adalah hitungan kedua bernilai 0: itu berarti
-- seluruh isinya tersaring dan router akan diam-diam kembali ke
-- berkas .md.
--
-- Satu kode yang wajib ikut terbaca:
--
--   select code from public.pustaka_router() where code = 'DITERUSKAN CS';
--
-- Itu balasan Gerbang 0. Bila hilang, pelanggan yang minta refund
-- atau melaporkan barang rusak menerima balasan KOSONG. Router
-- sekarang punya jaring pengaman untuk keadaan itu (teksHandover()),
-- tetapi jaring pengaman bukan alasan membiarkannya hilang.

commit;
