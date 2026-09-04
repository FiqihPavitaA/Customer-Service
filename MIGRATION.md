# MIGRATION.md — Migrasi ke Next.js + Supabase + Vercel

> Versi: 1.0 | Dibuat: 08 Juli 2026
> Acuan perilaku AI: `claude.md`, `sop.md` — tidak berubah selama migrasi, hanya berpindah tempat baca.
> Acuan pengujian: `TEST-PLAN-SINKRONISASI.md` — dijalankan penuh setelah Fase 3 (Supabase aktif).

---

## 1. Target Arsitektur

```
[Supabase]  <──────────────►  [Next.js — Application Server]
 Database                        Backend: API Routes (Node.js)
                                  Frontend: React + TypeScript + Tailwind CSS
                                        │
                                        ▼
                                   [GitHub]  ──►  [Vercel]  ──►  AI Customer Service
                                Version control   Cloud Deploy      (Infarm.id)

Local Development: VS Code + Claude Code (sudah berjalan sekarang)
```

Satu aplikasi Next.js menggantikan dua bagian terpisah yang ada sekarang (halaman statis HTML/CSS/JS + `backend/` Express).

## 2. Pemetaan: Sekarang → Nanti

| Sekarang | Menjadi |
|---|---|
| `index.html`, `dashboard.html`, `beranda.html`, `pesanan.html`, `ai.html`, `broadcast.html`, `statistik.html`, `settings.html` | Route React di `app/(...)/page.tsx` |
| `dashboard.css`, `*.css` per halaman | Tailwind classes + `tailwind.config` (token warna dari `claude.md`) |
| `dashboard.js`, `pesanan.js`, `ai.js`, `broadcast.js`, `statistik.js`, `settings.js`, `rail.js` | Komponen React + hooks (`useState`, custom hooks) |
| `backend/server.js` (Express) | `app/api/*/route.ts` (Next.js API Routes) |
| `backend/knowledge.js` | Modul server (`lib/knowledge.ts`) — logika sama, load `claude.md` + `sop.md` + `products.json` + `faq-cs.md` |
| Data mock (`CONVERSATIONS`, `REVIEWS`, dll di tiap `*.js`) | Tabel Supabase (`conversations`, `escalations`, dll) |
| Login hardcode (`Infarm.sales` / `123Infarm`) | Supabase Auth |
| `localStorage` (pengaturan AI di Settings) | Tabel Supabase (1 sumber kebenaran untuk semua admin) |
| Badge unread dummy (`rail.js`) | Query realtime Supabase |

## 3. Prasyarat Sebelum Mulai

- [x] **Node.js terpasang** — `v24.16.0`, npm `11.13.0` (diverifikasi 31 Agu 2026)
- [x] Git sudah terpasang (`git version 2.54.0`)
- [x] Repo **GitHub** aktif: `github.com/infarmsales/Customer-Service` (branch `master`)
- [ ] Buat project **Supabase** (gratis) — catat `Project URL` + `anon key`
- [ ] Buat akun **Vercel**, hubungkan ke GitHub
- [x] API key **Anthropic** (`ANTHROPIC_API_KEY`) — sudah terpasang di `web/.env.local` dan terbukti dipakai pada Step 5 (31 Agu 2026). Belum dipasang di Vercel (menunggu Fase 5).

---

## 4. Tahapan Migrasi

### Fase 0 — Checkpoint Aman ✅ SELESAI (31 Agu 2026)
- [x] `git init` di root proyek → commit kondisi sekarang apa adanya (rollback point). Riwayat commit sudah ada sejak sebelum dokumen ini dibuat.
- [x] Push ke repo GitHub (`infarmsales/Customer-Service`).
- [x] Branch kerja migrasi dibuat: `migrasi-nextjs`; `master` tetap utuh sebagai fallback.
- [x] `.gitignore` root ditambahkan — `.env*`, `node_modules/`, `web/.next/`, `.vercel/` tidak akan ikut ter-commit.
- [x] **Jangan hapus file HTML/CSS/JS lama** sampai migrasi selesai — dipakai sebagai referensi visual & fallback yang tetap bisa dibuka manual.

### Fase 1 — Scaffold Next.js
```bash
npx create-next-app@latest web --typescript --tailwind --app
```
- [x] **Scaffold selesai (31 Agu 2026)** — Next.js `16.3.3`, React `19.2.8`, TypeScript, App Router, Turbopack, ESLint. Build produksi & dev server sudah diverifikasi hijau.
- [x] **Port dev dikunci ke 3100** (`next dev -p 3100`). Alasan: port 3000 di mesin ini sudah dipakai proyek Next.js lain (website infarm.id), dan 3000 juga port default `backend/server.js`. Dengan 3100, app lama dan app baru bisa hidup berdampingan untuk perbandingan sisi-bersisi di Fase 6.
- [x] Struktur folder: `web/app/`, `web/lib/`, `web/components/` (Step 3). `web/app/api/` dibuat di Step 4 bersama endpoint chat.
- [x] Palet hijau dari `claude.md` (`#16a34a`, hover `#128a3e`, dark `#15803d`, soft `#f4fbf6`, mint `#ecfdf3`, page `#eef7f0`) + warna teks/garis + warna marketplace, semuanya di blok `@theme` pada `app/globals.css` (Step 3). Breakpoint baku claude.md (480/760/980/1180px) ikut didaftarkan sebagai varian `max-mini`/`max-mobile`/`max-tablet`/`max-wide`.
  > ⚠️ **Koreksi rencana:** `create-next-app` sekarang memasang **Tailwind v4**, yang **tidak lagi memakai `tailwind.config.ts`**. Palet didefinisikan sebagai CSS custom properties di blok `@theme` dalam `app/globals.css`. Hasil akhirnya sama (`bg-green`, `text-green-dark`, dst.), hanya lokasinya berbeda dari yang tertulis di rencana awal.
