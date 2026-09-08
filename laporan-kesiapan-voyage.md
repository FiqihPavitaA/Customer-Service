# Laporan Kesiapan Data untuk Semantic Search (Voyage)

> Audit dijalankan 8 September 2026 terhadap keadaan repo pada commit `01b627a`.
> Alat: `node knowledge-base/audit-voyage.mjs` — biaya Rp 0, tanpa jaringan.
> Tidak ada satu pun data yang diubah oleh audit ini.

---

## 1. Ringkasan eksekutif

**Data ini BELUM SIAP untuk semantic search, dan tes akurasi belum layak
dijalankan.** Menjalankannya sekarang akan menghasilkan angka buruk yang salah
menyalahkan model, padahal masalahnya ada di data.

Empat dari enam patokan lulus gagal. Yang paling menentukan: **0% template INTI
punya ≥ 3 contoh pertanyaan** (patokan: 90%). Seluruh katalog hanya punya 36
contoh untuk 154 template, dan 35 dari 36 itu bergaya dokumen, bukan gaya chat
pelanggan.

Tiga hal yang harus dibereskan lebih dulu, berurutan:

1. **`[DITERUSKAN CS]` hilang dari tabel Supabase** — pelanggan yang minta refund
   akan menerima pesan KOSONG begitu sumber tabel dinyalakan. Sudah diverifikasi.
2. **Perbaiki kontradiksi jam kirim** antara `[INSTANT]`, `[KIRIM INSTANT]`, dan
   `[KIRIM REGULER]` — satu di antaranya bahkan bertentangan dengan dirinya sendiri.
3. **Tim CS menulis 3 contoh pertanyaan** untuk tiap template INTI, dengan gaya
   chat asli. Ini pekerjaan terbesar sekaligus pengungkit akurasi terbesar.

---

## 2. Skor kesiapan

| Kriteria | Lulus | Total | Status |
|---|---|---|---|
| A. Struktur data | 4 | 6 | ⚠️ sebagian |
| B. Kualitas contoh | 0 | 154 | ❌ gagal |
| C. Kesesuaian contoh | 33 | 35 *(hanya yang punya contoh)* | ⚠️ sebagian |
| D. Kesehatan katalog | 2 | 5 | ❌ gagal |
| E. Pengaman kode | 3 | 7 | ❌ gagal |

### Patokan lulus

| Patokan | Kenyataan | Lulus? |
|---|---|---|
| Tidak ada pasangan INTI dengan kemiripan ≥ 0,80 | **4 pasangan** | ❌ |
| Tidak ada kode template duplikat | 0 duplikat | ✅ |
| ≥ 90% template INTI punya ≥ 3 contoh | **0%** (0 dari 105) | ❌ |
| ≥ 80% template INTI punya contoh bergaya chat | **16%** (17 dari 105) | ❌ |
| Kolom `keywords` & `contoh_pertanyaan` terpisah | terpisah, bahkan beda tabel | ✅ |
| Aturan sensitif jalan sebelum pencocokan apa pun | Gerbang 0 tanpa syarat | ✅ |

### Angka dasar

| | |
|---|---|
| Template di berkas `.md` | **154** |
| Template di `seed-templates.sql` | **152** ← tertinggal 2 |
| Aturan kata kunci (Gerbang 1) | 43 |
| Template tanpa kata kunci | 111 |
| Total contoh pertanyaan | **36** |
| Template yang punya ≥ 1 contoh | 35 |
| Template tanpa satu pun contoh | **119** |

---

## 3. Temuan kritis

Hal yang membuat sistem **salah menjawab pelanggan**.

### K1. `[DITERUSKAN CS]` tidak ada di Supabase — balasan Gerbang 0 jadi kosong

**Ini yang paling berbahaya di seluruh laporan, dan bisa aktif hari ini juga.**

`knowledge-base/router.js:349` menetapkan `KODE_HANDOVER = "DITERUSKAN CS"`.
Saat Gerbang 0 menahan pesan (refund, barang rusak, keracunan, minta manusia),
teks balasannya diambil dari pustaka:

```js
teks: getTemplateLibrary().get(KODE_HANDOVER) ?? ""
```

`[DITERUSKAN CS]` ada di `faq-interaksi.md:159`, tetapi **tidak ada di
`seed-templates.sql`** — berkas itu dibangkitkan 4 September, sedangkan
templatenya ditambahkan setelahnya. Begitu router membaca dari Supabase,
`.get()` mengembalikan `undefined` dan pelanggan menerima string kosong.

