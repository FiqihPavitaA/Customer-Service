# Prompt: Audit Kesiapan Data untuk Semantic Search (Voyage)

Cara pakai di Claude Code: `Baca prompts/audit-kesiapan-voyage.md lalu jalankan auditnya.`

> Hasil audit terakhir: [`laporan-kesiapan-voyage.md`](../laporan-kesiapan-voyage.md)
> (8 September 2026). Alat bantunya: `node knowledge-base/audit-voyage.mjs`,
> biaya Rp 0.

---

## KONTEKS PROYEK

Kamu mengaudit data template balasan untuk sistem Customer Service AI milik Infarm
(brand urban farming, 18 toko di Shopee/Tokopedia/Blibli/Lazada, ~1.000 chat/hari).

Arsitektur pencocokan chat pelanggan berlapis, dari murah ke mahal:

| Gerbang | Mekanisme | Sumber data |
|---|---|---|
| 0 | Aturan kode untuk kasus sensitif → langsung ke CS manusia | daftar kata sensitif |
| 1 | Pencocokan kata kunci persis (gratis) | kolom `keywords` |
| 2 | Semantic search pakai embedding Voyage (`voyage-4-lite`) | kolom `contoh_pertanyaan` |
| 3 | Claude Haiku memilih 1 dari 3 kandidat saat skor ragu | — |
| 4 | Claude Sonnet menyusun draf saat tidak ada template | knowledge base |

**Cara kerja gerbang 2 yang harus kamu pahami sebelum menilai apa pun:**

Voyage merata-ratakan SELURUH teks yang dikirim menjadi SATU titik dalam ruang 1.024 dimensi.
Konsekuensinya:

- Tumpukan kata kunci lepas menghasilkan titik yang kabur — agak dekat ke semua hal,
  tidak benar-benar dekat ke apa pun. Template seperti ini jadi magnet yang menyedot chat
  milik template lain, atau justru tidak pernah menang.
- Kalimat utuh berbentuk pertanyaan menghasilkan titik yang tajam, karena model dilatih
  dengan pasangan pertanyaan–jawaban.

Jadi untuk gerbang 2, **kata kunci adalah racun dan kalimat utuh adalah obat.** Kata kunci
tetap berguna, tapi tempatnya di gerbang 1 (kolom terpisah), bukan di `contoh_pertanyaan`.

---

## TUGASMU

Audit data yang ADA SEKARANG di repo ini terhadap 5 kelompok kriteria di bawah.

**Aturan kerja:**
- JANGAN memperbaiki apa pun. Ini audit, bukan perbaikan. Laporkan saja.
- JANGAN mengarang temuan. Kalau sesuatu tidak bisa diperiksa dari data yang ada,
  tulis "tidak bisa diperiksa" dan sebutkan apa yang kurang.
- Sebutkan nama file dan nomor baris untuk setiap temuan supaya bisa ditindaklanjuti.
- Kalau tidak yakin sebuah temuan benar, tandai sebagai "perlu konfirmasi manusia".

**Langkah pertama:** cari dulu di mana data template disimpan. Kemungkinan lokasinya:
file `.md` di `knowledge-base/`, tabel `templates` di Supabase (cari file migrasi/schema),
atau file seed/JSON. Laporkan apa yang kamu temukan sebelum mulai menilai.

---

## KRITERIA A — Struktur penyimpanan data

Periksa skema tabel `templates` (atau struktur file yang setara):

- [ ] Ada kolom `keywords` DAN kolom `contoh_pertanyaan` yang **terpisah**.
      Kalau keduanya dicampur jadi satu kolom, itu temuan KRITIS — kata kunci akan ikut
      ter-embed dan mengaburkan titiknya.
- [ ] `contoh_pertanyaan` disimpan sebagai daftar (array / baris terpisah / tabel anak),
      bukan satu blob teks panjang. Blob mengundang penulisan gaya paragraf atau daftar kata.
- [ ] Ada kolom `butuh_data_sistem` (boolean) untuk template yang isinya harus diambil
      dari status pesanan, bukan dijawab langsung.
- [ ] Ada kolom penanda kesiapan routing (mis. `siap_routing`) yang bisa otomatis `false`
      selama contoh pertanyaannya kurang dari 3.
- [ ] Ada kolom `berlaku_sampai` untuk template promo/musiman supaya nonaktif otomatis.
- [ ] Ada kolom untuk menyimpan vektor embedding dan `embedding_updated_at`,
      supaya baris yang embeddingnya basi bisa dideteksi.

---

## KRITERIA B — Kualitas tiap contoh pertanyaan