- [x] Komponen layout bersama `<TopBar>`, `<Rail>`, `<Toast>` dipakai semua halaman via `app/(dashboard)/layout.tsx` (Step 3). Rail otomatis menandai menu aktif dari URL; `<Toast>` memakai React context (`useToast()`) menggantikan helper `toast()` global di `dashboard.js`.
- [x] Tujuh route placeholder dibuat supaya rail sudah bisa diklik dan tiap halaman jujur menyebut step migrasinya:

  | Route baru | Halaman lama | Dimigrasi pada |
  |---|---|---|
  | `/` | `index.html` | Step 7 (Supabase Auth) |
  | `/beranda` | `beranda.html` | Step 10 |
  | `/chat` | `dashboard.html` | Step 14 |
  | `/pesanan` | `pesanan.html` | Step 12 |
  | `/ai` | `ai.html` | Step 13 |
  | `/broadcast` | `broadcast.html` | Step 11 |
  | `/statistik` | `statistik.html` | Step 9 |
  | `/settings` | `settings.html` | Step 8 |

### Fase 2 — Pindahkan AI Engine Lebih Dulu (paling kritikal, dikerjakan sedini mungkin)
- [x] `app/api/chat/route.ts` + `lib/knowledge.ts` + `lib/claude.ts` — port dari `backend/server.js` + `backend/knowledge.js` (Step 4):
  - Muat `claude.md` + `sop.md` + ringkasan `products.json` + `faq-cs.md` sebagai system prompt (80.373 karakter)
  - Panggil Claude API (`@anthropic-ai/sdk` `^0.122.0`)
  - Kembalikan `{ action, reply, model, usage }` — kontrak sama persis dengan versi Express
- [x] `app/api/health/route.ts` ikut diport: memastikan KB terbaca & API key terpasang tanpa memanggil (dan membayar) Claude API.
- [x] Berkas KB disalin ke `web/content/` dan didaftarkan di `outputFileTracingIncludes` (`next.config.ts`). **Wajib**: tanpa itu build Vercel tetap lolos tetapi `/api/chat` gagal membaca KB di produksi.
- [x] **Tambahan Step 13:** `template jawaban.md` ikut dimuat ke system prompt (disalin sebagai `web/content/template-jawaban.md`). Berisi aturan konsultasi tanaman, aturan membaca foto, dan contoh balasan per ACTION. Menambah ~2.200 karakter; system prompt kini 82.599 karakter.
- [x] **Perubahan perilaku yang disengaja:** `sop.md` kini ikut dimuat ke system prompt. `backend/knowledge.js` lama tidak pernah memuatnya, padahal MIGRATION.md §4 Fase 2 mensyaratkannya. Aturan di dalam `sop.md` sendiri tidak diubah sama sekali (§5 poin 6).
- [x] **Tambahan hemat biaya:** system prompt ditandai `cache_control: ephemeral` (prompt caching). Isinya tidak berubah antar permintaan, jadi prefix yang sama tidak dibayar penuh berulang kali. Pantau lewat `usage.cache_read_input_tokens` di Step 5.
- [x] **Uji endpoint berdiri sendiri — SELESAI (Step 5, 31 Agu 2026).** Empat pesan, satu per klasifikasi; **keempat ACTION keluar sesuai harapan**. Waktu balas 3,9–8,9 detik.

  | # | Pesan uji | ACTION | Token keluar | Biaya |
  |---|---|---|---|---|
  | 1 | Dosis POC Buah buat tomat | AUTO_REPLY | 108 | Rp 2.090 *(menulis cache)* |
  | 2 | Daun cabai menguning | ASK_INFORMATION | 124 | Rp 197 |
  | 3 | Paket 7 hari, mau refund | HANDOVER_TO_CS | 337 | Rp 250 |
  | 4 | Resi 240620 sudah update? | CHECK_ORDER_SYSTEM | 169 | Rp 208 |

  - **System prompt = 33.321 token** (82.599 karakter). Prompt caching terbukti bekerja: permintaan 2–4 membacanya dari cache, biaya turun ±90% dibanding permintaan pertama.
  - **⚠️ Temuan penting — TTL cache 5 menit.** Diskon 90% itu hanya berlaku bila ada permintaan lain dalam 5 menit terakhir. Pada trafik jarang (mis. 1.000 chat/bulan ≈ 1 chat tiap 43 menit), **mayoritas chat justru membayar tarif tulis-cache Rp 2.090**, bukan Rp 218. Proyeksi biaya karena itu bisa berbeda hampir 10×:
    - trafik padat (jarak antar chat < 5 menit) → ±Rp 218/chat
    - trafik jarang (jarak > 5 menit) → ±Rp 2.090/chat
  - Kesimpulan: pengungkit terbesar bukan caching, melainkan **memperkecil apa yang dikirim**. Susunan system prompt: `faq-cs.md` 46%, `claude.md` 25%, ringkasan produk 24%, sisanya SOP + template.
  - Sudah diuji tanpa key (Step 4): `/api/health` melaporkan 4 berkas KB terbaca; `/api/chat` membalas 503 informatif tanpa key, 400 untuk body cacat, 405 untuk metode salah.
