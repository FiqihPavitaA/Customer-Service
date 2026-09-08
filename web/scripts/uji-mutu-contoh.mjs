/* ===========================================================
   Uji pemeriksa mutu contoh pertanyaan (lib/mutuContoh.ts).

     npm run uji-mutu

   Biaya Rp 0, tanpa jaringan.

   KENAPA INI PERLU DIUJI TERSENDIRI

   Seluruh nilai Tahap C bersandar pada satu fungsi: bergayaChat().
   Kalau ia menganggap kalimat rapi sebagai gaya chat, peringatannya
   tidak pernah muncul dan tim CS mengisi 315 contoh yang salah bentuk
   tanpa satu pun tanda. Kalau ia terlalu galak, tiap contoh benar
   ikut ditandai dan peringatannya berhenti dibaca — yang akibatnya
   sama saja.

   Kalimat uji di bawah BUKAN karangan: yang "rapi" diambil apa
   adanya dari 36 contoh bootstrap yang ada sekarang, dan yang
   "pelanggan" dari 19 kalimat pada tes-ambang beserta contoh nyata
   di laporan audit.
   =========================================================== */

const { bergayaChat, periksaContoh, periksaKumpulan, CONTOH_MINIMUM } =
  await import("../lib/mutuContoh.ts");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, catatan = "") {
  if (benar) {
    lulus++;
    console.log(`  v ${nama}`);
  } else {
    gagal++;
    console.log(`  X ${nama}${catatan ? ` — ${catatan}` : ""}`);
  }
}

/* Diambil apa adanya dari contoh bootstrap yang ada sekarang.
   Semuanya HARUS ditandai terlalu rapi — itulah temuan P2 audit. */
const RAPI = [
  "cara pakai neem oil gimana?",
  "dosis NPK berapa kak?",
  "cara pakai TDS meter gimana?",
  "takaran magnesium sulfat berapa?",
  "Bagaimana cara penggunaan produk ini?",
  "cara kalibrasi ulang TDS meter?",
];

/* Gaya pelanggan sungguhan — dari tes-ambang dan laporan audit. */
const PELANGGAN = [
  "nem oilnya dipakenya gmn kak",
  "ppm nutrisi ngitungnya gmn",
  "poc nya gmn makenya kk",
  "dolomit per meter brp ya",
  "em4 dipakenya gmn ya",
  "pelebat tuh paket apa",
  "barangnya blm sampe nih min",
  // Nama produk kapital di tengah kalimat gaya pelanggan.
  // Ditemukan dari pemakaian sungguhan 8 Sep 2026: kalimat ini
  // ditandai "terlalu rapi" hanya karena "POC" kapital.
  "POC cara pke nya gimana",
  "NPK nya brp dosisnya",
];

console.log("\n1. Kalimat rapi HARUS ditandai");
for (const t of RAPI) {
  periksa(`"${t}"`, !bergayaChat(t), "lolos sebagai gaya chat");
}

console.log("\n2. Kalimat pelanggan TIDAK boleh ditandai");
for (const t of PELANGGAN) {
  periksa(`"${t}"`, bergayaChat(t), "salah ditandai terlalu rapi");
}

console.log("\n3. Bentuk yang memang tidak berguna ditolak keras");
const galatKeras = [
  ["", "kosong"],
  ["poc", "satu kata"],
  ["poc, npk, dosis, takaran, cara", "daftar kata kunci menyamar"],
  ["a".repeat(200), "melebihi batas panjang"],
];
for (const [teks, kenapa] of galatKeras) {
  const ada = periksaContoh(teks).some((c) => c.berat === "galat");
  periksa(`${kenapa}`, ada, "tidak ditolak");
}

console.log("\n4. Kalimat pelanggan yang benar TIDAK ditolak");
for (const t of PELANGGAN) {
  const ada = periksaContoh(t).some((c) => c.berat === "galat");
  periksa(`"${t}" diterima`, !ada, "ditolak padahal benar");
}

console.log("\n5. Penilaian kumpulan");
const kosong = periksaKumpulan([]);
periksa("kumpulan kosong ditandai galat", kosong.catatan.some((c) => c.berat === "galat"));
periksa("kumpulan kosong tidak dianggap cukup", !kosong.cukup);

const kurang = periksaKumpulan(PELANGGAN.slice(0, 2));
periksa(
  `${2} contoh belum cukup (butuh ${CONTOH_MINIMUM})`,
  !kurang.cukup && kurang.catatan.some((c) => c.berat === "peringatan"),
);

const cukup = periksaKumpulan(PELANGGAN.slice(0, 4));
periksa("4 contoh gaya pelanggan dianggap cukup", cukup.cukup);
periksa("dan diakui bergaya chat", cukup.adaGayaChat);

const semuaRapi = periksaKumpulan(RAPI.slice(0, 3));
periksa(
  "kumpulan yang semuanya rapi diperingatkan",
  !semuaRapi.adaGayaChat &&
    semuaRapi.catatan.some((c) => c.berat === "peringatan"),
);

console.log(`\n${"-".repeat(52)}`);
console.log(`Mutu contoh : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) process.exit(1);
console.log("\nSemua kasus lulus");