Untuk SETIAP template, periksa daftar `contoh_pertanyaan`-nya:

**B1. Jumlah.** Hitung berapa contoh per template.
- 0–2 contoh → BELUM SIAP untuk routing otomatis
- 3–5 contoh → ideal
- lebih dari 8 → berlebihan; hasilnya menurun dan risiko tabrakan naik

**B2. Bentuk kalimat, bukan daftar kata.** Tandai contoh yang mencurigakan:
- lebih pendek dari 4 kata
- mengandung 3 koma atau lebih dalam satu contoh (ciri daftar kata kunci menyamar)
- tidak mengandung satu pun kata tanya (`apa`, `gimana`, `gmn`, `berapa`, `brp`, `kapan`,
  `kpn`, `bisa`, `boleh`, `kenapa`, `mana`) DAN bukan kalimat perintah/pernyataan yang wajar

**B3. Gaya bahasa pelanggan, bukan bahasa dokumen.** Untuk tiap template, cek apakah
ADA MINIMAL SATU contoh yang mengandung ciri chat marketplace:
- singkatan: `gmn`, `brp`, `blm`, `kpn`, `gak`, `ga`, `udh`, `tdk`, `yg`, `sy`
- sapaan: `kak`, `kk`, `ka`, `sis`, `min`, `bang`
- huruf kecil semua tanpa tanda baca

Template yang SEMUA contohnya ditulis baku dan rapi ("Bagaimana cara penggunaan produk ini?")
adalah temuan — pelanggan asli tidak menulis begitu, jadi contohnya tidak mewakili kenyataan.

**B4. Ragam.** Contoh dalam satu template sebaiknya bervariasi. Tandai kalau:
- semua contoh punya 3 kata pembuka yang sama
- selisih panjang terpanjang dan terpendek kurang dari 5 kata
- semua contoh menyebut nama produk, atau semuanya tidak menyebut nama produk sama sekali

**B5. Duplikat lintas template.** Cari contoh pertanyaan yang muncul (persis atau hampir persis)
di lebih dari satu template. Ini membuat sistem mustahil memilih dengan benar.

---

## KRITERIA C — Kesesuaian contoh dengan isi jawaban

Ini butuh penilaianmu, tidak bisa dihitung otomatis. Untuk setiap template, baca
`contoh_pertanyaan` bersama `template_text`, lalu nilai:

**C1. Apakah tiap contoh BENAR-BENAR terjawab oleh template itu?**
Contoh pelanggaran: template `[PAKAI POC]` hanya menjelaskan takaran dan cara siram,
tapi salah satu contohnya berbunyi "poc bagus buat tanaman apa" — itu pertanyaan manfaat,
bukan pertanyaan cara pakai. Memasukkannya berarti mengajari sistem mengirim jawaban
yang tidak nyambung.

**C2. Apakah satu template mengandung lebih dari satu maksud?**
Kalau contoh-contohnya menanyakan hal yang benar-benar berbeda (takaran vs manfaat vs
perbedaan dengan produk lain), template itu sebaiknya dipecah. Usulkan pemecahannya.

---

## KRITERIA D — Kesehatan katalog secara keseluruhan

**D1. Kode duplikat.** Cari kode template yang muncul lebih dari sekali. Untuk tiap duplikat,
laporkan apakah isinya identik (aman, hapus satu) atau berbeda (KONFLIK, harus diputuskan).

**D2. Template yang terlalu mirip satu sama lain.** Tanpa API key kamu bisa memakai pendekatan
leksikal (TF-IDF karakter n-gram + cosine similarity) sebagai perkiraan. Laporkan semua
pasangan dengan skor >= 0,60, dan tandai yang >= 0,80 sebagai wajib digabung.

**D3. Template yang seharusnya TIDAK masuk pool routing.** Klasifikasikan tiap template:
- `BROADCAST` — materi promo yang dikirim massal, tidak dipicu pertanyaan pelanggan
- `OUTBOUND` — kalimat yang CS kirim duluan (sapaan, penutup, konfirmasi), bukan jawaban
- `SENSITIF` — refund, komplain, klaim, pembatalan → wajib ke manusia, tidak boleh auto
- `KONDISI_INTERNAL` — jawabannya tergantung keadaan gudang hari itu (kenapa pesanan belum
  dikirim: libur/overload/tanggal merah/pickup/bertahap). Isi chat pelanggan IDENTIK untuk
  semua kasus ini, jadi tidak mungkin dibedakan oleh model apa pun. Harus jadi satu template
  induk berparameter yang diisi dari status sistem.
- `INTI` — sisanya; hanya kelompok ini yang layak masuk routing otomatis