- [x] `ANTHROPIC_API_KEY` → `web/.env.local` (lokal, contoh ada di `web/.env.example`) — terpasang & terpakai di Step 5. Tidak pernah ditaruh di kode/commit.
- [ ] `ANTHROPIC_API_KEY` → **Vercel Project Settings → Environment Variables** (produksi) — dikerjakan bersama Fase 5.

### Fase 3 — Supabase (Database & Auth)
- [x] **Skema ditulis (Step 6a)** di `supabase/schema.sql` — idempoten, siap ditempel ke SQL Editor. Panduan langkah demi langkah: `supabase/README.md`.
  - `conversations` — sesuai `claude.md`, **plus 7 kolom** yang memang ditampilkan `dashboard.html` lama (`customer_name`, `shop_name`, `unread`, `tracking_no`, `ai_suggestion`, `handover_detail`, `last_message_at`). Tanpa kolom ini, Step 14 butuh migrasi skema kedua.
  - `escalations` — persis `claude.md`, tanpa tambahan.
  - `settings` — satu baris, menggantikan `localStorage` di `settings.js`.
  - `ai_flags` — menggantikan `localStorage` di `flag-store.js` (Flag Koreksi). Tidak tercantum di rencana awal, tetapi masalahnya sama persis: data terpisah per browser.
  - `profiles` — nama & peran (`cs`/`admin`), terisi otomatis lewat trigger saat pengguna Auth dibuat. Wajib ada karena `auth.users` tidak boleh diubah langsung.
  - **RLS aktif di kelima tabel** + 10 kebijakan akses. Tanpa ini, `anon key` yang dipakai browser bisa membaca dan menulis seluruh isi tabel.
  - **Koreksi terhadap `claude.md`:** komentar SQL di sana menulis nilai `action` sebagai `ASK_INFO | HANDOVER | CHECK_ORDER`, padahal yang benar-benar dikirim `/api/chat` adalah `ASK_INFORMATION | HANDOVER_TO_CS | CHECK_ORDER_SYSTEM`. Skema memakai nilai yang nyata.
- [x] **Supabase Realtime** dinyalakan untuk `conversations`, `escalations`, `settings`, dan `ai_flags` (dasar sinkronisasi multi-admin).
- [ ] **Menunggu pemilik proyek:** buat project Supabase, jalankan `schema.sql`, buat admin pertama, lalu salin URL + anon key ke `web/.env.local`. Skema di atas belum pernah dijalankan pada database sungguhan.
- [ ] Ganti login hardcode → **Supabase Auth** (email/password untuk tiap admin).
- [ ] Pindahkan pengaturan AI (Settings) dari `localStorage` → tabel `settings` (1 baris, dibaca semua admin).

> Setelah fase ini selesai, **`TEST-PLAN-SINKRONISASI.md` baru bisa dijalankan secara nyata** (sebelumnya terhalang karena data masih mock per-browser).

### Fase 4 — Migrasi Halaman (satu per satu, urutan dari risiko rendah → tinggi)
1. **Statistik** — banyak tampilan (chart), sedikit state → pemanasan
2. **Beranda** — mirip, banyak kartu statis
3. **Settings** — form + toggle, state sederhana
4. **Broadcast** — form + tabel per marketplace
5. **Pesanan** — 3 sub-tab + aksi massal (checklist, approve/reject)
6. **AI Chatbot** — panel uji coba yang sudah manggil `/api/chat` — ✅ **SELESAI (Step 13, dikerjakan lebih awal)**
7. **Dashboard (Chat)** — paling kompleks: realtime, pencarian massal, modal integrasi toko → dikerjakan **terakhir**

Setiap halaman dianggap selesai migrasi bila:
- [ ] Tampilan visual setara dengan versi HTML lama
- [ ] Semua interaksi (tombol, filter, modal) berfungsi
- [ ] Data berasal dari Supabase/API, bukan array mock

### Fase 5 — Integrasi GitHub → Vercel
- [ ] Push branch migrasi ke GitHub.
- [ ] Import project di Vercel, hubungkan ke repo.
- [ ] Set semua environment variables di Vercel (Anthropic key, Supabase URL/key).
- [ ] Tiap `git push` ke `main` → auto-deploy preview/production.

