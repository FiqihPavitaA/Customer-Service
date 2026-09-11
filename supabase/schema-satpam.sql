-- ===========================================================
-- Infarm CS — Gerbang 0 (satpam) pindah dari kode ke tabel
--
-- Tahap 1 dari rencana "kata sensitif bisa dikelola admin"
-- (Notion: Progres web cs, 2026-09-11).
--
-- MASALAH YANG DIPECAHKAN
--
-- Gerbang 0 memutuskan pesan mana yang WAJIB ditangani manusia:
-- refund, barang rusak, keracunan, minta bicara dengan orang.
-- Daftarnya selama ini array konstan di knowledge-base/router.js,
-- jadi menambah satu kata berarti commit + deploy. Tim CS menemukan
-- lubangnya sendiri pada 10 Sep 2026: "chat penjual" tidak pernah
-- tertangkap, karena pola minta_manusia hanya mengenal
-- cs/admin/orang/manusia/petugas. Pesan seperti itu lolos ke Claude
-- dan berbiaya, padahal jawabannya sudah pasti "alihkan ke CS".
--
-- KENAPA TABEL INI MENGGANTI DAFTAR DI KODE, BUKAN MENAMBAHINYA
--
-- Keputusan pemilik proyek, 11 Sep 2026. Kalau tabel hanya
-- menambahi, admin tidak akan pernah bisa MENCABUT kata bawaan yang
-- ternyata terlalu luas — dan sudah ada contohnya: pola `dana` di
-- luar_marketplace akan mencegat "bantuan dana desa". Harga yang
-- diterima: daftar bisa dikosongkan admin. Itu ditahan dengan
-- penanda is_bawaan + peringatan di UI, bukan dengan melarang.
--
-- Router tetap menyimpan daftar bawaannya sebagai CADANGAN. Kalau
-- tabel ini gagal dibaca atau kosong, yang berlaku adalah daftar di
-- kode. Ini berbeda dari tabel `templates` (yang jatuh ke berkas
-- .md), dan bedanya disengaja: "tabel kosong" tidak boleh pernah
-- berarti "tidak ada pengaman".
--
-- Prasyarat : schema.sql, schema-kb.sql, dan grants.sql sudah jalan.
-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run
-- Sifat     : idempoten, aman dijalankan berulang kali.
-- ===========================================================

begin;

-- ===========================================================
-- 1. satpam_kategori — tujuh alasan bawaan, beserta dasarnya
-- ===========================================================
-- Dipisah dari aturannya karena satu kategori dipakai banyak baris
-- aturan, dan `alasan` di bawah adalah kutipan dari claude-core.md
-- bagian "C. HANDOVER_TO_CS — Wajib gunakan jika". Mengulang teks
-- itu di tiap baris aturan berarti 21 salinan yang harus dijaga
-- tetap sama.
--
-- Kategori BOLEH ditambah admin. Yang tidak boleh adalah menghapus
-- kategori yang masih dipakai aturan — dijaga foreign key di bawah.

create table if not exists public.satpam_kategori (
  slug        text primary key,
  label       text not null,          -- yang dibaca manusia di UI
  alasan      text not null,          -- dasarnya di claude-core.md
  urutan      integer not null,       -- urutan tampil di halaman admin
  created_at  timestamptz not null default now()
);

