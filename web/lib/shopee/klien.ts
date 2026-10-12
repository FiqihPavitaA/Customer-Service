import "server-only";

/* ===========================================================
   Klien Shopee Open Platform v2 — satu-satunya jalur HTTP ke Shopee.

   HANYA DI SERVER. Baris pertama berkas ini membuat bundler Next.js
   menolak kalau ada komponen klien yang mengimpornya, langsung atau
   lewat rantai impor. Itu pagar yang sesungguhnya; komentar ini
   hanya menjelaskan kenapa pagarnya ada: fungsi di bawah membaca
   SHOPEE_PARTNER_KEY dari env, dan apa pun yang ikut ke bundel
   peramban bisa dibaca siapa saja.

   Uji tanpa jaringan tetap bisa mengimpor berkas ini dengan
   `node --conditions=react-server`, yang membuat paket server-only
   terpecahkan ke modul kosong. Lihat package.json.

   YANG TIDAK PERNAH DILAKUKAN BERKAS INI

   Mencetak URL, kunci, token, atau sign ke log atau ke pesan galat.
   URL Shopee memuat access_token dan sign di query string, jadi satu
   console.log(url) yang "sementara" sudah cukup untuk menaruh token
   toko di log Vercel. Galat yang dilempar hanya membawa kode, pesan
   dari Shopee, request_id, dan status HTTP.
   =========================================================== */

import {
  HOST_SANDBOX,
  paramPublik,
  paramToko,
  susunUrl,
  timestampSekarang,
  type Kredensial,
} from "./tandaTangan.ts";
import type { AmplopShopee } from "./tipe.ts";

/**
 * Shopee menolak atau tidak bisa dihubungi.
 *
 * `kode` adalah `error` dari Shopee (mis. "error_sign",
 * "invalid_acceess_token" — salah ketik itu milik Shopee), atau salah
 * satu kode buatan sendiri di bawah untuk kegagalan sebelum jawaban
 * Shopee sempat dibaca:
 *
 *   jaringan    fetch gagal sama sekali (DNS, koneksi, timeout)
 *   bukan_json  jawaban bukan JSON — biasanya halaman galat proxy
 *   http_<n>    HTTP bukan 2xx tanpa `error` di badannya
 */
export class GalatShopee extends Error {
  readonly kode: string;
  readonly pesan: string;
  readonly requestId: string | null;
  readonly http: number | null;

  constructor(kode: string, pesan: string, requestId: string | null, http: number | null) {
    super(pesan ? `${kode} — ${pesan}` : kode);
    this.name = "GalatShopee";
    this.kode = kode;
    this.pesan = pesan;
    this.requestId = requestId;
    this.http = http;
  }
}

/**
 * Env belum lengkap. Dipisah dari GalatShopee supaya pemanggil bisa
 * membedakan "kita belum siap" dari "Shopee menolak" — dua keadaan
 * yang butuh tindakan berlawanan.
 */
export class GalatKonfigurasi extends Error {
  readonly kurang: readonly string[];

  constructor(kurang: readonly string[]) {
    super(`Belum disetel: ${kurang.join(", ")}`);
    this.name = "GalatKonfigurasi";
    this.kurang = kurang;
  }
}

export type Permintaan = {
  /** Jalur API, mis. "/api/v2/order/get_order_list". */
  path: string;
  method?: "GET" | "POST";
  /** Isi KEDUANYA untuk endpoint toko; kosongkan keduanya untuk endpoint publik/auth. */
  shopId?: string | number;
  accessToken?: string;
  /** Parameter khas endpoint; parameter umum (partner_id, timestamp, sign) ditambahkan sendiri. */
  query?: Record<string, string | number | boolean>;
  /** Badan JSON untuk POST. Parameter umum TETAP di query string, bukan di badan. */
  body?: unknown;
};

/**
 * Pengait untuk uji — semuanya opsional, dan di jalur produksi tidak
 * satu pun diisi. Memungkinkan uji tanpa jaringan dan tanpa env.
 */
export type Pengait = {
  fetchImpl?: typeof fetch;
  sekarang?: () => number;
  kredensial?: Kredensial;
  host?: string;
};

export type Jawaban<T> = {
  data: T;
  requestId: string | null;
  http: number;
  lamaMs: number;
};

function bacaEnv(nama: string): string {
  return (process.env[nama] ?? "").trim();
}