### Fase 6 — Uji & Cutover
- [ ] Jalankan penuh **`TEST-PLAN-SINKRONISASI.md`** dengan 3 admin nyata di Supabase Realtime.
- [ ] Bandingkan sisi-bersisi: halaman lama (HTML) vs halaman baru (Next.js) untuk tiap sub-tab.
- [ ] Setelah semua kasus **Kritikal** pada test plan lulus → arahkan domain produksi ke Vercel.
- [ ] Arsipkan (jangan hapus) file HTML/CSS/JS lama ke folder `legacy/` sebagai referensi historis.

---

## 5. Prinsip Keamanan Migrasi

1. **Tidak big-bang** — migrasi per halaman, app lama tetap bisa dibuka sampai penggantinya lulus uji.
2. **AI Engine dipindah paling awal** dan diuji terpisah dari UI — bagian paling berisiko diberi waktu paling banyak.
3. **Supabase disiapkan sebelum migrasi halaman** — supaya halaman React langsung pakai data nyata, tidak dua kali kerja (mock → real).
4. **Setiap fase = commit git terpisah** — mudah rollback bila ada regresi.
5. **Rahasia (API key, Supabase key) tidak pernah masuk kode/commit** — selalu lewat environment variables.
6. **Aturan `claude.md` & `sop.md` tidak diubah** selama migrasi — hanya berpindah cara dibaca (dari `fs.readFileSync` di Express, menjadi hal yang sama di API Route Next.js).

## 6. Estimasi Waktu (kerja santai, 1 orang)

| Fase | Estimasi |
|---|---|
| 0 — Checkpoint | 0.5 hari |
| 1 — Scaffold Next.js | 1 hari |
| 2 — AI Engine | 1 hari |
| 3 — Supabase & Auth | 1–2 hari |
| 4 — Migrasi 8 halaman | 7–10 hari |
| 5 — GitHub → Vercel | 0.5 hari |
| 6 — Uji & cutover | 1–2 hari |
| **Total** | **~2–3 minggu** |

## 7. Status Saat Ini

_Terakhir diperbarui: 4 September 2026 (setelah Step 6c + Step 7). Rekap per-step ada di tabel di bawah._

- [x] Node.js terinstall di mesin pengembangan — `v24.16.0`
- [x] Repo GitHub dibuat — `infarmsales/Customer-Service`
- [x] Branch migrasi dibuat — `migrasi-nextjs`
- [x] `.gitignore` root melindungi rahasia & artefak build
- [ ] Project Supabase dibuat
- [ ] Project Vercel dihubungkan
- [x] **Fase 0 selesai**
- [x] **Fase 1 SELESAI** — scaffold (Step 2) + token warna & kerangka layout (Step 3).
- [x] **Fase 2 hampir selesai:** AI engine diport ke `/api/chat` + `/api/health` (Step 4) dan sudah diuji dengan API key sungguhan (Step 5). Sisa: pasang `ANTHROPIC_API_KEY` di Vercel (Fase 5).
- [x] **Fase 3 sebagian:** skema ditulis (Step 6a) + lapisan data mode demo yang sudah berbentuk skema itu (Step 6b-demo); belum dijalankan di database nyata (Step 6b).
- [x] **Fase 4 SELESAI (mode demo):** ketujuh halaman console sudah dimigrasi ke React; datanya masih seed di memori.

### 📋 Rekap Step 1–15 (diverifikasi 2 Sep 2026)

Daftar tunggal semua step bernomor beserta buktinya. Nomor step
mengacu pada penamaan commit; step yang belum dikerjakan memakai
nomor yang sudah dijanjikan di tabel route (§4 Fase 1).

