/* ===========================================================
   Uji lapisan "sumber tabel" untuk Gerbang 0.

     node knowledge-base/uji-satpam-sumber.mjs

   Biaya Rp 0. Tidak ada jaringan sama sekali: barisnya dibuat di
   berkas ini, persis berbentuk keluaran public.satpam_router().

   KENAPA UJI INI ADA TERSENDIRI

   uji-satpam-seed.mjs membuktikan ISI seed benar. Berkas ini
   membuktikan MEKANISME pemasangannya benar — dua hal yang
   berbeda, dan yang kedua punya cara gagal yang tidak akan
   tertangkap yang pertama.

   Gerbang 0 berbeda dari Lapis 1 dalam satu hal yang menentukan
   seluruh isi berkas ini: ia tidak punya sumber cadangan yang
   setara. Templates yang gagal dibaca masih punya berkas .md;
   satpam yang gagal dibaca hanya punya daftar di kode. Kalau
   lapisan ini salah menangani kegagalan, akibatnya bukan "jawaban
   dari sumber yang salah" melainkan "tidak ada pengaman sama
   sekali" — dan gejalanya tidak terlihat sampai ada pelanggan
   yang permintaan refundnya dijawab mesin.

   Yang dijaga di sini ada tujuh:

     1. tabel menang atas daftar di kode
     2. tabel kosong -> KEMBALI ke kode secara UTUH
     3. pola rusak membuang SATU aturan, bukan seluruh pengaman
     4. SELURUH pola rusak -> kembali ke kode, bukan tanpa aturan
     5. urutan ditegakkan dari priority, bukan urutan baris
     6. also/unless dari tabel benar-benar berlaku
     7. bersihkanSatpamLuar() memulihkan keadaan semula
   =========================================================== */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KB = dirname(fileURLToPath(import.meta.url));
