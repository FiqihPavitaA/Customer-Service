/* ===========================================================
   Ukur ambang Gerbang 2 dengan kalimat gaya pelanggan.

     npm run tes-ambang               perkiraan saja, Voyage TIDAK dipanggil
     npm run tes-ambang -- --jalankan benar-benar mengukur

   YANG DIUKUR, DAN KENAPA BUKAN SEKADAR "BENAR ATAU SALAH".

   Yang menentukan bisa-tidaknya Gerbang 2 dipercaya bukan apakah
   template yang benar menang, melainkan SEBERAPA JAUH ia menang.
   Pada katalog ini, pertanyaan berbentuk "cara pakai X" membuat
   produk yang sama sekali berbeda ikut mendapat skor ~0,88 hanya
   karena kerangka kalimatnya sama. Menang tipis di atas lantai
   setinggi itu bukan kemenangan — ia akan berubah jadi kekalahan
   begitu kalimatnya sedikit berbeda.

   Karena itu kolom terpenting di keluaran ini adalah `margin`:
   selisih skor juara terhadap pesaing terdekat yang templatenya
   BERBEDA. Ambang yang benar diturunkan dari sana, bukan dari
   rata-rata skor.

   Kalimat ujinya disaring lebih dulu lewat Gerbang 0 dan Gerbang 1
   supaya yang diukur hanya yang benar-benar sampai ke Gerbang 2 —
   mengukur kalimat yang sudah ditangkap kata kunci hanya membuang
   token dan mengaburkan angkanya.
   =========================================================== */

import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KB = join(AKAR, "knowledge-base");

const { matchTemplate, periksaSatpam, setKbDir } = await import(
  join(KB, "router.js").split("\\").join("/").replace(/^([A-Za-z]):/, "file:///$1:")
);
setKbDir(KB);

/* [kalimat gaya pelanggan, template yang seharusnya menang] */
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

/* ---- Saring: hanya yang sampai Gerbang 2 ---- */
const uji = [];
let ditahan0 = 0;
let kena1 = 0;
for (const [pesan, harap] of KANDIDAT) {
  if (periksaSatpam(pesan)) {
    ditahan0++;
    continue;
  }
  if (matchTemplate(pesan)) {
    kena1++;
    continue;
  }
  uji.push({ pesan, harap });
}

console.log(`Kandidat        : ${KANDIDAT.length}`);
console.log(`  ditahan Gerbang 0 : ${ditahan0}`);
console.log(`  kena Gerbang 1    : ${kena1}`);
console.log(`  diukur di sini    : ${uji.length}`);

const { embed, kiraToken, perkiraanBiaya, VOYAGE_MODEL, voyageSiap, voyageTerkunci } =
  await import("../lib/voyage.ts");

const kira = kiraToken(uji.map((u) => u.pesan));
const biayaKira = perkiraanBiaya(kira);
console.log(`\n--- perkiraan ---`);
console.log(`  model        : ${VOYAGE_MODEL}`);
console.log(`  permintaan   : 1 (semua muat satu batch)`);
console.log(`  token (kira) : ${kira}`);
console.log(`  biaya (kira) : Rp ${biayaKira.idr.toFixed(4)}`);

if (!process.argv.includes("--jalankan")) {
  console.log("\nMODE PERKIRAAN. Voyage tidak dipanggil.");
  console.log("Jalankan sungguhan:  npm run tes-ambang -- --jalankan");
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("\nKredensial Supabase belum diisi di web/.env.local.");
  process.exit(1);
}
const sb = createClient(URL, ANON, { auth: { persistSession: false } });

/* ---- Satu panggilan Voyage untuk semuanya ---- */
console.log("\nMemanggil Voyage...");
const hasil = await embed(
  uji.map((u) => u.pesan),
  "query",
);
const biayaNyata = perkiraanBiaya(hasil.token);
console.log(`  token ditagih : ${hasil.token}`);
console.log(`  biaya nyata   : Rp ${biayaNyata.idr.toFixed(4)}`);

/* ---- Cari kandidat untuk tiap kalimat (Supabase, gratis) ---- */
const baris = [];
for (let i = 0; i < uji.length; i++) {
  const { data, error } = await sb.rpc("cari_template", {
    q: JSON.stringify(hasil.vektor[i]),
    batas: 5,
  });
  if (error) {
    console.error(`  RPC gagal untuk "${uji[i].pesan}": ${error.message}`);
    process.exit(1);
  }
  const k = data ?? [];
  const juara = k[0];
  // Pesaing terdekat yang templatenya BERBEDA dari si juara.
  const penantang = k.find((x) => x.code !== juara?.code);
  const skorHarap = k.find((x) => x.code === uji[i].harap)?.skor ?? null;
  baris.push({
    pesan: uji[i].pesan,
    harap: uji[i].harap,
    juara: juara?.code ?? "-",
    skorJuara: juara?.skor ?? 0,
    penantang: penantang?.code ?? "-",
    skorPenantang: penantang?.skor ?? 0,
    skorHarap,
    benar: juara?.code === uji[i].harap,
  });
}

/* ---- Laporan ---- */
const pad = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t.padEnd(n));
const num = (v) => (v === null ? "  -  " : v.toFixed(3));

console.log(`\n${"pesan".padEnd(40)} ${"juara".padEnd(22)} skor  margin  harap`);
console.log("-".repeat(92));
for (const b of baris) {
  const margin = b.skorJuara - b.skorPenantang;
  const tanda = b.benar ? " " : "✗";
  console.log(
    `${tanda}${pad(b.pesan, 39)} ${pad(b.juara, 22)} ${num(b.skorJuara)} ${
      margin >= 0 ? "+" : ""
    }${margin.toFixed(3)}  ${b.benar ? "" : "harus [" + b.harap + "] " + num(b.skorHarap)}`,
  );
}

const benar = baris.filter((b) => b.benar);
const salah = baris.filter((b) => !b.benar);
console.log("-".repeat(92));
console.log(`Juara benar : ${benar.length}/${baris.length}`);

/* Ambang yang berguna: setinggi mungkin tanpa membuang yang benar,
   tetapi tetap di atas skor tertinggi yang SALAH. */
if (benar.length) {
  const skorBenar = benar.map((b) => b.skorJuara).sort((a, b) => a - b);
  const marginBenar = benar
    .map((b) => b.skorJuara - b.skorPenantang)
    .sort((a, b) => a - b);
  console.log(
    `  skor juara benar : min ${skorBenar[0].toFixed(3)} · median ${skorBenar[
      Math.floor(skorBenar.length / 2)
    ].toFixed(3)} · maks ${skorBenar[skorBenar.length - 1].toFixed(3)}`,
  );
  console.log(
    `  margin ke pesaing: min ${marginBenar[0].toFixed(3)} · median ${marginBenar[
      Math.floor(marginBenar.length / 2)
    ].toFixed(3)}`,
  );
}
if (salah.length) {
  const tertinggiSalah = Math.max(...salah.map((b) => b.skorJuara));
  console.log(`  skor TERTINGGI yang salah : ${tertinggiSalah.toFixed(3)}`);
  console.log(
    `  -> ambang di bawah angka itu akan mengirim jawaban yang salah otomatis.`,
  );
}

const AMBANG = Number(process.env.AMBANG_YAKIN || 0.93);
const lolos = baris.filter((b) => b.skorJuara >= AMBANG);
console.log(
  `\nPada ambang ${AMBANG}: ${lolos.length} dari ${baris.length} akan dijawab otomatis, ` +
    `${lolos.filter((b) => !b.benar).length} di antaranya SALAH.`,
);
