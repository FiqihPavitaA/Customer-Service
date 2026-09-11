/* ===========================================================
   Kapan AI boleh menjawab pelanggan — logika murni.

   Tidak menyentuh jaringan, database, maupun React. Tidak
   meng-import satu pun alias "@/..." SUPAYA bisa diimpor langsung
   oleh web/scripts/uji-jadwal-ai.mjs dengan node telanjang. Uji
   yang harus menyalin logikanya akan menyimpang cepat atau lambat.

   KENAPA KEPUTUSANNYA DIPISAH JADI FUNGSI SENDIRI

   Yang diputuskan di sini bukan tampilan, melainkan apakah seorang
   pelanggan menerima balasan atau tidak. Salahnya tidak pernah
   muncul sebagai galat — ke satu arah, AI menyela CS sepanjang hari
   kerja; ke arah lain, pelanggan tidak dijawab semalaman dan yang
   terlihat cuma persentase balas cepat yang turun beberapa hari
   kemudian.

   Karena itu SELURUH aturannya ada di satu berkas yang bisa diuji
   tanpa menjalankan apa pun, dan header maupun /api/chat membaca
   jawaban yang sama — bukan masing-masing menghitung sendiri.
   =========================================================== */

import { sisaJedaMs } from "./handover.ts";

/** Isi kolom jadwal di public.settings (id = 1). */
export type PengaturanJadwal = {
  /** Saklar induk. false = AI mati, apa pun jadwalnya. */
  ai_enabled: boolean;
  ai_jadwal_aktif: boolean;
  /** Jam WIB saat AI mulai diam (0-23). */
  ai_jam_mulai: number;
  /** Jam WIB saat AI kembali menjawab (0-23). */
  ai_jam_selesai: number;
  /** Hari berlaku, ISO: 1 = Senin … 7 = Minggu. */
  ai_hari: number[];
  ai_override_sampai: string | null;
  ai_override_nyala: boolean;
};

export type SebabKeputusan =
  /** Override sementara sedang berlaku. */
  | "override"
  /** Saklar induk ai_enabled dimatikan. */
  | "saklar-induk"
  /** Sedang di dalam jendela jam kerja. */
  | "jadwal"
  /** Tidak ada yang menahan. */
  | "bebas";

export type KeputusanAI = {
  boleh: boolean;
  sebab: SebabKeputusan;
  /**
   * Kapan keadaan ini berakhir, sebagai jam WIB (0-23), atau null
   * bila tidak bisa dipastikan. Dipakai header untuk menulis
   * "nyala 16:00" — angka yang membuat CS tidak perlu menebak.
   */
  jamBerakhir: number | null;
  /** Untuk override: sampai kapan, apa adanya. */
  sampai: string | null;
};

/* ===========================================================
   1. Jam dinding WIB
   ===========================================================
   Vercel berjalan di UTC; tim CS berpikir dalam WIB. Jam 08:00 WIB
   adalah 01:00 UTC, jadi getHours() biasa akan meleset tujuh jam —
   dan melesetnya tidak menghasilkan galat apa pun, hanya jadwal
   yang berlaku di waktu yang salah.

   Proyek ini sudah pernah kena persoalan yang sama pada jeda
   handover; uji-handover.mjs sampai punya kasus khusus
   "+07:00 dan Z yang menunjuk saat sama diperlakukan sama".

   Offsetnya ditulis eksplisit dan TIDAK diwariskan dari server:
   apa pun zona waktu mesin yang menjalankan kode ini — laptop
   pengembang, Vercel, atau uji di CI — hasilnya sama. */

/** WIB = UTC+7. Seluruh toko Infarm memakai jam ini. */
export const WIB_OFFSET_MENIT = 7 * 60;

/** Jam dinding WIB (0-23) untuk sebuah saat. */
export function jamWib(saat: Date): number {
  return new Date(saat.getTime() + WIB_OFFSET_MENIT * 60_000).getUTCHours();
}

/** Hari WIB dalam penomoran ISO: 1 = Senin … 7 = Minggu. */
export function hariWib(saat: Date): number {
  const h = new Date(saat.getTime() + WIB_OFFSET_MENIT * 60_000).getUTCDay();
  // getUTCDay(): 0 = Minggu. ISO menaruh Minggu di akhir sebagai 7.
  return h === 0 ? 7 : h;
}

/** Hari sebelumnya, tetap dalam penomoran ISO. */
function hariKemarin(hari: number): number {
  return hari === 1 ? 7 : hari - 1;
}

/* ===========================================================
   2. Apakah jadwalnya masuk akal?
   ===========================================================
   Database sudah menolak nilai yang tidak sah lewat CHECK, tetapi
   pemeriksaan yang sama diulang di sini dan itu disengaja. Barisnya
   bisa datang dari seed lama, dari migrasi yang belum dijalankan,
   atau dari tangan yang menyunting langsung di SQL Editor. Yang
   dijaga bukan kerapian datanya — melainkan supaya nilai rusak
   berarti "jadwal diabaikan" dan bukan "AI diam selamanya". */

function jadwalMasukAkal(s: PengaturanJadwal): boolean {
  const jamSah = (j: unknown) =>
    typeof j === "number" && Number.isInteger(j) && j >= 0 && j <= 23;

  if (!jamSah(s.ai_jam_mulai) || !jamSah(s.ai_jam_selesai)) return false;
  // Sama = nol jam atau dua puluh empat jam; tidak ada cara memilih
  // di antaranya. Diabaikan, bukan ditebak.
  if (s.ai_jam_mulai === s.ai_jam_selesai) return false;

  if (!Array.isArray(s.ai_hari) || s.ai_hari.length === 0) return false;
  if (!s.ai_hari.every((h) => Number.isInteger(h) && h >= 1 && h <= 7)) return false;

  return true;
}

