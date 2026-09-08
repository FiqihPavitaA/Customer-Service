-- ===========================================================
-- Infarm CS — Gerbang 2 (Pengenal Maksud)
--
-- Menyimpan CONTOH PERTANYAAN PELANGGAN beserta vektornya, lalu
-- mencari template terdekat saat ada chat masuk.
--
-- YANG DICOCOKKAN ADALAH PERTANYAAN, BUKAN JAWABAN.
-- Ini keputusan terpenting di berkas ini. Menyematkan isi template
-- (yaitu balasan CS) terasa lebih mudah — datanya sudah ada — tetapi
-- salah: pelanggan menulis "nem oilnya dipakenya gmn kak", sedangkan
-- template berbunyi "Cara penggunaan Neem Oil: larutkan 2 ml...".
-- Keduanya berbeda bentuk, panjang, dan sudut pandang. Yang mirip
-- dengan pertanyaan pelanggan adalah PERTANYAAN PELANGGAN LAIN.
--
-- Karena itu tabel di bawah kosong sampai tim CS mengisinya
-- (Tahap C). Tanpa contoh pertanyaan, Gerbang 2 tidak punya apa pun
-- untuk dibandingkan.
--
-- Prasyarat: schema.sql dan schema-kb.sql sudah dijalankan.
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang.
-- ===========================================================

begin;

-- pgvector sudah tersedia di setiap project Supabase, tinggal
-- dinyalakan. Tidak ada biaya tambahan.
create extension if not exists vector;


-- ===========================================================
-- 1. template_examples — contoh pertanyaan per template
-- ===========================================================
create table if not exists public.template_examples (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,

  -- Ditulis seperti pelanggan sungguhan mengetik, termasuk singkatan
  -- dan salah ketik ("gmn", "brp", "blm", "kk"). Contoh yang ditulis
  -- rapi seperti bahasa buku justru membuat gerbang ini gagal pada
  -- kalimat yang paling sering datang.
  teks        text not null,

  -- cs        : ditulis tim CS. Inilah yang paling menentukan akurasi.
  -- bootstrap : diturunkan dari aturan pemicu & kasus uji yang sudah
  --             ada, supaya gerbang bisa diuji sebelum tim CS selesai.
  --             Jumlahnya sedikit dan gayanya terlalu rapi — anggap
  --             kerangka sementara, bukan data sungguhan.
  -- chat      : hasil panen dari percakapan nyata yang sudah dilabeli.
  sumber      text not null default 'cs'
              check (sumber in ('cs', 'bootstrap', 'chat')),

  -- Sengaja TANPA dimensi tetap, mis. vector(512).
  --
  -- Dimensi ditentukan model, dan model masih mungkin berganti
  -- (voyage-4-lite vs varian multilingual). Mengunci angkanya di
  -- skema berarti setiap pergantian model menuntut migrasi kolom.
  -- Aman dilakukan di sini karena barisnya hanya ratusan: perbandingan
  -- berurutan atas 500 vektor selesai dalam hitungan milidetik.
  -- Indeks HNSW baru sepadan di puluhan ribu baris.
  --
  -- Bila nanti dimensinya bercampur, PostgreSQL bergalat keras saat
  -- membandingkan — bukan diam-diam memberi skor yang salah.
  embedding   vector,

  -- Dicatat supaya ketahuan bila sebagian baris dibuat model lama.
  -- Vektor dari dua model berbeda TIDAK bisa dibandingkan, dan
  -- gejalanya hanya berupa skor yang aneh.
  embedding_model   text,
  embedding_dibuat  timestamptz,

  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,

  -- Contoh yang sama persis untuk template yang sama tidak menambah
  -- informasi, hanya menambah biaya embedding.
  unique (template_id, teks)
);

comment on table public.template_examples is
  'Contoh pertanyaan pelanggan per template. Yang disematkan adalah pertanyaan, bukan jawaban.';

create index if not exists template_examples_template_idx
  on public.template_examples (template_id);

-- Daftar kerja tim CS: contoh yang belum punya vektor.
create index if not exists template_examples_belum_vektor_idx
  on public.template_examples (created_at)
  where embedding is null;


-- ===========================================================
-- 2. cari_template() — pencarian tetangga terdekat
-- ===========================================================
-- security definer supaya bisa dipanggil dari route API yang tidak
-- membawa sesi pengguna. Ini JAUH lebih aman daripada memakai
-- service_role key di server: fungsi ini hanya bisa membaca, hanya
-- mengembalikan teks template, dan tidak menyentuh satu pun data
-- pelanggan.
--
-- Dua saringan di dalamnya bukan hiasan:
--   is_active     — template yang dimatikan tidak boleh terpilih.
--   is_sensitive  — [REKENING], [CS WA], [CS KOMPLAIN] dan sejenisnya
--                   tidak boleh pernah terkirim otomatis, sepintar
--                   apa pun kecocokannya. Sejalan dengan Gerbang 0.
create or replace function public.cari_template(
  q      vector,
  batas  int default 3
)
returns table (
  template_id  uuid,
  code         text,
  body         text,
  contoh       text,
  skor         double precision
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    t.id,
    t.code,
    t.body,
    e.teks,
    -- <=> adalah jarak kosinus (0 = identik). Dibalik jadi kemiripan
    -- 0..1 supaya angkanya searah dengan ambang di /api/chat: makin
    -- besar makin yakin.
    1 - (e.embedding <=> q) as skor
  from public.template_examples e
  join public.templates t on t.id = e.template_id
  where e.embedding is not null
    and t.is_active
    and not t.is_sensitive
  order by e.embedding <=> q
  limit greatest(1, least(batas, 20));
$fn$;

comment on function public.cari_template is
  'Cari template terdekat dari sebuah vektor pertanyaan. Hanya template aktif & tidak sensitif.';


-- ===========================================================
-- 3. RLS & hak akses
-- ===========================================================
alter table public.template_examples enable row level security;

drop policy if exists template_examples_read on public.template_examples;
create policy template_examples_read on public.template_examples
  for select to authenticated using (true);

-- Menulis contoh pertanyaan adalah pekerjaan tim CS lewat halaman
-- Kelola Template, jadi tidak dibatasi admin saja.
drop policy if exists template_examples_write on public.template_examples;
create policy template_examples_write on public.template_examples
  for all to authenticated using (true) with check (true);

-- GRANT, bukan hanya RLS.
--
-- Pelajaran 8 September 2026: schema.sql memasang 19 kebijakan RLS
-- tanpa satu pun GRANT, dan seluruh aplikasi gagal dengan
-- "permission denied for table profiles". RLS memilih BARIS; GRANT
-- memberi izin menyentuh TABEL. Keduanya diperiksa terpisah.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.template_examples to authenticated;

-- Route API memanggil fungsi ini tanpa sesi pengguna.
grant execute on function public.cari_template(vector, int) to anon, authenticated;


commit;

-- ===========================================================
-- Periksa hasilnya
-- ===========================================================
-- select count(*) as contoh,
--        count(embedding) as sudah_bervektor,
--        count(distinct embedding_model) as jumlah_model
-- from public.template_examples;
--
-- Lebih dari satu model = vektor bercampur dan skornya tidak bisa
-- dipercaya. Bangun ulang seluruhnya bila itu terjadi.
--
-- Template aktif yang BELUM punya satu pun contoh pertanyaan —
-- inilah daftar kerja Tahap C:
--
-- select t.code, t.category_slug
-- from public.templates t
-- left join public.template_examples e on e.template_id = t.id
-- where e.id is null and t.is_active and not t.is_sensitive
-- order by t.category_slug, t.code;