const {
  bersihkanSatpamLuar,
  getKategoriSatpam,
  getSumberSatpam,
  jumlahSatpam,
  periksaSatpam,
  setKbDir,
  setSatpamLuar,
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

/** Bentuk baris persis seperti keluaran public.satpam_router(). */
const baris = (kategori, priority, when, extra = {}) => ({
  kategori,
  priority,
  when_patterns: when,
  also_pattern: null,
  unless_patterns: null,
  flags: "i",
  why: `uji ${kategori}`,
  ...extra,
});

const kategoriDari = (pesan) => periksaSatpam(pesan)?.kategori ?? null;

/* --------------------------------------------------------------- */
console.log("\n=== UJI SUMBER TABEL GERBANG 0 (tanpa jaringan, Rp 0) ===\n");

console.log("Keadaan awal — daftar di kode");
const aturanKode = jumlahSatpam();
const kategoriKode = getKategoriSatpam().length;
periksa('sumber "kode"', getSumberSatpam() === "kode");
periksa("ada aturan bawaan", aturanKode > 0, `${aturanKode} aturan`);
periksa("refund tertangkap", kategoriDari("mau refund dong") === "refund_retur");
periksa(
  '"chat penjual" memang belum tertangkap',
  kategoriDari("saya mau chat penjual") === null,
  "inilah lubang yang dilaporkan tim CS 10 Sep 2026",
);

/* --------------------------------------------------------------- */
console.log("\n1. Tabel menang atas daftar di kode");
{
  // Tabel SENGAJA dibuat sempit: hanya satu aturan, dan kategorinya
  // tidak ada di kode. Kalau daftar kode diam-diam masih ikut
  // dinilai, "mau refund dong" akan tetap tertangkap — dan itulah
  // yang dibuktikan TIDAK terjadi di sini.
  const hasil = setSatpamLuar([baris("uji_kanal", 10, [String.raw`\bkata rahasia\b`])]);
  periksa('sumber jadi "supabase"', getSumberSatpam() === "supabase");
  periksa("hanya 1 aturan berlaku", jumlahSatpam() === 1, `${jumlahSatpam()} aturan`);
  periksa("hasil melaporkan 1 aturan", hasil.aturan === 1);
  periksa("aturan tabel menangkap", kategoriDari("ini kata rahasia") === "uji_kanal");
  periksa(
    "daftar kode BENAR-BENAR diabaikan",
    kategoriDari("mau refund dong") === null,
    "kalau tertangkap, dua sumber sedang berjalan bersamaan",
  );
  periksa(
    "getKategoriSatpam ikut sumber tabel",
    getKategoriSatpam().length === 1 && getKategoriSatpam()[0].kategori === "uji_kanal",
  );
}

/* --------------------------------------------------------------- */
console.log("\n2. Tabel kosong -> kembali ke kode secara UTUH");
{
  const hasil = setSatpamLuar([]);
  periksa('sumber kembali "kode"', getSumberSatpam() === "kode");
  periksa("jumlah aturan kembali seperti semula", jumlahSatpam() === aturanKode);
  periksa("jumlah kategori kembali seperti semula", getKategoriSatpam().length === kategoriKode);
  periksa("refund tertangkap lagi", kategoriDari("mau refund dong") === "refund_retur");
  periksa("hasil melaporkan 0 aturan tabel", hasil.aturan === 0);

  // null dan undefined juga bisa datang dari pemanggil yang gagal.
  setSatpamLuar(null);
  periksa("null diperlakukan sama dengan kosong", getSumberSatpam() === "kode");
  setSatpamLuar(undefined);
  periksa("undefined diperlakukan sama dengan kosong", getSumberSatpam() === "kode");
}

/* --------------------------------------------------------------- */
console.log("\n3. Pola rusak membuang SATU aturan, bukan seluruh pengaman");
{
  const hasil = setSatpamLuar([
    baris("uji_baik", 10, [String.raw`\bkata aman\b`]),
    baris("uji_rusak", 20, ["(((belum ditutup"]),
    baris("uji_baik2", 30, [String.raw`\bkata kedua\b`]),
  ]);
  periksa("dua aturan selamat", hasil.aturan === 2, `${hasil.aturan} aturan`);
  periksa("satu aturan dibuang", hasil.ditolak.length === 1, hasil.ditolak.join("; "));
  periksa("sebabnya disebutkan", /uji_rusak/.test(hasil.ditolak[0] ?? ""));
  periksa("aturan sebelum yang rusak tetap jalan", kategoriDari("ini kata aman") === "uji_baik");
  periksa("aturan sesudah yang rusak tetap jalan", kategoriDari("ini kata kedua") === "uji_baik2");
  periksa('masih memakai tabel', getSumberSatpam() === "supabase");
}

/* --------------------------------------------------------------- */
console.log("\n4. SELURUH pola rusak -> kembali ke kode, bukan tanpa aturan");
{
  // Inilah kasus yang paling berbahaya dan paling mudah salah
  // ditangani: tabelnya TIDAK kosong, jadi jalur "tabel kosong" di
  // atas tidak menolong. Kalau seluruh isinya ditolak dan kodenya
  // naif, Gerbang 0 berjalan dengan nol aturan — diam, tanpa galat,
  // dan setiap permintaan refund mulai dijawab mesin.
  const hasil = setSatpamLuar([
    baris("rusak_satu", 10, ["(((", "[belum"]),
    baris("rusak_dua", 20, ["*bukan pola"]),
  ]);
  periksa('sumber kembali "kode"', getSumberSatpam() === "kode");
  periksa("aturan bawaan berlaku lagi", jumlahSatpam() === aturanKode, `${jumlahSatpam()} aturan`);
  periksa(
    "refund TETAP tertangkap",
    kategoriDari("mau refund dong") === "refund_retur",
    "ini yang menahan pesan berbahaya saat tabel kacau",
  );
  periksa("keracunan TETAP tertangkap", kategoriDari("apa ini bisa keracunan") === "keamanan");
  periksa("yang ditolak tetap dilaporkan", hasil.ditolak.length === 2, hasil.ditolak.join("; "));
}

/* --------------------------------------------------------------- */
console.log("\n5. Urutan ditegakkan dari priority, bukan urutan baris");
{
  // Dikirim TERBALIK dengan sengaja. Pesan di bawah cocok dengan
  // kedua aturan; yang dilaporkan harus yang priority-nya kecil.
  setSatpamLuar([
    baris("belakangan", 90, [String.raw`\bsengketa\b`]),
    baris("duluan", 10, [String.raw`\bsengketa\b`]),
  ]);
  periksa(
    "priority kecil menang walau barisnya datang belakangan",
    kategoriDari("ada sengketa nih") === "duluan",
    `dapat: ${kategoriDari("ada sengketa nih")}`,
  );
}

/* --------------------------------------------------------------- */
console.log("\n6. also & unless dari tabel benar-benar berlaku");
{
  setSatpamLuar([
    baris("butuh_also", 10, [String.raw`\blayu\b`], {
      also_pattern: String.raw`\bsetelah (di)?(pakai|semprot)\b`,
    }),
    baris("ada_unless", 20, [String.raw`\bkirim\b`], {
      unless_patterns: [String.raw`\bongkos kirim\b`],
    }),
  ]);
  periksa("also terpenuhi -> tercegat", kategoriDari("daunnya layu setelah disemprot") === "butuh_also");
  periksa("also tidak terpenuhi -> lolos", kategoriDari("daunnya layu kenapa ya") === null);
  // "dikirim" sengaja TIDAK dipakai di sini: \bkirim\b tidak cocok
  // dengan kata berawalan, dan kasus itu menguji batas kata, bukan
  // unless. Mencampur keduanya membuat kegagalan sulit dibaca.
  periksa("unless tidak kena -> tercegat", kategoriDari("tolong kirim cepat") === "ada_unless");
  periksa("unless kena -> dibatalkan", kategoriDari("ongkos kirim berapa") === null);
}

/* --------------------------------------------------------------- */
console.log("\n7. bersihkanSatpamLuar() memulihkan keadaan semula");
{
  bersihkanSatpamLuar();
  periksa('sumber "kode"', getSumberSatpam() === "kode");
  periksa("jumlah aturan sama seperti awal", jumlahSatpam() === aturanKode);
  periksa("jumlah kategori sama seperti awal", getKategoriSatpam().length === kategoriKode);
  periksa("kategori uji sudah tidak ada", !getKategoriSatpam().some((k) => k.kategori.startsWith("uji_")));
  periksa("refund tertangkap", kategoriDari("mau refund dong") === "refund_retur");
  periksa("minta manusia tertangkap", kategoriDari("mau bicara dengan cs") === "minta_manusia");
}

/* --------------------------------------------------------------- */
console.log(`\n${"-".repeat(52)}`);
console.log(`Sumber satpam : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
