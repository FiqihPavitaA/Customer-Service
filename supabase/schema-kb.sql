-- ===========================================================
-- Infarm CS — Skema Knowledge Base & Template (bagian 2)
-- Dibuat: 4 September 2026 (Step 6c).
--
-- Berkas ini MELENGKAPI supabase/schema.sql, bukan menggantikan.
-- Urutan wajib: jalankan schema.sql lebih dulu, baru berkas ini
-- (di bawah ada foreign key ke public.profiles dan penambahan
-- kolom pada public.conversations & public.ai_flags).
--
-- Sifat: idempoten — aman dijalankan ulang.
--
-- -----------------------------------------------------------
-- "Apakah tabel pesan pelanggan dan tabel template ditaruh di
--  project yang sama, hanya beda tabel?"  -> YA. Alasannya:
--
--   1. Keduanya perlu di-JOIN. routing_log di bawah menghubungkan
--      satu pesan pelanggan dengan template yang menjawabnya.
--      PostgreSQL tidak bisa JOIN antar-project tanpa FDW.
--   2. Auth, RLS, dan Realtime melekat pada project. Dua project
--      berarti dua login, dua anon key, dua daftar admin.
--   3. Paket gratis hanya memberi 2 project — sayang dipakai untuk
--      memecah data yang saling terkait.
--   4. Ukurannya tidak jadi alasan: 152 template kira-kira 60 KB,
--      sedangkan kuotanya 500 MB.
--
-- Yang memisahkan keduanya cukup nama tabel + aturan RLS: tabel
-- percakapan boleh ditulis semua anggota CS, tabel template hanya
-- boleh diubah admin (lihat bagian RLS di bawah).
-- ===========================================================


-- ===========================================================
-- 9. kb_categories — empat berkas kategori FAQ
-- ===========================================================
-- Cerminan knowledge-base/index.json. Dipakai router untuk memilih
-- SATU berkas yang dikirim ke Claude, bukan keempatnya.

create table if not exists public.kb_categories (
  slug        text primary key,   -- 'interaksi' | 'cara-pakai' | 'produk' | 'umum'
  name        text not null,      -- label yang dilihat pengguna
  source_file text not null,      -- berkas .md asal, untuk ekspor balik
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now()
);

insert into public.kb_categories (slug, name, source_file, sort_order) values
  ('interaksi',  'Interaksi',  'knowledge-base/faq-interaksi.md',  1),
  ('cara-pakai', 'Cara Pakai', 'knowledge-base/faq-cara-pakai.md', 2),
  ('produk',     'Produk',     'knowledge-base/faq-produk.md',     3),
  ('umum',       'Umum',       'knowledge-base/faq-umum.md',       4)
on conflict (slug) do nothing;


-- ===========================================================
-- 10. templates — 152 entri [KODE] dari keempat berkas FAQ
-- ===========================================================
-- `code` sengaja dijadikan kunci unik alami (bukan sekadar id acak)
-- karena kode itulah yang dirujuk router, dipakai di log, dan
-- diketik manusia. index.json mencatat 155 entri untuk 152 kode
-- unik — tiga kode ganda (KOMPLAIN, IDUL FITRI, BERTAHAP); aturan
-- lama "yang pertama menang" ditegakkan di sini oleh UNIQUE.

create table if not exists public.templates (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  category_slug  text not null references public.kb_categories (slug),
  body           text not null,       -- isi balasan, apa adanya
  action         text not null default 'AUTO_REPLY'
                   check (action in ('AUTO_REPLY','ASK_INFORMATION',
                                     'HANDOVER_TO_CS','CHECK_ORDER_SYSTEM')),

  -- Template yang TIDAK boleh dipakai otomatis tetap disimpan agar
  -- CS manusia bisa menyalinnya, tetapi is_active=false membuat
  -- router melewatinya.
  is_active      boolean not null default true,

  -- Promo bertanggal (12.12, IDUL FITRI, NATAL) harus mati sendiri.
  -- Tanpa dua kolom ini, template promo lama akan dikirim ke
  -- pelanggan berbulan-bulan setelah promonya habis.
  active_from    date,
  active_until   date,

  -- [REKENING] berisi nomor rekening; [CS WA] & [CS KOMPLAIN] berisi
  -- nomor telepon. claude-core.md melarang mengarahkan transaksi ke
  -- luar marketplace, jadi ketiganya ditandai dan dimatikan.
  is_sensitive   boolean not null default false,

  note           text,
  usage_count    integer not null default 0,
  last_used_at   timestamptz,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);

