/* ===========================================================
   GET /api/shopee/auth-url — mulai otorisasi toko Shopee.

   Mengarahkan peramban ke halaman persetujuan Shopee. Tautannya
   berumur sekitar 5 menit, jadi dibuat baru pada setiap klik dan
   tidak pernah disimpan di mana pun.

   KENAPA TIDAK MEMERIKSA LOGIN

   Ini navigasi peramban (klik tautan), dan sesi console hidup di
   localStorage — header Authorization tidak ikut. Yang bisa
   diperiksa di sini tidak ada.

   Dan memang tidak perlu: URL yang dihasilkan hanya memuat
   partner_id, timestamp, sign, dan redirect. Membukanya tidak
   memberi apa pun kepada siapa pun — langkah berikutnya menuntut
   login ke akun penjual Shopee, dan hasilnya adalah toko ORANG ITU
   terhubung ke aplikasi KITA. Tidak ada rahasia yang bocor dan tidak
   ada yang bisa disalahgunakan tanpa akun penjual yang sah.
   =========================================================== */

import { NextResponse } from "next/server";
import { GalatKonfigurasi, hostDariEnv, kredensialDariEnv } from "@/lib/shopee/klien";
import { urlOtorisasi } from "@/lib/shopee/otorisasi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const redirect = (process.env.SHOPEE_REDIRECT_URL ?? "").trim();
  if (!redirect) {
    return NextResponse.json(
      { error: "Belum disetel: SHOPEE_REDIRECT_URL" },
      { status: 503 },
    );
  }

  try {
    const url = urlOtorisasi(kredensialDariEnv(), hostDariEnv(), redirect);
    return NextResponse.redirect(url.toString(), 302);
  } catch (err) {
    if (err instanceof GalatKonfigurasi) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
