/* ===========================================================
   Uji pencocok template — OFFLINE.

   Hanya regex + baca berkas .md lokal. Tidak ada fetch, tidak ada
   klien Anthropic, tidak menyentuh saldo API. Biaya Rp 0.
   (router.js hanya meng-import node:fs, node:path, node:url.)

   Jalankan:  node knowledge-base/router.test.mjs
   =========================================================== */

import { matchTemplate, periksaSatpam } from "./router.js";

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
  // Catatan: sejak Gerbang 0 dipasang, pesan ini TIDAK LAGI dijawab
  // [KOMPLAIN] pada alur sungguhan — satpam menahannya lebih dulu
  // (kategori barang_bermasalah). Kasus ini tetap di sini karena yang
  // diuji matchTemplate, yaitu Gerbang 1 secara terpisah, dan aturan
  // itu memang masih benar. Perilaku ujung-ke-ujungnya diuji di
  // bagian KASUS_SATPAM di bawah.
  ["barang saya bocor", "KOMPLAIN"],
  ["mau lacak paket dong", "LACAK"],
  ["ada garansi nggak kak?", "GARANSI"],
];

/* ===========================================================
   Gerbang 0 — satpam
   ===========================================================
   Dua sisi diuji, dan sisi kedua sama pentingnya:

     1. Yang WAJIB DITAHAN. Kalau ini bocor, kasus refund atau
        keracunan bisa dijawab otomatis.
     2. Yang WAJIB LOLOS. Satpam yang kebablasan tidak terlihat
        seperti kerusakan — ia hanya membanjiri CS manusia dengan
        pertanyaan biasa, dan diam-diam menghapus seluruh manfaat
        gerbang di belakangnya.

   Sisi kedua itulah yang menjaga daftar kata tetap jujur.        */

/** [pesan, kategori satpam yang diharapkan]. null = HARUS lolos. */
const KASUS_SATPAM = [
  // --- wajib ditahan ---
  ["mau refund dong barangnya nggak sesuai", "refund_retur"],
  ["tolong batalkan pesanan saya", "refund_retur"],
  ["botolnya bocor semua pas sampai", "barang_bermasalah"],
  ["isinya kurang 1 botol kak", "barang_bermasalah"],
  ["salah kirim nih, bukan yang saya pesan", "barang_bermasalah"],
  ["ini penipuan ya, saya lapor", "sengketa"],
  ["kalau kena kucing bahaya nggak?", "keamanan"],
  ["sayurnya aman dimakan nggak setelah disemprot?", "keamanan"],
  ["cabai saya mati setelah disemprot produk ini", "tanaman_rusak"],
  ["saya mau bicara sama cs manusia", "minta_manusia"],
  ["boleh minta nomor whatsapp nya kak?", "luar_marketplace"],

  // --- wajib lolos ---
  ["dosis NPK berapa kak?", null],
  ["cara pakai neem oil gimana?", null],
  // Pelacakan biasa. Sengaja dibiarkan lewat: jawabannya ada di
  // sistem pesanan, bukan di tangan manusia, dan jumlahnya paling
  // banyak dari semua jenis pertanyaan.
  ["paket saya belum sampai kak", null],
  // "layu" tanpa kaitan sebab-akibat dengan produk kami adalah
  // konsultasi tanaman biasa, bukan sengketa.
  ["daun cabai saya layu kenapa ya?", null],
  ["ada garansi nggak kak?", null],
];

let lulus = 0;
const gagal = [];

for (const [pesan, harap] of KASUS) {
  const hasil = matchTemplate(pesan);
  const dapat = hasil ? hasil.code : null;
  if (dapat === harap) lulus++;
  else gagal.push({ pesan, harap, dapat });
}

console.log(`Gerbang 1 — template   : LULUS ${lulus}/${KASUS.length}`);
for (const g of gagal) {
  console.log(
    `  GAGAL  "${g.pesan.slice(0, 55)}"` +
      `\n         dapat: ${g.dapat ?? "AI"} | harap: ${g.harap ?? "AI"}`,
  );
}

let lulusSatpam = 0;
const gagalSatpam = [];

for (const [pesan, harap] of KASUS_SATPAM) {
  const hasil = periksaSatpam(pesan);
  const dapat = hasil ? hasil.kategori : null;
  if (dapat === harap) lulusSatpam++;
  else gagalSatpam.push({ pesan, harap, dapat, cocok: hasil ? hasil.cocok : null });
}

console.log(`Gerbang 0 — satpam     : LULUS ${lulusSatpam}/${KASUS_SATPAM.length}`);
for (const g of gagalSatpam) {
  console.log(
    `  GAGAL  "${g.pesan.slice(0, 55)}"` +
      `\n         dapat: ${g.dapat ?? "LOLOS"}${g.cocok ? ` (cocok: "${g.cocok}")` : ""}` +
      ` | harap: ${g.harap ?? "LOLOS"}`,
  );
}

const total = gagal.length + gagalSatpam.length;
console.log(total ? `\n${total} KASUS GAGAL` : "\nSemua kasus lulus");
process.exit(total ? 1 : 0);