| Step | Isi | Fase | Bukti / commit | Status |
|---|---|---|---|---|
| 1 | Checkpoint aman: `git init`, push GitHub, branch `migrasi-nextjs`, `.gitignore` root | 0 | `102bbfc` | ✅ Selesai |
| 2 | Scaffold Next.js di `web/` — Next 16.3.3, React 19, TS, Tailwind v4, port dev 3100 | 1 | `e815f7e` | ✅ Selesai |
| 3 | Token warna hijau di `@theme` + layout bersama (`TopBar`/`Rail`/`Toast`) + 7 route placeholder | 1 | `ac3e599` | ✅ Selesai |
| 4 | Port AI engine: `app/api/chat/route.ts`, `/api/health`, `lib/knowledge.ts`, `lib/claude.ts`, KB → `web/content/` | 2 | `ed0ae7e`, `12aaeba` | ✅ Selesai |
| 5 | Uji AI engine sungguhan: 4 pesan → 4 ACTION benar, ukur token & biaya, temuan TTL cache 5 menit | 2 | `edf4989` | ✅ Selesai |
| 6a | **Tulis** skema `supabase/schema.sql` (5 tabel + RLS + Realtime) + `supabase/README.md` | 3 | `4a07318` | ✅ Selesai |
| 6b-demo | Lapisan data `web/lib/db/` — tipe TS dari `schema.sql` + seed dari mock lama + satu titik tukar ke Supabase | 3 | `lib/db/` | ✅ Selesai |
| 6b | **Jalankan** skema di project Supabase nyata + isi URL & anon key di `web/.env.local` | 3 | — | ⛔ Ditunda — menunggu pemilik proyek |
| 6c | **Tulis** skema KB `supabase/schema-kb.sql` (5 tabel template + log router) | 3 | `schema-kb.sql` | ✅ Selesai |
| 7 | Login Supabase Auth + lapisan data write-through ke Supabase | 3 | `lib/auth.tsx`, `lib/supabase/client.ts`, `lib/db/store.ts` | ✅ Kode selesai — menyala sendiri saat kredensial diisi |
| 8 | Halaman Settings; pengaturan AI pindah dari `localStorage` → store berbentuk tabel `settings` | 3 & 4 | `components/settings/` | ✅ Selesai (mode demo) |
| 9 | Migrasi halaman Statistik | 4 | `components/statistik/` | ✅ Selesai (mode demo) |
| 10 | Migrasi halaman Beranda | 4 | `components/beranda/` | ✅ Selesai (mode demo) |
| 11 | Migrasi halaman Broadcast | 4 | `components/broadcast/` | ✅ Selesai (mode demo) |
| 12 | Migrasi halaman Pesanan (+ Quick Chat) | 4 | `components/pesanan/` | ✅ Selesai (mode demo) |
| 13 | Halaman AI Chatbot `/ai` + pengukur token & biaya — **dikerjakan lebih awal** | 4 | `cfc98f2` | ✅ Selesai |
| 14 | Migrasi halaman Chat/Dashboard (paling kompleks, dikerjakan terakhir) | 4 | `components/chat/` | ✅ Selesai (mode demo) |
| 15 | Lapisan template sebelum AI (`lib/templates.ts`, 12 aturan, uji 21/21) | Tambahan | `abd8d37` | ✅ Selesai |
| 16 | Sub-tab Flag Koreksi di `/ai` — port `ai-flag.js` + `flag.css` | 4 | `components/ai/FlagKoreksi.tsx` | ✅ Selesai (mode demo) |

**Ringkasan:** 17 step selesai (1, 2, 3, 4, 5, 6a, 6b-demo, 6c, 7, 8, 9,
10, 11, 12, 13, 15, 16) — tinggal 6b, satu-satunya yang tidak bisa
dikerjakan dari sisi kode karena butuh project Supabase nyata milik
pemilik proyek. Seluruh halaman console sudah jadi; tidak ada lagi
placeholder maupun sub-tab yang belum dimigrasi.

> Step 7 ditulis supaya **tidak menunggu** Step 6b. Kodenya sudah ada dan
> teruji di kedua cabang; yang menentukan mana yang dipakai adalah ada
> tidaknya kredensial di `web/.env.local`, bukan konstanta di kode.

> "Selesai (mode demo)" berarti tampilan & interaksi halaman sudah
> setara versi HTML lama dan datanya sudah berbentuk baris
> `schema.sql`, tetapi masih dari seed di memori. Yang tersisa untuk
> halaman-halaman itu hanya menukar sumber data di `lib/db/index.ts`.

**Belum bernomor step** (dicatat di §4 sebagai fase, bukan step):
Fase 5 (GitHub → Vercel) dan Fase 6 (uji `TEST-PLAN-SINKRONISASI.md`
+ cutover + arsip `legacy/`) — keduanya belum dikerjakan.

### 🔀 Perubahan urutan: demo dulu, Supabase belakangan (31 Agu 2026)

Atas permintaan pemilik proyek, urutan Fase 3–4 diubah. Prioritas
sekarang adalah **demo untuk mengukur efektivitas penggunaan token
Claude**, bukan kelengkapan halaman. Konsekuensinya:

- **Halaman AI Chatbot (`/ai`) dikerjakan lebih dulu** — satu-satunya
  halaman yang benar-benar memanggil Claude, jadi satu-satunya yang
  menghasilkan angka token. Data selain hasil AI tetap hardcode.
- **Supabase (Step 6b, 7, 8) ditunda.** Skema sudah siap di
  `supabase/schema.sql` dan tinggal dijalankan kapan pun.
- Halaman lain (Statistik, Beranda, Broadcast, Pesanan, Chat) belum
  dikerjakan; semuanya tidak memanggil AI sehingga tidak menambah
  angka apa pun ke pengukuran.

Rencana asli tidak dihapus — hanya diurutkan ulang.

### 🧱 Lapisan template sebelum AI (Step 15, 31 Agu 2026)

Ditambahkan atas usul pemilik proyek: pesan pelanggan dicocokkan
dulu ke balasan baku; hanya yang tidak tertangani diteruskan ke
Claude.

- **Sumber template:** `content/faq-cs.md` — ternyata bukan sekadar
  FAQ, melainkan pustaka **152 balasan baku** tim CS berkode
  `### [KODE]`. Berkas yang sama tetap ikut ke system prompt, jadi
  tidak ada penggandaan isi.
- **Modul:** `web/lib/templates.ts` — 12 aturan pencocokan, tiap
  aturan mencatat alasan mengapa aman ditangani tanpa AI.