comment on table public.templates is
  'Balasan baku [KODE]. Rencananya jadi sumber kebenaran untuk router, menggantikan berkas .md. Selama tabel ini kosong, router tetap membaca berkas .md seperti sekarang.';

create index if not exists templates_category_idx on public.templates (category_slug);
create index if not exists templates_active_idx on public.templates (is_active) where is_active;

-- Masa berlaku yang terbalik akan mematikan template diam-diam.
do $blk$
begin
  if not exists (select 1 from pg_constraint where conname = 'templates_period_check') then
    alter table public.templates add constraint templates_period_check
      check (active_from is null or active_until is null or active_from <= active_until);
  end if;
end
$blk$;


-- ===========================================================
-- 11. template_rules — 43 aturan pencocok router
-- ===========================================================
-- Isi RULES[] di knowledge-base/router.js.
--
-- CATATAN PENTING soal `priority`: urutan aturan ADALAH logika.
-- "cara pakai miracle powder" harus jatuh ke [MIRACLE POWDER],
-- bukan [PRODUK MIRACLE], semata karena aturan pemakaian berada
-- lebih dulu. Karena itu priority wajib unik dan router membacanya
-- dengan `order by priority`.
--
-- Pola disimpan sebagai teks sumber regex (tanpa garis miring).
-- PostgreSQL tidak menjalankannya — Node yang menyusunnya kembali
-- dengan new RegExp(). Konsekuensinya: pola yang buruk bisa membuat
-- server hang (catastrophic backtracking), jadi hak tulis tabel ini
-- dibatasi admin, dan setiap pola diuji router.test.mjs sebelum
-- dianggap sah.