**D4. Template kadaluarsa.** Cari template yang menyebut tanggal atau acara yang sudah lewat
(promo tanggal tertentu, hari raya, periode libur). Bandingkan dengan tanggal hari ini.

**D5. Kontradiksi fakta.** Cari dua template yang menyatakan fakta berbeda tentang hal yang
sama (mis. dua template menyebut batas jam pengiriman yang berbeda). Ini bug bisnis dan
lebih mendesak daripada masalah teknis mana pun.

---

## KRITERIA E — Pengaman di sisi kode

Periksa kode aplikasi (bukan data):

- [ ] **Urutan gerbang benar.** Aturan sensitif (gerbang 0) dijalankan SEBELUM pencocokan
      apa pun, dan hasilnya mengalahkan skor setinggi apa pun.
- [ ] **Normalisasi slang** diterapkan ke pesan pelanggan sebelum di-embed — dan diterapkan
      juga ke `contoh_pertanyaan`, supaya keduanya berbicara dalam bentuk yang sama.
- [ ] **Re-embed otomatis** saat template disimpan/diubah, dan hanya baris yang berubah.
- [ ] **Cek tabrakan saat simpan** — sebelum template baru disimpan, contohnya dibandingkan
      dengan seluruh katalog; kalau ada yang >= 0,80 tampilkan peringatan ke CS.
      Kalau belum ada, ini rekomendasi paling berdampak: tanpa pengaman ini katalog akan
      kembali berantakan dalam beberapa bulan.
- [ ] **Ambang skor tidak di-hardcode** di banyak tempat — sebaiknya satu konstanta/config
      supaya bisa dikalibrasi setelah tes akurasi.
- [ ] **Log `NO_MATCH` dan skor tersimpan** di tabel `conversations`, supaya bisa dipakai
      memperbaiki contoh pertanyaan tiap minggu.
- [ ] **API key Voyage tidak pernah muncul di kode** — hanya dari environment variable,
      dan `.env` ada di `.gitignore`.

---

## FORMAT LAPORAN

Tulis hasilnya ke `laporan-kesiapan-voyage.md` dengan urutan berikut.

**1. Ringkasan eksekutif** — maksimal 8 baris. Jawab satu pertanyaan:
apakah data ini sudah siap dipakai untuk semantic search, dan kalau belum, apa 3 hal
yang harus dibereskan lebih dulu.

**2. Skor kesiapan** — tabel:

| Kriteria | Lulus | Total | Status |
|---|---|---|---|
| A. Struktur data | x | 6 | |
| B. Kualitas contoh | x | (jumlah template) | |
| C. Kesesuaian contoh | x | (jumlah template) | |
| D. Kesehatan katalog | x | 5 | |
| E. Pengaman kode | x | 7 | |

**3. Temuan kritis** — hal yang membuat sistem SALAH menjawab pelanggan. Urutkan dari
yang paling berbahaya. Kode template + file + baris.

**4. Temuan penting** — hal yang menurunkan akurasi tapi tidak berbahaya.

**5. Tabel per template** — kolom: kode, klasifikasi (INTI/BROADCAST/OUTBOUND/SENSITIF/
KONDISI_INTERNAL), jumlah contoh, ada gaya chat? (ya/tidak), masalah yang ditemukan,
tindakan yang disarankan.

**6. Daftar tindakan** — urut berdasarkan dampak dibagi usaha. Setiap baris harus konkret
dan bisa langsung dikerjakan ("gabungkan [INSTANT] dan [KIRIM INSTANT] setelah memutuskan
batas jam yang benar"), bukan saran umum ("tingkatkan kualitas data").

**7. Yang tidak bisa diperiksa** — daftar hal yang butuh data atau keputusan manusia,
beserta apa yang dibutuhkan untuk memeriksanya.

---

## PATOKAN LULUS

Data dianggap siap untuk semantic search bila SEMUA ini terpenuhi:

- Tidak ada pasangan template dengan kemiripan >= 0,80 di dalam pool `INTI`
- Tidak ada kode template yang duplikat
- Minimal 90% template `INTI` punya >= 3 contoh pertanyaan
- Minimal 80% template `INTI` punya >= 1 contoh bergaya chat pelanggan asli
- Kolom `keywords` dan `contoh_pertanyaan` terpisah
- Aturan sensitif dijalankan sebelum pencocokan apa pun

Kalau ada satu saja yang gagal, sebutkan dengan jelas bahwa data BELUM SIAP dan tes
akurasi belum layak dijalankan — karena angkanya akan buruk dan akan salah menyalahkan
model, padahal masalahnya ada di data.