- **Tiga pengaman**, karena salah balas lebih mahal daripada biaya AI:
  1. Kata yang menuntut penilaian (`kenapa`, `boleh nggak`, `cocok
     nggak`, `bagusnya`, `campur`, …) **selalu** dilempar ke AI.
  2. Pesan lebih dari 180 karakter dilempar ke AI — biasanya
     bercerita atau berlapis, bukan pertanyaan baku.
  3. Aturan `unless`: mis. "lacak" cocok, tetapi bila ada kata
     "belum sampai/refund/komplain" pencocokan dibatalkan.
- **Endpoint:** `/api/chat` menerima `useTemplates` (default true).
  Bila cocok → `{ source: "template", templateCode, usage: null }`
  tanpa memanggil Claude. Bidang lama (`action`, `reply`, `model`,
  `usage`) tetap ada supaya UI lama tidak rusak.
- **Halaman /ai** dapat saklar "Lapisan template" untuk
  membandingkan biaya menyala vs mati dalam satu demo, dan panel
  pengukur kini melaporkan berapa persen pertanyaan yang dicegat.

**Hasil uji.** Pencocok diuji terhadap 21 kasus — 14 seharusnya
dicegat, 7 seharusnya lolos ke AI — **21/21 benar**. Uji A/B lewat
HTTP dengan pertanyaan sama ("Cara pakai POC gimana ya kak?"):

| | Sumber | Waktu | Biaya |
|---|---|---|---|
| Lapisan template menyala | `[PAKAI POC]` | 0,1 detik | **Rp 0** |
| Lapisan template dimatikan | Claude | 5,9 detik | Rp 2.083 |

Isi jawabannya setara — keduanya menyebut dosis 2 pump per liter,
siram merata, seminggu sekali — karena template memang sumber yang
sama dengan yang dibaca AI.

### 🧩 Step 6b mode demo: semua halaman jadi, Supabase belakangan (2 Sep 2026)

Atas permintaan pemilik proyek: **demo dulu, koneksi database
setelah disetujui**. Step 6b aslinya berarti "jalankan `schema.sql`
di project Supabase"; yang dikerjakan di sini adalah versi
tanpa-koneksinya — bentuk datanya sudah mengikuti skema, isinya
masih dari mock halaman lama.

**Lapisan data baru — `web/lib/db/`**

| Berkas | Isi |
|---|---|
| `types.ts` | Tipe TS salinan persis tiap tabel `schema.sql`. Field yang dipakai UI lama tapi belum ada kolomnya dipisah ke tipe `*Extra` supaya kelihatan mana yang masih perlu kolom/API baru. |
| `seed.ts` | Isi awal, dipindahkan apa adanya dari `dashboard.js`, `pesanan.js`, `broadcast.js`, `settings.js`. |
| `store.ts` | "Database" di memori + hook React (`useConversations`, `useSettings`, `decideCancels`, dst). |
| `analytics.ts` | Angka agregat Statistik & Beranda — bukan tabel; nanti hasil `COUNT/GROUP BY`. |
| `index.ts` | **Satu titik tukar.** Berisi peta lengkap fungsi → panggilan Supabase yang akan menggantikannya. |

**Tujuh halaman console selesai** (Step 8–14 dikerjakan sekaligus):
Beranda, Chat, Pesanan, AI Chatbot, Broadcast, Statistik, Pengaturan.
Tidak ada lagi halaman placeholder — `components/PlaceholderPage.tsx`
dihapus.

**Yang sudah tidak lagi dummy**, karena kini membaca store yang sama:
- Badge 💬 di rail = jumlah `conversations.unread` sungguhan; membuka
  percakapan menurunkannya.
- Kartu "Membutuhkan balasan" & "Perlu Handover ke CS" di Beranda ikut
  menghitung `conversations` + `escalations` (ditandai label `live`).
- Pengaturan AI tidak lagi di `localStorage` per browser, melainkan
  satu baris berbentuk tabel `settings`.
- Pencarian topbar (5 lingkup + pencarian massal) benar-benar menyaring
  daftar percakapan; sebelumnya berhenti di kotaknya sendiri.

**Perubahan yang disengaja:**
- Isi pesan dirender sebagai teks (`whitespace-pre-line`), bukan
  `innerHTML` seperti `dashboard.js` — menutup jalur XSS dari isi chat
  pelanggan. Karena itu `messages` di seed memakai `\n`, bukan `<br>`.
- Waktu disimpan ISO 8601 (bentuk `timestamptz`), formatnya dihitung di
  `lib/format.ts`.
- Katalog 373 SKU dibaca lewat `/api/products` dari `content/products.json`
  — berkas yang sama dengan system prompt, tidak digandakan, dan tidak
  ikut membengkakkan bundel JavaScript.
- Kontrol yang belum punya kolom di `schema.sql` (gaya bahasa,
  notifikasi, keamanan) diberi label **"belum tersimpan"** supaya
  tidak terlihat seolah sudah tersimpan.
- Rail mobile diperbaiki: sebelumnya menyisip di antara topbar dan
  konten; sekarang benar-benar di bawah layar sesuai claude.md.

**Batasan mode demo — sengaja tidak disembunyikan.** Tiap halaman
memasang penanda "Mode demo — data contoh, belum tersambung Supabase".
Data hidup di memori satu tab: refresh mengembalikannya ke seed, dan
belum ada sinkronisasi antar admin (justru itu yang akan diuji
`TEST-PLAN-SINKRONISASI.md` setelah Supabase menyala).

