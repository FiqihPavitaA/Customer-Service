/* ===========================================================
   Uji penghitung angka nyata Beranda & Statistik
   (lib/db/ringkasan.ts).

     npm run uji-ringkasan

   Biaya Rp 0, tanpa jaringan, tanpa database.

   KENAPA INI PERLU DIUJI TERSENDIRI

   Angka dasbor tidak punya cara memberi tahu bahwa dirinya salah.
   Kalau hitungan handover meleset, tidak ada yang meledak — layar
   hanya menampilkan angka lain yang sama-sama masuk akal, dan
   keputusan menambah orang jaga diambil dari angka itu.

   Bug yang justru memicu berkas ini dibuat bukan salah hitung,
   melainkan `HOME_REALTIME.perluHandover + open`: tetapan demo
   dijumlahkan dengan hitungan sungguhan. Uji apa pun atas fungsi
   penghitungnya akan lulus; yang salah adalah pemakainya. Karena
   itu kasus terakhir di bawah menguji sifat yang tidak boleh
   dilanggar — hasil untuk kumpulan kosong harus benar-benar nol,
   supaya tidak ada godaan menambalnya dengan angka contoh.
   =========================================================== */

/* Dua sumber, karena tiap fungsi tinggal di sebelah data yang
   dipakainya: hitungAntrean butuh menitMenunggu (lib/handover.ts),
   sisanya butuh ACTION_ORDER (lib/db/analytics.ts). Keduanya hanya
   memakai `import type` ke dalam, yang dihapus penuh oleh
   penanggal tipe — itulah syarat sebuah modul bisa dijalankan
   langsung oleh Node tanpa bundler. */
const { hitungAntrean } = await import("../lib/handover.ts");
const { hitungTindakan, totalTindakan, persenHandover, awalRentang } = await import(
  "../lib/db/analytics.ts"
);

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

const SEMENIT = 60 * 1000;
const SEJAM = 60 * SEMENIT;
const SEHARI = 24 * SEJAM;

const ACUAN = new Date("2026-09-09T14:00:00+07:00");
const dari = (ms) => new Date(ACUAN.getTime() + ms).toISOString();

const esk = (status, selisihMs) => ({
  id: Math.random().toString(36).slice(2),
  conversation_id: "c1",
  reason: null,
  status,
  assigned_to: null,
  created_at: dari(selisihMs),
});

console.log("\n1. hitungAntrean — hanya yang berstatus open");
const antrean = hitungAntrean(
  [{ unread: true }, { unread: false }, { unread: true }],
  [
    esk("open", -5 * SEMENIT),
    esk("open", -42 * SEMENIT),
    esk("resolved", -3 * SEHARI),
  ],
  ACUAN,
);
periksa("2 terbuka, yang resolved tidak dihitung", antrean.terbuka === 2, `dapat ${antrean.terbuka}`);
periksa("belum dibaca dihitung terpisah", antrean.belumDibaca === 2);

/* Yang TERTUA, bukan rata-rata. Rata-rata dari 5 dan 42 menit
   adalah 23 — angka yang menenangkan padahal ada kasus yang sudah
   melanggar batas 15 menit hampir tiga kali lipat. */
periksa(
  "tertua 42 menit, bukan rata-rata 23",
  antrean.tertuaMenit === 42,
  `dapat ${antrean.tertuaMenit}`,
);
periksa(
  "eskalasi resolved tidak ikut menaikkan yang tertua",
  antrean.tertuaMenit < 60,
  "3 hari yang resolved ikut terhitung",
);

const kosong = hitungAntrean([], [], ACUAN);
periksa("kumpulan kosong -> 0 terbuka", kosong.terbuka === 0);
periksa("kumpulan kosong -> 0 menit, bukan NaN", kosong.tertuaMenit === 0);

