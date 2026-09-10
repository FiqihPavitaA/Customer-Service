/* ===========================================================
   Uji aturan pencocokan pencarian (lib/cocok.ts).

     npm run uji-cari

   Biaya Rp 0, tanpa jaringan.

   KENAPA INI PERLU DIUJI TERSENDIRI

   Kalau pencocokan meleset, tidak ada yang rusak di layar. Yang
   muncul adalah "tidak ada percakapan yang cocok" — kalimat yang
   terbaca sebagai JAWABAN, bukan sebagai kegagalan. CS akan
   menyimpulkan pesanannya memang tidak ada, lalu memberi tahu
   pelanggan begitu.

   Kegagalan yang menyamar sebagai jawaban tidak pernah dilaporkan
   siapa pun, dan karena itu tidak pernah diperbaiki.
   =========================================================== */

const { cocokKata, normalkan } = await import("../lib/cocok.ts");

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

const NOMOR = "260909KMTPRWX";

console.log("\n1. Nomor pesanan apa adanya");
periksa("nomor persis", cocokKata(NOMOR, NOMOR));
periksa("huruf kecil", cocokKata(NOMOR, "260909kmtprwx"));
periksa("sebagian nomor", cocokKata(NOMOR, "KMTPRWX"));
periksa("di tengah teks lain", cocokKata(`Pesanan #${NOMOR} sudah dikirim`, NOMOR));

console.log("\n2. Nomor yang ditempel bersama tanda baca");
/* Bentuk-bentuk nyata yang sampai ke CS: disalin dari layar
   marketplace, dari tangkapan layar, atau diketik ulang. */
const TEMPELAN = [
  ["#260909KMTPRWX", "dengan pagar"],
  ["Pesanan: 260909KMTPRWX", "berlabel"],
  ["260909-KMTPRWX", "bertanda hubung"],
  ["260909 KMTPRWX", "berspasi"],
  ["  260909KMTPRWX  ", "berspasi di ujung"],
  ["No. 260909/KMTPRWX", "bergaris miring"],
];
for (const [kunci, kenapa] of TEMPELAN) {
  periksa(`${kenapa}: "${kunci}"`, cocokKata(NOMOR, kunci));
}

console.log("\n3. Nama pembeli");
periksa("nama penuh", cocokKata("budi.santoso", "budi"));
periksa("beda huruf besar-kecil", cocokKata("Budi Santoso", "budi santoso"));
periksa("nama bertitik dicari berspasi", cocokKata("budi.santoso", "budi santoso"));
periksa("sebagian belakang", cocokKata("rina.kusuma", "kusuma"));

/* Normalisasi TIDAK boleh dipakai sendirian. Kalau begitu, "budi
   santoso" jadi "budisantoso" dan ikut mencocoki "budisantosoputra"
   — melebar diam-diam, dan baru terlihat saat ada dua pelanggan
   bernama mirip. Perilaku yang benar: pencocokan apa adanya dulu. */
console.log("\n4. Yang TIDAK boleh cocok");
periksa("nama lain", !cocokKata("budi.santoso", "siti"));
periksa("nomor lain", !cocokKata(NOMOR, "260909ZZZZZZZ"));
periksa("nomor yang mirip tapi beda", !cocokKata(NOMOR, "260909KMTPRWY"));
periksa(
  "potongan yang tidak ada",
  !cocokKata("agus.pratama", "wulandari"),
);

console.log("\n5. Kata kunci kosong tidak menyembunyikan apa pun");
periksa("kosong -> cocok", cocokKata("apa saja", ""));
periksa("spasi saja -> cocok", cocokKata("apa saja", "   "));
periksa("tanda baca saja -> cocok", cocokKata("apa saja", "###"), "tanda baca dianggap kunci");

console.log("\n6. normalkan()");
periksa('"#260909-KMT" -> "260909kmt"', normalkan("#260909-KMT") === "260909kmt");
periksa("string kosong -> kosong", normalkan("") === "");
periksa("hanya tanda baca -> kosong", normalkan("#-/. ") === "");
periksa("emoji dibuang", normalkan("budi 🌱 santoso") === "budisantoso");

console.log("\n7. Lingkup 'semua' — tiap bidang dicoba SATU PER SATU");
/* Bukan digabung jadi satu teks. Kalau digabung, nilai bidangnya
   berhenti berbentuk nomor dan tahap 3 mati diam-diam — kasus
   "Pesanan: ..." di bawah yang membuktikannya. */
const BIDANG = [
  "yoga.pratama",
  "260909KMTPRWX",
  "JX4718290365",
  "kak resi pesanan saya sudah dikirim belum",
];
const semua = (kunci) => BIDANG.some((b) => cocokKata(b, kunci));

periksa("ketemu lewat nama", semua("yoga"));
periksa("ketemu lewat nomor pesanan", semua("#260909KMTPRWX"));
periksa("ketemu lewat nomor berlabel", semua("Pesanan: 260909KMTPRWX"));
periksa("ketemu lewat resi", semua("JX4718290365"));
periksa("ketemu lewat isi chat", semua("sudah dikirim"));
periksa("tidak ketemu yang bukan miliknya", !semua("sari.wulandari"));

/* Bukti bahwa penggabungan MEMATIKAN tahap 3. Kalau suatu saat ada
   yang menyederhanakannya jadi satu teks, kasus ini yang gagal. */
const digabung = BIDANG.join(" ");
periksa(
  "digabung -> nomor berlabel TIDAK ketemu (alasan bidang dipisah)",
  !cocokKata(digabung, "Pesanan: 260909KMTPRWX"),
);

console.log(`\n${"-".repeat(52)}`);
console.log(`Pencocokan cari : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) process.exit(1);
console.log("\nSemua kasus lulus");
