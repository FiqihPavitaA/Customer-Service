-- ===========================================================
-- Infarm CS — Skema database Supabase (PostgreSQL)
-- Dibuat pada Step 6 migrasi (lihat MIGRATION.md Fase 3).
--
-- Acuan     : claude.md → "Tabel yang Dibutuhkan"
-- Sifat     : idempoten — aman dijalankan ulang, tidak menghapus
--             data yang sudah ada.
-- Cara pakai: Supabase Dashboard → SQL Editor → tempel seluruh
--             isi berkas ini → Run. Panduan: supabase/README.md
-- ===========================================================


-- ===========================================================
-- 1. profiles — identitas & peran admin
-- ===========================================================
-- Tidak ada di claude.md, tetapi wajib ada: Supabase Auth hanya
-- menyimpan email/password di auth.users yang tidak boleh diubah
-- langsung. Nama tampilan dan peran ('cs' | 'admin') — yang
-- selama ini disimpan flag-store.js di localStorage per browser —
-- perlu tempat sendiri, dan dipakai oleh aturan RLS di bawah.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  role       text not null default 'cs' check (role in ('cs', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil admin CS. Satu baris per pengguna Supabase Auth.';

-- Buat profil otomatis setiap ada pengguna baru mendaftar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Penolong: apakah pengguna yang sedang login berperan admin?
-- security definer supaya pengecekan tidak terbentur RLS profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$fn$;


-- ===========================================================
-- 2. conversations — percakapan pelanggan
-- ===========================================================
-- Kolom sampai `updated_at` persis seperti claude.md.
-- Kolom setelahnya ditambahkan pada Step 6 karena dashboard.html
-- versi lama memang menampilkannya; tanpa kolom ini halaman Chat
-- (Step 14) akan butuh migrasi skema kedua. Tiap tambahan diberi
-- keterangan asalnya.

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  platform         text,          -- 'shopee' | 'tiktok' | 'lazada'
  customer_id      text,
  order_id         text,
  messages         jsonb not null default '[]'::jsonb,  -- [{role, content, timestamp}]
  action           text,          -- lihat CHECK di bawah
  handover_summary text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- --- tambahan Step 6, dipakai UI lama ---
  customer_name    text,          -- dashboard.js: nama pembeli di daftar chat
  shop_name        text,          -- dashboard.js: 'infarmofficialshop', dll
  unread           boolean not null default true,   -- badge 💬 di rail
  tracking_no      text,          -- resi; salah satu lingkup pencarian topbar
  ai_suggestion    text,          -- panel "saran AI" di halaman Chat
  handover_detail  jsonb,         -- {Platform, Kategori, "Inti Masalah", Urgensi}
  last_message_at  timestamptz not null default now()  -- urutan daftar chat
);

-- Nilai `action` mengikuti kontrak nyata AI engine (parseAction di
-- lib/knowledge.ts). CATATAN: komentar SQL di claude.md menulis
-- singkatan lama 'ASK_INFO | HANDOVER | CHECK_ORDER'; yang benar —
-- dan yang sungguh dikirim /api/chat — adalah keempat nilai ini.
do $blk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_action_check'
  ) then
    alter table public.conversations
      add constraint conversations_action_check
      check (action is null or action in (
        'AUTO_REPLY', 'ASK_INFORMATION', 'HANDOVER_TO_CS', 'CHECK_ORDER_SYSTEM'
      ));
  end if;
end
$blk$;

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);
create index if not exists conversations_unread_idx
  on public.conversations (unread) where unread;
create index if not exists conversations_order_idx
  on public.conversations (order_id);
create index if not exists conversations_tracking_idx
  on public.conversations (tracking_no);


-- ===========================================================
-- 3. escalations — log eskalasi ke CS manusia
-- ===========================================================
-- Persis seperti claude.md, tanpa tambahan.

create table if not exists public.escalations (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete cascade,
  reason          text,
  status          text not null default 'open' check (status in ('open', 'resolved')),
  assigned_to     text,
  created_at      timestamptz not null default now()
);

create index if not exists escalations_status_idx
  on public.escalations (status);
create index if not exists escalations_conversation_idx
  on public.escalations (conversation_id);


-- ===========================================================
-- 4. settings — pengaturan AI (satu baris, dibaca semua admin)
-- ===========================================================
-- Menggantikan localStorage 'infarm_cs_settings' di settings.js,
-- yang selama ini terpisah per browser sehingga tiap admin bisa
-- melihat pengaturan yang berbeda.

