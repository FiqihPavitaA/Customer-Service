# Hasil percobaan: `input_type` mana yang lebih baik

> Dijalankan 9 September 2026 · `npm run uji-input-type -- --jalankan`
> Biaya nyata **Rp 0,13** (394 token, 2 panggilan Voyage).
> Tidak ada data Supabase yang diubah — hasilnya laporan saja.

---

## Pertanyaan

Contoh pertanyaan yang tersimpan disematkan sebagai `document`, pesan
pelanggan sebagai `query`. Penanda itu dirancang untuk pencarian
**asimetris**: pertanyaan pendek dicocokkan ke paragraf panjang berisi
jawaban.

Tetapi yang kita simpan bukan paragraf jawaban — melainkan **contoh
pertanyaan**. Bentuknya sama dengan pesan yang masuk. Itu tugas
simetris, jadi pilihan `document` layak dipertanyakan.

## Hasil

19 kalimat gaya pelanggan yang benar-benar sampai Gerbang 2,
dibandingkan dengan 36 contoh yang sama.

| | `query`↔`document`<br>(berjalan sekarang) | `query`↔`query`<br>(usulan) |
|---|---|---|
| Juara benar | 17/19 | **18/19** |
| Skor juara (min–maks) | 0,404 – 0,672 | 0,504 – 0,902 |
| Margin BENAR terkecil | 0,033 | 0,007 |
| Margin BENAR median | 0,173 | **0,318** |
| Margin SALAH terbesar | 0,061 | **0,051** |
| **Bisa dijawab tanpa satu pun salah** | **12** | **17** |

Baris terakhir yang menentukan, dan bacanya begini: pada ambang margin
setinggi mungkin yang masih menahan seluruh jawaban salah, berapa
jawaban benar yang tetap lolos.

- `query`↔`document`: ambang harus di atas 0,061 → **12** lolos
- `query`↔`query`: ambang harus di atas 0,051 → **17** lolos

Naik dari 12 ke 17 dari 19 — **42% lebih banyak** pertanyaan terjawab
otomatis, tanpa menambah satu pun jawaban salah.

## Kenapa ini bukan sekadar "skornya lebih besar"

Kekhawatiran yang wajar: skala `query`↔`query` memang menghasilkan
angka lebih tinggi, dan angka lebih tinggi tidak dengan sendirinya
berarti lebih baik. Menaikkan semua skor bersamaan tidak menambah
informasi apa pun.

Yang membuktikan ini bukan sekadar pergeseran skala: **margin median
justru hampir dua kali lipat** (0,173 → 0,318). Kalau yang terjadi
hanya semua angka naik bersama, marginnya akan tetap sama. Yang
terjadi adalah jaraknya melebar — juara benar makin jauh meninggalkan
pesaingnya.

Sekaligus, margin jawaban SALAH justru turun (0,061 → 0,051). Dua arah
yang berlawanan itulah bukti bahwa pemisahannya membaik, bukan
skalanya yang bergeser.

## Kasus yang berubah

**`"nem oilnya dipakenya gmn kak"`** — kasus yang sejak awal jadi
contoh kegagalan:

```
query<->document   ✗ [PAKAI POC]  0,438  margin 0,027   SALAH
query<->query        [PAKAI NEEM] 0,504  margin 0,007   benar
```

Juaranya kini benar. Marginnya tipis sekali (0,007) sehingga tetap
ditahan syarat margin dan diteruskan ke Claude — tetapi ia berhenti
salah menunjuk.

**`"miracle powder dipakenya gmn"`** tetap salah di kedua susunan,
dimenangkan `[PRODUK MIRACLE]`. Sebabnya bukan `input_type` melainkan
data: `[PBM]` memuat seluruh teks `[MIRACLE POWDER]` (temuan K5 pada
audit), dan `[PRODUK MIRACLE]` hanya punya satu contoh yang gayanya
terlalu rapi.

## Metrik yang saya rancang ternyata bukan yang paling berguna

Skrip ini menghitung **CELAH** = margin benar terkecil dikurangi
margin salah terbesar. Gagasannya: positif berarti ada ambang yang
memisahkan sempurna.

Hasilnya negatif di kedua susunan (−0,028 dan −0,044), dan itu
membuat `query`↔`query` terlihat lebih buruk. Padahal tidak.

Sebabnya CELAH memakai margin benar **terkecil**, jadi satu kalimat
bermargin 0,007 menenggelamkan seluruh gambaran — walaupun 17 kalimat
lain jauh di atas ambang. Menahan satu jawaban benar bukan kerugian
yang setara dengan meloloskan satu jawaban salah: yang tertahan cuma
diteruskan ke Claude, yang lolos salah sampai ke pelanggan.

Metrik yang benar adalah **berapa yang bisa dijawab tanpa satu pun
salah** — dan itu baru terlihat setelah datanya ada.

## Usulan konfigurasi bila dipindah

```
PENGENAL_MODE=bayangan          (tetap, belum diaktifkan)
AMBANG_YAKIN=0.50               (skor benar terendah 0,504)
AMBANG_MARGIN=0.06              (margin salah tertinggi 0,051)
AMBANG_RAGU=0.35                (tetap; lantai kasar saja)
```

Ambang skor hampir tidak berperan di susunan ini: jawaban yang salah
justru berskor **tinggi** (0,833), jadi yang menahannya hanya margin.

## Yang perlu dikerjakan bila dipindah

1. `web/app/api/pengenal/bangun/route.ts` — `"document"` → `"query"`
2. `web/scripts/bangun-contoh.mjs` — sama
3. Kosongkan `embedding` di `template_examples`, lalu bangun ulang
   (~36 contoh, sekitar **Rp 0,01**)
4. Perbarui `AMBANG_MARGIN` di `web/lib/pengenal.ts`
5. Perbarui catatan panjang di `lib/pengenal.ts` dan `lib/voyage.ts` —
   keduanya menyatakan `document`/`query` sudah pasti benar

## Batas ketelitian — wajib dibaca sebelum menyimpulkan

**19 kalimat itu karangan saya, bukan chat pelanggan sungguhan.**
Angka di atas menunjukkan arah yang konsisten dengan alasan teoretis
(korpus kita berisi pertanyaan, bukan paragraf), tetapi 19 kalimat
terlalu sedikit untuk dijadikan keputusan akhir.

Kekeliruan ambang 0,93 dulu lahir persis dari menyimpulkan terlalu
cepat atas pengukuran yang bentuknya tidak sama dengan produksi.

Karena itu: pemindahan ini **layak dilakukan**, tetapi hasilnya harus
diukur ulang pada Tahap E dengan 400 chat Duoke asli yang sudah
dilabeli. Sampai itu terjadi, Gerbang 2 tetap di mode bayangan.