**Hasil uji (2 Sep 2026).** `tsc --noEmit` bersih, `eslint` bersih,
`next build` hijau (12 route). Delapan pemeriksaan interaksi lewat
Playwright — semuanya lulus, tanpa error JavaScript di konsol:

| # | Yang diuji | Hasil |
|---|---|---|
| 1 | Membuka percakapan menurunkan badge unread (2 → 1) | ✅ |
| 2 | Filter "Perlu CS" hanya menyisakan HANDOVER_TO_CS | ✅ |
| 3 | Pencarian topbar lingkup Nomor Resi menyaring daftar | ✅ |
| 4 | Pesan terkirim muncul di aliran chat | ✅ |
| 5 | Setujui massal mengurangi chip "Menunggu Diproses" (6 → 5) | ✅ |
| 6 | Quick Chat terbuka dengan pesan awal dari ulasan | ✅ |
| 7 | Model Claude tersimpan & tetap ada saat pindah panel | ✅ |
| 8 | Tugas broadcast baru muncul di tabel | ✅ |

Tangkapan layar desktop (1440×900) dan mobile (390×844) diperiksa untuk
Beranda, Statistik, Pengaturan, Broadcast, Pesanan, dan Chat.

**Sisa pekerjaan untuk menyambungkan Supabase** (Step 6b + 7): jalankan
`schema.sql`, isi dua baris env, `npm i @supabase/supabase-js`, lalu
tulis `lib/db/supabase.ts` dengan nama fungsi yang sama dan ganti satu
baris re-export di `lib/db/index.ts`. Tidak ada komponen halaman yang
perlu diubah.

### 🚩 Step 16: sub-tab Flag Koreksi (4 Sep 2026)

Bagian terakhir yang masih berupa placeholder. Dikerjakan lebih dulu
karena Supabase sedang mengalami gangguan (*Project Lifecycle Actions*),
sehingga Step 6b tidak bisa dijalankan hari itu — sedangkan halaman ini
sepenuhnya bisa dibangun dan diuji di mode demo.

#### Tetap sub-tab, bukan halaman sendiri

Sempat terpikir menjadikannya route `/flag`. Tidak jadi: rail navigasi
hanya punya delapan ikon (🏠💬📦🤖📣📈⚙️👤) sesuai `claude.md`, dan tidak
ada satu pun untuk Flag Koreksi. Route terpisah tanpa ikon rail berarti
halaman yang tidak bisa dijangkau siapa pun kecuali dengan mengetik URL.
Versi lama pun menaruhnya sebagai sub-tab di `ai.html`.

#### Yang diperbaiki dari versi lama

`flag-store.js` menyimpan seluruh flag di `localStorage`. Akibatnya daftar
flag tiap admin berbeda, dan **hasil review satu orang tidak pernah
terlihat oleh yang lain** — laporan yang sudah diputuskan tetap tampak
"menunggu" di layar rekannya. Sekarang datanya lewat `lib/db/store.ts`,
yang begitu Supabase menyala menulis ke `ai_flags` dan menyegarkan lewat
Realtime.

Peran juga tidak lagi datang dari tombol `localStorage`, melainkan dari
`profiles.role` — kolom yang sama yang dipakai RLS `is_admin()`. Tombol
penukar peran tetap ada **hanya di mode demo**, supaya perbedaan tampilan
Admin vs CS masih bisa diperagakan tanpa membuat akun kedua.

#### Dua lapis izin, bukan satu

Tombol Setujui/Tolak disembunyikan untuk peran `cs`, DAN kebijakan RLS
`ai_flags_review` menolaknya di sisi database. Menyembunyikan tombol saja
bukan pengaman — siapa pun bisa memanggil fungsinya lewat devtools.

Penyaringan "CS hanya melihat laporannya sendiri" sebaliknya memang
**hanya** kenyamanan tampilan: `ai_flags_read` sengaja mengizinkan semua
CS membaca, supaya laporan yang sama tidak dikirim dua kali oleh orang
yang berbeda.

#### Cara mengujinya tanpa peramban

Sub-tab dan tampilan detail keduanya dikendalikan state klien, jadi tidak
muncul di HTML hasil render. Untuk membuktikannya benar-benar tampil,
nilai awal state diubah sementara (`tab` ke `"flag"`, lalu `dibuka` ke
flag pertama), aplikasi dibangun dan diambil dengan `curl`, kemudian
kedua perubahan itu dikembalikan.

Hasilnya: daftar memuat 3 baris dengan hitungan penyaring benar
(Semua 3 / Menunggu 1 / Disetujui 1 / Ditolak 1), badge sub-tab
menunjukkan 1, dan tampilan detail memuat seluruh bagian termasuk tombol
keputusan admin.

**Yang belum diuji:** klik Setujui/Tolak dan perpindahan daftar ↔ detail —
keduanya butuh interaksi peramban sungguhan.

Satu contoh berstatus `ditolak` ditambahkan ke seed supaya cabang
penolakan (beserta alasannya) ikut terlihat saat demo, bukan hanya jalur
setujui.
### 🔐 Step 7: login + tukar data ke Supabase (4 Sep 2026)

