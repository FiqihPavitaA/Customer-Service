/* ===========================================================
   Peraga: dari mana angka 0,675 dan 0,590 itu datang.

     node knowledge-base/peraga-kemiripan.mjs

   BIAYA Rp 0. Tidak ada jaringan sama sekali — vektornya dibaca
   dari supabase/seed-contoh.sql yang sudah ada di repo.

   Berkas ini tidak dipakai aplikasi. Gunanya satu: menunjukkan
   bahwa "skor kemiripan" bukan angka ajaib dari Voyage, melainkan
   satu rumus aritmetika biasa yang bisa dihitung ulang siapa pun.

   Voyage hanya mengubah kalimat jadi 1.024 angka. Yang MEMBANDINGKAN
   angka-angka itu adalah Postgres, dan caranya persis seperti di
   bawah ini.
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------------------------------------------------------------
   1. Rumusnya, pada angka yang bisa dilihat mata
   --------------------------------------------------------------- */

/** Hasil kali titik: jumlahkan perkalian pasangan angka seposisi. */
function kaliTitik(a, b) {
  let jumlah = 0;
  for (let i = 0; i < a.length; i++) jumlah += a[i] * b[i];
  return jumlah;
}

/** Panjang vektor (teorema Pythagoras, diperluas ke n dimensi). */
function panjang(v) {
  return Math.sqrt(kaliTitik(v, v));
}

/**
 * Kemiripan kosinus = kosinus sudut antara dua arah.
 *
 *      A · B
 *   -----------
 *   |A| × |B|
 *
 *    1 = arah sama persis
 *    0 = tegak lurus, sama sekali tidak berhubungan
 *   -1 = arah berlawanan
 *
 * Perhatikan pembaginya: PANJANG vektor dibagi habis, jadi yang
 * dinilai murni ARAH. Kalimat panjang dan kalimat pendek dengan
 * maksud sama tetap bisa berskor tinggi.
 */
function kemiripan(a, b) {
  return kaliTitik(a, b) / (panjang(a) * panjang(b));
}

console.log("=== 1. Rumusnya pada angka kecil ===\n");
console.log("Bayangkan hanya 3 dimensi, bukan 1.024:\n");

const contoh = [
  ["arah sama persis", [1, 2, 3], [1, 2, 3]],
  ["arah sama, panjang beda 10x", [1, 2, 3], [10, 20, 30]],
  ["mirip, sedikit menyimpang", [1, 2, 3], [1, 2, 4]],
  ["tegak lurus", [1, 0, 0], [0, 1, 0]],
  ["berlawanan", [1, 2, 3], [-1, -2, -3]],
];

for (const [nama, a, b] of contoh) {
  console.log(
    `  ${nama.padEnd(28)} ${JSON.stringify(a).padEnd(14)} vs ${JSON.stringify(b).padEnd(16)} = ${kemiripan(a, b).toFixed(3)}`,
  );
}

console.log(
  "\n  Baris kedua penting: panjangnya 10 kali lipat, skornya tetap 1,000.\n" +
    "  Itulah sebabnya yang dipakai kosinus, bukan jarak biasa.\n",
);

/* ---------------------------------------------------------------
   2. Angka sungguhan dari seed-contoh.sql
   --------------------------------------------------------------- */

const sql = readFileSync(join(AKAR, "supabase", "seed-contoh.sql"), "utf8");

/** { teks -> vektor } dari baris VALUES di seed. */
const vektor = new Map();
const kode = new Map();
for (const m of sql.matchAll(
  /^\s*\('((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'\[([^\]]*)\]'/gm,
)) {
  const teks = m[2].replace(/''/g, "'");
  vektor.set(teks, m[3].split(",").map(Number));
  kode.set(teks, m[1].replace(/''/g, "'"));
}

console.log(`=== 2. Vektor sungguhan (${vektor.size} contoh, dari seed) ===\n`);

const semua = [...vektor.keys()];
const dimensi = vektor.get(semua[0]).length;
console.log(`  dimensi tiap vektor : ${dimensi}`);
console.log(`  panjang vektor      : ${panjang(vektor.get(semua[0])).toFixed(6)}`);
console.log(
  "  ^ Voyage sudah menormalkan panjangnya jadi 1, jadi pembagi di\n" +
    "    rumus itu tinggal 1 x 1 dan kemiripan = hasil kali titik saja.\n",
);

/* Ambil satu contoh dan cari tetangga terdekatnya — persis yang
   dikerjakan cari_template(), hanya di JavaScript. */
const ACUAN = "cara pakai POC gimana ya kak?";
if (!vektor.has(ACUAN)) {
  console.error(`Contoh acuan "${ACUAN}" tidak ada di seed.`);
  process.exit(1);
}

const skor = semua
  .filter((t) => t !== ACUAN)
  .map((t) => ({ teks: t, code: kode.get(t), s: kemiripan(vektor.get(ACUAN), vektor.get(t)) }))
  .sort((a, b) => b.s - a.s);

console.log(`  Acuan: "${ACUAN}"  [${kode.get(ACUAN)}]\n`);
console.log("  5 tetangga TERDEKAT:");
for (const x of skor.slice(0, 5)) {
  console.log(`    ${x.s.toFixed(3)}  [${x.code}]  "${x.teks}"`);
}
console.log("\n  3 tetangga TERJAUH:");
for (const x of skor.slice(-3)) {
  console.log(`    ${x.s.toFixed(3)}  [${x.code}]  "${x.teks}"`);
}

/* ---------------------------------------------------------------
   3. Apa yang sebenarnya dijalankan Postgres
   --------------------------------------------------------------- */

console.log(`
=== 3. Yang dijalankan Postgres ===

  schema-vektor.sql berbunyi:

      1 - (e.embedding <=> q) as skor

  <=> adalah operator JARAK kosinus milik pgvector:

      jarak = 1 - kemiripan

  jadi 1 - jarak mengembalikannya jadi kemiripan lagi. Dibalik
  supaya angkanya searah dengan ambang di lib/pengenal.ts: makin
  besar makin yakin. Kalau dipakai jaraknya langsung, ambang
  "lebih besar lebih baik" akan terbalik artinya.

  Perlu diluruskan: komentar di schema-vektor.sql menyebut hasilnya
  "0..1". Sebenarnya -1..1, karena kemiripan kosinus bisa negatif.
  Pada teks hal itu praktis tidak pernah terjadi — dua kalimat
  berbahasa Indonesia hampir tak mungkin berarah berlawanan — tetapi
  batas bawahnya memang bukan nol.

=== 4. Kenapa skor produksi hanya 0,40-0,67 ===

  Angka di bagian 2 di atas tinggi-tinggi (0,8+) karena keduanya
  disematkan sebagai "document". Yang berjalan sungguhan berbeda:

      contoh pertanyaan  -> input_type: "document"
      pesan pelanggan    -> input_type: "query"

  Voyage mengkalibrasi kedua peran itu pada SKALA YANG BERBEDA:

      document vs document   0,80 - 1,00
      query vs document      0,40 - 0,67   <- yang sungguhan

  Kekeliruan membaca dua skala ini pernah membuat ambang dipasang
  0,93 dan Gerbang 2 mati total tanpa satu pun pesan galat: 0 dari
  19 kalimat pernah lolos. Lihat catatan panjang di
  web/lib/pengenal.ts.
`);
