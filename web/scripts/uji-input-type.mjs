/* ===========================================================
   Mana yang lebih baik: query<->document, atau query<->query?

     npm run uji-input-type               perkiraan saja, Rp 0
     npm run uji-input-type -- --jalankan BERBAYAR, 2 panggilan

   PERTANYAAN YANG DIJAWAB

   Contoh pertanyaan yang tersimpan disematkan sebagai "document",
   pesan pelanggan sebagai "query". Penanda itu dirancang untuk
   pencarian ASIMETRIS: pertanyaan pendek dicocokkan ke paragraf
   panjang berisi jawaban.

   Tetapi yang kita simpan bukan paragraf jawaban — melainkan CONTOH
   PERTANYAAN. Bentuknya sama dengan pesan yang masuk. Itu tugas
   simetris, dan pilihan "document" jadi layak dipertanyakan.

   YANG DIUKUR, DAN YANG SENGAJA TIDAK

   Bukan tinggi skornya. Skala query<->query hampir pasti
   menghasilkan angka lebih besar, dan angka lebih besar TIDAK berarti
   lebih baik: menaikkan semua skor bersamaan tidak menambah
   informasi apa pun.

   Yang menentukan dua hal:
     1. berapa juara yang BENAR
     2. seberapa jauh juara meninggalkan pesaing dari template lain

   Nomor 2 yang paling menentukan, karena itulah syarat yang dipakai
   lib/pengenal.ts (AMBANG_MARGIN). Skala yang skornya tinggi tapi
   berdempetan justru lebih buruk daripada skala rendah yang renggang.

   TIDAK MENYENTUH SUPABASE. Vektor "document" dibaca dari
   supabase/seed-contoh.sql yang sudah ada; yang baru hanya dihitung
   di memori lalu dibuang. Hasilnya laporan, bukan perubahan data.
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KB = join(AKAR, "knowledge-base");

/* ---------------- 1. Contoh tersimpan + vektor "document" ---------------- */

const sql = readFileSync(join(AKAR, "supabase", "seed-contoh.sql"), "utf8");

/** @type {{code:string, teks:string, dok:number[]}[]} */
const contoh = [];
for (const m of sql.matchAll(
  /^\s*\('((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'\[([^\]]*)\]'/gm,
)) {
  contoh.push({
    code: m[1].replace(/''/g, "'"),
    teks: m[2].replace(/''/g, "'"),
    dok: m[3].split(",").map(Number),
  });
}

if (contoh.length === 0) {
  console.error("Tidak ada contoh terbaca dari seed-contoh.sql.");
  process.exit(1);
}

/* ---------------- 2. Kalimat uji yang benar-benar sampai Gerbang 2 -------- */

const r = await import(pathToFileURL(join(KB, "router.js")).href);
r.setKbDir(KB);

/* Daftar yang sama dengan tes-ambang.mjs, supaya angkanya bisa
   dibandingkan dengan pengukuran 8 September. */
const KANDIDAT = [
  ["npk nya brp dosisnya kk", "CARA PAKAI NPK"],
  ["em4 dipakenya gmn ya", "CARA PAKAI EM4"],
  ["magnesium sulfat takarannya brp", "MAGNESIUM"],
  ["guano cara pakenya gmn kak", "PAKAI GUANO"],
  ["dolomit per meter brp ya", "DOLOMIT"],
  ["asam amino nya gmn cara pakenya", "CARA PAKAI ASAM AMINO"],
  ["nutripod gmn kak makenya", "NUTRIPOD"],
  ["cocopeat nya dipake gmn", "COCOPEAT"],
  ["soil meter cara pakenya gmn", "SOIL METER"],
  ["tds meter gmn makenya kk", "CARA PAKAI TDS METER"],
  ["ph meter nya gmn ya pakenya", "CARA PAKAI PH METER"],
  ["tds meter nya cara kalibrasi ulang gmn", "CARA KALIBRASI ULANG TDS METER"],
  ["kalibrasi ph meter gmn caranya kak", "CARA KALIBRASI ULANG PH METER"],
  ["ppm nutrisi ngitungnya gmn", "HITUNG PPM TDS"],
  ["b1 nya brp dosisnya", "PAKAI B1"],
  ["vitamin akar makenya gmn", "VITAMIN AKAR"],
  ["hormon akar buat stek brp", "PAKAI AKAR"],
  ["fruit expert gmn pakenya", "PAKAI FRUITEXPERT"],
  ["ab mix instan gmn cara nya", "PAKAI ABMC"],
  ["bivi dosisnya brp kak", "BIVI"],
  ["petrogenol gmn makenya", "ATRAKTAN PETROGENOL"],
  ["groot buat cangkok gmn caranya", "CANGKOK"],
  ["miracle powder dipakenya gmn", "MIRACLE POWDER"],
  ["miracle powder tuh apaan", "PRODUK MIRACLE"],
  ["poc nya gmn makenya kk", "PAKAI POC"],
  ["ab mix brp dosis nya", "PAKAI ABMB"],
  ["nem oilnya dipakenya gmn kak", "PAKAI NEEM"],
  ["guano brp harganya", "HARGA"],
  ["poc itu produk apa sih kak", "PRODUK POC"],
  ["akar ini fungsinya buat apa", "PRODUK AKAR"],
  ["pestisidanya gunanya apa", "PRODUK PESTISIDA"],
  ["seed booster manfaat nya apa ya", "PRODUK SEEDBOOSTER"],
  ["pelebat tuh paket apa", "PRODUK PELEBAT"],
  ["halooo", "BANTU"],
  ["mksh kak", "TQ"],
  ["dosis npk buat cabe brp kak", "CARA PAKAI NPK"],
  ["neem oil takarannya brapa ya", "PAKAI NEEM"],
  ["cara nya pake cocopeat gmn sih", "COCOPEAT"],
];