console.log("\n2. hitungTindakan — rentang waktu dipatuhi");
const pesan = (action, selisihMs) => ({ action, last_message_at: dari(selisihMs) });
const rows = [
  pesan("AUTO_REPLY", -1 * SEJAM),
  pesan("AUTO_REPLY", -2 * SEJAM),
  pesan("HANDOVER_TO_CS", -3 * SEJAM),
  pesan("ASK_INFORMATION", -4 * SEJAM),
  // Di luar rentang 7 hari:
  pesan("AUTO_REPLY", -10 * SEHARI),
  pesan("HANDOVER_TO_CS", -10 * SEHARI),
  // Belum ada keputusan atasnya:
  pesan(null, -1 * SEJAM),
];

const tujuhHari = hitungTindakan(rows, new Date(ACUAN.getTime() - 7 * SEHARI));
periksa("AUTO_REPLY dalam 7 hari = 2", tujuhHari.AUTO_REPLY === 2, `dapat ${tujuhHari.AUTO_REPLY}`);
periksa("HANDOVER dalam 7 hari = 1", tujuhHari.HANDOVER_TO_CS === 1);
periksa("total 7 hari = 4, yang 10 hari lalu tidak ikut", totalTindakan(tujuhHari) === 4);

/* Percakapan tanpa action tidak boleh dipaksa masuk salah satu
   dari empat kotak — itu mengarang keputusan yang belum pernah
   dibuat. */
periksa(
  "baris tanpa action tidak dihitung ke mana pun",
  totalTindakan(tujuhHari) === 4,
  "baris null ikut terhitung",
);

const tigaPuluh = hitungTindakan(rows, new Date(ACUAN.getTime() - 30 * SEHARI));
periksa("rentang 30 hari menangkap yang 10 hari lalu", totalTindakan(tigaPuluh) === 6);

periksa(
  "keempat klasifikasi selalu ada walau nol",
  tujuhHari.CHECK_ORDER_SYSTEM === 0 && "CHECK_ORDER_SYSTEM" in tujuhHari,
);

periksa(
  "stempel rusak dilewati, tidak melempar",
  totalTindakan(
    hitungTindakan([{ action: "AUTO_REPLY", last_message_at: "entah" }], new Date(0)),
  ) === 0,
);

console.log("\n3. persenHandover — nol berbeda dari belum ada data");
periksa('kumpulan kosong -> "—", bukan "0,0%"', persenHandover(hitungTindakan([], new Date(0))) === "—");
periksa("1 dari 4 -> 25,0%", persenHandover(tujuhHari) === "25,0%", persenHandover(tujuhHari));
periksa(
  "tanpa handover -> 0,0% (sudah diukur, hasilnya nol)",
  persenHandover(hitungTindakan([pesan("AUTO_REPLY", 0)], new Date(0))) === "0,0%",
);
periksa("pemisah desimal koma, bukan titik", !persenHandover(tujuhHari).includes("."));

console.log("\n4. awalRentang");
/* "Hari ini" berarti sejak tengah malam, BUKAN 24 jam ke belakang.
   Pukul 09.00, selisihnya adalah seluruh sore kemarin — dan angka
   yang memasukkan chat kemarin tidak akan pernah cocok dengan
   laporan harian tim. */
const awalHariIni = awalRentang("today", ACUAN);
periksa("today -> tengah malam setempat", awalHariIni.getHours() === 0 && awalHariIni.getMinutes() === 0);
periksa(
  "today BUKAN 24 jam ke belakang",
  ACUAN.getTime() - awalHariIni.getTime() < 24 * SEJAM,
);
periksa(
  "7d -> tepat 7 x 24 jam",
  ACUAN.getTime() - awalRentang("7d", ACUAN).getTime() === 7 * SEHARI,
);
periksa(
  "30d -> tepat 30 x 24 jam",
  ACUAN.getTime() - awalRentang("30d", ACUAN).getTime() === 30 * SEHARI,
);

console.log(`\n${"-".repeat(52)}`);
console.log(`Ringkasan dasbor : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) process.exit(1);
console.log("\nSemua kasus lulus");
