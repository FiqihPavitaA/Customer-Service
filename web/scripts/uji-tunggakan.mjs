/* ===========================================================
   Aturan tunggakan: chat yang belum dijawab siapa pun.

     npm run uji-tunggakan

   Biaya Rp 0. Tidak ada jaringan, tidak ada Supabase, tidak ada
   Claude — hanya fungsi murni di lib/tunggakan.ts.

   YANG DIJAGA DI SINI

   Dua hal yang gejalanya identik tetapi sebabnya berlawanan:

     salah menganggap SUDAH terjawab  tunggakan hilang dari daftar,
                                      dan pelanggan menunggu selamanya
                                      tanpa seorang pun tahu

     salah menganggap BELUM terjawab  daftar penuh chat yang sudah
                                      beres, lalu berhenti dipercaya

   Yang pertama lebih berbahaya, dan karena itu fungsi belumTerjawab()
   sengaja condong ke sana: role yang tidak dikenal dilewati, bukan
   dianggap balasan.

   Jam dinding diuji terpisah dari jam server. Seluruh kasus di bawah
   menyusun waktunya lewat wib(), yang menulis UTC secara eksplisit —
   bukan getHours(), yang akan menjawab berbeda di laptop developer
   dan di server Vercel.
   =========================================================== */

import {
  AMBANG_PERINGATAN_MENIT,
  belumTerjawab,
  peringatanTunggakan,
  sisaJendelaMenit,
} from "../lib/tunggakan.ts";

let lulus = 0;
let gagal = 0;

function uji(nama, dapat, harap) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  if (sama) {
    lulus++;
    console.log(`  v ${nama}`);
  } else {
    gagal++;
    console.log(`  X ${nama}`);
    console.log(`      harap : ${JSON.stringify(harap)}`);
    console.log(`      dapat : ${JSON.stringify(dapat)}`);
  }
}

/** Jam dinding WIB -> saat UTC yang sesungguhnya. WIB = UTC+7. */
const wib = (jam, menit = 0) => new Date(Date.UTC(2026, 8, 11, jam - 7, menit));

const pesan = (...peran) =>
  peran.map((r, i) => ({ role: r, content: `pesan ${i}`, timestamp: "" }));

/** Keputusan "AI diam karena jadwal", berakhir pada jam tertentu. */
const krnJadwal = (jamBerakhir) => ({
  boleh: false,
  sebab: "jadwal",
  jamBerakhir,
  sampai: null,
});

console.log("\n=== UJI ATURAN TUNGGAKAN (Rp 0) ===\n");

/* -----------------------------------------------------------
   1. Siapa yang bicara terakhir
   ----------------------------------------------------------- */
console.log("1. Peran pesan terakhir\n");

uji("percakapan kosong bukan tunggakan", belumTerjawab([]), false);
uji("pelanggan bicara, belum dibalas", belumTerjawab(pesan("user")), true);
uji("dibalas AI", belumTerjawab(pesan("user", "assistant")), false);
uji("dibalas CS manusia", belumTerjawab(pesan("user", "cs")), false);
uji(
  "dibalas lalu pelanggan bertanya lagi",
  belumTerjawab(pesan("user", "assistant", "user")),
  true,
);
uji(
  "percakapan panjang yang berakhir di CS",
  belumTerjawab(pesan("user", "assistant", "user", "cs")),
  false,
);
uji("hanya ada sapaan dari kita", belumTerjawab(pesan("assistant")), false);

/* Kolom messages bertipe jsonb TANPA CHECK, jadi role apa pun bisa
   masuk — sisa impor lama, atau salah ketik di skrip seed. Yang
   diuji di sini adalah ARAH kesalahannya, bukan sekadar bahwa ia
   tidak jatuh. */
console.log("\n2. Role yang tidak dikenal — condong ke arah yang aman\n");

uji(
  "role asing di akhir tidak menutupi pertanyaan pelanggan",
  belumTerjawab([...pesan("user"), { role: "bot", content: "?", timestamp: "" }]),
  true,
);
uji(
  "role asing di akhir tidak memunculkan tunggakan palsu",
  belumTerjawab([...pesan("user", "cs"), { role: "bot", content: "?", timestamp: "" }]),
  false,
);
uji(
  "seluruhnya role asing bukan tunggakan",
  belumTerjawab([{ role: "bot", content: "?", timestamp: "" }]),
  false,
);
uji(
  "elemen rusak (null) dilewati, bukan menjatuhkan",
  belumTerjawab([null, ...pesan("user")]),
  true,
);

/* -----------------------------------------------------------
   3. Berapa lama lagi jendelanya tutup
   ----------------------------------------------------------- */
console.log("\n3. Sisa jendela, dalam jam WIB\n");

uji("baru mulai kerja: 08.00, tutup 16.00", sisaJendelaMenit(krnJadwal(16), wib(8)), 480);
uji("15.45 -> 15 menit lagi", sisaJendelaMenit(krnJadwal(16), wib(15, 45)), 15);
uji("15.59 -> 1 menit lagi", sisaJendelaMenit(krnJadwal(16), wib(15, 59)), 1);
uji("15.00 -> 60 menit lagi", sisaJendelaMenit(krnJadwal(16), wib(15)), 60);

