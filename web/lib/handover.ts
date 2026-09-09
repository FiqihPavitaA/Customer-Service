/* ===========================================================
   Aturan jeda AI setelah handover ke CS — logika murni.

   TIDAK ADA jaringan dan TIDAK ADA akses database di berkas ini,
   supaya semuanya bisa diuji dengan `npm run uji-handover` seharga
   Rp 0 — termasuk kasus tepi tengah malam dan stempel rusak.

   SATU-SATUNYA env DI SINI BERAWALAN NEXT_PUBLIC_, DAN ITU PENTING

   Berkas ini diimpor peramban DAN server. Keduanya perlu tahu
   lamanya jeda: server memasangnya saat handover, peramban
   memajukannya saat CS membalas. Kalau namanya bukan NEXT_PUBLIC_,
   Next.js hanya mengisinya di sisi server — peramban diam-diam
   memakai angka bawaan sementara server memakai angka env. Tidak
   ada galat, tidak ada peringatan; jedanya cuma berbeda tergantung
   siapa yang terakhir menulisnya.

   Angka ini bukan rahasia (24), jadi tidak ada yang dikorbankan
   dengan membuatnya publik.
   =========================================================== */

/** Lama jeda bawaan, dalam jam. Lihat supabase/handover-jeda-ai.sql. */
export const JAM_JEDA_BAWAAN = 24;

/**
 * Lama jeda yang benar-benar dipakai. Bisa diperpendek lewat
 * NEXT_PUBLIC_JEDA_HANDOVER_JAM saat menguji — menunggu 24 jam
 * sungguhan untuk membuktikan jedanya berakhir bukan pengujian,
 * itu penantian.
 */
export const JAM_JEDA = Number(
  process.env.NEXT_PUBLIC_JEDA_HANDOVER_JAM || JAM_JEDA_BAWAAN,
);

const SEJAM_MS = 60 * 60 * 1000;

/**
 * Jeda yang lebih jauh dari ini dianggap nilai rusak, bukan jeda.
 *
 * KENAPA BATAS INI ADA — ditemukan oleh npm run uji-handover
 *
 * Date.parse() di JavaScript membaca "99999" sebagai TAHUN 99999,
 * bukan sebagai kegagalan. Jadi satu nilai sampah di kolom
 * ai_paused_until tidak menghasilkan galat apa pun; ia menghasilkan
 * jeda sepanjang sembilan puluh ribu tahun, dan AI berhenti
 * menjawab percakapan itu selamanya tanpa satu pun tanda di layar.
 *
 * Jeda yang sah paling lama 24 jam ke depan, diperpanjang 24 jam
 * setiap balasan CS. Tiga puluh hari sudah jauh di luar apa pun
 * yang bisa dihasilkan aturan itu. Catatan untuk yang mengubah
 * NEXT_PUBLIC_JEDA_HANDOVER_JAM: nilai di atas 720 jam akan
 * tertahan di sini.
 */
const BATAS_MASUK_AKAL_MS = 30 * 24 * SEJAM_MS;

/**
 * Kapan jeda seharusnya berakhir bila dimulai/diperpanjang sekarang.
 *
 * @param jam  lama jeda; pemanggil yang menentukan (lihat alasan di atas)
 * @param dari titik mulai; default sekarang
 * @returns stempel ISO, siap dikirim ke kolom timestamptz
 */
export function hitungJedaSampai(
  jam: number = JAM_JEDA_BAWAAN,
  dari: Date = new Date(),
): string {
  return new Date(dari.getTime() + jam * SEJAM_MS).toISOString();
}

/**
 * Apakah percakapan ini sedang ditangani manusia?
 *
 * Stempel yang tidak bisa dibaca diperlakukan sebagai TIDAK dijeda,
 * bukan sebaliknya. Nilai rusak berarti kita tidak tahu apa-apa, dan
 * membisukan AI selamanya karena satu kolom kotor jauh lebih merusak
 * daripada satu balasan otomatis yang lolos — pelanggan yang tidak
 * dijawab sama sekali adalah kegagalan yang tidak terlihat siapa pun.
 */
export function sedangDijeda(
  sampai: string | null | undefined,
  sekarang: Date = new Date(),
): boolean {
  return sisaJedaMs(sampai, sekarang) > 0;
}