Sudah diverifikasi, bukan dugaan:

```
SUMBER BERKAS   : jenis=handover kode=[DITERUSKAN CS] panjang=121
SUMBER SUPABASE : jenis=handover kode=[DITERUSKAN CS] panjang=0
teks ke pelanggan: ""
```

Gerbang 0 tetap menahan pesannya dengan benar — yang hilang justru kalimat
penerimaan yang membuat pelanggan tahu kasusnya sedang ditangani. Pelanggan
marah yang menulis "saya mau refund barangnya rusak" akan melihat balasan
kosong.

`[KOMPLAIN DATA]` juga hilang dengan sebab yang sama, tetapi akibatnya lebih
ringan karena tidak dirujuk kode.

> **Catatan jujur:** cacat ini muncul karena perubahan yang saya buat hari ini
> (memindahkan sumber router ke tabel). Sebelum hari ini router hanya membaca
> berkas dan masalah ini tidak ada.

**Lokasi:** `knowledge-base/router.js:349`, `knowledge-base/faq-interaksi.md:159`,
`supabase/seed-templates.sql`
**Tindakan:** bangkitkan ulang seed (`npm run template-sql`) lalu jalankan, ATAU
tambahkan pengaman di router: bila `KODE_HANDOVER` tidak ada di sumber aktif,
ambil dari berkas `.md`.

---

### K2. `[KIRIM INSTANT]` bertentangan dengan dirinya sendiri

`faq-interaksi.md:126`:

> "Pesanan instant yang masuk **dibawah jam 13.00** WIB akan dikirim di hari yang
> sama, sementara pesanan **diatas jam 10.00** WIB akan dikirim di jam
> operasional toko berikutnya"

Pesanan pukul 11.00 memenuhi **kedua** syarat sekaligus. Angka 10.00 itu sisa
salin-tempel dari `[KIRIM REGULER]`, yang memang memakai 10.00 di kedua sisi.

**Lokasi:** `knowledge-base/faq-interaksi.md:126`
**Tindakan:** perbaiki angkanya — butuh keputusan operasional, lihat K3.

---

### K3. Tiga template menyebut batas jam kirim yang berbeda

| Template | Lokasi | Batas | Kemiripan |
|---|---|---|---|
| `[INSTANT]` | `faq-interaksi.md:44` | **15.00** | — |
| `[KIRIM INSTANT]` | `faq-interaksi.md:126` | **13.00** / 10.00 | 0,909 dengan `[INSTANT]` |
| `[KIRIM REGULER]` | `faq-interaksi.md:119` | 10.00 | 0,917 dengan `[KIRIM INSTANT]` |

`[INSTANT]` dan `[KIRIM INSTANT]` menjawab pertanyaan yang persis sama dengan
angka yang berbeda. Ini **bug bisnis**, bukan masalah teknis: apa pun yang
dilakukan model, sebagian pelanggan akan diberi tahu jam yang salah.

**Tindakan:** tentukan batas jam yang benar bersama tim operasional, lalu
gabungkan `[INSTANT]` + `[KIRIM INSTANT]` jadi satu template. Selama belum
diputuskan, **jangan** masukkan ketiganya ke pool routing.

---

### K4. Empat pasangan template dengan kemiripan ≥ 0,80

Diukur leksikal (TF-IDF trigram karakter + kosinus) sebagai perkiraan embedding.

| Skor | Pasangan | Lokasi | Sifat |
|---|---|---|---|
| 0,917 | `[KIRIM REGULER]` ↔ `[KIRIM INSTANT]` | `faq-interaksi.md:119` \| `:126` | beda angka saja |
| 0,909 | `[INSTANT]` ↔ `[KIRIM INSTANT]` | `faq-interaksi.md:44` \| `:126` | duplikat + kontradiksi |
| 0,907 | `[PAKAI FRUITEXPERT]` ↔ `[PERAWATAN CABAI]` | `faq-cara-pakai.md:38` \| `faq-umum.md:555` | `[PERAWATAN CABAI]` = superset |
| 0,860 | `[INSTANT]` ↔ `[KIRIM REGULER]` | `faq-interaksi.md:44` \| `:119` | kerangka kalimat sama |

Pasangan sedekat ini membuat Gerbang 2 **mustahil** memilih dengan benar —
skornya akan berdempetan dan margin selalu di bawah ambang.