/* Jendela yang melewati tengah malam. Kalau selisih jamnya dihitung
   tanpa modulo 24, kasus ini menghasilkan angka minus dan seluruh
   peringatan malam hari hilang diam-diam. */
uji(
  "jendela 22.00-06.00, sekarang 23.10",
  sisaJendelaMenit(krnJadwal(6), wib(23, 10)),
  410,
);
uji(
  "jendela 22.00-06.00, sekarang 05.30",
  sisaJendelaMenit(krnJadwal(6), wib(5, 30)),
  30,
);

/* Jam server BUKAN jam WIB. Pukul 15.45 WIB adalah 08.45 UTC; kalau
   ada satu saja getHours() yang lolos, kasus ini akan menjawab
   seolah masih tujuh jam lagi. */
uji(
  "dihitung dari jam WIB, bukan jam UTC",
  sisaJendelaMenit(krnJadwal(16), new Date("2026-09-11T08:45:00Z")),
  15,
);

console.log("\n4. Keadaan yang tidak punya jam berakhir\n");

uji(
  "AI boleh menjawab: tidak ada jendela",
  sisaJendelaMenit({ boleh: true, sebab: "bebas", jamBerakhir: null, sampai: null }, wib(15, 45)),
  null,
);
uji(
  "dimatikan manual: tidak ada jam nyala",
  sisaJendelaMenit(
    { boleh: false, sebab: "saklar-induk", jamBerakhir: null, sampai: null },
    wib(15, 45),
  ),
  null,
);
uji(
  "override punya batas sendiri, bukan jendela jadwal",
  sisaJendelaMenit(
    { boleh: false, sebab: "override", jamBerakhir: 16, sampai: "2026-09-11T12:00:00Z" },
    wib(15, 45),
  ),
  null,
);
uji(
  "sebab jadwal tetapi jamBerakhir hilang",
  sisaJendelaMenit({ boleh: false, sebab: "jadwal", jamBerakhir: null, sampai: null }, wib(15, 45)),
  null,
);

/* -----------------------------------------------------------
   5. Kalimat peringatannya
   ----------------------------------------------------------- */
console.log("\n5. Kapan tim diperingatkan\n");

uji(
  "tidak ada tunggakan: diam saja",
  peringatanTunggakan(krnJadwal(16), 0, wib(15, 45)),
  null,
);
uji(
  "ada tunggakan dan hampir tutup",
  peringatanTunggakan(krnJadwal(16), 3, wib(15, 45)),
  "AI nyala 15 menit lagi · 3 chat belum terjawab",
);
uji(
  "masih lama: belum perlu diganggu",
  peringatanTunggakan(krnJadwal(16), 3, wib(12)),
  null,
);

/* Tepat di ambang. Batas yang dijaga dari DUA sisi — pemeriksaan
   ">" dan ">=" sama-sama lulus kalau hanya satu sisi yang diuji. */
uji(
  `tepat ${AMBANG_PERINGATAN_MENIT} menit: masih diperingatkan`,
  peringatanTunggakan(krnJadwal(16), 2, wib(15, 60 - AMBANG_PERINGATAN_MENIT)),
  `AI nyala ${AMBANG_PERINGATAN_MENIT} menit lagi · 2 chat belum terjawab`,
);
uji(
  `${AMBANG_PERINGATAN_MENIT + 1} menit: belum`,
  peringatanTunggakan(krnJadwal(16), 2, wib(15, 60 - AMBANG_PERINGATAN_MENIT - 1)),
  null,
);

uji(
  "satu menit lagi: tidak berbunyi '1 menit lagi'",
  peringatanTunggakan(krnJadwal(16), 1, wib(15, 59)),
  "AI nyala sebentar lagi · 1 chat belum terjawab",
);
uji(
  "tepat tutup: tidak berbunyi '0 menit lagi'",
  peringatanTunggakan(krnJadwal(16), 1, wib(16)),
  "AI nyala sebentar lagi · 1 chat belum terjawab",
);

uji(
  "AI sedang menyala: tidak ada yang perlu dikejar",
  peringatanTunggakan(
    { boleh: true, sebab: "bebas", jamBerakhir: null, sampai: null },
    9,
    wib(17),
  ),
  null,
);
uji(
  "dimatikan manual: peringatan ini tidak berlaku",
  peringatanTunggakan(
    { boleh: false, sebab: "saklar-induk", jamBerakhir: null, sampai: null },
    9,
    wib(15, 45),
  ),
  null,
);

/* Kalimatnya dibaca sekilas di header, jadi angkanya harus ada di
   dalamnya. Uji ini gagal kalau seseorang menyederhanakannya jadi
   "ada chat belum terjawab". */
const contoh = peringatanTunggakan(krnJadwal(16), 7, wib(15, 50));
uji("kalimatnya menyebut jumlahnya", contoh?.includes("7 chat"), true);
uji("kalimatnya menyebut sisa waktunya", contoh?.includes("10 menit"), true);

console.log(`\n${"-".repeat(52)}`);
console.log(`Aturan tunggakan : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);

if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
