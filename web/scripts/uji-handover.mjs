/* ===========================================================
   Uji aturan jeda AI setelah handover (lib/handover.ts).

     npm run uji-handover

   Biaya Rp 0, tanpa jaringan, tanpa database.

   KENAPA INI PERLU DIUJI TERSENDIRI

   Yang dijaga fungsi-fungsi ini bukan tampilan, melainkan aturan
   "AI tidak boleh menjawab pelanggan yang sedang ditangani manusia".
   Kalau sedangDijeda() salah menjawab `false`, tidak ada yang
   meledak dan tidak ada galat di layar — AI hanya menyela CS di
   tengah kasus refund, dan baru ketahuan dari keluhan pelanggan
   berminggu-minggu kemudian.

   Kasus tepi di bawah bukan karangan. Semuanya bentuk nyata yang
   bisa keluar dari kolom timestamptz: null (belum pernah
   dialihkan), stempel lewat, stempel dengan offset WIB, stempel
   dengan offset Z, dan nilai rusak.
   =========================================================== */

const {
  JAM_JEDA_BAWAAN,
  hitungJedaSampai,
  sedangDijeda,
  sisaJedaMs,
  teksSisaJeda,
  menitMenunggu,
} = await import("../lib/handover.ts");

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

/* Titik acuan tetap, supaya hasilnya sama kapan pun uji dijalankan. */
const ACUAN = new Date("2026-09-09T14:00:00+07:00");
const dari = (ms) => new Date(ACUAN.getTime() + ms).toISOString();

console.log("\n1. Lama jeda bawaan");
periksa("bawaannya 24 jam", JAM_JEDA_BAWAAN === 24, `dapat ${JAM_JEDA_BAWAAN}`);

const jeda24 = hitungJedaSampai(JAM_JEDA_BAWAAN, ACUAN);
periksa(
  "hitungJedaSampai() memajukan tepat 24 jam",
  Date.parse(jeda24) - ACUAN.getTime() === 24 * SEJAM,
);
periksa(
  "lama jeda bisa ditentukan pemanggil (1 jam)",
  Date.parse(hitungJedaSampai(1, ACUAN)) - ACUAN.getTime() === SEJAM,
);

console.log("\n2. sedangDijeda — inti pengamannya");
periksa("batas di masa depan -> masih dijeda", sedangDijeda(dari(SEJAM), ACUAN));
periksa("batas sudah lewat -> tidak dijeda", !sedangDijeda(dari(-SEJAM), ACUAN));
periksa("null -> tidak dijeda", !sedangDijeda(null, ACUAN));
periksa("undefined -> tidak dijeda", !sedangDijeda(undefined, ACUAN));
periksa("string kosong -> tidak dijeda", !sedangDijeda("", ACUAN));

/* Nilai rusak sengaja diperlakukan sebagai TIDAK dijeda. Kalau
   sebaliknya, satu kolom kotor akan membisukan AI di percakapan itu
   selamanya — dan tidak ada layar yang menunjukkannya. */
periksa("stempel rusak -> tidak dijeda", !sedangDijeda("bukan tanggal", ACUAN));

/* Date.parse("99999") TIDAK gagal — JavaScript membacanya sebagai
   tahun 99999. Tanpa batas kewajaran, satu nilai sampah di kolom
   membisukan AI di percakapan itu selama sembilan puluh ribu tahun,
   tanpa galat dan tanpa tanda apa pun di layar. Kasus ini yang
   menemukannya. */
periksa("angka acak dibaca sebagai tahun -> tidak dijeda", !sedangDijeda("99999", ACUAN));
periksa(
  "tahun 9999 yang sah bentuknya -> tetap tidak dijeda",
  !sedangDijeda("9999-01-01T00:00:00Z", ACUAN),
);
periksa("31 hari ke depan -> di luar batas wajar", !sedangDijeda(dari(31 * 24 * SEJAM), ACUAN));
periksa("29 hari ke depan -> masih diterima", sedangDijeda(dari(29 * 24 * SEJAM), ACUAN));

/* Batas persis: jeda sampai jam 14.00, sekarang jam 14.00. Sisa nol
   berarti sudah berakhir — bukan masih berlaku sedetik lagi. */
periksa("tepat di batas -> sudah berakhir", !sedangDijeda(dari(0), ACUAN));
periksa("semilidetik sebelum batas -> masih dijeda", sedangDijeda(dari(1), ACUAN));

console.log("\n3. Zona waktu tidak boleh mengubah hasil");
/* Stempel yang sama, ditulis dua cara. Supabase mengembalikan Z;
   seed dan data lama memakai +07:00. Keduanya harus sama artinya. */
const wib = "2026-09-09T20:00:00+07:00";
const utc = "2026-09-09T13:00:00Z";
periksa(
  "+07:00 dan Z yang menunjuk saat sama diperlakukan sama",
  sisaJedaMs(wib, ACUAN) === sisaJedaMs(utc, ACUAN),
  `${sisaJedaMs(wib, ACUAN)} vs ${sisaJedaMs(utc, ACUAN)}`,
);
periksa("keduanya masih dijeda (6 jam lagi)", sedangDijeda(utc, ACUAN));

console.log("\n4. Sisa jeda dalam bahasa manusia");
const kasusTeks = [
  [30 * SEMENIT, "30 menit lagi"],
  [SEJAM, "1 jam lagi"],
  [SEJAM + 30 * SEMENIT, "1 jam 30 menit lagi"],
  [24 * SEJAM, "24 jam lagi"],
  [-SEJAM, "jeda berakhir"],
];
for (const [selisih, harap] of kasusTeks) {
  const dapat = teksSisaJeda(dari(selisih), ACUAN);
  periksa(`"${harap}"`, dapat === harap, `dapat "${dapat}"`);
}
periksa("null -> 'jeda berakhir'", teksSisaJeda(null, ACUAN) === "jeda berakhir");

/* Pembulatan ke atas: sisa 1 milidetik tetap "1 menit lagi", bukan
   "0 menit lagi". Angka nol pada sesuatu yang masih berlaku membuat
   CS mengira jedanya sudah lewat. */
periksa(
  "sisa 1 milidetik tidak pernah tampil 0 menit",
  teksSisaJeda(dari(1), ACUAN) === "1 menit lagi",
  teksSisaJeda(dari(1), ACUAN),
);

console.log("\n5. menitMenunggu — arahnya berlawanan, jangan tertukar");
periksa("30 menit lalu -> 30", menitMenunggu(dari(-30 * SEMENIT), ACUAN) === 30);
periksa("2 jam lalu -> 120", menitMenunggu(dari(-2 * SEJAM), ACUAN) === 120);
periksa("baru saja -> 0", menitMenunggu(dari(0), ACUAN) === 0);
/* Masa depan tidak masuk akal untuk "sudah menunggu berapa lama",
   dan angka negatif akan mengurutkan antrean terbalik. */
periksa("stempel masa depan -> 0, bukan negatif", menitMenunggu(dari(SEJAM), ACUAN) === 0);
periksa("null -> 0", menitMenunggu(null, ACUAN) === 0);
periksa("stempel rusak -> 0", menitMenunggu("entah", ACUAN) === 0);

console.log(`\n${"-".repeat(52)}`);
console.log(`Jeda handover : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) process.exit(1);
console.log("\nSemua kasus lulus");
