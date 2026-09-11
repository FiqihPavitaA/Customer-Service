-- ===========================================================
-- Infarm CS — jadwal kerja: AI diam saat tim CS bertugas
--
-- Tahap 1 dari rencana "saklar jadwal AI di header"
-- (Notion: Progres web cs, 2026-09-11).
--
-- MASALAH YANG DIPECAHKAN
--
-- Saat tim CS bekerja, AI ikut menjawab pelanggan. Dua akibatnya:
-- CS terinterupsi — balasan otomatis datang di percakapan yang
-- sedang ditangani manusia — dan ongkos Claude terbakar untuk pesan
-- yang toh akan dibalas orang.
--
-- SATU BARIS, BUKAN TABEL BARU
--
-- Seluruh kolom di bawah menumpang public.settings, yang memang
-- sudah bertugas menyimpan konfigurasi global dan sudah dibatasi
-- satu baris (id = 1). Tabel baru hanya akan menambah satu tempat
-- lagi yang harus dibaca /api/chat sebelum menjawab.
--
-- KENAPA JAM DISIMPAN SEBAGAI ANGKA, BUKAN time ATAU timestamptz
--
-- Yang disimpan bukan sebuah SAAT, melainkan sebuah kebiasaan:
-- "tiap hari kerja, jam delapan sampai empat". timestamptz akan
-- menuntut tanggal yang tidak ada artinya, dan `time` membawa
-- pertanyaan zona waktu ke dalam database — padahal jawabannya
-- selalu sama dan sudah pasti: WIB, jam dinding yang dilihat tim CS
-- di Surabaya. Angka 0-23 tidak bisa disalahpahami.
--
-- Perhitungannya dilakukan Node, bukan Postgres, supaya bisa diuji
-- tanpa database: lihat web/lib/jadwalAi.ts dan
-- web/scripts/uji-jadwal-ai.mjs.
--
-- Prasyarat : schema.sql sudah jalan (tabel settings ada).
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang kali.
-- ===========================================================

begin;

-- ===========================================================
-- 1. Kolom jadwal
-- ===========================================================

alter table public.settings
  -- Mati secara bawaan. Menyalakan penjadwalan adalah keputusan yang
  -- harus diambil sadar: sampai ada yang menyalakannya, perilaku
  -- sistem persis seperti sebelum berkas ini dijalankan.
  add column if not exists ai_jadwal_aktif boolean not null default false,

  -- Jam AI MULAI DIAM dan jam AI KEMBALI MENJAWAB, dalam WIB.
  -- Bawaannya 8 dan 16 — jam kerja yang disebut tim CS.
  add column if not exists ai_jam_mulai smallint not null default 8,
  add column if not exists ai_jam_selesai smallint not null default 16,

  -- Hari berlakunya jadwal, ISO-8601: 1 = Senin … 7 = Minggu.
  -- Bawaannya Senin-Jumat.
  add column if not exists ai_hari smallint[] not null default array[1,2,3,4,5]::smallint[],

  -- Override sementara: menyimpang dari jadwal sampai waktu tertentu.
  --
  -- STEMPEL WAKTU, BUKAN BOOLEAN — alasannya sama persis dengan yang
  -- sudah ditulis di handover-jeda-ai.sql: sesuatu yang berakhir
  -- sendiri tidak butuh aturan kedua tentang siapa yang mematikannya.
  -- Risiko terbesar fitur ini adalah AI dimatikan Jumat sore lalu
  -- tidak ada yang menyalakan sampai Senin.
  add column if not exists ai_override_sampai timestamptz,
  add column if not exists ai_override_nyala boolean not null default true;

comment on column public.settings.ai_jam_mulai is
  'Jam WIB saat AI mulai diam (0-23). Bersama ai_jam_selesai membentuk jendela; bila mulai > selesai, jendelanya melewati tengah malam.';

comment on column public.settings.ai_override_sampai is
  'Selama > now(), arah di ai_override_nyala mengalahkan jadwal. Null = tidak ada override. Nilai yang terlalu jauh ke depan dianggap rusak dan diabaikan — lihat BATAS_MASUK_AKAL_MS di web/lib/handover.ts.';

comment on column public.settings.ai_hari is
  'Hari berlakunya jadwal, ISO-8601: 1 = Senin sampai 7 = Minggu. Untuk jendela yang melewati tengah malam, yang dihitung adalah hari saat jendela DIMULAI.';