---

### K5. `[PBM]` memuat dua maksud sekaligus (C2)

`faq-umum.md:330` berisi cara pakai POC **dan** cara pakai Miracle Powder,
disalin utuh dari `[MIRACLE POWDER]` (`faq-umum.md:72`, kemiripan 0,716).
Pelanggan yang bertanya "miracle powder dipakenya gmn" akan diperebutkan dua
template yang salah satunya juga membahas hal lain.

Ini sudah **terbukti** merusak pengukuran: `npm run tes-ambang` mencatat
`"miracle powder dipakenya gmn"` dimenangkan `[PRODUK MIRACLE]` dengan skor
0,621 — salah, dan lebih tinggi dari 11 dari 17 juara yang benar.

**Tindakan:** putuskan apakah `[PBM]` adalah template paket (kalau ya, keluarkan
dari pool routing dan tandai `BROADCAST`) atau harus dipecah.

---

## 4. Temuan penting

Menurunkan akurasi, tetapi tidak membuat jawaban salah terkirim.

### P1. Katalog `.md` sudah 2 langkah di depan Supabase

154 di berkas, 152 di tabel. Selisihnya `[KOMPLAIN DATA]` dan `[DITERUSKAN CS]`.
Tidak ada mekanisme yang memberi tahu bahwa keduanya menyimpang — tidak ada
pemeriksaan, tidak ada peringatan.

### P2. Hanya 16% template INTI punya contoh bergaya chat pelanggan

35 dari 36 contoh ditulis rapi: `"cara pakai neem oil gimana?"`,
`"dosis NPK berapa kak?"`. Pelanggan asli menulis `"nem oilnya dipakenya gmn kak"`.

Ini bukan teori — sudah terukur. Pada `npm run tes-ambang`, kalimat gaya asli
`"nem oilnya dipakenya gmn kak"` kalah ke `[PAKAI POC]` (0,438 vs 0,410) justru
karena `[PAKAI NEEM]` hanya punya satu contoh, dan contoh itu ditulis rapi.

`supabase/schema-vektor.sql` sendiri sudah memperingatkan hal ini di komentar
kolom `teks` — peringatannya benar, dan datanya melanggarnya.

### P3. Tidak ada contoh dengan ragam apa pun

Semua 35 template punya tepat 1 contoh (kecuali satu punya 2). Kriteria ragam
(B4) tidak bisa dinilai — dengan satu contoh tidak ada yang bisa beragam.

### P4. 8 contoh cacat bentuknya

| Template | Contoh | Masalah |
|---|---|---|
| `[BANTU]` | "Halo kak" | 2 kata, tanpa kata tanya |
| `[TQ]` | "makasih kak" | 2 kata, tanpa kata tanya |
| `[HARGA]` | "guano harganya berapa?" | 3 kata |
| `[BIVI]` | "dosis bivi berapa?" | 3 kata |
| `[CARA KALIBRASI ULANG TDS METER]` | 2 contoh | tanpa kata tanya |

Dua yang pertama sebenarnya wajar — `[BANTU]` dan `[TQ]` memang dipicu sapaan
telanjang, dan itu sudah ditangani Gerbang 1. Keduanya **tidak perlu** masuk
Gerbang 2 sama sekali.

### P5. `[EKSPEDISI]` dan `[EKSPEDISI 2]` nyaris kembar (0,780)

Isinya sama; `[EKSPEDISI 2]` menambah "sepertinya sedang ada kendala massal".
Itu **kondisi hari itu**, bukan jawaban tetap — kandidat `KONDISI_INTERNAL`.

### P6. `[KIRIM PUSAT]` termuat utuh di dalam `[TOKO INSTAN]` (0,728)

Keduanya menyebut "gudang sedang dalam perbaikan" — pernyataan yang akan basi
tanpa ada yang menghapusnya. Tidak ada `active_until` yang mengatur.

### P7. 13 template menyebut tanggal atau acara

`[NATAL]`, `[IDUL FITRI]`, `[1010]`, `[12.12]`, `[6.6]`, `[PROMO HARI INI]`
sudah lewat per 8 September 2026. Tidak satu pun punya `active_until` terisi —
kolomnya ada di skema, tetapi `seed-templates.sql` tidak mengisinya.

