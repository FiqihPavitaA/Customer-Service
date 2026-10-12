/* ===========================================================
   Tanda tangan permintaan Shopee Open Platform.

   HANYA DIPANGGIL DARI SERVER. Modul ini membaca node:crypto dan
   menerima partner key sebagai argumen; mengimpornya dari komponen
   klien akan menyeret kunci itu ke bundel peramban. Pemanggil yang
   sah hanya route handler di app/api/shopee/.

   KENAPA BERKAS INI ADA, PADAHAL SKRIPNYA SUDAH PUNYA

   scripts/shopee-sandbox-test.mjs sudah bisa menandatangani. Tetapi
   skrip itu CLI di luar web/, dan menyalin rumusnya ke route handler
   berarti ada dua salinan yang bisa menyimpang diam-diam. Rumus yang
   menyimpang sedikit saja menjawab `error_sign` — galat yang sudah
   terbukti menghabiskan dua hari karena ia tidak menunjuk ke bagian
   mana pun yang salah.

   Maka: rumusnya ditulis sekali di sini, dan uji nilai-tetap di
   scripts/uji-shopee-sign.mjs mengunci keluarannya. Kalau nanti
   skrip CLI dirapikan, ia tinggal mengimpor dari sini.

   RUMUSNYA

   HMAC-SHA256, kunci = partner_key, keluaran hex huruf kecil.

     endpoint publik : partner_id + api_path + timestamp
     endpoint toko   : partner_id + api_path + timestamp
                       + access_token + shop_id

   Urutannya tidak boleh tertukar dan TIDAK ADA pemisah apa pun di
   antara bagian-bagiannya — bukan koma, bukan spasi, bukan newline.
   =========================================================== */

import { createHmac } from "node:crypto";

/**
 * Sandbox cluster Singapura.
 *
 * Host sandbox berbeda per cluster. Host yang keliru menjawab
 * `error_sign`, BUKAN "aplikasi tidak ditemukan" — kekeliruan yang
 * menyamar jadi masalah kunci. Kalau ditolak, salin host dari URL
 * yang dihasilkan API Test Tool di konsol Shopee; konsol memakai
 * host cluster aplikasi itu sendiri.
 */
export const HOST_SANDBOX = "https://openplatform.sandbox.test-stable.shopee.sg";

/** Produksi. Hanya dipakai bila SHOPEE_HOST disetel ke nilai ini. */
export const HOST_PRODUKSI = "https://partner.shopeemobile.com";

export type Kredensial = {
  partnerId: string;
  partnerKey: string;
};

/** Detik sejak epoch — satuan yang dipakai Shopee, bukan milidetik. */
export function timestampSekarang(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * HMAC-SHA256 atas bagian-bagian yang disambung tanpa pemisah.
 *
 * Angka diubah jadi string lewat String(), bukan toString() pada
 * nilai yang mungkin null — supaya `undefined` yang terselip muncul
 * sebagai teks "undefined" yang kasatmata di uji, bukan melempar.
 */
export function buatSign(
  partnerKey: string,
  bagian: readonly (string | number)[],
): string {
  return createHmac("sha256", partnerKey)
    .update(bagian.map(String).join(""))
    .digest("hex");
}

/** Parameter umum endpoint publik — tanpa access_token dan shop_id. */
export function paramPublik(
  { partnerId, partnerKey }: Kredensial,
  apiPath: string,
  timestamp: number = timestampSekarang(),
): Record<string, string> {
  return {
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign: buatSign(partnerKey, [partnerId, apiPath, timestamp]),
  };
}

/** Parameter umum endpoint toko — butuh access_token dan shop_id. */
export function paramToko(
  { partnerId, partnerKey }: Kredensial,
  apiPath: string,
  accessToken: string,
  shopId: string | number,
  timestamp: number = timestampSekarang(),
): Record<string, string> {
  return {
    partner_id: partnerId,
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: String(shopId),
    sign: buatSign(partnerKey, [
      partnerId,
      apiPath,
      timestamp,
      accessToken,
      shopId,
    ]),
  };
}

/** Rangkai URL penuh. Nilai apa pun dijadikan string oleh URLSearchParams. */
export function susunUrl(
  host: string,
  apiPath: string,
  query: Record<string, string | number>,
): URL {
  const url = new URL(apiPath, host);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  return url;
}
