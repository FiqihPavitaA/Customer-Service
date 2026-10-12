/* ===========================================================
   Pesanan pembeli di panel kanan halaman Chat — aturan murni.

   Tidak menyentuh Supabase atau React; itu ada di
   lib/db/usePesananPembeli.ts. Diuji oleh scripts/uji-pesanan-
   pembeli.mjs.

   CARA MENGHUBUNGKAN PERCAKAPAN KE PESANAN

   Chat marketplace tidak selalu membawa nomor pesanan, tetapi selalu
   membawa pembelinya. Maka pencariannya bertingkat:

     1. conversations.order_id terisi   -> pesanan itu persis
     2. customer_id  = orders.buyer_user_id   (id Shopee, angka)
        customer_name = orders.buyer_username (nama akun)
        — keduanya dicari sekaligus, yang cocok mana pun dipakai

   Percakapan simulasi (customer_id berawalan sim_) tidak pernah
   dicocokkan: pembelinya tidak ada di marketplace mana pun, dan
   mencocokkannya hanya membuang satu kueri per klik.
   =========================================================== */

import { LABEL_STATUS, type StatusInternal } from "./marketplace/tipe.ts";

const AWALAN_SIMULASI = "sim_";

export type SumberPembeli = {
  customer_id: string | null;
  customer_name: string | null;
  order_id: string | null;
};

export type KriteriaPesanan = {
  order_id: string | null;
  buyer_user_id: string | null;
  buyer_username: string | null;
};

/** Baris orders seperti yang dibaca panel. */
export type PesananPembeli = {
  id: string;
  external_order_id: string;
  status: StatusInternal | string;
  raw_status: string | null;
  total_amount: number | null;
  currency: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  items: { nama: string; sku: string | null; varian: string | null; qty: number; harga: number | null; gambar: string | null }[];
  ship_by_date: string | null;
  order_created_at: string | null;
  order_updated_at: string | null;
};

function rapikan(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

/**
 * @returns null bila tidak ada yang bisa dicocokkan (simulasi, atau
 *   percakapan tanpa pengenal apa pun).
 */
export function kriteriaPesanan(c: SumberPembeli): KriteriaPesanan | null {
  const customerId = rapikan(c.customer_id);
  if (customerId?.startsWith(AWALAN_SIMULASI)) return null;

  const k: KriteriaPesanan = {
    order_id: rapikan(c.order_id),
    /* buyer_user_id Shopee selalu angka. customer_id yang bukan angka
       (data lama memakai nama akun) tidak akan pernah cocok di kolom
       itu — jadi tidak dikirim sebagai id, tetapi tetap dicoba
       sebagai nama akun di bawah. */
    buyer_user_id: customerId && /^\d+$/.test(customerId) ? customerId : null,
    buyer_username: rapikan(c.customer_name) ?? (customerId && !/^\d+$/.test(customerId) ? customerId : null),
  };

  if (!k.order_id && !k.buyer_user_id && !k.buyer_username) return null;
  return k;
}

/**
 * Nilai untuk filter PostgREST `.or(...)`. Nilai dikutip ganda supaya
 * koma atau kurung di dalam nama akun tidak merusak sintaksnya.
 */
export function filterOr(k: KriteriaPesanan): string {
  const kutip = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
  const bagian: string[] = [];
  if (k.order_id) bagian.push(`external_order_id.eq.${kutip(k.order_id)}`);
  if (k.buyer_user_id) bagian.push(`buyer_user_id.eq.${kutip(k.buyer_user_id)}`);
  if (k.buyer_username) bagian.push(`buyer_username.eq.${kutip(k.buyer_username)}`);
  return bagian.join(",");
}

/**
 * Pesanan yang harus dikirim tetapi batas kirimnya sudah lewat.
 * Hanya 'perlu_dikirim' — pesanan yang sudah dikirim atau batal
 * tidak "terlambat" walau tanggalnya lewat.
 */
export function terlambatKirim(p: Pick<PesananPembeli, "status" | "ship_by_date">, sekarangMs: number): boolean {
  if (p.status !== "perlu_dikirim" || !p.ship_by_date) return false;
  const batas = Date.parse(p.ship_by_date);
  if (Number.isNaN(batas)) return false;
  return batas < sekarangMs;
}

/** Label status untuk layar; status asing ditampilkan apa adanya. */
export function labelStatus(status: string): string {
  return (LABEL_STATUS as Record<string, string>)[status] ?? status;
}

/** Jumlah dalam mata uang pesanan. null -> "—" (belum bayar). */
export function teksJumlah(jumlah: number | null, mataUang: string | null): string {
  if (jumlah === null) return "—";
  const kode = mataUang ?? "IDR";
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: kode, maximumFractionDigits: 0 }).format(jumlah);
  } catch {
    return `${kode} ${jumlah.toLocaleString("id-ID")}`;
  }
}