insert into public.satpam_kategori (slug, label, alasan, urutan) values
  ('refund_retur', 'Refund & Retur',
   'claude-core.md: pelanggan meminta refund, retur, pembatalan, kompensasi, atau penggantian. Hanya CS manusia yang berwenang menjanjikan ini.', 1),
  ('barang_bermasalah', 'Barang Bermasalah',
   'claude-core.md: barang rusak, bocor, kurang, salah kirim, atau tidak sampai.', 2),
  ('sengketa', 'Sengketa & Ancaman',
   'claude-core.md: pelanggan marah, mengancam, atau menyampaikan sengketa. Kemarahan tanpa kata-kata di daftar ini tidak ditangkap — itu memang lebih baik dinilai manusia lewat halaman Chat.', 3),
  ('keamanan', 'Keamanan & Keracunan',
   'claude-core.md: pertanyaan menyangkut keamanan pestisida, keracunan, hewan peliharaan, anak-anak, atau konsumsi hasil panen. Dibiarkan lewat hanya bila jawabannya tertulis jelas di KB — dan satpam tidak bisa menilai itu, jadi selalu ditahan.', 4),
  ('tanaman_rusak', 'Tanaman Rusak Setelah Pakai',
   'claude-core.md: tanaman diduga rusak setelah menggunakan produk Infarm. Butuh syarat tambahan karena kata "layu" sendirian adalah konsultasi biasa — yang menjadikannya sengketa adalah kaitan sebab-akibat dengan produk kami.', 5),
  ('minta_manusia', 'Minta Bicara dengan Manusia',
   'claude-core.md: pelanggan secara eksplisit meminta berbicara dengan manusia. Menahannya di sini membuat permintaan itu dipenuhi seketika, bukan setelah satu putaran balasan otomatis lagi.', 6),
  ('luar_marketplace', 'Transaksi di Luar Marketplace',
   'claude-core.md: menghindari pengarahan transaksi di luar ekosistem marketplace. Melanggar ketentuan Shopee/TikTok, dan sanksinya menimpa toko — bukan pelanggan.', 7)
on conflict (slug) do nothing;


-- ===========================================================
-- 2. satpam_rules — satu baris = satu aturan pencegatan
-- ===========================================================
-- Bentuknya sengaja dibuat sama dengan template_rules: when (ATAU),
-- also (DAN), unless (pembatal). Sekali paham, paham keduanya.
--
-- KENAPA `frasa` DAN `when_patterns` DISIMPAN DUA-DUANYA
--
-- `frasa` adalah kata apa adanya yang diketik admin; `when_patterns`
-- adalah regex yang benar-benar dijalankan router. Kalau hanya pola
-- yang disimpan, halaman admin harus membongkar regex kembali
-- menjadi kata untuk bisa menampilkannya — rapuh, dan pasti salah
-- pada pola yang sedikit saja rumit.
--
-- Invariannya: bila `frasa` terisi, `when_patterns` HARUS sama
-- dengan buatPolaDariFrasa(frasa). Itu yang membuat admin cukup
-- mengetik kata biasa dan tidak pernah perlu menulis regex —
-- fungsinya meng-escape seluruh karakter khusus, jadi salah ketik
-- tidak bisa menjadi pola yang membuat server hang.
--
-- `frasa` NULL berarti aturan ini terlalu rumit untuk diwakili
-- daftar kata — misalnya pola pembatalan yang akhiran -in/-kan-nya
-- opsional. Baris seperti itu ditampilkan tetapi tidak bisa
-- disunting dari halaman admin. Tiga keadaan, bukan dua; persis
-- seperti yang sudah dilakukan TemplateManager pada kata kunci
-- pemicu template.