Dikerjakan atas permintaan pemilik proyek setelah skema KB selesai
ditulis. Yang penting dari step ini bukan formulir loginnya, melainkan
**cara modenya ditentukan**.

#### Mode tidak lagi diketik tangan

`DB_MODE` di `web/lib/db/index.ts` dulu berupa konstanta `"memory"` yang
harus diubah manual. Sekarang nilainya diturunkan dari ada tidaknya
`NEXT_PUBLIC_SUPABASE_URL` & `_ANON_KEY`.

Alasannya: dengan konstanta manual, cepat atau lambat akan muncul keadaan
di mana konstantanya berkata `"supabase"` sementara `.env.local` kosong —
dan gejalanya adalah **halaman kosong tanpa pesan galat**, yang sulit
ditebak sebabnya. Dengan cara sekarang keduanya tidak mungkin berbeda.

Konsekuensinya: menyalakan Supabase = mengisi dua baris di `.env.local`
lalu jalankan ulang server. Tidak ada berkas kode yang perlu disentuh.

#### Write-through, bukan modul tandingan

Rencana lama (tertulis di `lib/db/index.ts` versi Step 6b) adalah membuat
`lib/db/supabase.ts` berisi fungsi bernama sama, lalu menukar baris
re-export. Rencana itu **ditinggalkan**: dua implementasi dari API yang
sama pasti menyimpang diam-diam, dan setiap perbaikan harus ditulis dua
kali. Sekarang `store.ts` tetap satu-satunya jalur, dengan satu
percabangan di dalamnya — membaca saat login, menulis setiap perubahan,
dan menyegarkan lewat Realtime.

#### Yang perlu diingat soal keamanan

`AuthGuard` mengalihkan pengguna yang belum login ke `/`. **Itu
kenyamanan, bukan pengaman** — siapa pun bisa mematikannya lewat
devtools. Yang benar-benar menjaga data adalah RLS: setiap kebijakan
berbunyi `to authenticated`, jadi tanpa sesi yang sah query balik kosong
walau halamannya dibuka paksa.

Karena itu pula sesi disimpan di `localStorage`, bukan cookie: route
handler di server tidak perlu melihatnya. `/api/chat` memakai kunci
Anthropic milik server dan memang tidak perlu tahu siapa yang login.

#### Yang TETAP dari seed walau Supabase menyala

`reviews`, `refunds`, `cancels`, dan `broadcast`. Keempatnya bukan tabel
kita — sumbernya API pesanan & broadcast marketplace. Menyalinnya ke
Supabase berarti menyimpan angka milik Shopee/TikTok yang bisa basi kapan
saja tanpa kita tahu.

#### Bagaimana ini diuji tanpa project Supabase

Kedua cabang dijalankan sungguhan, bukan hanya dikompilasi:

| Cabang | Cara | Hasil |
|---|---|---|
| Demo (env kosong) | `next build` + `next start` | `/` menampilkan "Buka Console", `/beranda` memuat penanda mode demo |
| Supabase (env palsu) | build ulang dengan URL & key karangan | `/` menampilkan formulir email + kata sandi, `/beranda` berhenti di "Memeriksa sesi…" |

Cabang kedua memakai kredensial palsu, jadi yang terbukti adalah
**percabangan dan tampilannya**, bukan query-nya. Query sungguhan baru
bisa diuji setelah Step 6b dijalankan.

Selain itu: `tsc --noEmit` bersih, `eslint` bersih, `router.test.mjs`
48/48, `sync-kb --check` 10 berkas sinkron. Tidak ada panggilan Claude
API sepanjang step ini.
### ⏸ Yang tertahan menunggu pemilik proyek
1. ~~**Step 5 — uji AI engine sungguhan**~~ ✅ selesai 31 Agu 2026.
2. **Step 6b — jalankan skema:** butuh project Supabase + jalankan `supabase/schema.sql`, lalu URL & anon key di `web/.env.local`. **DITUNDA** atas permintaan pemilik proyek — demo dijalankan lebih dulu dengan lapisan data mode demo (lihat bagian Step 6b di atas).

Sisa penghalang tinggal nomor 2. Pengukuran token sudah bisa dilakukan sekarang: halaman `/ai` menampilkan angka nyata sejak Step 13, dan Step 15 menambahkan pembanding biaya template vs AI.

### Keputusan arsitektur yang disepakati
1. App Next.js baru tinggal di subfolder `web/` pada repo yang sama (bukan repo terpisah); Vercel Root Directory = `web`.
2. Semua pekerjaan migrasi di branch `migrasi-nextjs`; `master` tetap bisa dibuka manual sebagai fallback sampai cutover.
3. `backend/` Express dibiarkan apa adanya sampai halaman AI Chatbot lulus uji, lalu diarsipkan ke `legacy/` bersama file HTML lama.

---

*Dokumen ini adalah panduan migrasi arsitektur. Perbarui checklist di atas seiring progres; jangan hapus fase yang sudah selesai — beri tanda centang agar riwayat migrasi tetap terlihat.*