Sisanya (`[DOLOMIT]` "1-2", `[VITAMIN AKAR]` "1-2",
`[CARA KALIBRASI ULANG PH METER]` "4.01") adalah **positif palsu** dari pola
pencarian tanggal — itu dosis dan nilai kalibrasi, bukan tanggal.

---

## 5. Tabel per template

Klasifikasi di kolom "Kelas" adalah **tebakan mesin** berbasis pola kata, bukan
keputusan. Lihat bagian 7 untuk yang saya tahu keliru.

Kolom "Contoh" = jumlah contoh pertanyaan. Kolom "Kata kunci" = punya aturan
pemicu Gerbang 1 atau tidak.

| Kode | Kelas | Contoh | Gaya chat | Kata kunci | Masalah | Lokasi |
|---|---|---|---|---|---|---|
| `BANTU` | INTI | 1 | ya | ya | hanya 1 contoh | faq-interaksi.md:8 |
| `BANTU LAGI` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:11 |
| `AKHIRI` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:14 |
| `REQ BENIH` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:17 |
| `SENIN` | KONDISI_INTERNAL | 0 | — | ya | 0 contoh | faq-interaksi.md:20 |
| `KIRIM BESOK` | OUTBOUND | 0 | — | — | 0 contoh | faq-interaksi.md:23 |
| `MAKSIMALKAN` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:27 |
| `OVERLOAD` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-interaksi.md:30 |
| `KOMPLAIN` | SENSITIF | 0 | — | ya | 0 contoh | faq-interaksi.md:35 |
| `LIBUR` | KONDISI_INTERNAL | 0 | — | ya | 0 contoh | faq-interaksi.md:38 |
| `BONUS` | SENSITIF | 0 | — | — | 0 contoh | faq-interaksi.md:41 |
| `INSTANT` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:44 |
| `OFFLINE` | INTI | 0 | — | ya | 0 contoh | faq-interaksi.md:51 |
| `PENGEMBANGAN` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:55 |
| `LACAK` | INTI | 0 | — | ya | 0 contoh | faq-interaksi.md:59 |
| `EKSPEDISI` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:62 |
| `KONFIRMASI PESANAN` | SENSITIF | 0 | — | — | 0 contoh | faq-interaksi.md:65 |
| `READY` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:72 |
| `INFARM` | OUTBOUND | 0 | — | — | 0 contoh | faq-interaksi.md:75 |
| `TQ` | OUTBOUND | 1 | ya | ya | hanya 1 contoh | faq-interaksi.md:83 |
| `PROSES REQ` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:86 |
| `REKENING` | SENSITIF | 0 | — | — | 0 contoh | faq-interaksi.md:89 |
| `PICKUP` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-interaksi.md:93 |
| `DATA` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-interaksi.md:96 |
| `RESI REVISI` | SENSITIF | 0 | — | — | 0 contoh | faq-interaksi.md:99 |
| `KOSONG` | OUTBOUND | 0 | — | — | 0 contoh | faq-interaksi.md:102 |
| `HARGA` | BROADCAST | 1 | ya | ya | hanya 1 contoh | faq-interaksi.md:112 |
| `KIRIM REGULER` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:119 |
| `KIRIM INSTANT` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:126 |
| `OTW` | INTI | 0 | — | — | 0 contoh | faq-interaksi.md:133 |
| `KOMPLAIN DATA` | SENSITIF | 0 | — | — | 0 contoh | faq-interaksi.md:137 |
| `GARANSI` | SENSITIF | 0 | — | ya | 0 contoh | faq-interaksi.md:145 |
| `REQ RANDOM` | OUTBOUND | 0 | — | — | 0 contoh | faq-interaksi.md:156 |
| `DITERUSKAN CS` | OUTBOUND | 0 | — | — | 0 contoh | faq-interaksi.md:159 |
| `PAKAI ABMB` | INTI | 1 | ya | ya | hanya 1 contoh | faq-cara-pakai.md:8 |
| `PAKAI NEEM` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-cara-pakai.md:19 |
| `PAKAI POC` | INTI | 1 | ya | ya | hanya 1 contoh | faq-cara-pakai.md:31 |
| `PAKAI FRUITEXPERT` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-cara-pakai.md:38 |
| `PAKAI ABMC` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-cara-pakai.md:45 |
| `PAKAI AKAR` | INTI | 1 | ya | ya | hanya 1 contoh | faq-cara-pakai.md:54 |
| `BIVI` | INTI | 1 | ya | ya | hanya 1 contoh | faq-cara-pakai.md:66 |
| `POLYBAG 1KG` | INTI | 0 | — | — | 0 contoh | faq-produk.md:8 |
| `POLYBAG 500GR` | INTI | 0 | — | — | 0 contoh | faq-produk.md:22 |
| `POLYBAG 250 GR` | INTI | 0 | — | — | 0 contoh | faq-produk.md:36 |
| `VELCRO` | INTI | 0 | — | — | 0 contoh | faq-produk.md:48 |
| `PRODUK POC` | INTI | 1 | ya | ya | hanya 1 contoh | faq-produk.md:51 |
| `PRODUK MIRACLE` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-produk.md:57 |
| `PRODUK AKAR` | INTI | 1 | ya | ya | hanya 1 contoh | faq-produk.md:63 |
| `PRODUK PELEBAT` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-produk.md:69 |
| `PRODUK PESTISIDA` | INTI | 1 | ya | ya | hanya 1 contoh | faq-produk.md:75 |
| `PRODUK SEEDBOOSTER` | INTI | 1 | ya | ya | hanya 1 contoh | faq-produk.md:81 |
| `PBL` | INTI | 0 | — | — | 0 contoh | faq-produk.md:87 |
| `VOUCHER KOMPLAIN` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:8 |
| `CANCEL` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:11 |
| `KIRIM PUSAT` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:14 |
| `NATAL` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:17 |
| `ORDER ULANG` | INTI | 0 | — | — | 0 contoh | faq-umum.md:20 |
| `PESAN ULANG` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:23 |
| `TANGGAL 7` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:26 |
| `TEAM AHLI` | INTI | 0 | — | — | 0 contoh | faq-umum.md:29 |
| `CATATANBENIHPAKET` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:32 |
| `KOMPOSISI TANAH` | INTI | 0 | — | — | 0 contoh | faq-umum.md:35 |
| `TANGGAL MERAH` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:38 |
| `PILIHAN BENIH` | INTI | 0 | — | — | 0 contoh | faq-umum.md:41 |
| `KLAIM BARANG` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:45 |
| `KLIK PESANAN SELESAI` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:48 |
| `BENIH PATEN` | INTI | 0 | — | — | 0 contoh | faq-umum.md:51 |
| `CHAT 321` | INTI | 0 | — | — | 0 contoh | faq-umum.md:54 |
| `CS WA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:57 |
| `TANPA` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:60 |
| `CARA TANAM` | INTI | 0 | — | — | 0 contoh | faq-umum.md:63 |
| `UKURAN POLYBAG` | INTI | 0 | — | — | 0 contoh | faq-umum.md:66 |
| `PAKAI GUANO` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:69 |
| `MIRACLE POWDER` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:72 |
| `BERAT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:79 |
| `PARANET` | INTI | 0 | — | — | 0 contoh | faq-umum.md:82 |
| `ONGKIR` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:88 |
| `SPRAYER KIMIA KERAS` | INTI | 0 | — | — | 0 contoh | faq-umum.md:96 |
| `PAKAI B1` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:99 |
| `CANGKOK` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:108 |
| `BEDA NEEM DAN PESNAB` | INTI | 0 | — | — | 0 contoh | faq-umum.md:120 |
| `PAKAI USIA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:124 |
| `REPELLENT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:127 |
| `PAKAI ROUNDOUP` | INTI | 0 | — | — | 0 contoh | faq-umum.md:130 |
| `TOKO INSTAN` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:138 |
| `CS KOMPLAIN` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:142 |
| `LINK BENIH` | INTI | 0 | — | — | 0 contoh | faq-umum.md:145 |
| `ATRAKTAN PETROGENOL` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:148 |
| `HITUNG PPM TDS` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:158 |
| `BEDA AB MIX POC` | INTI | 0 | — | — | 0 contoh | faq-umum.md:166 |
| `NUTRIPOD` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:169 |
| `CAMPAIGN3` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:177 |
| `1PROMO NUTRIPOD` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:193 |
| `BEDA BLOCK PRESS` | INTI | 0 | — | — | 0 contoh | faq-umum.md:206 |
| `TRAY PS` | INTI | 0 | — | — | 0 contoh | faq-umum.md:209 |
| `TANAM STRAWBERRY` | INTI | 0 | — | — | 0 contoh | faq-umum.md:213 |
| `NOTA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:216 |
| `SOIL METER` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:219 |
| `WA KOL` | INTI | 0 | — | — | 0 contoh | faq-umum.md:225 |
| `PROMOMINGGUAN` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:228 |
| `NO PURCHASING KAK RENI` | INTI | 0 | — | — | 0 contoh | faq-umum.md:239 |
| `ORGANIK` | INTI | 0 | — | — | 0 contoh | faq-umum.md:242 |
| `MAAF KENDALA EKSPEDISI` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:245 |
| `BENIH` | INTI | 0 | — | — | 0 contoh | faq-umum.md:249 |
| `COCO SEMENTARA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:252 |
| `AKAR AUKSIN` | INTI | 0 | — | — | 0 contoh | faq-umum.md:256 |
| `KANDUNGAN PENGKILAP` | INTI | 0 | — | — | 0 contoh | faq-umum.md:259 |
| `FREE GIFT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:262 |
| `UKURAN SARUNG TANGAN` | INTI | 0 | — | — | 0 contoh | faq-umum.md:265 |
| `IKUT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:268 |
| `PESTNAB SEMENTARA` | OUTBOUND | 0 | — | — | 0 contoh | faq-umum.md:271 |
| `DOLOMIT` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:279 |
| `1010` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:288 |
| `SINGLE` | INTI | 0 | — | — | 0 contoh | faq-umum.md:306 |
| `COCOPEAT` | SENSITIF | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:309 |
| `ISI PAKET 25` | INTI | 0 | — | — | 0 contoh | faq-umum.md:315 |
| `AWAL PEMULA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:320 |
| `POLINASI MANUAL TOMAT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:323 |
| `ALIHKAN` | OUTBOUND | 0 | — | — | 0 contoh | faq-umum.md:327 |
| `PBM` | INTI | 0 | — | ya | 0 contoh | faq-umum.md:330 |
| `TUTUP SUSAH BUKA` | INTI | 0 | — | — | 0 contoh | faq-umum.md:342 |
| `MAGNESIUM` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:345 |
| `BAIK` | INTI | 0 | — | — | 0 contoh | faq-umum.md:352 |
| `EKSPEDISI 2` | INTI | 0 | — | — | 0 contoh | faq-umum.md:355 |
| `BEDA BOOSTER BIO DAN FRUIT EXPERT` | INTI | 0 | — | — | 0 contoh | faq-umum.md:358 |
| `ABMIX MELON` | INTI | 0 | — | — | 0 contoh | faq-umum.md:361 |
| `12.12` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:371 |
| `VITAMIN AKAR` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:379 |
| `EXPRESS ECO` | INTI | 0 | — | — | 0 contoh | faq-umum.md:386 |
| `BEDA GUANO DAN POP` | INTI | 0 | — | — | 0 contoh | faq-umum.md:393 |
| `PENINJAUAN` | INTI | 0 | — | — | 0 contoh | faq-umum.md:396 |
| `COD` | INTI | 0 | — | — | 0 contoh | faq-umum.md:399 |
| `PAKET5BENIH` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:407 |
| `SAMPLE` | INTI | 0 | — | — | 0 contoh | faq-umum.md:417 |
| `KIRIM DARI` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:420 |
| `CARA PAKAI NPK` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:423 |
| `BAHAN PLANTER BAG` | INTI | 0 | — | — | 0 contoh | faq-umum.md:430 |
| `CARA PAKAI TDS METER` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:433 |
| `CARA PAKAI PH METER` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:441 |
| `CARA KALIBRASI ULANG TDS METER` | INTI | 2 | ya | ya | hanya 2 contoh; ragam panjang sempit (1 kata) | faq-umum.md:450 |
| `CARA KALIBRASI ULANG PH METER` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:460 |
| `CARA PAKAI EM4` | INTI | 1 | — | ya | hanya 1 contoh; tidak ada contoh bergaya chat | faq-umum.md:470 |
| `CARA PAKAI ASAM AMINO` | INTI | 1 | ya | ya | hanya 1 contoh | faq-umum.md:480 |
| `TIPS SEMAI ANTI KUTILANG` | SENSITIF | 0 | — | — | 0 contoh | faq-umum.md:486 |
| `IDUL FITRI` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:492 |
| `BERTAHAP` | KONDISI_INTERNAL | 0 | — | — | 0 contoh | faq-umum.md:495 |
| `PAKAI AGK LENGKAP` | INTI | 0 | — | ya | 0 contoh | faq-umum.md:498 |
| `HARGANAIK` | INTI | 0 | — | — | 0 contoh | faq-umum.md:508 |
| `BENIH50` | INTI | 0 | — | — | 0 contoh | faq-umum.md:511 |
| `PAKET25SAYUR` | INTI | 0 | — | — | 0 contoh | faq-umum.md:515 |
| `BEDA SIMPLE PACK DAN PRO PACK` | INTI | 0 | — | — | 0 contoh | faq-umum.md:518 |
| `PROMO HARI INI` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:521 |
| `6.6` | BROADCAST | 0 | — | — | 0 contoh | faq-umum.md:536 |
| `PERAWATAN CABAI` | INTI | 0 | — | — | 0 contoh | faq-umum.md:555 |

