# Supabase — Panduan Penyiapan

> Bagian dari Step 6 migrasi. Skema lengkap ada di [`schema.sql`](schema.sql).
> Selesaikan langkah di bawah lebih dulu; Step 7 (login Supabase Auth)
> dan Step 8 (halaman Pengaturan) baru bisa dikerjakan setelah ini.

---

## 1. Buat project Supabase

1. Masuk ke <https://supabase.com> → **New project**.
2. Isi nama (mis. `infarm-cs`), atur **Database Password** — simpan baik-baik,
   password ini tidak bisa dilihat lagi setelah halaman ditutup.
3. Pilih region terdekat: **Southeast Asia (Singapore)**.
4. Tunggu project selesai dibuat (±2 menit).

Paket gratis cukup: 500 MB database, 2 project — sesuai catatan di `claude.md`.

## 2. Jalankan skema

1. Buka project → menu kiri **SQL Editor** → **New query**.
2. Salin **seluruh** isi [`schema.sql`](schema.sql), tempel, lalu **Run**.
3. Hasil yang diharapkan: `Success. No rows returned`.

Berkas ini idempoten — kalau nanti ada perubahan skema, jalankan ulang seluruh
isinya tanpa takut menghapus data yang sudah ada.

**Cek hasilnya:** menu **Table Editor** harus memperlihatkan 5 tabel —
`profiles`, `conversations`, `escalations`, `settings`, `ai_flags` —
dan tabel `settings` sudah berisi tepat 1 baris.

## 3. Buat pengguna admin pertama

Supabase Auth belum tahu siapa admin, dan skema ini memberi peran `cs` kepada
setiap pengguna baru.

1. **Authentication** → **Users** → **Add user** → **Create new user**.
   Isi email dan password untuk admin pertama. Centang *Auto Confirm User*
   supaya tidak perlu verifikasi email.
2. Kembali ke **SQL Editor**, jalankan (ganti alamat emailnya):

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'email-anda@infarm.co.id');
   ```

3. Pastikan berhasil:

   ```sql
   select p.username, p.role, u.email
   from public.profiles p
   join auth.users u on u.id = p.id;
   ```

Ulangi langkah 1 saja (tanpa `update`) untuk tiap anggota tim CS lain — mereka
otomatis berperan `cs`.

## 4. Salin kunci ke aplikasi

1. **Project Settings** → **API**.
2. Salin **Project URL** dan **anon public key**.
3. Tambahkan ke `web/.env.local` (buat berkasnya bila belum ada, contohnya di
   `web/.env.example`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

`anon key` memang dirancang untuk dipakai di browser dan aman ditampilkan —
yang menjaga data tetap aman adalah aturan RLS di `schema.sql`, bukan
kerahasiaan key ini. Sebaliknya, **`service_role` key tidak boleh dipakai di
sisi klien dan tidak boleh masuk ke repo** — kunci itu menembus seluruh RLS.

`.env.local` tidak pernah ikut ter-commit (lihat `.gitignore`). Untuk produksi,
nilai yang sama diisi di Vercel → Project Settings → Environment Variables
(Step 15).

---

## Isi skema secara ringkas

| Tabel | Menggantikan | Catatan |
|---|---|---|
| `profiles` | `localStorage` peran & nama di `flag-store.js` | Peran `cs` / `admin`; terisi otomatis saat pengguna dibuat |
| `conversations` | array `CONVERSATIONS` di `dashboard.js` | Sesuai `claude.md` + 7 kolom yang memang ditampilkan UI lama |
| `escalations` | — | Persis `claude.md`, tanpa tambahan |
| `settings` | `localStorage` `infarm_cs_settings` | Satu baris, dibaca semua admin |
| `ai_flags` | `localStorage` `infarm_cs_flags` | Flag Koreksi jawaban AI |

**Keamanan.** RLS aktif di kelima tabel: hanya pengguna yang sudah login yang
bisa mengakses. Menyimpan pengaturan AI dan memutuskan Flag Koreksi
(setujui/tolak) khusus peran `admin`; anggota `cs` tetap bisa membaca dan
mengirim laporan flag baru.

**Realtime** dinyalakan untuk `conversations`, `escalations`, `settings`, dan
`ai_flags` — inilah dasar yang membuat `TEST-PLAN-SINKRONISASI.md` bisa
dijalankan dengan beberapa admin sekaligus.