const uji = [];
for (const [pesan, harap] of KANDIDAT) {
  if (r.periksaSatpam(pesan)) continue;
  if (r.matchTemplate(pesan)) continue;
  uji.push({ pesan, harap });
}

console.log(`contoh tersimpan : ${contoh.length}`);
console.log(`kandidat uji     : ${KANDIDAT.length}`);
console.log(`sampai Gerbang 2 : ${uji.length}`);

/* ---------------- 3. Perkiraan biaya ---------------- */

const { embed, kiraToken, perkiraanBiaya, VOYAGE_MODEL, voyageSiap, voyageTerkunci } =
  await import("../lib/voyage.ts");

const tokenKira = kiraToken(contoh.map((c) => c.teks)) + kiraToken(uji.map((u) => u.pesan));
const biayaKira = perkiraanBiaya(tokenKira);

console.log(`\n--- perkiraan ---`);
console.log(`  model        : ${VOYAGE_MODEL}`);
console.log(`  panggilan    : 2`);
console.log(`  token (kira) : ${tokenKira}`);
console.log(`  biaya (kira) : Rp ${biayaKira.idr.toFixed(4)}`);

if (!process.argv.includes("--jalankan")) {
  console.log("\nMODE PERKIRAAN. Voyage tidak dipanggil.");
  console.log("Jalankan sungguhan:  npm run uji-input-type -- --jalankan");
  process.exit(0);
}
if (voyageTerkunci()) {
  console.error("\nAI_TEST_LOCK/VOYAGE_LOCK aktif — ditolak.");
  process.exit(1);
}
if (!voyageSiap()) {
  console.error("\nVOYAGE_API_KEY belum diisi.");
  process.exit(1);
}

/* ---------------- 4. Dua panggilan Voyage ---------------- */

console.log("\nMemanggil Voyage (1/2) — contoh tersimpan sebagai \"query\"...");
const hasilContoh = await embed(
  contoh.map((c) => c.teks),
  "query",
  { ulangSaatPadat: true },
);
contoh.forEach((c, i) => {
  c.qry = hasilContoh.vektor[i];
});

console.log("Memanggil Voyage (2/2) — kalimat uji sebagai \"query\"...");
const hasilUji = await embed(
  uji.map((u) => u.pesan),
  "query",
  { ulangSaatPadat: true },
);

const tokenNyata = hasilContoh.token + hasilUji.token;
const biayaNyata = perkiraanBiaya(tokenNyata);
console.log(`\n  token ditagih : ${tokenNyata}`);
console.log(`  biaya nyata   : Rp ${biayaNyata.idr.toFixed(4)}`);

/* ---------------- 5. Hitung kedua susunan ---------------- */

const kali = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const norma = (v) => Math.sqrt(kali(v, v));
const mirip = (a, b) => kali(a, b) / (norma(a) * norma(b));

/**
 * @param {"dok"|"qry"} sisi vektor mana yang dipakai untuk contoh
 * @returns ringkasan satu susunan
 */