---

## 6. Daftar tindakan

Urut berdasarkan dampak dibagi usaha.

| # | Tindakan | Usaha | Dampak |
|---|---|---|---|
| 1 | Bangkitkan ulang `seed-templates.sql` (`npm run template-sql`) lalu jalankan, sehingga `[DITERUSKAN CS]` dan `[KOMPLAIN DATA]` masuk tabel | 5 menit | **mencegah balasan kosong ke pelanggan komplain** |
| 2 | Tambahkan pengaman di `router.js`: bila `KODE_HANDOVER` tidak ada di sumber aktif, ambil dari berkas `.md` dan tulis peringatan | 20 menit | menutup K1 secara permanen, bukan sekali ini saja |
| 3 | Putuskan batas jam instant yang benar bersama tim operasional | keputusan | membuka jalan tindakan 4 |
| 4 | Gabungkan `[INSTANT]` + `[KIRIM INSTANT]`; perbaiki `[KIRIM REGULER]`; perbaiki salah ketik "dikiirm" di ketiganya | 15 menit | menghapus 3 dari 4 pasangan ≥ 0,80 |
| 5 | Keluarkan `[BANTU]`, `[TQ]`, dan seluruh kelas OUTBOUND/BROADCAST/SENSITIF dari pool Gerbang 2 | 30 menit | mengecilkan pool dari 154 ke ±105, mengurangi tabrakan |
| 6 | Isi `active_until` untuk 6 template promo yang sudah lewat | 10 menit | template kadaluarsa mati sendiri |
| 7 | Gabungkan `[EKSPEDISI]` + `[EKSPEDISI 2]`; jadikan `[KIRIM PUSAT]`/`[TOKO INSTAN]` satu template berparameter | 30 menit | menghapus 2 pasangan ≥ 0,60 |
| 8 | Putuskan nasib `[PBM]` dan `[PERAWATAN CABAI]` (paket atau pecah) | keputusan | menghapus 2 pasangan tersisa |
| 9 | **Tim CS menulis 3 contoh per template INTI, gaya chat asli** — 105 template × 3 = 315 contoh | besar, berhari-hari | **pengungkit akurasi terbesar**; tanpa ini semua yang lain sia-sia |
| 10 | Tambah kolom `butuh_data_sistem` dan `siap_routing` ke `templates` | 30 menit | `siap_routing` otomatis `false` selama contoh < 3 |
| 11 | Normalisasi slang sebelum embed, diterapkan ke pesan DAN ke contoh | 2 jam | menutup celah gaya bahasa yang terukur di P2 |
| 12 | Re-embed otomatis saat contoh disimpan, hanya baris yang berubah | 3 jam | mencegah vektor basi |
| 13 | Cek tabrakan ≥ 0,80 saat CS menyimpan contoh baru | 4 jam | **tanpa ini katalog akan berantakan lagi dalam beberapa bulan** |
| 14 | Tulis ke `routing_log` dari `/api/chat` | 2 jam | bahan perbaikan mingguan; tanpa ini tidak ada umpan balik |
| 15 | Samakan nilai bawaan ambang di `tes0.mjs` & `tes-ambang.mjs` dengan `lib/pengenal.ts` | 10 menit | menghilangkan pengukuran yang memakai ambang berbeda dari produksi |

