/* ===========================================================
   Uji aturan "kapan AI boleh menjawab" (lib/jadwalAi.ts).

     npm run uji-jadwal-ai

   Biaya Rp 0, tanpa jaringan, tanpa database.

   KENAPA INI PERLU DIUJI KETAT

   Yang diputuskan fungsi ini bukan tampilan, melainkan apakah
   seorang pelanggan menerima balasan. Salahnya tidak pernah muncul
   sebagai galat, dan dua arah salahnya sama-sama mahal:

     terlalu longgar - AI menyela CS sepanjang jam kerja. Persis
                       keluhan yang membuat fitur ini diminta.
     terlalu ketat   - pelanggan tidak dijawab semalaman. Yang
                       terlihat cuma persentase balas cepat yang
                       turun beberapa hari kemudian, dan tidak ada
                       yang menghubungkannya dengan jadwal.

   Tiga hal yang paling mungkin salah dan masing-masing punya
   bagiannya sendiri di bawah:

     1. zona waktu  — server UTC, tim CS berpikir WIB
     2. tengah malam — jendela 22:00-06:00 tidak bisa dihitung
                       dengan jam >= mulai && jam < selesai
     3. nilai rusak  — yang bisa membisukan AI selamanya
   =========================================================== */

const { putusanAI, teksKeadaanAI, jamWib, hariWib, WIB_OFFSET_MENIT } =
  await import("../lib/jadwalAi.ts");

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

/** Pengaturan bawaan: jadwal mati, AI bebas menjawab. */
const DASAR = {
  ai_enabled: true,
  ai_jadwal_aktif: false,
  ai_jam_mulai: 8,
  ai_jam_selesai: 16,
  ai_hari: [1, 2, 3, 4, 5],
  ai_override_sampai: null,
  ai_override_nyala: true,
};

const atur = (ubah) => ({ ...DASAR, ...ubah });

/* Tanggal acuan ditulis dengan offset +07:00 EKSPLISIT, bukan
   "2026-09-09T14:00:00" polos. Tanpa offset, Date() membacanya
   sebagai waktu lokal mesin penguji — dan uji zona waktu yang
   hasilnya bergantung zona waktu mesin penguji tidak membuktikan
   apa pun.

   2026-09-09 adalah hari RABU. */
const rabu = (jamWibTeks) => new Date(`2026-09-09T${jamWibTeks}+07:00`);

console.log("\n=== UJI JADWAL AI (Rp 0, tanpa jaringan) ===\n");

/* --------------------------------------------------------------- */
console.log("1. Jam dinding WIB, bukan jam server");
{
  periksa("offset WIB = 420 menit", WIB_OFFSET_MENIT === 420);

  // Saat yang SAMA, ditulis dua cara. Supabase mengembalikan Z;
  // data lama memakai +07:00. Keduanya wajib berarti jam WIB yang
  // sama — inilah kesalahan tujuh jam yang paling mudah terjadi.
  periksa("09:00 WIB dibaca sebagai jam 9", jamWib(rabu("09:00:00")) === 9);
  periksa(
    "02:00 UTC juga dibaca sebagai jam 9 WIB",
    jamWib(new Date("2026-09-09T02:00:00Z")) === 9,
    `dapat ${jamWib(new Date("2026-09-09T02:00:00Z"))}`,
  );
  periksa(
    "23:30 WIB masih hari yang sama, bukan besok",
    jamWib(rabu("23:30:00")) === 23 && hariWib(rabu("23:30:00")) === 3,
  );
  // 2026-09-09 23:00 WIB = 16:00 UTC. Kalau harinya dihitung dari
  // UTC, hasilnya tetap Rabu — jadi kasus yang benar-benar menguji
  // adalah jam yang MELEWATI batas hari saat digeser.
  periksa(
    "00:30 WIB Kamis bukan Rabu (17:30 UTC Rabu)",
    hariWib(new Date("2026-09-09T17:30:00Z")) === 4,
    `dapat ${hariWib(new Date("2026-09-09T17:30:00Z"))}`,
  );
  periksa("Minggu bernomor 7, bukan 0", hariWib(new Date("2026-09-13T10:00:00+07:00")) === 7);
}

