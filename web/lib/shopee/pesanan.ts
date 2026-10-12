import "server-only";

/* ===========================================================
   Uji koneksi Shopee — tarik daftar pesanan, sisi server.

   TUJUANNYA MEMBUKTIKAN KONEKSI, BUKAN MENJADI FITUR.

   get_order_list hanya mengembalikan `order_sn` dan `order_status`.
   Tidak ada tanggal, kurir, resi, barang, atau total — dan sengaja
   begitu: balasan setipis ini TIDAK memuat satu pun data pribadi
   pelanggan. Jadi ia aman ditarik sekarang, sebelum SEC-003
   benar-benar Verified.

   Yang dibuktikan kalau ini berhasil: tanda tangan benar, host
   benar, otorisasi toko benar, access_token masih hidup. Empat hal
   itulah yang selama ini belum pernah terbukti dari dalam aplikasi,
   hanya dari CLI.

   Seluruh HTTP lewat lib/shopee/klien.ts. Berkas ini hanya
   menerjemahkan galatnya jadi langkah yang bisa dikerjakan orang.
   =========================================================== */

import {
  GalatKonfigurasi,
  GalatShopee,
  hostDariEnv,
  permintaanShopee,
} from "./klien.ts";
import { timestampSekarang } from "./tandaTangan.ts";
import type { DaftarPesanan } from "./tipe.ts";

/**
 * Batas Shopee: selisih time_from dan time_to paling lama 15 hari.
 * Lebih dari itu dijawab `order.order_list_invalid_time`.
 */
export const BATAS_RENTANG_HARI_SHOPEE = 15;

/**
 * Seberapa jauh ke belakang pesanan dicari.
 *
 * 14, bukan 15: rentang 15 hari tepat berada persis di batas, dan
 * dokumentasinya tidak menjanjikan apakah batas itu inklusif. Satu
 * hari lebih pendek menghilangkan tebakan itu sama sekali.
 */
export const HARI_KE_BELAKANG = 14;

const API_PATH = "/api/v2/order/get_order_list";

/**
 * Parameter khas get_order_list — dipisah supaya bisa diuji tanpa
 * jaringan (scripts/uji-shopee-sign.mjs).
 *
 * response_optional_fields WAJIB disebut. Tanpa itu Shopee hanya
 * mengembalikan order_sn — dokumentasinya menaruh order_status di
 * bawah "Optional fields in response", dan contoh balasannya memang
 * tidak memuat status sama sekali. Halaman uji yang menampilkan
 * "—" di setiap baris adalah gejala parameter ini hilang.
 */
export function parameterPesanan(sekarang: number): Record<string, string | number> {
  return {
    time_range_field: "create_time",
    time_from: sekarang - HARI_KE_BELAKANG * 24 * 60 * 60,
    time_to: sekarang,
    page_size: 20,
    response_optional_fields: "order_status",
  };
}

export type BarisPesanan = {
  order_sn: string;
  order_status: string | null;
};

/**
 * Keterangan yang boleh dilihat peramban.
 *
 * Perhatikan apa yang TIDAK ada di sini: partner_key, access_token,
 * dan sign. Halaman uji ini dibuka dari peramban, jadi apa pun yang
 * masuk ke tipe ini otomatis jadi hal yang bisa dibaca siapa pun
 * yang membuka devtools.
 */
export type Diagnostik = {
  host: string;
  jalur: string;
  partner_id: string;
  shop_id: string;
  /** Panjang kunci saja — cukup untuk menangkap kunci yang terpotong. */
  panjang_partner_key: number;
  rentang_hari: number;
  http?: number;
  /** Dari Shopee; satu-satunya pegangan saat membuka tiket. */
  request_id?: string;
  /** Milidetik dari permintaan dikirim sampai jawaban lengkap. */
  lama_ms?: number;
};

export type Hasil =
  | { ok: true; diagnostik: Diagnostik; pesanan: BarisPesanan[]; lebih: boolean }
  | { ok: false; diagnostik: Diagnostik; galat: string; saran: string };

function bacaEnv(nama: string): string {
  return (process.env[nama] ?? "").trim();
}

/**
 * Terjemahkan kode galat Shopee jadi langkah yang bisa dikerjakan.
 *
 * Tanpa ini, layar hanya menampilkan `error_sign` — kata yang tidak
 * memberi tahu bagian mana yang salah, dan itu persis sebabnya
 * penelusuran kemarin memakan dua hari.
 */
