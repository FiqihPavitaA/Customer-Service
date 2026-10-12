/* ===========================================================
   /api/sync/shopee-tokens — segarkan token semua toko aktif, harian.

   KENAPA PERLU, PADAHAL SINKRONISASI PESANAN SUDAH MENYEGARKAN

   refresh_token berumur 30 hari dan hanya diperpanjang saat DIPAKAI.
   Sinkronisasi pesanan memang memakainya — selama ia berjalan. Kalau
   cron pesanan dimatikan sebulan (toko sepi, biaya, sedang
   diperbaiki), semua refresh_token hangus serentak dan 18 pemilik
   toko harus mengotorisasi ulang. Rute ini jaring pengaman yang
   terpisah dari sinkronisasi pesanan.

   tokenTokoValid() hanya menyegarkan bila access_token sudah basi
   (<10 menit sisa). Access token berumur 4 jam, jadi pada panggilan
   harian ia SELALU basi dan SELALU disegarkan — itulah yang
   dimaksud. Tidak perlu "paksa".
   =========================================================== */

import { NextResponse } from "next/server";
import { periksaPemicu } from "@/lib/sync/penjaga";
import { GalatShopee } from "@/lib/shopee/klien";
import { GalatToko, daftarTokoAktif, tokenTokoValid } from "@/lib/shopee/token";
import { GalatKonfigurasiAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function jalankan(req: Request) {
  const pemicu = await periksaPemicu(req);
  if (!pemicu) {
    return NextResponse.json({ error: "Tidak berhak memicu penyegaran." }, { status: 401 });
  }

  try {
    const toko = await daftarTokoAktif();
    const hasil: { toko: string; ok: boolean; galat?: string }[] = [];
    for (const t of toko) {
      const nama = t.shop_name ?? `Toko ${t.external_shop_id}`;
      try {
        await tokenTokoValid(t.id);
        hasil.push({ toko: nama, ok: true });
      } catch (err) {
        const kode =
          err instanceof GalatShopee || err instanceof GalatToko ? err.kode : (err as Error).name;
        console.error(`[sync/shopee-tokens] ${nama} gagal:`, kode);
        hasil.push({ toko: nama, ok: false, galat: kode });
      }
    }
    return NextResponse.json({ pemicu: pemicu.lewat, toko: hasil });
  } catch (err) {
    if (err instanceof GalatKonfigurasiAdmin) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function GET(req: Request) {
  return jalankan(req);
}

export async function POST(req: Request) {
  return jalankan(req);
}