/** Kredensial dari env. Menyebut SEMUA nama yang kosong, bukan hanya yang pertama. */
export function kredensialDariEnv(): Kredensial {
  const partnerId = bacaEnv("SHOPEE_PARTNER_ID");
  const partnerKey = bacaEnv("SHOPEE_PARTNER_KEY");
  const kurang: string[] = [];
  if (!partnerId) kurang.push("SHOPEE_PARTNER_ID");
  if (!partnerKey) kurang.push("SHOPEE_PARTNER_KEY");
  if (kurang.length > 0) throw new GalatKonfigurasi(kurang);
  return { partnerId, partnerKey };
}

/** Host dari env; sandbox bila kosong. Produksi harus disetel eksplisit. */
export function hostDariEnv(): string {
  return bacaEnv("SHOPEE_HOST") || HOST_SANDBOX;
}

/**
 * Kirim satu permintaan ke Shopee dan kembalikan `response`-nya.
 *
 * Melempar GalatShopee bila `error` terisi, HTTP bukan 2xx, jawaban
 * bukan JSON, atau jaringan gagal. Melempar GalatKonfigurasi bila env
 * belum lengkap. Tidak pernah mengembalikan jawaban yang "setengah
 * berhasil" — pemanggil tidak perlu memeriksa `error` lagi.
 *
 * Catatan untuk endpoint auth (token/get, access_token/get): Shopee
 * menaruh access_token dan refresh_token di AKAR jawaban, bukan di
 * `response`. Untuk endpoint itu pakai permintaanMentah() di bawah.
 */
export async function permintaanShopee<T>(
  p: Permintaan,
  pengait: Pengait = {},
): Promise<Jawaban<T>> {
  const mentah = await permintaanMentah<AmplopShopee<T>>(p, pengait);
  return { ...mentah, data: (mentah.data.response ?? {}) as T };
}

/**
 * Sama dengan permintaanShopee, tetapi mengembalikan SELURUH badan
 * jawaban. Dipakai endpoint auth yang bentuknya tidak mengikuti
 * amplop `response`. Tetap melempar bila `error` terisi.
 */
export async function permintaanMentah<T extends { error?: string; message?: string; request_id?: string }>(
  p: Permintaan,
  pengait: Pengait = {},
): Promise<Jawaban<T>> {
  const kred = pengait.kredensial ?? kredensialDariEnv();
  const host = pengait.host ?? hostDariEnv();
  const fetchImpl = pengait.fetchImpl ?? fetch;
  const timestamp = (pengait.sekarang ?? timestampSekarang)();
  const method = p.method ?? "GET";

  /* Endpoint toko butuh KEDUANYA. Satu saja yang terisi hampir pasti
     kesalahan pemanggil, dan Shopee akan menjawabnya dengan error_sign
     yang menyesatkan — lebih baik ditolak di sini dengan nama. */
  const adaToken = p.accessToken !== undefined && p.accessToken !== "";
  const adaShop = p.shopId !== undefined && p.shopId !== "";
  if (adaToken !== adaShop) {
    throw new GalatKonfigurasi([adaToken ? "shopId" : "accessToken"]);
  }

  const umum = adaToken
    ? paramToko(kred, p.path, p.accessToken as string, p.shopId as string | number, timestamp)
    : paramPublik(kred, p.path, timestamp);

  const query: Record<string, string | number> = { ...umum };
  for (const [k, v] of Object.entries(p.query ?? {})) query[k] = typeof v === "boolean" ? String(v) : v;

  const url = susunUrl(host, p.path, query);

  const mulai = Date.now();
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers: p.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: p.body !== undefined ? JSON.stringify(p.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    /* Pesan dari fetch tidak memuat URL, jadi aman diteruskan. */
    throw new GalatShopee("jaringan", (err as Error).message, null, null);
  }
  const lamaMs = Date.now() - mulai;

  const teks = await res.text();
  let data: T;
  try {
    data = JSON.parse(teks) as T;
  } catch {
    /* Potongan awal saja: halaman galat proxy bisa panjang dan tidak
       memuat rahasia, tetapi membatasi panjangnya tetap kebiasaan baik. */
    throw new GalatShopee("bukan_json", teks.slice(0, 160), null, res.status);
  }

  const requestId = data.request_id ?? null;

  /* Dua pemeriksaan terpisah, sengaja. Shopee bisa menjawab 200 dengan
     error terisi, dan juga 4xx/5xx dengan error terisi atau kosong. */
  if (data.error) {
    throw new GalatShopee(data.error, data.message ?? "", requestId, res.status);
  }
  if (!res.ok) {
    throw new GalatShopee(`http_${res.status}`, data.message ?? "", requestId, res.status);
  }

  return { data, requestId, http: res.status, lamaMs };
}