create table if not exists public.template_rules (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.templates (id) on delete cascade,
  priority        integer not null,          -- kecil = dinilai lebih dulu
  when_patterns   text[] not null,           -- cukup SALAH SATU cocok (ATAU)
  also_pattern    text,                      -- WAJIB ikut cocok (DAN)
  unless_patterns text[],                    -- bila cocok, aturan dibatalkan
  flags           text not null default 'i',
  why             text not null,             -- alasan aman tanpa AI, untuk audit
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

comment on column public.template_rules.why is
  'Wajib diisi. Sebuah aturan berarti pelanggan dijawab tanpa AI — alasannya harus bisa dibaca ulang saat audit dosis.';

create index if not exists template_rules_priority_idx on public.template_rules (priority);
create index if not exists template_rules_template_idx on public.template_rules (template_id);

do $blk$
begin
  if not exists (select 1 from pg_constraint where conname = 'template_rules_when_check') then
    alter table public.template_rules add constraint template_rules_when_check
      check (array_length(when_patterns, 1) >= 1);
  end if;

  -- priority wajib unik, TETAPI harus deferrable. Menyisipkan aturan
  -- baru di tengah berarti menggeser nomor aturan di bawahnya; dengan
  -- UNIQUE biasa, UPDATE itu gagal pada baris pertama yang bertabrakan
  -- walaupun di akhir transaksi seluruh nomornya kembali unik.
  if not exists (
    select 1 from pg_constraint where conname = 'template_rules_priority_key'
  ) then
    alter table public.template_rules add constraint template_rules_priority_key
      unique (priority) deferrable initially deferred;
  end if;
end
$blk$;


-- ===========================================================
-- 12. template_revisions — riwayat perubahan template
-- ===========================================================
-- Sebagian besar template berisi DOSIS. Kalau suatu hari pelanggan
-- melaporkan takaran yang salah, pertanyaan pertamanya adalah
-- "sejak kapan berubah dan siapa yang mengubah". Tabel ini yang
-- menjawab; tanpa itu jejaknya hilang karena UPDATE menimpa body.

create table if not exists public.template_revisions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  version     integer not null,
  body        text not null,       -- isi SEBELUM perubahan
  action      text,
  changed_by  uuid references public.profiles (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (template_id, version)
);

create index if not exists template_revisions_template_idx
  on public.template_revisions (template_id, version desc);

-- Simpan versi lama otomatis setiap body/action berubah.
create or replace function public.snapshot_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.body is distinct from old.body or new.action is distinct from old.action then
    insert into public.template_revisions (template_id, version, body, action, changed_by)
    values (old.id, old.version, old.body, old.action, new.updated_by)
    on conflict (template_id, version) do nothing;
    new.version := old.version + 1;
  end if;
  return new;
end;
$fn$;

drop trigger if exists templates_snapshot on public.templates;
create trigger templates_snapshot
  before update on public.templates
  for each row execute function public.snapshot_template();


-- ===========================================================
-- 13. routing_log — bukti penghematan token, per permintaan
-- ===========================================================
-- Sampai sekarang angka penghematan router (17-93% karakter FAQ)
-- masih hitungan di atas kertas. Tabel ini menggantinya dengan data
-- nyata: berapa banyak permintaan yang selesai di template (biaya
-- Rp 0), berapa yang 'unclear' dan terpaksa mengirim keempat
-- berkas, dan berapa rupiah yang benar-benar terpakai.

create table if not exists public.routing_log (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.conversations (id) on delete set null,
  message_excerpt  text,          -- 180 karakter pertama, untuk penelusuran
  decision         text not null check (decision in ('template','category','unclear')),
  template_code    text,          -- sengaja teks, bukan FK: log harus tetap
                                  -- terbaca walau templatenya dihapus
  category_slug    text references public.kb_categories (slug) on delete set null,
  kb_files         text[],        -- berkas yang benar-benar dikirim
  faq_chars        integer,       -- karakter FAQ yang dikirim
  faq_chars_full   integer,       -- kalau keempat berkas dikirim (pembanding)
  input_tokens     integer,
  output_tokens    integer,
  cache_read_tokens  integer,
  cache_write_tokens integer,
  cost_idr         numeric(12,2) not null default 0,
  latency_ms       integer,
  created_at       timestamptz not null default now()
);

create index if not exists routing_log_created_idx on public.routing_log (created_at desc);
create index if not exists routing_log_decision_idx on public.routing_log (decision);
create index if not exists routing_log_code_idx on public.routing_log (template_code);


-- ===========================================================
-- 14. Sambungan ke tabel yang sudah ada
-- ===========================================================
-- Dua kolom tambahan supaya halaman Chat bisa menunjukkan "dijawab
-- template [X]" dan Flag Koreksi bisa menunjuk template yang salah —
-- inilah jalur perbaikannya: flag disetujui -> template diperbarui
-- -> template_revisions mencatat versi lamanya.

alter table public.conversations
  add column if not exists template_code text;

alter table public.ai_flags
  add column if not exists template_id uuid references public.templates (id) on delete set null;

create index if not exists ai_flags_template_idx on public.ai_flags (template_id);


-- ===========================================================
-- 15. updated_at otomatis untuk tabel baru
-- ===========================================================
-- public.touch_updated_at() sudah dibuat di schema.sql bagian 6.

drop trigger if exists templates_touch on public.templates;
create trigger templates_touch
  before update on public.templates
  for each row execute function public.touch_updated_at();

drop trigger if exists template_rules_touch on public.template_rules;
create trigger template_rules_touch
  before update on public.template_rules
  for each row execute function public.touch_updated_at();


-- ===========================================================
-- 16. Row Level Security
-- ===========================================================
-- Inilah pemisah sesungguhnya antara "tabel pesan" dan "tabel
-- template": percakapan boleh ditulis seluruh tim CS, sedangkan
-- template & aturan hanya boleh diubah admin. Satu salah ketik pada
-- dosis akan terkirim ke semua pelanggan sekaligus.

alter table public.kb_categories      enable row level security;
alter table public.templates          enable row level security;
alter table public.template_rules     enable row level security;
alter table public.template_revisions enable row level security;
alter table public.routing_log        enable row level security;

drop policy if exists kb_categories_read on public.kb_categories;
create policy kb_categories_read on public.kb_categories
  for select to authenticated using (true);

drop policy if exists kb_categories_write on public.kb_categories;
create policy kb_categories_write on public.kb_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates
  for select to authenticated using (true);

drop policy if exists templates_write on public.templates;
create policy templates_write on public.templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists template_rules_read on public.template_rules;
create policy template_rules_read on public.template_rules
  for select to authenticated using (true);

drop policy if exists template_rules_write on public.template_rules;
create policy template_rules_write on public.template_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Riwayat hanya boleh dibaca. Sengaja tidak ada kebijakan INSERT /
-- UPDATE / DELETE sama sekali: barisnya ditulis oleh trigger yang
-- berjalan sebagai security definer, sehingga catatan audit tidak
-- bisa "dirapikan" siapa pun lewat anon key.
drop policy if exists template_revisions_read on public.template_revisions;
create policy template_revisions_read on public.template_revisions
  for select to authenticated using (true);

drop policy if exists routing_log_read on public.routing_log;
create policy routing_log_read on public.routing_log
  for select to authenticated using (true);

drop policy if exists routing_log_insert on public.routing_log;
create policy routing_log_insert on public.routing_log
  for insert to authenticated with check (true);


-- ===========================================================
-- 17. Realtime
-- ===========================================================
-- templates & template_rules disiarkan supaya perubahan oleh satu
-- admin langsung menyegarkan cache router di instans lain.
-- routing_log TIDAK disiarkan — barisnya bertambah tiap chat dan
-- akan membanjiri langganan tanpa ada yang menontonnya.

do $blk$
declare
  t text;
begin
  foreach t in array array['templates', 'template_rules', 'kb_categories']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$blk$;


-- ===========================================================
-- 18. Tampilan ringkas untuk halaman Statistik
-- ===========================================================
-- Menjawab pertanyaan yang selama ini dihitung manual: dari sekian
-- pesan, berapa persen yang selesai tanpa memanggil Claude?

-- security_invoker wajib. Tanpa itu view berjalan sebagai pemiliknya
-- dan MENEMBUS RLS routing_log, sehingga peran anon yang belum login
-- bisa membaca ringkasan biaya. Supabase linter menandai pola ini
-- sebagai "security_definer_view".
create or replace view public.v_routing_harian
  with (security_invoker = true) as
select
  date_trunc('day', created_at)::date                     as tanggal,
  count(*)                                                as total_pesan,
  count(*) filter (where decision = 'template')           as lewat_template,
  count(*) filter (where decision = 'category')           as satu_kategori,
  count(*) filter (where decision = 'unclear')            as semua_berkas,
  round(100.0 * count(*) filter (where decision = 'template')
        / nullif(count(*), 0), 1)                         as persen_template,
  sum(cost_idr)                                           as biaya_idr
from public.routing_log
group by 1
order by 1 desc;


-- ===========================================================
-- Selesai. Kelima tabel di atas sengaja dibiarkan KOSONG.
-- Skrip pengisinya belum dibuat: menulis ke Supabase butuh URL &
-- service key yang baru ada setelah project dibuat, jadi skrip yang
-- tidak bisa diuji lebih berbahaya daripada belum ada.
-- Selama tabel kosong, router tetap membaca berkas .md — aplikasi
-- berjalan normal. Langkah berikutnya: supabase/README.md "Step 6c".
-- ===========================================================
