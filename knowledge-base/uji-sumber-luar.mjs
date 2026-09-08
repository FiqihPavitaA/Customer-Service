/* ===========================================================
   Uji lapisan "sumber luar" — pustaka & aturan dari tabel Supabase.

     node knowledge-base/uji-sumber-luar.mjs

   Biaya Rp 0. Tidak ada jaringan sama sekali: barisnya dibuat di
   berkas ini, persis berbentuk keluaran public.pustaka_router().

   KENAPA UJI INI ADA TERSENDIRI

   Sampai 8 September 2026 router hanya punya satu sumber, dan
   router.test.mjs menguji sumber itu. Lapisan baru menambah jalan
   kedua yang MENANG atas jalan pertama — dan kegagalannya bukan
   berupa galat, melainkan berupa jawaban yang salah sumber. Itu
   bentuk kerusakan yang tidak akan tertangkap 48 kasus yang sudah
   ada, karena semuanya berjalan pada sumber berkas.

   Yang dijaga di sini ada lima, dan tiap satunya pernah jadi cara
   sistem seperti ini gagal diam-diam:

     1. tabel menang atas berkas
     2. tabel kosong -> KEMBALI ke berkas, bukan diam
     3. pola rusak membuang SATU aturan, bukan seluruh pencocok
     4. urutan aturan ditegakkan dari priority, bukan dari urutan
        baris yang kebetulan datang
     5. bersihkanSumberLuar() benar-benar memulihkan keadaan semula
   =========================================================== */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KB = dirname(fileURLToPath(import.meta.url));
const {
  bersihkanSumberLuar,
  getAsalKode,
  getSumberAktif,
  getTemplateLibrary,
  getPustakaBerkas,
  jumlahAturan,
  matchTemplate,
  setKbDir,
  setSumberLuar,
} = await import(join(KB, "router.js").split("\\").join("/").replace(/^([A-Za-z]):/, "file:///$1:"));

setKbDir(KB);

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

/* Kode yang sengaja TIDAK ada di berkas .md mana pun, supaya
   kemenangannya tidak bisa datang dari berkas secara kebetulan. */
const KODE_UJI = "UJI SUMBER LUAR";

const BARIS = [
  {
    code: KODE_UJI,
    body: "Ini jawaban dari TABEL.",
    action: "AUTO_REPLY",
    category_slug: "produk",
    priority: 10,
    when_patterns: ["\\bkata kunci hanya di tabel\\b"],
    also_pattern: null,
    unless_patterns: null,
    flags: "i",
    why: "Uji otomatis.",
  },
  {
    // Template tanpa pemicu: teksnya tetap harus terbawa, karena
    // Gerbang 2 (Voyage) membutuhkannya walau Gerbang 1 tidak.
    code: "UJI TANPA PEMICU",
    body: "Tidak punya aturan, tapi tetap ada teksnya.",
    action: "AUTO_REPLY",
    category_slug: "umum",
    priority: null,
    when_patterns: null,
    also_pattern: null,
    unless_patterns: null,
    flags: "i",
    why: null,
  },
];

/* ---------------------------------------------------------------
   0. Keadaan awal
   --------------------------------------------------------------- */
console.log("\n0. Keadaan awal");
const jumlahBerkas = getPustakaBerkas().size;
const aturanBerkas = jumlahAturan();
periksa('sumber awal "berkas"', getSumberAktif() === "berkas", getSumberAktif());
periksa(
  "pustaka berkas terbaca",
  jumlahBerkas > 100,
  `hanya ${jumlahBerkas} entri`,
);
periksa(
  `kode [${KODE_UJI}] memang belum ada di berkas`,
  !getPustakaBerkas().has(KODE_UJI),
);

/* ---------------------------------------------------------------
   1. Tabel menang atas berkas
   --------------------------------------------------------------- */
console.log("\n1. Tabel menang atas berkas");
const hasil = setSumberLuar(BARIS);
periksa('sumber berubah jadi "supabase"', getSumberAktif() === "supabase");
periksa("dua template terbaca", hasil.templates === 2, `dapat ${hasil.templates}`);
periksa("satu aturan terbaca", hasil.aturan === 1, `dapat ${hasil.aturan}`);
periksa("tidak ada aturan yang ditolak", hasil.ditolak.length === 0);

const cocok = matchTemplate("kata kunci hanya di tabel");
periksa("pesan tertangkap aturan dari tabel", cocok?.code === KODE_UJI, String(cocok?.code));
periksa("teks balasannya datang dari tabel", cocok?.reply === "Ini jawaban dari TABEL.");

