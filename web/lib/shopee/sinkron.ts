import "server-only";

/* ===========================================================
   Sinkronisasi pesanan Shopee -> tabel orders.

   Dipanggil oleh /api/sync/shopee-orders (cron tiap 15 menit, atau
   tombol "Sinkronkan sekarang" di Pengaturan).

   SATU TOKO GAGAL TIDAK MENGHENTIKAN TOKO LAIN. Tiap toko dibungkus
   try/catch sendiri dan hasilnya dilaporkan per toko; pemanggil
   melihat ringkasan, bukan satu galat yang menutupi 17 toko lainnya.

   TITIK SINKRONISASI disimpan per toko di
   marketplace_shops.orders_synced_until dan baru dimajukan SESUDAH
   semua baris tersimpan. Kalau proses mati di tengah, jendela yang
   sama ditarik ulang pada giliran berikutnya — dan karena semuanya
   upsert, itu aman.
   =========================================================== */

import { getSupabaseAdmin } from "../supabase/admin.ts";
import { petakanPesananShopee } from "../marketplace/pemetaPesanan.ts";
import type { PesananInternal } from "../marketplace/tipe.ts";
import { GalatShopee } from "./klien.ts";
import { titikMulai } from "./sinkronAturan.ts";
import { timestampSekarang } from "./tandaTangan.ts";
import { daftarSnBerubah, detailPesanan } from "./tarikPesanan.ts";
import { GalatToko, daftarTokoAktif, tokenTokoValid, type TokoUntukLayar } from "./token.ts";

export type RingkasanToko = {
  toko: string;
  shop_id: string;
  ok: boolean;
  /** Jendela yang ditarik, ISO. */
  dari: string;
  sampai: string;
  ditemukan: number;
  disimpan: number;
  lama_ms: number;
  /** Kode galat saja — tidak pernah pesan yang memuat token. */
  galat?: string;
};

export type RingkasanSinkron = {
  mulai: string;
  selesai: string;
  toko: RingkasanToko[];
};

const UKURAN_UPSERT = 200;

function namaToko(t: TokoUntukLayar): string {
  return t.shop_name ?? `Toko ${t.external_shop_id}`;
}

function kodeGalat(err: unknown): string {
  if (err instanceof GalatShopee) return err.kode;
  if (err instanceof GalatToko) return err.kode;
  return (err as Error)?.name ?? "tak_dikenal";
}

/**
 * Simpan baris pesanan + jawaban mentahnya. Mengembalikan jumlah
 * baris orders yang tersimpan.
 */
async function simpanPesanan(
  baris: PesananInternal[],
  mentah: Map<string, unknown>,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const sekarang = new Date().toISOString();
  let total = 0;

  for (let i = 0; i < baris.length; i += UKURAN_UPSERT) {
    const potongan = baris.slice(i, i + UKURAN_UPSERT).map((b) => ({ ...b, synced_at: sekarang }));
    const { data, error } = await sb
      .from("orders")
      .upsert(potongan, { onConflict: "platform,external_order_id" })
      .select("id, external_order_id");
    if (error) throw new GalatToko("database", `orders: ${error.message}`);
    total += data?.length ?? 0;

    /* orders_raw butuh uuid baris orders — itu sebabnya upsert di
       atas memilih id. Tabel ini tanpa grant ke authenticated; hanya
       service_role yang sampai ke sini. */
    const barisMentah = (data ?? [])
      .filter((d) => mentah.has(d.external_order_id as string))
      .map((d) => ({
        order_id: d.id as string,
        raw: mentah.get(d.external_order_id as string),
        synced_at: sekarang,
      }));
    if (barisMentah.length > 0) {
      const { error: galatMentah } = await sb
        .from("orders_raw")
        .upsert(barisMentah, { onConflict: "order_id" });
      if (galatMentah) throw new GalatToko("database", `orders_raw: ${galatMentah.message}`);
    }
  }
  return total;
}

export async function sinkronSatuToko(t: TokoUntukLayar): Promise<RingkasanToko> {
  const mulaiMs = Date.now();
  const sekarang = timestampSekarang();
  const dari = titikMulai(t.orders_synced_until, sekarang);
  const dasar = {
    toko: namaToko(t),
    shop_id: t.external_shop_id,
    dari: new Date(dari * 1000).toISOString(),
    sampai: new Date(sekarang * 1000).toISOString(),
  };

  try {
    const { accessToken, shopId } = await tokenTokoValid(t.id);
    const daftarSn = await daftarSnBerubah(accessToken, shopId, dari, sekarang);

    let disimpan = 0;
    if (daftarSn.length > 0) {
      const detail = await detailPesanan(accessToken, shopId, daftarSn);
      const mentah = new Map<string, unknown>(detail.map((d) => [d.order_sn, d]));
      disimpan = await simpanPesanan(
        detail.map((d) => petakanPesananShopee(d, t.id)),
        mentah,
      );
    }

    /* Dimajukan hanya setelah semuanya tersimpan. */
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("marketplace_shops")
      .update({ orders_synced_until: dasar.sampai })
      .eq("id", t.id);
    if (error) throw new GalatToko("database", `orders_synced_until: ${error.message}`);

    return { ...dasar, ok: true, ditemukan: daftarSn.length, disimpan, lama_ms: Date.now() - mulaiMs };
  } catch (err) {
    console.error(`[sinkron] ${dasar.toko} gagal:`, kodeGalat(err));
    return { ...dasar, ok: false, ditemukan: 0, disimpan: 0, lama_ms: Date.now() - mulaiMs, galat: kodeGalat(err) };
  }
}

/** Semua toko aktif, berurutan. Tidak pernah melempar karena satu toko. */
export async function sinkronSemuaToko(): Promise<RingkasanSinkron> {
  const mulai = new Date().toISOString();
  const toko = await daftarTokoAktif();
  const hasil: RingkasanToko[] = [];
  for (const t of toko) hasil.push(await sinkronSatuToko(t));
  return { mulai, selesai: new Date().toISOString(), toko: hasil };
}