function nilai(sisi) {
  const baris = uji.map((u, i) => {
    const q = hasilUji.vektor[i];
    const skor = contoh
      .map((c) => ({ code: c.code, teks: c.teks, s: mirip(q, c[sisi]) }))
      .sort((a, b) => b.s - a.s);

    const juara = skor[0];
    const penantang = skor.find((x) => x.code !== juara.code);
    return {
      pesan: u.pesan,
      harap: u.harap,
      juara: juara.code,
      skor: juara.s,
      margin: juara.s - (penantang?.s ?? 0),
      benar: juara.code === u.harap,
    };
  });

  const benar = baris.filter((b) => b.benar);
  const salah = baris.filter((b) => !b.benar);
  const urut = (a) => [...a].sort((x, y) => x - y);
  const median = (a) => (a.length ? urut(a)[Math.floor(a.length / 2)] : 0);

  const marginBenar = benar.map((b) => b.margin);
  const marginSalah = salah.map((b) => b.margin);

  return {
    baris,
    benar: benar.length,
    total: baris.length,
    skorMin: Math.min(...baris.map((b) => b.skor)),
    skorMaks: Math.max(...baris.map((b) => b.skor)),
    marginBenarMin: marginBenar.length ? Math.min(...marginBenar) : 0,
    marginBenarMedian: median(marginBenar),
    marginSalahMaks: marginSalah.length ? Math.max(...marginSalah) : 0,
    /* Inilah angka yang benar-benar menentukan: jarak antara margin
       terkecil yang BENAR dan margin terbesar yang SALAH. Positif
       berarti ada ambang yang memisahkan keduanya sempurna; negatif
       berarti tidak ada ambang margin yang bisa dipakai tanpa salah. */
    celah: (marginBenar.length ? Math.min(...marginBenar) : 0) -
      (marginSalah.length ? Math.max(...marginSalah) : 0),
  };
}

const A = nilai("dok"); // query <-> document  (yang berjalan sekarang)
const B = nilai("qry"); // query <-> query     (usulan)

/* ---------------- 6. Laporan ---------------- */

const p = (n) => n.toFixed(3);
console.log(`\n${"=".repeat(74)}`);
console.log("PERBANDINGAN");
console.log("=".repeat(74));
console.log(
  `${"".padEnd(34)} ${"query<->document".padEnd(18)} query<->query`,
);
console.log("-".repeat(74));
const baris = (nama, a, b) =>
  console.log(`${nama.padEnd(34)} ${String(a).padEnd(18)} ${b}`);

baris("juara benar", `${A.benar}/${A.total}`, `${B.benar}/${B.total}`);
baris("skor juara (min - maks)", `${p(A.skorMin)} - ${p(A.skorMaks)}`, `${p(B.skorMin)} - ${p(B.skorMaks)}`);
baris("margin BENAR terkecil", p(A.marginBenarMin), p(B.marginBenarMin));
baris("margin BENAR median", p(A.marginBenarMedian), p(B.marginBenarMedian));
baris("margin SALAH terbesar", p(A.marginSalahMaks), p(B.marginSalahMaks));
baris("CELAH (benar min - salah maks)", p(A.celah), p(B.celah));

console.log(
  "\nCELAH adalah angka penentunya. Positif = ada ambang margin yang\n" +
    "memisahkan benar dan salah dengan sempurna; makin besar makin\n" +
    "longgar. Negatif = tidak ada ambang yang bisa dipakai tanpa\n" +
    "meloloskan jawaban yang salah.",
);

/* Rincian per kalimat, supaya kesimpulannya bisa diperiksa ulang. */
console.log(`\n${"-".repeat(96)}`);
console.log(
  `${"pesan".padEnd(38)} ${"A: q<->dok".padEnd(28)} B: q<->q`,
);
console.log("-".repeat(96));
for (let i = 0; i < uji.length; i++) {
  const a = A.baris[i];
  const b = B.baris[i];
  const f = (x) =>
    `${x.benar ? " " : "✗"}[${x.juara}] ${p(x.skor)}/${p(x.margin)}`;
  console.log(
    `${a.pesan.slice(0, 37).padEnd(38)} ${f(a).slice(0, 27).padEnd(28)} ${f(b)}`,
  );
}
console.log("-".repeat(96));
console.log("Bentuk kolom: [juara] skor/margin. Tanda ✗ = juara salah.");
