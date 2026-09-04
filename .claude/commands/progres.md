---
description: Catat progres kerja hari ini ke database Notion "Progres web cs"
argument-hint: [deskripsi opsional — kosongkan untuk mencatat seluruh kerja sesi ini]
allowed-tools: Bash(git log:*), Bash(git status:*), mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-query-data-sources, mcp__claude_ai_Notion__notion-fetch
---

Catat progres ke database Notion **Progres web cs**.

## Tujuan penulisan

Data source (dipakai langsung, tidak perlu search lagi):

```
3d1357aa-ede5-8011-b284-000b7752bedd
```

Kalau id itu ditolak, barulah cari database bernama "Progres web cs"
(letaknya `WEB CS / Progres`). Bila muncul lebih dari satu yang mirip,
**berhenti dan tanya** — jangan menebak.

## Skema sebenarnya — perhatikan, beda dari dugaan

| Properti | Tipe asli | Cara mengisi |
|---|---|---|
| `Tanggal` | **title** (teks, bukan date) | `"YYYY-MM-DD"` tanggal hari ini |
| `Aktivitas` | text | satu kalimat, judul singkat |
| `Kategori` | **multi-select** | array berisi **satu** nilai |
| `Status` | status | `Not started` / `In progress` / `Done` |
| `Notes` | text | 1–3 kalimat |

Pilihan `Kategori`: Backend, API, Deployment, Frontend, Arsitektur,
Security, Testing, Analytic. Pilih **satu yang paling dominan**, bukan
semua yang tersentuh.

Pemetaan status: Selesai → `Done`, Sedang Dikerjakan → `In progress`.
**Belum ada opsi untuk "Terhambat"** — kalau ada pekerjaan yang
benar-benar terhambat, pakai `In progress` lalu tulis blocker-nya di
Notes dan sebutkan ke pengguna bahwa opsi itu belum ada.

## Argumen

`$ARGUMENTS` — bila diisi, catat **hanya** hal itu. Bila kosong, telusuri
sendiri kerja sesi ini: commit hari ini (`git log` dengan `--date` hari
ini), berkas yang berubah, dan pekerjaan yang belum ter-commit.

## Aturan isi

1. **Satu baris = satu unit kerja yang berarti.** Setup project, komponen
   baru, migrasi halaman, integrasi API, perbaikan bug, setup database,
   deploy. Bukan tiap baris kode.
2. **Jangan catat** perbaikan typo satu baris atau eksperimen yang
   dibatalkan.
3. **Jangan buat baris ganda.** Sebelum menulis, query data source untuk
   tanggal hari ini dan periksa apakah pekerjaan itu sudah tercatat. Bila
   sudah ada tetapi statusnya berubah, **perbarui baris itu**, jangan
   tambah yang baru.
4. Beberapa task kecil yang saling berkaitan boleh digabung jadi satu
   baris, asal Aktivitas dan Notes tetap mewakili semuanya.

## Isi Notes yang berguna

Notes bukan pengulangan judul. Sebutkan: berkas/komponen yang berubah,
nomor commit bila ada, dan — yang paling penting — **hal yang perlu
diketahui pengguna**: keputusan desain beserta alasannya, trade-off yang
diambil, atau yang masih menunggu keputusan mereka.

Tulis jujur soal batas pengujian. Kalau sesuatu belum pernah dijalankan
sungguhan, katakan begitu di Notes, jangan tulis seolah sudah terbukti.

## Setelah menulis

Tampilkan tabel ringkas berisi baris yang baru ditambahkan atau diperbarui
(Tanggal, Aktivitas, Kategori, Status). Sebutkan juga bila ada yang
sengaja **tidak** dicatat karena dianggap terlalu kecil.