/** Sisa jeda dalam milidetik; 0 bila sudah lewat, null, atau rusak. */
export function sisaJedaMs(
  sampai: string | null | undefined,
  sekarang: Date = new Date(),
): number {
  if (!sampai) return 0;
  const batas = Date.parse(sampai);
  if (Number.isNaN(batas)) return 0;

  const sisa = batas - sekarang.getTime();
  // Terlalu jauh ke depan berarti nilainya rusak, bukan jedanya
  // panjang. Lihat BATAS_MASUK_AKAL_MS di atas.
  if (sisa > BATAS_MASUK_AKAL_MS) return 0;

  return Math.max(0, sisa);
}

/**
 * Sisa jeda dalam bahasa manusia, untuk badge di halaman Chat.
 * Dibulatkan ke menit — detik tidak berarti apa-apa pada rentang
 * 24 jam, dan angka yang bergerak tiap detik hanya bikin gelisah.
 */
export function teksSisaJeda(
  sampai: string | null | undefined,
  sekarang: Date = new Date(),
): string {
  const sisa = sisaJedaMs(sampai, sekarang);
  if (sisa === 0) return "jeda berakhir";

  const totalMenit = Math.ceil(sisa / 60000);
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;

  if (jam === 0) return `${menit} menit lagi`;
  if (menit === 0) return `${jam} jam lagi`;
  return `${jam} jam ${menit} menit lagi`;
}

/**
 * Sudah berapa lama sebuah eskalasi menunggu — untuk mengurutkan
 * tab "Perlu CS" dan mewarnai badge-nya.
 *
 * Dipisah dari sisa jeda karena keduanya berlawanan arah: yang satu
 * menghitung mundur ke masa depan, yang satu menghitung maju dari
 * masa lalu. Pernah tertukar sekali sudah cukup mahal.
 */
export function menitMenunggu(
  sejak: string | null | undefined,
  sekarang: Date = new Date(),
): number {
  if (!sejak) return 0;
  const mulai = Date.parse(sejak);
  if (Number.isNaN(mulai)) return 0;
  return Math.max(0, Math.floor((sekarang.getTime() - mulai) / 60000));
}

/**
 * Batas SLA: `claude-core.md` menuntut balasan di bawah 15 menit.
 * Badge memerah di 10 supaya masih ada waktu bertindak, bukan
 * memberi tahu setelah terlambat.
 */
export const MENIT_GENTING = 10;

/**
 * Lama menunggu dalam bahasa manusia, untuk badge antrean.
 *
 * Naik satuan supaya tetap terbaca: menit di bawah sejam, jam di
 * bawah sehari, lalu hari. "1.437 menit" secara teknis benar tetapi
 * tidak memberi tahu apa pun kepada orang yang sedang memilih mana
 * yang harus dikerjakan lebih dulu.
 */
/* -----------------------------------------------------------
   Ringkasan antrean untuk Beranda

   Ditaruh di sini, bukan di modul dasbor tersendiri, karena satu
   syarat: berkas ini dijalankan langsung oleh Node lewat
   `npm run uji-handover`, dan Node tidak membaca alias "@/" di
   tsconfig maupun impor tanpa ekstensi berkas. Yang selamat hanya
   `import type`, yang memang dihapus penuh oleh penanggal tipe.

   Jadi fungsi ini tinggal bersama menitMenunggu() yang dipakainya,
   dan tetap bisa diuji Rp 0.
   ----------------------------------------------------------- */

import type { EscalationRow } from "./db/types";

export type RingkasanAntrean = {
  /** Eskalasi berstatus 'open'. */
  terbuka: number;
  /**
   * Lama menunggu eskalasi TERTUA, dalam menit.
   *
   * Sengaja yang tertua, bukan rata-rata. Rata-rata dari 5 menit
   * dan 42 menit adalah 23 — angka yang menenangkan, padahal ada
   * kasus yang sudah melanggar batas 15 menit hampir tiga kali
   * lipat dan tidak terlihat sama sekali.
   */
  tertuaMenit: number;
  /** Percakapan yang belum dibaca siapa pun. */
  belumDibaca: number;
};

export function hitungAntrean(
  conversations: readonly { unread: boolean }[],
  escalations: readonly EscalationRow[],
  sekarang: Date = new Date(),
): RingkasanAntrean {
  let terbuka = 0;
  let tertuaMenit = 0;

  for (const e of escalations) {
    if (e.status !== "open") continue;
    terbuka++;
    const menit = menitMenunggu(e.created_at, sekarang);
    if (menit > tertuaMenit) tertuaMenit = menit;
  }

  return {
    terbuka,
    tertuaMenit,
    belumDibaca: conversations.filter((c) => c.unread).length,
  };
}

export function teksMenunggu(menit: number): string {
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit`;

  const jam = Math.floor(menit / 60);
  if (jam < 24) {
    const sisa = menit % 60;
    return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
  }

  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
}