periksa(
  "template tanpa pemicu tetap masuk pustaka",
  getTemplateLibrary().get("UJI TANPA PEMICU") ===
    "Tidak punya aturan, tapi tetap ada teksnya.",
);
periksa(
  "kategori tabel dipetakan ke berkas padanannya",
  getAsalKode().get(KODE_UJI) === "faq-produk.md",
  String(getAsalKode().get(KODE_UJI)),
);

/* Aturan lama TIDAK boleh ikut berlaku saat tabel dipakai — kalau
   ikut, sumbernya bercampur dan tidak ada yang bisa menjelaskan
   template mana yang sebenarnya sedang menjawab. */
periksa(
  "aturan berkas tidak lagi dipakai",
  matchTemplate("dosis npk berapa kak") === null,
  "aturan berkas masih menangkap saat tabel aktif",
);
periksa("jumlahAturan mengikuti tabel", jumlahAturan() === 1, String(jumlahAturan()));

/* ---------------------------------------------------------------
   2. Pola rusak membuang satu aturan saja
   --------------------------------------------------------------- */
console.log("\n2. Pola rusak dibuang, sisanya tetap jalan");
const rusak = setSumberLuar([
  ...BARIS,
  {
    code: "UJI POLA RUSAK",
    body: "Tidak akan pernah terpakai.",
    action: "AUTO_REPLY",
    category_slug: "umum",
    priority: 5,
    // Kurung yang tidak ditutup — new RegExp() akan melempar.
    when_patterns: ["\\b(belum ditutup\\b"],
    also_pattern: null,
    unless_patterns: null,
    flags: "i",
    why: "Uji otomatis.",
  },
]);
periksa("aturan rusak ditolak", rusak.ditolak.length === 1, JSON.stringify(rusak.ditolak));
periksa("aturan sehat tetap terpasang", rusak.aturan === 1, `dapat ${rusak.aturan}`);
periksa(
  "pencocok tetap hidup",
  matchTemplate("kata kunci hanya di tabel")?.code === KODE_UJI,
);

/* ---------------------------------------------------------------
   3. Urutan ditegakkan dari priority, bukan urutan baris
   --------------------------------------------------------------- */
console.log("\n3. Urutan dari priority, bukan urutan baris");
const dua = (kode, prioritas) => ({
  code: kode,
  body: `Jawaban ${kode}.`,
  action: "AUTO_REPLY",
  category_slug: "umum",
  priority: prioritas,
  when_patterns: ["\\bdirebut siapa\\b"],
  also_pattern: null,
  unless_patterns: null,
  flags: "i",
  why: "Uji otomatis.",
});
// Sengaja dikirim terbalik: yang priority-nya besar ditaruh duluan.
setSumberLuar([dua("UJI BELAKANG", 99), dua("UJI DEPAN", 1)]);
periksa(
  "priority terkecil yang menang",
  matchTemplate("direbut siapa")?.code === "UJI DEPAN",
  String(matchTemplate("direbut siapa")?.code),
);

/* ---------------------------------------------------------------
   4. Tabel kosong -> kembali ke berkas
   --------------------------------------------------------------- */
console.log("\n4. Tabel kosong kembali ke berkas");
setSumberLuar([]);
periksa('sumber kembali "berkas"', getSumberAktif() === "berkas", getSumberAktif());
periksa(
  "aturan berkas hidup lagi",
  matchTemplate("dosis npk berapa kak")?.code === "CARA PAKAI NPK",
  String(matchTemplate("dosis npk berapa kak")?.code),
);

/* ---------------------------------------------------------------
   5. Pemulihan penuh
   --------------------------------------------------------------- */
console.log("\n5. bersihkanSumberLuar memulihkan keadaan semula");
setSumberLuar(BARIS);
bersihkanSumberLuar();
periksa('sumber "berkas"', getSumberAktif() === "berkas");
periksa(
  "jumlah template kembali seperti semula",
  getTemplateLibrary().size === jumlahBerkas,
  `${getTemplateLibrary().size} vs ${jumlahBerkas}`,
);
periksa(
  "jumlah aturan kembali seperti semula",
  jumlahAturan() === aturanBerkas,
  `${jumlahAturan()} vs ${aturanBerkas}`,
);
periksa(
  "kode uji sudah tidak ada lagi",
  !getTemplateLibrary().has(KODE_UJI),
);

/* --------------------------------------------------------------- */
console.log(`\n${"-".repeat(52)}`);
console.log(`Sumber luar : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