create table if not exists public.settings (
  id                   smallint primary key default 1 check (id = 1),
  ai_enabled           boolean not null default true,
  ai_model             text    not null default 'claude-sonnet-4-6',
  confidence           integer not null default 80 check (confidence between 0 and 100),
  escalation_keywords  text[]  not null default array[
    'refund', 'retur', 'pembatalan', 'barang rusak',
    'tidak sampai', 'komplain', 'bicara CS'
  ],
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.profiles (id) on delete set null
);

-- Nilai awal = default settings.js versi lama.
insert into public.settings (id) values (1) on conflict (id) do nothing;


-- ===========================================================
-- 5. ai_flags — Flag Koreksi jawaban AI
-- ===========================================================
-- Menggantikan localStorage 'infarm_cs_flags' di flag-store.js.
-- Berkas itu sendiri sudah menuliskan rencana ini di komentarnya.
-- Nama kolom sengaja sepadan dengan bentuk datanya supaya
-- penggantian loadFlags/addFlag/updateFlag minim perubahan.

create table if not exists public.ai_flags (
  id               uuid primary key default gen_random_uuid(),
  code             text unique,   -- 'FLG-0001' — nomor yang dilihat pengguna
  customer_message text not null,
  ai_answer        text not null,
  ai_action        text,
  correct_answer   text,
  category         text not null default 'lainnya'
                     check (category in ('produk','kebijakan','dosis','harga','lainnya')),
  reporter_id      uuid references public.profiles (id) on delete set null,
  reporter_name    text,
  note             text,
  status           text not null default 'menunggu'
                     check (status in ('menunggu','disetujui','ditolak')),
  reject_reason    text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null
);

create index if not exists ai_flags_status_idx on public.ai_flags (status);
create index if not exists ai_flags_created_idx on public.ai_flags (created_at desc);


-- ===========================================================
-- 6. updated_at otomatis
-- ===========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch
  before update on public.settings
  for each row execute function public.touch_updated_at();


-- ===========================================================
-- 7. Row Level Security
-- ===========================================================
-- Semua tabel dikunci. Tanpa blok ini, anon key yang dipakai di
-- browser bisa membaca & menulis seluruh isi tabel.
-- Aturan dasar: hanya pengguna yang sudah login (authenticated)
-- yang bisa mengakses; sebagian aksi khusus admin.

alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.escalations   enable row level security;
alter table public.settings      enable row level security;
alter table public.ai_flags      enable row level security;

-- --- profiles ---
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Hanya admin yang boleh mengubah peran orang lain.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- conversations: seluruh tim CS bekerja pada inbox yang sama ---
drop policy if exists conversations_all on public.conversations;
create policy conversations_all on public.conversations
  for all to authenticated using (true) with check (true);

-- --- escalations ---
drop policy if exists escalations_all on public.escalations;
create policy escalations_all on public.escalations
  for all to authenticated using (true) with check (true);

-- --- settings: semua admin membaca, hanya admin menulis ---
-- Kalau nanti semua orang perlu bisa menyimpan pengaturan, ganti
-- `public.is_admin()` pada kebijakan di bawah menjadi `true`.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select to authenticated using (true);

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- ai_flags: siapa pun melapor, hanya admin memutuskan ---
drop policy if exists ai_flags_read on public.ai_flags;
create policy ai_flags_read on public.ai_flags
  for select to authenticated using (true);

drop policy if exists ai_flags_insert on public.ai_flags;
create policy ai_flags_insert on public.ai_flags
  for insert to authenticated with check (true);

drop policy if exists ai_flags_review on public.ai_flags;
create policy ai_flags_review on public.ai_flags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ===========================================================
-- 8. Realtime — dasar sinkronisasi antar admin
-- ===========================================================
-- Tanpa ini TEST-PLAN-SINKRONISASI.md tidak bisa dijalankan:
-- perubahan oleh satu admin tidak akan muncul di layar admin lain.

do $blk$
declare
  t text;
begin
  foreach t in array array['conversations', 'escalations', 'settings', 'ai_flags']
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
-- Selesai. Langkah berikutnya ada di supabase/README.md:
-- membuat pengguna admin pertama dan menyalin kunci API.
-- ===========================================================