-- ===========================================================
-- 2. Batas nilai — menahan yang bisa membisukan AI selamanya
-- ===========================================================
-- Bentuk kegagalan yang dijaga di sini tidak pernah muncul sebagai
-- galat. Jadwal 00:00-24:00 berarti AI mati sepanjang waktu; yang
-- terlihat hanyalah pelanggan yang tidak pernah dijawab, berhari-
-- hari, tanpa satu pun tanda di layar. Persis jenis kerusakan yang
-- sudah dijaga 41 kasus uji pada jeda handover.
--
-- 0-23 pada KEDUANYA berarti "mati sepanjang hari" TIDAK BISA
-- dinyatakan lewat jadwal sama sekali, dan itu disengaja: untuk
-- mematikan AI sepenuhnya sudah ada ai_enabled, yang terlihat jelas
-- sebagai keputusan dan bukan efek samping dua angka.

do $blk$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_ai_jam_check') then
    alter table public.settings add constraint settings_ai_jam_check
      check (
        ai_jam_mulai between 0 and 23
        and ai_jam_selesai between 0 and 23
        -- Sama berarti jendelanya tidak punya arti: nol jam, atau
        -- dua puluh empat jam. Ditolak di sini supaya ambiguitasnya
        -- tidak pernah sampai ke kode yang harus menebak.
        and ai_jam_mulai <> ai_jam_selesai
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'settings_ai_hari_check') then
    alter table public.settings add constraint settings_ai_hari_check
      check (
        array_length(ai_hari, 1) between 1 and 7
        -- Tidak ada nilai di luar 1-7. Satu angka 0 yang lolos akan
        -- membuat sebuah hari tidak pernah cocok, dan gejalanya
        -- hanyalah "kok hari Senin AI tetap menjawab".
        and ai_hari <@ array[1,2,3,4,5,6,7]::smallint[]
      );
  end if;
end
$blk$;

-- ===========================================================
-- 3. jadwal_ai() — jalan baca untuk /api/chat
-- ===========================================================
-- Alasannya identik dengan pustaka_router() dan satpam_router():
-- /api/chat memanggil Supabase dengan kunci anon telanjang dan
-- TIDAK authenticated, karena sesi console disimpan di localStorage
-- peramban dan tidak pernah sampai ke route handler. Kebijakan
-- settings_read berbunyi `to authenticated`, jadi tanpa fungsi ini
-- gerbang jadwal tidak bisa membaca satu kolom pun — dan gejalanya
-- adalah jadwal yang tersimpan rapi tetapi tidak pernah berlaku.
--
-- Ditambahkan 11 Sep 2026, sesudah berkas ini sempat dijalankan
-- tanpa bagian ini. Aman dijalankan ulang.
--
-- HANYA KOLOM JADWAL YANG DIKEMBALIKAN, bukan seluruh baris.
-- settings juga memuat ai_model dan escalation_keywords yang tidak
-- ada urusannya dengan keputusan ini; membukanya ke anon berarti
-- memberi lebih dari yang dibutuhkan, untuk keuntungan nol.

create or replace function public.jadwal_ai()
returns table (
  ai_enabled          boolean,
  ai_jadwal_aktif     boolean,
  ai_jam_mulai        smallint,
  ai_jam_selesai      smallint,
  ai_hari             smallint[],
  ai_override_sampai  timestamptz,
  ai_override_nyala   boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    s.ai_enabled,
    s.ai_jadwal_aktif,
    s.ai_jam_mulai,
    s.ai_jam_selesai,
    s.ai_hari,
    s.ai_override_sampai,
    s.ai_override_nyala
  from public.settings s
  where s.id = 1;
$fn$;

comment on function public.jadwal_ai() is
  'Kolom jadwal dari settings (id = 1), untuk gerbang jadwal di /api/chat. security definer supaya bisa dipanggil dengan kunci anon tanpa membuka tabel settings ke anon.';

grant execute on function public.jadwal_ai() to anon, authenticated;

commit;

-- ===========================================================
-- Pemeriksaan sesudah Run
-- ===========================================================
--   select * from public.jadwal_ai();
--
-- Atau, gratis dari folder web/:
--
--   npm run periksa-jadwal
--
--   select ai_enabled, ai_jadwal_aktif, ai_jam_mulai, ai_jam_selesai,
--          ai_hari, ai_override_sampai, ai_override_nyala
--   from public.settings where id = 1;
--
-- Sesudah berkas ini dijalankan, perilaku sistem BELUM berubah sama
-- sekali: ai_jadwal_aktif masih false, dan /api/chat belum membaca
-- satu pun kolom di atas. Itu Tahap 2.
--
-- Aturan keputusannya sendiri sudah bisa diuji sekarang, gratis dan
-- tanpa database:
--
--   npm run uji-jadwal-ai
