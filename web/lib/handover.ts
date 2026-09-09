/* ===========================================================
   Aturan jeda AI setelah handover ke CS — logika murni.

   TIDAK ADA jaringan, TIDAK ADA env, TIDAK ADA akses database di
   berkas ini. Itu disengaja, dua alasan:

   1. Berkas ini diimpor peramban DAN server. Kalau lamanya jeda
      dibaca dari process.env di sini, sisi peramban akan diam-diam
      memakai angka bawaan sementara server memakai angka env —
      dua kebenaran yang berbeda tanpa ada yang memberi tahu.
      Karena itu lamanya jeda selalu DIKIRIM sebagai parameter,
      tidak pernah dibaca sendiri. Yang membacanya cuma
      lib/db/handoverServer.ts, dan hanya di sisi server.

   2. Semuanya bisa diuji dengan `npm run uji-handover` seharga
      Rp 0 — termasuk kasus tepi tengah malam dan stempel rusak.
   =========================================================== */

/** Lama jeda bawaan, dalam jam. Lihat supabase/handover-jeda-ai.sql. */
export const JAM_JEDA_BAWAAN = 24;

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
 * JEDA_HANDOVER_JAM: nilai di atas 720 jam akan tertahan di sini.
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