export function saranUntuk(kode: string, pesan: string): string {
  const k = kode.toLowerCase();
  if (k.includes("sign")) {
    return (
      "Tanda tangan ditolak. Periksa berurutan: partner key tanpa spasi di " +
      "ujung, partner ID yang cocok dengan key-nya, host yang sesuai cluster " +
      "aplikasi, lalu jam server. Bandingkan dengan URL dari API Test Tool."
    );
  }
  if (k.includes("token") || /access_token/i.test(pesan)) {
    return (
      "Access token tidak berlaku. Token Shopee berumur pendek — jalankan " +
      "`refresh <refresh_token> <shop_id>` lewat scripts/shopee-sandbox-test.mjs, " +
      "lalu perbarui SHOPEE_ACCESS_TOKEN di web/.env.local dan mulai ulang server."
    );
  }
  if (k.includes("permission") || k.includes("perm")) {
    return (
      "Izin ditolak. Dua sebab yang paling sering: toko belum diotorisasi ke " +
      "aplikasi ini, atau tipe aplikasi tidak termasuk yang boleh memanggil " +
      "endpoint ini (lihat bagian API Permissions di dokumentasinya)."
    );
  }
  if (k.includes("invalid_time")) {
    return (
      `Rentang waktu ditolak. Shopee membatasi selisih time_from dan time_to ` +
      `paling lama ${BATAS_RENTANG_HARI_SHOPEE} hari; kode ini meminta ` +
      `${HARI_KE_BELAKANG} hari, jadi kalau galat ini muncul, periksa jam server.`
    );
  }
  if (k.includes("shop")) {
    return "shop_id tidak dikenali. Pastikan angkanya dari toko yang memang sudah diotorisasi.";
  }
  if (k === "jaringan") {
    return "Periksa koneksi internet dan apakah SHOPEE_HOST dieja benar.";
  }
  if (k === "bukan_json") {
    return "Biasanya halaman galat dari proxy, bukan dari Shopee. Potongan awalnya ada di pesan galat.";
  }
  return "Lihat kode galat di dokumentasi Shopee untuk endpoint get_order_list.";
}

/**
 * Tarik daftar pesanan dari Shopee.
 *
 * Sengaja TIDAK pernah melempar: halaman uji harus bisa menampilkan
 * sebab kegagalan, dan pengecualian yang naik ke route handler akan
 * berubah jadi 500 kosong yang tidak memberi tahu apa-apa.
 *
 * Access token dan shop_id masih dari env selama Fase 1. Sejak Fase 3
 * keduanya dibaca dari tabel marketplace_shops lewat lib/shopee/token.ts.
 */
export async function ambilPesanan(): Promise<Hasil> {
  const partnerId = bacaEnv("SHOPEE_PARTNER_ID");
  const partnerKey = bacaEnv("SHOPEE_PARTNER_KEY");
  const accessToken = bacaEnv("SHOPEE_ACCESS_TOKEN");
  const shopId = bacaEnv("SHOPEE_SHOP_ID");

  const diagnostik: Diagnostik = {
    host: hostDariEnv(),
    jalur: API_PATH,
    partner_id: partnerId || "(kosong)",
    shop_id: shopId || "(kosong)",
    panjang_partner_key: partnerKey.length,
    rentang_hari: HARI_KE_BELAKANG,
  };

  /* Diperiksa satu per satu, bukan sekaligus: "ada yang kurang"
     memaksa orang menebak yang mana. Dua yang pertama juga diperiksa
     klien, tetapi di sini supaya keempatnya tersebut dalam satu pesan. */
  const kurang = [
    ["SHOPEE_PARTNER_ID", partnerId],
    ["SHOPEE_PARTNER_KEY", partnerKey],
    ["SHOPEE_ACCESS_TOKEN", accessToken],
    ["SHOPEE_SHOP_ID", shopId],
  ]
    .filter(([, v]) => !v)
    .map(([n]) => n);

  if (kurang.length > 0) {
    return {
      ok: false,
      diagnostik,
      galat: `Belum disetel: ${kurang.join(", ")}`,
      saran:
        "Isi di web/.env.local (BUKAN .env di akar, yang hanya dibaca skrip CLI), " +
        "lalu jalankan ulang dev server — Next.js membaca env hanya saat mulai.",
    };
  }

  if (!/^\d+$/.test(shopId)) {
    return {
      ok: false,
      diagnostik,
      galat: "SHOPEE_SHOP_ID bukan angka",
      saran: "Salin shop_id dari URL balik otorisasi; isinya hanya digit, tanpa tanda kutip.",
    };
  }

  try {
    const { data, requestId, http, lamaMs } = await permintaanShopee<DaftarPesanan>({
      path: API_PATH,
      shopId,
      accessToken,
      query: parameterPesanan(timestampSekarang()),
    });

    diagnostik.http = http;
    diagnostik.lama_ms = lamaMs;
    if (requestId) diagnostik.request_id = requestId;

    return {
      ok: true,
      diagnostik,
      lebih: data.more === true,
      pesanan: (data.order_list ?? []).map((o) => ({
        order_sn: o.order_sn ?? "(tanpa nomor)",
        order_status: o.order_status ?? null,
      })),
    };
  } catch (err) {
    if (err instanceof GalatKonfigurasi) {
      return { ok: false, diagnostik, galat: err.message, saran: "Isi di web/.env.local lalu jalankan ulang server." };
    }
    if (err instanceof GalatShopee) {
      if (err.http !== null) diagnostik.http = err.http;
      if (err.requestId) diagnostik.request_id = err.requestId;
      return { ok: false, diagnostik, galat: err.message, saran: saranUntuk(err.kode, err.pesan) };
    }
    /* Bukan galat yang dikenal — tetap jangan melempar, tetapi jangan
       pula berpura-pura tahu sebabnya. */
    return {
      ok: false,
      diagnostik,
      galat: (err as Error).message,
      saran: "Galat tak terduga di sisi kita, bukan dari Shopee. Lihat log server.",
    };
  }
}
