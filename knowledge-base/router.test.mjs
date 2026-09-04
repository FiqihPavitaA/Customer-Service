/* ===========================================================
   Uji pencocok template — OFFLINE.

   Hanya regex + baca berkas .md lokal. Tidak ada fetch, tidak ada
   klien Anthropic, tidak menyentuh saldo API. Biaya Rp 0.
   (router.js hanya meng-import node:fs, node:path, node:url.)

   Jalankan:  node knowledge-base/router.test.mjs
   =========================================================== */

import { matchTemplate } from "./router.js";

/** [pesan, kode yang diharapkan]. null = harus diserahkan ke AI. */
const KASUS = [
  // ---------- Tier 1: dosis & cara pakai ----------
  ["dosis NPK berapa kak?", "CARA PAKAI NPK"],
  ["cara pakai EM4 gimana?", "CARA PAKAI EM4"],
  ["takaran magnesium sulfat berapa?", "MAGNESIUM"],
  ["cara pakai pupuk guano gimana kak", "PAKAI GUANO"],
  ["dosis dolomit per meter berapa?", "DOLOMIT"],
  ["cara pakai asam amino gimana?", "CARA PAKAI ASAM AMINO"],
  ["nutripod caranya gimana kak?", "NUTRIPOD"],
  ["cara pakai cocopeat gimana?", "COCOPEAT"],
  ["cara pakai soil meter gimana?", "SOIL METER"],
  ["cara pakai TDS meter gimana?", "CARA PAKAI TDS METER"],
  ["cara pakai pH meter gimana?", "CARA PAKAI PH METER"],
  ["cara kalibrasi ulang TDS meter?", "CARA KALIBRASI ULANG TDS METER"],
  ["cara kalibrasi pH meter gimana?", "CARA KALIBRASI ULANG PH METER"],
  ["cara hitung ppm nutrisi gimana?", "HITUNG PPM TDS"],
  ["dosis B1 berapa kak?", "PAKAI B1"],
  ["vitamin akar cara pakainya gimana?", "VITAMIN AKAR"],
  ["dosis hormon akar buat stek berapa?", "PAKAI AKAR"],
  ["cara pakai fruit expert gimana?", "PAKAI FRUITEXPERT"],
  ["cara pakai ab mix instant gimana?", "PAKAI ABMC"],
  ["dosis bivi berapa?", "BIVI"],
  ["cara pakai petrogenol gimana?", "ATRAKTAN PETROGENOL"],
  ["cara cangkok pakai groot gimana?", "CANGKOK"],

  // ---------- Urutan aturan (yang spesifik harus menang) ----------
  // Pemakaian menang atas deskripsi untuk produk yang sama:
  ["cara pakai miracle powder gimana?", "MIRACLE POWDER"],
  ["miracle powder itu apa sih?", "PRODUK MIRACLE"],
  // Kalibrasi menang atas cara pakai alat:
  ["kalibrasi TDS meter caranya?", "CARA KALIBRASI ULANG TDS METER"],
  // Aturan lama tetap menang untuk produk yang sudah punya aturan:
  ["cara pakai POC gimana ya kak?", "PAKAI POC"],
  ["dosis ab mix berapa?", "PAKAI ABMB"],
  ["cara pakai neem oil gimana?", "PAKAI NEEM"],

  // ---------- Harus TETAP ke AI (pengaman) ----------
  // Nama produk tanpa niat menanyakan pemakaian:
  ["NPK habis, mau beli lagi", null],
  ["cocopeat ready nggak kak?", null],
  ["guano harganya berapa?", "HARGA"],
  ["paket nutripod saya belum sampai", null],
  // Butuh penilaian -> selalu AI:
  ["dosis NPK buat cabai sebaiknya berapa?", null],
  ["B1 boleh dicampur POC nggak?", null],
  ["kenapa dosis dolomit segitu?", null],
  ["magnesium bagusnya dipakai kapan?", null],
  // Cerita panjang -> AI:
  [
    "kak saya baru mulai berkebun bulan lalu, tanaman cabai saya sudah tumbuh tapi daunnya menguning dan saya sudah pakai NPK dengan dosis yang saya baca di internet, kira-kira salahnya di mana ya kak",
    null,
  ],

  // ---------- Enam aturan PRODUK * ----------
  ["halo kak, produk POC ini apa ya", "PRODUK POC"],
  ["produk akar buat apa kak?", "PRODUK AKAR"],
  ["pestisida ini untuk apa ya kak", "PRODUK PESTISIDA"],
  ["seed booster manfaatnya apa?", "PRODUK SEEDBOOSTER"],
  ["paket pelebat itu apa?", "PRODUK PELEBAT"],
  ["POC ready nggak kak?", null],

  // ---------- Perilaku lama harus utuh ----------
  ["Halo kak", "BANTU"],
  ["makasih kak", "TQ"],
  ["barang saya bocor", "KOMPLAIN"],
  ["mau lacak paket dong", "LACAK"],
  ["ada garansi nggak kak?", "GARANSI"],
];

let lulus = 0;
const gagal = [];

for (const [pesan, harap] of KASUS) {
  const hasil = matchTemplate(pesan);
  const dapat = hasil ? hasil.code : null;
  if (dapat === harap) lulus++;
  else gagal.push({ pesan, harap, dapat });
}

console.log(`LULUS ${lulus}/${KASUS.length}`);
for (const g of gagal) {
  console.log(
    `  GAGAL  "${g.pesan.slice(0, 55)}"` +
      `\n         dapat: ${g.dapat ?? "AI"} | harap: ${g.harap ?? "AI"}`,
  );
}

process.exit(gagal.length ? 1 : 0);
