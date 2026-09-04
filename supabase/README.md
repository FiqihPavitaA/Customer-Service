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

---

## Step 6c — tabel Knowledge Base & template

> Ditambahkan 4 September 2026. Jalankan **setelah** langkah 1–4 di atas.

Sampai sekarang 152 balasan baku `[KODE]` hanya ada sebagai berkas `.md` di
repo. Artinya setiap koreksi kalimat — termasuk koreksi **dosis** — harus lewat
edit kode dan deploy ulang, dan tim CS tidak bisa memperbaikinya sendiri.
`schema-kb.sql` menyiapkan tempatnya di database.

1. **SQL Editor** → **New query** → tempel seluruh isi
   [`schema-kb.sql`](schema-kb.sql) → **Run**.
2. **Table Editor** sekarang menampilkan 5 tabel tambahan: `kb_categories`,
   `templates`, `template_rules`, `template_revisions`, `routing_log`.
   `kb_categories` sudah berisi 4 baris; empat tabel lain sengaja **kosong**.

### Kenapa tabelnya dibiarkan kosong

Skrip pengisi (`.md` → Supabase) belum dibuat. Menulisnya sekarang berarti
menyerahkan skrip yang belum pernah dijalankan, karena mengujinya butuh URL dan
key yang baru ada setelah project berdiri. Selama tabel kosong, `router.js`
tetap membaca berkas `.md` seperti biasa — **aplikasi berjalan normal**, tidak
ada yang rusak. Pengisian adalah langkah terpisah setelah kredensial siap.

| Tabel | Menggantikan / menambah | Hak tulis |
|---|---|---|
| `kb_categories` | `knowledge-base/index.json` | admin |
| `templates` | 152 entri `[KODE]` di 4 berkas FAQ | admin |
| `template_rules` | `RULES[]` di `knowledge-base/router.js` | admin |
| `template_revisions` | — (baru) riwayat perubahan dosis | hanya baca |
| `routing_log` | `console.log` di `logRouting()` | semua CS |

### Tiga hal yang perlu diperhatikan

**Urutan aturan adalah logika.** `template_rules.priority` wajib unik dan
router membacanya dengan `order by priority`. Menukar dua baris bisa membuat
"cara pakai miracle powder" dijawab deskripsi produk, bukan takarannya.

**Pola regex datang dari database.** Node menyusunnya kembali dengan
`new RegExp()`. Pola yang salah tulis bisa menggantung server (catastrophic
backtracking), jadi hak tulisnya dibatasi admin dan setiap perubahan harus
lolos `node knowledge-base/router.test.mjs` lebih dulu.

**Template jangan dibaca dari database di tiap pesan.** Satu perjalanan ke
Supabase per chat menambah latensi pada jalur yang sekarang berbiaya Rp 0 dan
nol jaringan. Rencananya: baca sekali, simpan di memori proses, segarkan lewat
langganan Realtime `templates` & `template_rules` yang sudah dinyalakan skema
ini.

### Yang tetap di berkas, bukan di database

`claude-core.md`, `products.json`, dan `template-jawaban.md` tetap berupa
berkas. Ketiganya ikut jadi *system prompt* yang di-cache Anthropic; memindahkan
isinya ke database tidak menghemat apa pun dan justru menambah satu titik gagal
sebelum setiap panggilan API.

---

## Data contoh untuk demo (opsional)

> Ditambahkan 4 September 2026.

Setelah skema dijalankan, tabel `conversations` **kosong** — wajar, tapi halaman
Chat jadi terlihat mati saat didemokan ke tim CS.

[`seed-demo.sql`](seed-demo.sql) mengisinya dengan 6 percakapan, 1 eskalasi, dan
3 flag koreksi — persis yang selama ini tampil di mode demo. SQL Editor → tempel
→ Run.

⚠️ **Ini data karangan.** Jangan dijalankan di database yang sudah berisi
percakapan pelanggan sungguhan, kecuali Anda memang ingin data contoh ikut
muncul di sana.

**Menghapusnya kembali:** blok `DELETE` ada di bagian paling bawah berkas yang
sama, tinggal dibuka tanda komentarnya. Semua baris contoh memakai UUID berpola
`c0000000-` / `e0000000-` / `f0000000-`, jadi penghapusannya tidak mungkin
menyentuh data nyata.

**Kalau `seed.ts` berubah**, bangkitkan ulang dengan `npm run seed-sql` di
folder `web/` — berkas SQL-nya dihasilkan dari sana, bukan diketik tangan,
supaya isi database dan isi mode demo tidak pernah berbeda.

Dua catatan tentang isinya:

- `reporter_id` dan `reviewed_by` pada `ai_flags` sengaja `NULL`. Keduanya
  foreign key ke `profiles`, dan profil demo tidak punya baris di `auth.users`.
  Nama pelapornya tetap terbaca lewat kolom teks `reporter_name`.
- `chat_count`, `product_query`, `order_status`, dan `order_courier` tidak ikut —
  keempatnya memang tidak punya kolom di `schema.sql`.