/* --------------------------------------------------------------- */
console.log("\n2. Jadwal mati = perilaku seperti sebelum fitur ini ada");
{
  const k = putusanAI(DASAR, rabu("10:00:00"));
  periksa("AI boleh menjawab", k.boleh === true);
  periksa("sebabnya 'bebas'", k.sebab === "bebas");
  periksa(
    "tidak menjanjikan jam berhenti",
    k.jamBerakhir === null,
    "jadwal mati, jadi tidak ada jam yang bisa disebut",
  );
}

/* --------------------------------------------------------------- */
console.log("\n3. Jendela jam kerja biasa (08:00-16:00, Senin-Jumat)");
{
  const s = atur({ ai_jadwal_aktif: true });

  periksa("07:59 — masih menjawab", putusanAI(s, rabu("07:59:00")).boleh === true);
  periksa("08:00 — mulai diam", putusanAI(s, rabu("08:00:00")).boleh === false);
  periksa("12:00 — diam", putusanAI(s, rabu("12:00:00")).boleh === false);
  periksa("15:59 — masih diam", putusanAI(s, rabu("15:59:00")).boleh === false);
  periksa(
    "16:00 — kembali menjawab",
    putusanAI(s, rabu("16:00:00")).boleh === true,
    "jam selesai bersifat eksklusif: jam 16 sudah di luar jendela",
  );
  periksa("23:00 — menjawab", putusanAI(s, rabu("23:00:00")).boleh === true);

  const siang = putusanAI(s, rabu("12:00:00"));
  periksa("sebabnya 'jadwal'", siang.sebab === "jadwal");
  periksa("menyebut jam nyala kembali", siang.jamBerakhir === 16);

  const pagi = putusanAI(s, rabu("07:00:00"));
  periksa("saat bebas, menyebut kapan akan diam", pagi.jamBerakhir === 8);
}

/* --------------------------------------------------------------- */
console.log("\n4. Hari — akhir pekan tidak ikut jadwal");
{
  const s = atur({ ai_jadwal_aktif: true });
  const sabtu = new Date("2026-09-12T12:00:00+07:00");
  const minggu = new Date("2026-09-13T12:00:00+07:00");

  periksa("Sabtu siang — AI tetap menjawab", putusanAI(s, sabtu).boleh === true);
  periksa("Minggu siang — AI tetap menjawab", putusanAI(s, minggu).boleh === true);
  periksa(
    "Sabtu tidak menjanjikan jam diam",
    putusanAI(s, sabtu).jamBerakhir === null,
    "jadwal tidak berlaku hari itu, jadi tidak ada yang bisa dijanjikan",
  );

  // Jadwal yang memasukkan Sabtu.
  const s7 = atur({ ai_jadwal_aktif: true, ai_hari: [1, 2, 3, 4, 5, 6] });
  periksa("Sabtu ikut bila dimasukkan", putusanAI(s7, sabtu).boleh === false);
}

/* --------------------------------------------------------------- */
console.log("\n5. Jendela yang MELEWATI TENGAH MALAM (22:00-06:00)");
{
  // Ini yang paling mudah salah. `jam >= 22 && jam < 6` tidak pernah
  // benar untuk jam mana pun, jadi jadwal malam akan diam-diam tidak
  // pernah berlaku — tanpa galat, tanpa tanda.
  const s = atur({ ai_jadwal_aktif: true, ai_jam_mulai: 22, ai_jam_selesai: 6 });

  periksa("21:59 Rabu — menjawab", putusanAI(s, rabu("21:59:00")).boleh === true);
  periksa("22:00 Rabu — diam", putusanAI(s, rabu("22:00:00")).boleh === false);
  periksa("23:59 Rabu — diam", putusanAI(s, rabu("23:59:00")).boleh === false);

  // Sisi setelah tengah malam: hari yang dicocokkan adalah hari saat
  // jendela DIMULAI, bukan hari berjalan.
  const kamisDini = new Date("2026-09-10T02:00:00+07:00");
  periksa("02:00 Kamis — masih di dalam jendela Rabu malam", putusanAI(s, kamisDini).boleh === false);
  periksa("06:00 Kamis — kembali menjawab", putusanAI(s, new Date("2026-09-10T06:00:00+07:00")).boleh === true);

  // Sabtu dini hari BUKAN bagian dari jendela mana pun: jendela
  // Jumat malam memang berlaku (Jumat ada di hari aktif), jadi ia
  // TETAP diam — yang harus dibuktikan adalah Minggu dini hari,
  // yang jendelanya dimulai Sabtu dan Sabtu tidak aktif.
  const mingguDini = new Date("2026-09-13T02:00:00+07:00");
  periksa(
    "02:00 Minggu — menjawab, karena jendelanya milik Sabtu yang tidak aktif",
    putusanAI(s, mingguDini).boleh === true,
  );
  const sabtuDini = new Date("2026-09-12T02:00:00+07:00");
  periksa(
    "02:00 Sabtu — diam, karena jendelanya milik Jumat yang aktif",
    putusanAI(s, sabtuDini).boleh === false,
  );
}