/**
 * Apakah saat ini berada di dalam jendela jam kerja?
 *
 * Jendela yang MELEWATI TENGAH MALAM (22:00-06:00) tidak bisa
 * dihitung dengan `jam >= mulai && jam < selesai` — hasilnya selalu
 * false. Kasus itu butuh cabangnya sendiri, dan bersamanya satu
 * pertanyaan yang mudah terlewat: hari mana yang dicocokkan.
 *
 * Jawabannya hari saat jendela DIMULAI. Jadwal "Jumat 22:00-06:00"
 * berarti Jumat malam sampai Sabtu pagi; pukul 02:00 Sabtu masih
 * bagian dari jendela Jumat, bukan jendela Sabtu.
 */
function dalamJendela(s: PengaturanJadwal, sekarang: Date): boolean {
  const jam = jamWib(sekarang);
  const hari = hariWib(sekarang);
  const { ai_jam_mulai: mulai, ai_jam_selesai: selesai, ai_hari: hariAktif } = s;

  if (mulai < selesai) {
    return hariAktif.includes(hari) && jam >= mulai && jam < selesai;
  }

  // Melewati tengah malam.
  if (jam >= mulai) return hariAktif.includes(hari);
  if (jam < selesai) return hariAktif.includes(hariKemarin(hari));
  return false;
}

/* ===========================================================
   3. Keputusan
   =========================================================== */

/**
 * Boleh tidaknya AI menjawab, beserta alasannya.
 *
 * Urutannya adalah aturannya, dan sengaja berbunyi seperti kalimat:
 *
 *   override masih berlaku?      -> ikuti arah override
 *   ai_enabled dimatikan?        -> MATI
 *   jadwal nyala & jam cocok?    -> MATI
 *   selain itu                   -> NYALA
 *
 * Override ditaruh PALING ATAS supaya ia benar-benar bisa dipakai
 * untuk menyimpang — termasuk menyalakan AI di tengah jam kerja
 * ketika CS pulang cepat. Override yang kalah oleh jadwal bukan
 * override; ia hanya tombol yang kadang bekerja.
 *
 * @param sekarang disuntikkan supaya bisa diuji. Jangan memanggil
 *   new Date() di dalam: fungsi yang jawabannya bergantung jam
 *   dinding mesin penguji tidak bisa dipercaya.
 */
export function putusanAI(
  s: PengaturanJadwal,
  sekarang: Date = new Date(),
): KeputusanAI {
  /* Override memakai sisaJedaMs() dari lib/handover.ts, BUKAN
     perbandingan tanggal sendiri. Fungsi itu sudah menangani tiga
     hal yang harus ditangani di sini juga, dan sudah punya 41 kasus
     ujinya: teks tanggal rusak, selisih +07:00 vs Z, dan nilai yang
     terlalu jauh ke depan.

     Yang terakhir itu yang penting. Date.parse("99999") terbaca
     sebagai TAHUN 99999, bukan sebagai kegagalan — satu nilai
     sampah di kolom ini akan mematikan AI selama sembilan puluh
     ribu tahun tanpa satu pun tanda di layar. Menulis ulang
     aturannya di sini berarti dua tempat yang harus tetap sepadan,
     dan yang satu pasti tertinggal. */
  if (sisaJedaMs(s.ai_override_sampai, sekarang) > 0) {
    return {
      boleh: s.ai_override_nyala !== false,
      sebab: "override",
      jamBerakhir: jamWib(new Date(Date.parse(s.ai_override_sampai as string))),
      sampai: s.ai_override_sampai,
    };
  }

  if (s.ai_enabled === false) {
    return { boleh: false, sebab: "saklar-induk", jamBerakhir: null, sampai: null };
  }

  if (s.ai_jadwal_aktif && jadwalMasukAkal(s) && dalamJendela(s, sekarang)) {
    return {
      boleh: false,
      sebab: "jadwal",
      jamBerakhir: s.ai_jam_selesai,
      sampai: null,
    };
  }

  return {
    boleh: true,
    sebab: "bebas",
    // Kapan AI akan diam lagi — hanya bisa dipastikan bila jadwalnya
    // memang berlaku hari ini.
    jamBerakhir:
      s.ai_jadwal_aktif && jadwalMasukAkal(s) && s.ai_hari.includes(hariWib(sekarang))
        ? s.ai_jam_mulai
        : null,
    sampai: null,
  };
}

/* ===========================================================
   4. Kalimat untuk header
   ===========================================================
   Ditaruh di sini, bukan di komponen, karena /api/chat juga
   melaporkannya pada jawabannya. Dua tempat yang menyusun kalimat
   sendiri-sendiri akan berselisih — dan berselisih tentang "AI
   nyala atau mati" adalah hal terakhir yang boleh terjadi di layar
   yang dipasang supaya tim bisa memantau keadaannya. */

const JAM = (j: number | null) =>
  j === null ? "" : `${String(j).padStart(2, "0")}.00`;

export function teksKeadaanAI(k: KeputusanAI): string {
  if (k.sebab === "override") {
    return k.boleh
      ? `AI aktif · sementara, sampai ${JAM(k.jamBerakhir)}`
      : `AI mati · sementara, nyala ${JAM(k.jamBerakhir)}`;
  }
  if (k.sebab === "saklar-induk") return "AI mati · dimatikan manual";
  if (k.sebab === "jadwal") return `AI mati · jam kerja, nyala ${JAM(k.jamBerakhir)}`;
  return k.jamBerakhir === null ? "AI aktif" : `AI aktif · diam mulai ${JAM(k.jamBerakhir)}`;
}
