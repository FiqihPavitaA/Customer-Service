-- ===========================================================
-- Infarm CS — SEC-002: akun CS biasa tidak bisa lagi mengubah
-- hak aksesnya sendiri menjadi admin
--
-- Temuan audit keamanan 17 Sep 2026 (Notion: Audit Security CS).
--
-- CELAHNYA
--
-- Policy profiles_update_self (schema.sql) mengizinkan setiap akun
-- mengubah baris profilnya sendiri:
--
--   for update to authenticated
--     using (id = auth.uid()) with check (id = auth.uid())
--
-- Policy itu membatasi BARIS, bukan KOLOM — dan grants.sql memberi
-- UPDATE atas seluruh tabel ke authenticated. Satu baris dari konsol
-- peramban sudah cukup:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', saya)
--
-- CHECK (role in ('cs','admin')) tidak menolong: 'admin' memang nilai
-- yang sah. Dan karena pendaftaran akun publik terbuka (SEC-001),
-- "akun mana pun" berarti "siapa pun di internet".
--
-- KENAPA TRIGGER, BUKAN MENCABUT HAK KOLOM
--
-- Cara yang paling sering disarankan adalah
--   revoke update on public.profiles from authenticated;
--   grant update (username) on public.profiles to authenticated;
-- tetapi hak kolom berlaku untuk SEMUA pemegang peran authenticated,
-- termasuk admin. Policy profiles_admin_update — jalan sah admin
-- mengubah role orang lain — akan ikut mati diam-diam, dan satu-
-- satunya tanda adalah "0 baris diubah".
--
-- Trigger bisa membedakan yang tidak bisa dibedakan hak kolom:
--
--   perubahan role dari sesi login (current_user = authenticated)
--     -> hanya boleh bila pengubahnya admin
--   perubahan role dari SQL Editor / service (current_user = postgres)
--     -> tetap boleh, seperti saat admin pertama dinaikkan
--
-- current_user sengaja dipakai, bukan auth.role(). PostgREST
-- menjalankan setiap permintaan DENGAN peran database authenticated
-- atau anon, jadi current_user tidak bisa dipalsukan dari klaim JWT
-- apa pun yang dikirim peramban.
--
-- Aman dijalankan berulang kali.
-- ===========================================================

create or replace function public.jaga_kolom_role()
returns trigger
language plpgsql
-- SECURITY INVOKER (bawaan), BUKAN definer: current_user di dalam
-- fungsi ini harus peran pemanggil yang sebenarnya. Dengan definer,
-- current_user selalu pemilik fungsi dan pemeriksaannya tidak pernah
-- menolak siapa pun.
set search_path = public
as $fn$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_admin()
  then
    raise exception
      'Hanya admin yang boleh mengubah role pengguna.'
      using errcode = '42501',
            hint = 'Minta admin mengubahnya, atau ubah lewat SQL Editor Supabase.';
  end if;
  return new;
end;
$fn$;

comment on function public.jaga_kolom_role() is
  'SEC-002: menolak perubahan profiles.role dari sesi login yang bukan admin. SQL Editor (postgres) tidak terpengaruh.';

drop trigger if exists profiles_jaga_role on public.profiles;
create trigger profiles_jaga_role
  before update of role on public.profiles
  for each row execute function public.jaga_kolom_role();


-- ===========================================================
-- CEK 1 — apakah celah ini SUDAH pernah dipakai?
--
-- Pendaftaran publik terbuka sejak awal, jadi perbaikan di atas
-- hanya menutup pintu ke depan. Jalankan ini dan pastikan setiap
-- admin dan setiap akun memang Anda kenal. Akun yang tidak dikenal:
-- turunkan rolenya (update ... set role = 'cs') lalu hapus lewat
-- Authentication -> Users.
-- ===========================================================

select
  u.email,
  p.username,
  p.role,
  u.created_at        as dibuat,
  u.last_sign_in_at   as terakhir_masuk,
  u.email_confirmed_at is not null as email_dikonfirmasi
from public.profiles p
join auth.users u on u.id = p.id
order by (p.role = 'admin') desc, u.created_at desc;


-- ===========================================================
-- CEK 2 — BUKTIKAN perbaikannya bekerja (tidak mengubah apa pun)
--
-- Jalankan blok ini TERPISAH, sesudah bagian atas berhasil.
-- Seluruhnya di dalam satu transaksi yang berakhir ROLLBACK.
--
-- Yang dilakukan: satu akun dijadikan 'cs' SEMENTARA, lalu sesi
-- menyamar sebagai akun itu persis seperti permintaan dari peramban,
-- dan mencoba menaikkan dirinya sendiri jadi admin.
--
-- HASIL YANG BENAR : galat "Hanya admin yang boleh mengubah role
--                    pengguna." — artinya celah tertutup.
-- HASIL YANG SALAH : "Success" tanpa galat — artinya celah MASIH
--                    terbuka (tetap aman: semuanya di-rollback).
--
-- begin;
--
-- select set_config('uji.id',
--   (select id::text from public.profiles order by created_at limit 1), true);
--
-- update public.profiles set role = 'cs'
--   where id = current_setting('uji.id')::uuid;
--
-- select set_config('request.jwt.claim.sub', current_setting('uji.id'), true);
-- select set_config('request.jwt.claims',
--   json_build_object('sub', current_setting('uji.id'),
--                     'role', 'authenticated')::text, true);
-- set local role authenticated;
--
-- update public.profiles set role = 'admin'
--   where id = current_setting('uji.id')::uuid;
--
-- rollback;
-- ===========================================================