/* --------------------------------------------------------------- */
console.log("\n6. Saklar induk ai_enabled");
{
  const mati = atur({ ai_enabled: false });
  const k = putusanAI(mati, rabu("22:00:00"));
  periksa("AI mati walau di luar jam kerja", k.boleh === false);
  periksa("sebabnya 'saklar-induk'", k.sebab === "saklar-induk");
  periksa(
    "tidak menjanjikan jam nyala",
    k.jamBerakhir === null,
    "dimatikan manual tidak berakhir sendiri — itu memang risikonya",
  );
}

/* --------------------------------------------------------------- */
console.log("\n7. Override menyimpang dari jadwal, DUA ARAH");
{
  const s = atur({ ai_jadwal_aktif: true });

  // Menyalakan di tengah jam kerja — CS pulang cepat.
  const nyala = { ...s, ai_override_sampai: "2026-09-09T16:00:00+07:00", ai_override_nyala: true };
  const kNyala = putusanAI(nyala, rabu("14:00:00"));
  periksa("override MENYALAKAN di tengah jam kerja", kNyala.boleh === true);
  periksa("sebabnya 'override'", kNyala.sebab === "override");
  periksa("menyebut sampai jam berapa", kNyala.jamBerakhir === 16);

  // Mematikan di luar jam kerja — CS lembur.
  const diam = { ...s, ai_override_sampai: "2026-09-09T22:00:00+07:00", ai_override_nyala: false };
  periksa("override MEMATIKAN di luar jam kerja", putusanAI(diam, rabu("19:00:00")).boleh === false);

  // Override yang sudah lewat tidak boleh berbekas.
  const lewat = { ...s, ai_override_sampai: "2026-09-09T10:00:00+07:00", ai_override_nyala: true };
  periksa(
    "override kedaluwarsa diabaikan, jadwal kembali berlaku",
    putusanAI(lewat, rabu("14:00:00")).boleh === false,
  );
  periksa("sebabnya kembali 'jadwal'", putusanAI(lewat, rabu("14:00:00")).sebab === "jadwal");

  periksa(
    "override mengalahkan saklar induk",
    putusanAI(
      { ...s, ai_enabled: false, ai_override_sampai: "2026-09-09T16:00:00+07:00", ai_override_nyala: true },
      rabu("14:00:00"),
    ).boleh === true,
    "kalau kalah, ia bukan override — hanya tombol yang kadang bekerja",
  );
}