**Baru setelah 1–9 selesai, tes akurasi layak dijalankan.**

---

## 7. Yang tidak bisa diperiksa

### Butuh keputusan manusia

| Hal | Yang dibutuhkan |
|---|---|
| **Batas jam kirim yang benar** | keputusan tim operasional — data tidak bisa menjawabnya |
| **Klasifikasi 154 template** | tebakan mesin di bagian 5 **wajib dikoreksi manusia**. Yang saya tahu keliru: `[COCOPEAT]` ditandai SENSITIF (terpicu kata "kurangi"), `[HARGA]` ditandai BROADCAST (terpicu "diskon atau promo"), `[ONGKIR]` ditandai SENSITIF (terpicu "klaim voucher"), `[TIPS SEMAI ANTI KUTILANG]` ditandai SENSITIF. Keempatnya sebenarnya INTI. `[NATAL]` & `[IDUL FITRI]` ditandai KONDISI_INTERNAL, seharusnya BROADCAST kadaluarsa |
| **`[PBM]` dan `[PERAWATAN CABAI]`** | apakah keduanya template paket yang memang sengaja menggabungkan produk? |
| **`[PRODUK PELEBAT]` vs `[PBL]`** | masih menggantung dari pekerjaan sebelumnya |

### Butuh data yang belum ada