create table if not exists public.satpam_rules (
  id              uuid primary key default gen_random_uuid(),
  kategori        text not null references public.satpam_kategori (slug),
  priority        integer not null,          -- kecil = dinilai lebih dulu
  frasa           text[],                    -- kata apa adanya; null = pola tangan
  when_patterns   text[] not null,           -- cukup SALAH SATU cocok (ATAU)
  also_pattern    text,                      -- WAJIB ikut cocok (DAN)
  unless_patterns text[],                    -- bila cocok, aturan dibatalkan
  flags           text not null default 'i',
  why             text not null,             -- kenapa ini wajib ke manusia
  is_bawaan       boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

comment on column public.satpam_rules.is_bawaan is
  'true = salinan daftar SATPAM di knowledge-base/router.js. Boleh dinonaktifkan admin, tetapi UI wajib memperingatkan lebih dulu: baris inilah yang menahan refund dan keracunan.';

comment on column public.satpam_rules.frasa is
  'Kata apa adanya yang diketik admin. NULL = pola ditulis tangan dan tidak bisa disunting lewat halaman admin. Bila terisi, when_patterns wajib sama dengan buatPolaDariFrasa(frasa).';

create index if not exists satpam_rules_priority_idx on public.satpam_rules (priority);
create index if not exists satpam_rules_kategori_idx on public.satpam_rules (kategori);

do $blk$
begin
  if not exists (select 1 from pg_constraint where conname = 'satpam_rules_when_check') then
    alter table public.satpam_rules add constraint satpam_rules_when_check
      check (array_length(when_patterns, 1) >= 1);
  end if;

  -- Alasannya sama persis dengan template_rules_priority_key:
  -- menyisipkan aturan baru di tengah berarti menggeser nomor aturan
  -- di bawahnya, dan dengan UNIQUE biasa UPDATE itu gagal pada baris
  -- pertama yang bertabrakan walaupun di akhir transaksi seluruh
  -- nomornya kembali unik.
  if not exists (
    select 1 from pg_constraint where conname = 'satpam_rules_priority_key'
  ) then
    alter table public.satpam_rules add constraint satpam_rules_priority_key
      unique (priority) deferrable initially deferred;
  end if;
end
$blk$;

-- public.touch_updated_at() sudah dibuat di schema.sql bagian 6.
drop trigger if exists satpam_rules_touch on public.satpam_rules;
create trigger satpam_rules_touch
  before update on public.satpam_rules
  for each row execute function public.touch_updated_at();


-- ===========================================================
-- 3. satpam_revisions — jejak siapa mengubah pengaman
-- ===========================================================
-- Alasannya sejajar dengan template_revisions, tetapi taruhannya
-- berbeda. Pada template yang hilang jejaknya adalah dosis; di sini
-- yang hilang jejaknya adalah ALASAN sebuah pesan berbahaya lolos.
-- Kalau suatu hari permintaan refund sampai ke Claude, pertanyaan
-- pertamanya adalah: kata apa yang dicabut, kapan, oleh siapa.
--
-- Baris lama disimpan apa adanya, termasuk saat aturan DIHAPUS —
-- karena itulah perubahan yang paling perlu bisa ditelusuri.

create table if not exists public.satpam_revisions (
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid,                      -- sengaja TANPA foreign key
  kategori        text not null,
  frasa           text[],                    -- isi SEBELUM perubahan
  when_patterns   text[] not null,
  also_pattern    text,
  unless_patterns text[],
  is_active       boolean,
  aksi            text not null check (aksi in ('ubah', 'hapus')),
  changed_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on column public.satpam_revisions.rule_id is
  'Sengaja bukan foreign key: catatan penghapusan harus tetap terbaca setelah barisnya hilang. Foreign key ON DELETE CASCADE justru akan menghapus bukti yang paling dibutuhkan.';

create index if not exists satpam_revisions_rule_idx
  on public.satpam_revisions (rule_id, created_at desc);

create or replace function public.snapshot_satpam()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    insert into public.satpam_revisions
      (rule_id, kategori, frasa, when_patterns, also_pattern, unless_patterns,
       is_active, aksi, changed_by)
    values (old.id, old.kategori, old.frasa, old.when_patterns, old.also_pattern,
            old.unless_patterns, old.is_active, 'hapus', old.updated_by);
    return old;
  end if;

  -- Hanya yang mengubah PERILAKU pencegatan yang dicatat. Menyunting
  -- `why` tidak mengubah satu pun pesan yang tertangkap, dan riwayat
  -- yang penuh perubahan tanpa akibat justru menyembunyikan yang
  -- berakibat.
  if new.frasa           is distinct from old.frasa
  or new.when_patterns   is distinct from old.when_patterns
  or new.also_pattern    is distinct from old.also_pattern
  or new.unless_patterns is distinct from old.unless_patterns
  or new.is_active       is distinct from old.is_active then
    insert into public.satpam_revisions
      (rule_id, kategori, frasa, when_patterns, also_pattern, unless_patterns,
       is_active, aksi, changed_by)
    values (old.id, old.kategori, old.frasa, old.when_patterns, old.also_pattern,
            old.unless_patterns, old.is_active, 'ubah', new.updated_by);
  end if;
  return new;
end;
$fn$;

drop trigger if exists satpam_rules_snapshot on public.satpam_rules;
create trigger satpam_rules_snapshot
  before update or delete on public.satpam_rules
  for each row execute function public.snapshot_satpam();


-- ===========================================================
-- 4. Row Level Security
-- ===========================================================
-- Tulis HANYA admin — keputusan pemilik proyek, 11 Sep 2026.
-- Peran `cs` tetap boleh membaca supaya halaman admin bisa
-- menampilkan daftarnya lengkap dengan keterangan kenapa tombol
-- simpannya mati. Pola yang sama persis dengan templates_write.

alter table public.satpam_kategori  enable row level security;
alter table public.satpam_rules     enable row level security;
alter table public.satpam_revisions enable row level security;

drop policy if exists satpam_kategori_read on public.satpam_kategori;
create policy satpam_kategori_read on public.satpam_kategori
  for select to authenticated using (true);

drop policy if exists satpam_kategori_write on public.satpam_kategori;
create policy satpam_kategori_write on public.satpam_kategori
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists satpam_rules_read on public.satpam_rules;
create policy satpam_rules_read on public.satpam_rules
  for select to authenticated using (true);

drop policy if exists satpam_rules_write on public.satpam_rules;
create policy satpam_rules_write on public.satpam_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Riwayat hanya boleh dibaca. Tidak ada kebijakan INSERT/UPDATE/
-- DELETE sama sekali: barisnya ditulis trigger security definer,
-- jadi catatan audit tidak bisa "dirapikan" siapa pun — termasuk
-- admin yang mencabut sebuah kata lalu ingin jejaknya hilang.
drop policy if exists satpam_revisions_read on public.satpam_revisions;
create policy satpam_revisions_read on public.satpam_revisions
  for select to authenticated using (true);


-- ===========================================================
-- 5. satpam_router() — jalan baca untuk /api/chat
-- ===========================================================
-- Alasannya identik dengan pustaka_router() di
-- schema-templates-baca.sql: /api/chat memanggil Supabase dengan
-- kunci anon telanjang dan TIDAK authenticated, karena sesi login
-- console disimpan di localStorage peramban dan tidak pernah sampai
-- ke route handler. Tanpa fungsi ini, router tidak bisa membaca satu
-- baris pun dari tabel yang seharusnya jadi sumbernya.
--
-- security definer + grant hanya atas FUNGSINYA, bukan tabelnya.
-- Anon tetap tidak punya hak apa pun atas satpam_rules.

create or replace function public.satpam_router()
returns table (
  kategori        text,
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
    r.kategori,
    r.priority,
    r.when_patterns,
    r.also_pattern,
    r.unless_patterns,
    r.flags,
    r.why
  from public.satpam_rules r
  where r.is_active
  -- Urutan ADALAH logika: pesan yang cocok dua kategori dilaporkan
  -- sebagai kategori yang dinilai lebih dulu, dan itulah yang
  -- dibaca tim CS di halaman Chat. Router menjaga urutan yang
  -- datang dari sini apa adanya.
  order by r.priority;
$fn$;

comment on function public.satpam_router() is
  'Aturan Gerbang 0 yang aktif, untuk router /api/chat. security definer supaya bisa dipanggil dengan kunci anon tanpa membuka tabel satpam_rules ke anon. Hanya mengembalikan baris is_active.';

grant execute on function public.satpam_router() to anon, authenticated;


-- ===========================================================
-- 6. Seed — salinan persis daftar SATPAM di router.js
-- ===========================================================
-- BLOK DI BAWAH DIHASILKAN, BUKAN DIKETIK TANGAN. Pola untuk baris
-- yang punya `frasa` dihitung buatPolaDariFrasa() — fungsi yang sama
-- yang nanti dipakai halaman admin — supaya invarian "frasa ada =>
-- when_patterns = buatPolaDariFrasa(frasa)" berlaku sejak baris
-- pertama.
--
-- SATU PERBEDAAN YANG DISENGAJA dari daftar di kode: frasa
-- ber-spasi menjadi \s+, bukan spasi tunggal. Jadi "uang  kembali"
-- dengan dua spasi kini ikut tertangkap, padahal pola lama
-- melewatkannya. Arahnya benar untuk sebuah pengaman — lebih
-- longgar, bukan lebih ketat — dan salah ketik spasi ganda memang
-- lazim di chat.
--
-- Nomor priority sengaja berjarak 10 supaya aturan baru bisa
-- disisipkan di antaranya tanpa menomori ulang seluruh tabel.
--
-- KENAPA WHERE NOT EXISTS, BUKAN ON CONFLICT
--
-- Percobaan pertama memakai `on conflict (priority) do nothing` dan
-- ditolak PostgreSQL saat migrasi dijalankan, 11 Sep 2026:
--
--   ERROR 55000: ON CONFLICT does not support deferrable unique
--   constraints/exclusion constraints as arbiters
--
-- Sebabnya satpam_rules_priority_key memang DEFERRABLE — lihat
-- alasannya di bagian 2 — dan constraint deferrable tidak bisa
-- dipakai sebagai penengah ON CONFLICT. Keduanya tidak bisa
-- dimiliki sekaligus, dan yang dipertahankan adalah deferrable-nya:
-- ia melindungi penomoran ulang aturan, sedangkan idempotensi bisa
-- dicapai dengan cara lain.
--
-- Cara lain itu WHERE NOT EXISTS, mengikuti seed-templates.sql yang
-- menghadapi batasan yang sama pada template_rules.
--
-- Satu perbedaan penting dari seed template: di sana barisnya
-- DIHAPUS lebih dulu (delete lalu insert), dan itu aman karena
-- seluruh isinya memang selalu dibangkitkan ulang dari router.js.
-- Di sini tidak boleh begitu — tabel ini juga memuat kata yang
-- ditambahkan admin lewat halaman Kata Sensitif, dan menghapusnya
-- berarti membuang pekerjaan orang lain setiap kali berkas ini
-- dijalankan ulang.
--
-- Penjagaannya per-seluruh-seed, bukan per-baris: kalau sudah ada
-- satu pun baris bawaan, seluruh blok dilewati. Dengan begitu baris
-- bawaan yang sengaja dinonaktifkan atau dihapus admin tidak
-- dihidupkan kembali diam-diam — itu keputusan, dan jejaknya ada di
-- satpam_revisions.
--
-- Kesetaraan perilakunya diuji tanpa database dan tanpa biaya:
--
--   node knowledge-base/uji-satpam-seed.mjs

insert into public.satpam_rules
  (kategori, priority, frasa, when_patterns, also_pattern, why, is_bawaan)
select v.kategori, v.priority, v.frasa, v.when_patterns, v.also_pattern, v.why, v.is_bawaan
from (values
  ('refund_retur', 10, array['refund', 'retur', 'pengembalian dana', 'uang kembali', 'balikin uang', 'kembalikan uang']::text[], array['\b(refund|retur|pengembalian\s+dana|uang\s+kembali|balikin\s+uang|kembalikan\s+uang)\b']::text[], null::text, 'Permintaan uang kembali, disebut dengan namanya sendiri.', true),
  ('refund_retur', 20, array['kompensasi', 'ganti rugi', 'penggantian', 'tukar barang', 'tuker barang']::text[], array['\b(kompensasi|ganti\s+rugi|penggantian|tukar\s+barang|tuker\s+barang)\b']::text[], null::text, 'Bentuk lain dari permintaan yang sama: minta diganti, bukan minta penjelasan.', true),
  ('refund_retur', 30, null::text[], array['\b(batal(in|kan)?|cancel)\b']::text[], null::text, 'Pembatalan. Ditulis sebagai pola karena akhiran -in/-kan opsional.', true),
  ('barang_bermasalah', 40, array['rusak', 'pecah', 'bocor', 'penyok', 'sobek', 'robek']::text[], array['\b(rusak|pecah|bocor|penyok|sobek|robek)\b']::text[], null::text, 'Kerusakan fisik yang dilaporkan pelanggan.', true),
  ('barang_bermasalah', 50, null::text[], array['\b(salah (kirim|barang|produk)|beda (barang|produk)|bukan yang (saya|aku) pesan)\b']::text[], null::text, 'Salah kirim. Pola, karena kata keduanya bervariasi.', true),
  ('barang_bermasalah', 60, array['tidak pernah sampai', 'nggak pernah sampai', 'gak pernah sampai', 'barang hilang', 'paket hilang']::text[], array['\b(tidak\s+pernah\s+sampai|nggak\s+pernah\s+sampai|gak\s+pernah\s+sampai|barang\s+hilang|paket\s+hilang)\b']::text[], null::text, 'Barang hilang. SENGAJA bukan ''belum sampai'' — itu pertanyaan pelacakan biasa dan jumlahnya paling banyak.', true),
  ('barang_bermasalah', 70, null::text[], array['\b(isi|barang|paket|pesanan)(nya)? kurang\b']::text[], null::text, 'Jumlah kurang. Pola, karena akhiran -nya opsional.', true),
  ('barang_bermasalah', 80, null::text[], array['\bkurang (satu|dua|tiga|\d+) (item|barang|pcs|botol|sachet|bungkus)\b']::text[], null::text, 'Jumlah kurang dengan angka. Pola, karena mengandung \d+.', true),
  ('sengketa', 90, array['penipuan', 'nipu', 'menipu', 'ditipu', 'tipu-tipu']::text[], array['\b(penipuan|nipu|menipu|ditipu|tipu-tipu)\b']::text[], null::text, 'Tuduhan penipuan. Tidak boleh dijawab otomatis dalam bentuk apa pun.', true),
  ('sengketa', 100, null::text[], array['\b(lapor(kan)?|somasi|tuntut|pengacara|polisi|ylki)\b']::text[], null::text, 'Ancaman jalur hukum. Pola, karena akhiran -kan opsional.', true),
  ('sengketa', 110, null::text[], array['\b(bintang (1|satu)|rating (1|satu)|ulasan buruk|review jelek)\b']::text[], null::text, 'Ancaman ulasan buruk. Pola, karena angka bisa ditulis dua cara.', true),
  ('keamanan', 120, array['keracunan', 'beracun', 'beracunkah', 'racunnya']::text[], array['\b(keracunan|beracun|beracunkah|racunnya)\b']::text[], null::text, 'Keracunan disebut langsung.', true),
  ('keamanan', 130, array['tertelan', 'termakan', 'kena mata', 'terhirup']::text[], array['\b(tertelan|termakan|kena\s+mata|terhirup)\b']::text[], null::text, 'Paparan tidak sengaja.', true),
  ('keamanan', 140, array['bayi', 'balita', 'anak kecil', 'kucing', 'anjing', 'hewan peliharaan', 'ternak']::text[], array['\b(bayi|balita|anak\s+kecil|kucing|anjing|hewan\s+peliharaan|ternak)\b']::text[], null::text, 'Anak-anak dan hewan peliharaan — disebut eksplisit di claude-core.md.', true),
  ('keamanan', 150, null::text[], array['\b(aman (di)?(makan|konsumsi|dimakan)|boleh dimakan|langsung dimakan|hasil panen)\b']::text[], null::text, 'Konsumsi hasil panen. Pola, karena awalan di- opsional.', true),
  ('tanaman_rusak', 160, array['mati', 'layu', 'gosong', 'terbakar', 'kering', 'rontok']::text[], array['\b(mati|layu|gosong|terbakar|kering|rontok)\b']::text[], '\b(setelah|sesudah|habis|gara-gara|gegara|karena|abis) (di)?(pakai|pake|semprot|siram|kasih|aplikasi)', 'Gejala kerusakan tanaman. Hanya berlaku bersama syarat sebab-akibat di also_pattern.', true),
  ('minta_manusia', 170, null::text[], array['\b(bicara|ngomong|chat|hubungi|sambung(kan)?) (dengan |sama |ke )?(cs|admin|orang|manusia|petugas)( asli| beneran| langsung)?\b']::text[], null::text, 'Minta bicara dengan manusia. Pola, karena kata sambung dan imbuhannya opsional.', true),
  ('minta_manusia', 180, null::text[], array['\b(ini (bot|robot|ai)|bukan bot|jangan bot|cs nya mana|admin nya mana|adminnya mana)\b']::text[], null::text, 'Pelanggan sadar sedang bicara dengan mesin dan menolaknya.', true),
  ('luar_marketplace', 190, array['transfer', 'rekening', 'no rek', 'norek', 'dana', 'gopay', 'ovo', 'shopeepay']::text[], array['\b(transfer|rekening|no\s+rek|norek|dana|gopay|ovo|shopeepay)\b']::text[], null::text, 'Pembayaran di luar marketplace.', true),
  ('luar_marketplace', 200, null::text[], array['\b(wa|whatsapp|wa-?me|nomor hp|no hp|telegram|line)\b']::text[], null::text, 'Perpindahan kanal. Pola, karena tanda hubung pada wa-me opsional.', true),
  ('luar_marketplace', 210, null::text[], array['\b(beli|order|pesan) (di ?)?(luar|langsung)\b']::text[], null::text, 'Ajakan transaksi di luar sistem.', true)
) as v(kategori, priority, frasa, when_patterns, also_pattern, why, is_bawaan)
where not exists (select 1 from public.satpam_rules where is_bawaan);


commit;