/* --------------------------------------------------------------- */
console.log("\n8. Nilai rusak — yang bisa membisukan AI selamanya");
{
  const s = atur({ ai_jadwal_aktif: true });
  const siang = rabu("12:00:00");

  // Inilah alasan utama bagian ini ada. Date.parse("99999") terbaca
  // sebagai TAHUN 99999, bukan sebagai kegagalan.
  periksa(
    "override bertahun 99999 diabaikan, bukan berlaku selamanya",
    putusanAI({ ...s, ai_override_sampai: "99999", ai_override_nyala: false }, siang).sebab ===
      "jadwal",
  );
  periksa(
    "override berisi teks sampah diabaikan",
    putusanAI({ ...s, ai_override_sampai: "besok pagi", ai_override_nyala: false }, siang).sebab ===
      "jadwal",
  );

  // Jam yang sama = nol jam atau dua puluh empat jam; tidak ada cara
  // memilih di antaranya, jadi jadwalnya diabaikan — TIDAK ditebak
  // sebagai "mati sepanjang hari".
  periksa(
    "jam mulai = jam selesai -> jadwal diabaikan, AI menjawab",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_jam_mulai: 0, ai_jam_selesai: 0 }), siang).boleh ===
      true,
  );
  periksa(
    "jam di luar 0-23 -> jadwal diabaikan",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_jam_mulai: 8, ai_jam_selesai: 24 }), siang).boleh ===
      true,
  );
  periksa(
    "jam pecahan -> jadwal diabaikan",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_jam_mulai: 8.5, ai_jam_selesai: 16 }), siang)
      .boleh === true,
  );
  periksa(
    "daftar hari kosong -> jadwal diabaikan",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_hari: [] }), siang).boleh === true,
  );
  periksa(
    "hari bernilai 0 (bukan ISO) -> jadwal diabaikan",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_hari: [0, 1, 2] }), siang).boleh === true,
  );
  periksa(
    "ai_hari bukan array -> jadwal diabaikan",
    putusanAI(atur({ ai_jadwal_aktif: true, ai_hari: null }), siang).boleh === true,
  );

  // Arah salah yang dipilih: nilai rusak berarti AI MENJAWAB.
  // Sebaliknya — nilai rusak membisukan AI — adalah kegagalan yang
  // tidak terlihat sampai berhari-hari kemudian.
  periksa(
    "seluruh nilai rusak berarti AI TETAP MENJAWAB, bukan diam",
    [
      { ai_jam_mulai: 99, ai_jam_selesai: -1 },
      { ai_hari: ["senin"] },
      { ai_jam_mulai: null, ai_jam_selesai: null },
    ].every((rusak) => putusanAI(atur({ ai_jadwal_aktif: true, ...rusak }), siang).boleh === true),
  );
}

/* --------------------------------------------------------------- */
console.log("\n9. Kalimat untuk header");
{
  const s = atur({ ai_jadwal_aktif: true });
  periksa(
    "jam kerja menyebut jam nyala",
    teksKeadaanAI(putusanAI(s, rabu("12:00:00"))) === "AI mati · jam kerja, nyala 16.00",
    teksKeadaanAI(putusanAI(s, rabu("12:00:00"))),
  );
  periksa(
    "di luar jam kerja menyebut kapan akan diam",
    teksKeadaanAI(putusanAI(s, rabu("07:00:00"))) === "AI aktif · diam mulai 08.00",
    teksKeadaanAI(putusanAI(s, rabu("07:00:00"))),
  );
  periksa(
    "tanpa jadwal cukup 'AI aktif'",
    teksKeadaanAI(putusanAI(DASAR, rabu("12:00:00"))) === "AI aktif",
  );
  periksa(
    "saklar induk disebut manual, bukan jadwal",
    teksKeadaanAI(putusanAI(atur({ ai_enabled: false }), rabu("12:00:00"))) ===
      "AI mati · dimatikan manual",
  );
  periksa(
    "override disebut sementara",
    teksKeadaanAI(
      putusanAI(
        { ...s, ai_override_sampai: "2026-09-09T16:00:00+07:00", ai_override_nyala: true },
        rabu("14:00:00"),
      ),
    ) === "AI aktif · sementara, sampai 16.00",
  );

  // Kalimatnya dipakai di layar yang dipasang supaya tim bisa
  // memantau keadaan. Tidak boleh ada keadaan yang menghasilkan
  // kalimat kosong atau "undefined".
  const semua = [
    putusanAI(DASAR, rabu("12:00:00")),
    putusanAI(s, rabu("12:00:00")),
    putusanAI(s, rabu("07:00:00")),
    putusanAI(atur({ ai_enabled: false }), rabu("12:00:00")),
    putusanAI({ ...s, ai_override_sampai: "2026-09-09T16:00:00+07:00" }, rabu("14:00:00")),
  ];
  periksa(
    "tidak ada keadaan yang kalimatnya kosong / undefined",
    semua.every((k) => {
      const t = teksKeadaanAI(k);
      return typeof t === "string" && t.length > 0 && !/undefined|NaN/.test(t);
    }),
  );
}

/* --------------------------------------------------------------- */
console.log(`\n${"-".repeat(52)}`);
console.log(`Jadwal AI : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