| Hal | Yang dibutuhkan |
|---|---|
| **Kemiripan semantik sebenarnya** | angka di K4 leksikal, bukan embedding. Perlu embed 154 template — ±Rp 0,05, **butuh izin Anda** |
| **Kriteria C secara menyeluruh** | 119 template belum punya contoh sama sekali; kesesuaiannya tidak bisa dinilai sebelum contohnya ada |
| **Akurasi sebenarnya** | butuh 400 chat Duoke asli yang sudah dilabeli (Tahap E). 19 kalimat pada `tes-ambang` adalah karangan saya, bukan chat pelanggan |
| **Isi tabel `templates` di Supabase** | audit ini membaca berkas `.md`. Anon tidak boleh membaca tabel, dan itu memang disengaja. Jalankan `npm run periksa-sumber` untuk membandingkan |
| **Apakah `template_examples` sudah terisi** | `seed-contoh.sql` berisi 36 contoh; belum dipastikan sudah dijalankan di project yang sekarang |

### Kriteria yang gagal karena datanya tidak ada, bukan karena buruk

- **B4 (ragam)** — semua template punya ≤ 2 contoh; ragam tidak bisa diukur
- **B5 (duplikat lintas template)** — 0 ditemukan, tetapi dengan 36 contoh saja
  angka itu belum berarti apa-apa

