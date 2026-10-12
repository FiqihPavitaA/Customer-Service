/* ===========================================================
   Aturan sinkronisasi pesanan Shopee — fungsi murni.

   Tidak membaca env, tidak menyentuh jaringan atau database. Diuji
   oleh scripts/uji-shopee-pemeta.mjs. Yang menyentuh Shopee ada di
   tarikPesanan.ts, yang menyentuh database di sinkron.ts.
   =========================================================== */

/**
 * Batas Shopee: selisih time_from–time_to paling lama 15 hari per
 * panggilan get_order_list. 14 dipakai supaya tidak berada persis di
 * batas yang tidak dijelaskan inklusif atau tidak.
 */
export const MAKS_HARI_PER_PANGGILAN = 14;

/** Batas Shopee: order_sn_list get_order_detail "limit [1,50]". */
export const MAKS_DETAIL_PER_PANGGILAN = 50;

/** Batas Shopee: page_size get_order_list "between 1 and 100". */
export const PAGE_SIZE_DAFTAR = 100;

/**
 * Saat pertama kali menyinkronkan sebuah toko, seberapa jauh ke
 * belakang. 1 hari — sesuai brief. Riwayat lebih lama diambil dengan
 * memundurkan orders_synced_until secara manual bila diperlukan.
 */
export const HARI_PERTAMA_KALI = 1;

/**
 * Jendela berikutnya mulai sedikit SEBELUM titik sinkronisasi
 * terakhir. Tanpa ini, pesanan yang update_time-nya tepat di detik
 * terakhir jendela sebelumnya bisa terlewat; dengan ini ia ditarik
 * dua kali — dan upsert membuat itu tidak berbahaya.
 */
export const TUMPANG_TINDIH_DETIK = 5 * 60;

/**
 * Field opsional yang diminta dari get_order_detail.
 *
 * Daftar ini adalah PAGAR DATA PRIBADI: apa pun yang tidak disebut
 * di sini tidak pernah keluar dari Shopee, jadi tidak pernah masuk
 * orders_raw sekalipun. recipient_address, dropshipper_phone, dan
 * buyer_cpf_id sengaja tidak ada. Uji di uji-shopee-pemeta.mjs
 * menjaga supaya tidak ada yang menambahkannya "sementara".
 */
export const FIELD_OPSIONAL_DETAIL: readonly string[] = [
  "buyer_user_id",
  "buyer_username",
  "item_list",
  "total_amount",
  "shipping_carrier",
];

export type Rentang = { dari: number; sampai: number };

/**
 * Pecah rentang [dari, sampai] (epoch detik) menjadi potongan yang
 * masing-masing tidak melebihi maksHari. Potongan berurutan dan
 * bersambung; rentang kosong atau terbalik -> [].
 */
export function pecahRentang(
  dari: number,
  sampai: number,
  maksHari: number = MAKS_HARI_PER_PANGGILAN,
): Rentang[] {
  if (!Number.isFinite(dari) || !Number.isFinite(sampai) || dari >= sampai) return [];
  const lebar = Math.max(1, Math.floor(maksHari)) * 86_400;
  const hasil: Rentang[] = [];
  let awal = dari;
  while (awal < sampai) {
    const akhir = Math.min(awal + lebar, sampai);
    hasil.push({ dari: awal, sampai: akhir });
    awal = akhir;
  }
  return hasil;
}

/**
 * Dari mana jendela sinkronisasi dimulai.
 *
 * @param syncedUntilIso orders_synced_until toko, null bila belum pernah.
 * @param sekarangDetik epoch detik.
 */
export function titikMulai(syncedUntilIso: string | null | undefined, sekarangDetik: number): number {
  const bawaan = sekarangDetik - HARI_PERTAMA_KALI * 86_400;
  if (!syncedUntilIso) return bawaan;
  const t = Date.parse(syncedUntilIso);
  if (Number.isNaN(t)) return bawaan;
  const terakhir = Math.floor(t / 1000);
  /* Nilai di masa depan (jam server pernah salah) tidak boleh
     membuat jendela kosong selamanya. */
  const mulai = Math.min(terakhir, sekarangDetik) - TUMPANG_TINDIH_DETIK;
  return Math.max(mulai, 0);
}

/** Bagi larik menjadi potongan berukuran n. n <= 0 -> satu potongan. */
export function bagi<T>(larik: readonly T[], n: number): T[][] {
  if (larik.length === 0) return [];
  const ukuran = Number.isFinite(n) && n > 0 ? Math.floor(n) : larik.length;
  const hasil: T[][] = [];
  for (let i = 0; i < larik.length; i += ukuran) hasil.push(larik.slice(i, i + ukuran));
  return hasil;
}