---

## Lampiran — rincian kriteria A dan E

### A. Struktur penyimpanan (4/6)

| Kriteria | Status | Bukti |
|---|---|---|
| `keywords` & `contoh_pertanyaan` terpisah | ✅ | beda tabel: `template_rules.when_patterns` vs `template_examples.teks` |
| Contoh sebagai daftar, bukan blob | ✅ | satu baris per contoh, `unique (template_id, teks)` |
| `butuh_data_sistem` | ❌ | tidak ada di `schema-kb.sql:63` |
| `siap_routing` | ❌ | tidak ada |
| `berlaku_sampai` | ✅ | `active_from` / `active_until` (`schema-kb.sql`) — **tetapi tidak pernah diisi** |
| Vektor + waktu embedding | ✅ | `embedding`, `embedding_model`, `embedding_dibuat` |

### E. Pengaman di sisi kode (3/7)

| Kriteria | Status | Bukti |
|---|---|---|
| Gerbang 0 sebelum pencocokan apa pun | ✅ | `router.js:923` `routeToCategory` memeriksa satpam paling depan; `/api/chat` menanganinya tanpa syarat `useTemplates` |
| Normalisasi slang | ❌ | tidak ada. `pengenal.ts:162` mengirim pesan mentah ke `embed()` |
| Re-embed otomatis saat simpan | ❌ | `/api/templates` tidak menyentuh `template_examples` sama sekali |
| Cek tabrakan saat simpan | ❌ | tidak ada — **rekomendasi paling berdampak jangka panjang** |
| Ambang tidak di-hardcode | ⚠️ | terpusat di `lib/pengenal.ts`, **tetapi** `tes0.mjs:19` memakai bawaan 0,93/0,6 dan `tes-ambang.mjs:221` memakai 0,93 — berbeda dari produksi (0,5/0,35). Pengukuran memakai ambang yang bukan ambang sebenarnya |
| Log `NO_MATCH` & skor | ❌ | tabel `routing_log` ada, tidak ada satu pun kode yang menulis ke sana |
| Kunci Voyage hanya dari env | ✅ | `voyage.ts:59,106` membaca `process.env`; `.env*` ada di `.gitignore`; `git ls-files` hanya memuat `.env.example` |
