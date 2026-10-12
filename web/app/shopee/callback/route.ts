/* ===========================================================
   GET /shopee/callback — Shopee mengembalikan peramban ke sini
   sesudah pemilik toko menyetujui otorisasi, dengan ?code=&shop_id=.

   Alurnya:
     1. tukar code -> access_token + refresh_token   (token/get)
     2. simpan ke marketplace_shops                   (service_role)
     3. ambil nama toko & kapan otorisasinya habis    (get_shop_info)
     4. kembali ke /settings dengan pesan — TANPA token di URL

   KENAPA TIDAK MEMERIKSA LOGIN

   Sama dengan auth-url: ini navigasi yang datang dari Shopee, bukan
   dari console, jadi tidak ada header sesi. Yang membatasinya adalah
   `code` itu sendiri: hanya sah 10 menit, sekali pakai, dan hanya
   bisa didapat oleh orang yang baru saja login ke akun penjual
   Shopee dan menyetujui aplikasi ini.

   YANG TIDAK PERNAH DILAKUKAN BERKAS INI

   Menaruh token di URL pengalihan, di log, atau di badan jawaban.
   URL balik ke /settings hanya memuat status dan nama toko atau kode
   galat — hal-hal yang memang akan ditampilkan di layar.
   =========================================================== */

import { NextResponse } from "next/server";
import { GalatKonfigurasi, GalatShopee } from "@/lib/shopee/klien";
import {
  GalatToko,
  ambilInfoToko,
  perbaruiProfilToko,
  simpanTokoBaru,
  tukarKode,
} from "@/lib/shopee/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keSettings(req: Request, param: Record<string, string>): NextResponse {
  const url = new URL("/settings", req.url);
  for (const [k, v] of Object.entries(param)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString(), 302);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim();
  const shopId = (searchParams.get("shop_id") ?? "").trim();

  if (!code || !/^\d+$/.test(shopId)) {
    return keSettings(req, { shopee: "gagal", sebab: "parameter_kurang" });
  }

  let id: string;
  try {
    const token = await tukarKode(code, shopId);
    id = await simpanTokoBaru(shopId, token);

    /* Nama toko adalah pelengkap: kalau get_shop_info gagal, toko
       tetap tersimpan dan bisa dipakai — hanya namanya kosong. Jangan
       sampai kegagalan di langkah hiasan membatalkan langkah inti. */
    try {
      const info = await ambilInfoToko(token.accessToken, shopId);
      await perbaruiProfilToko(id, info);
      return keSettings(req, { shopee: "ok", toko: info.shop_name ?? shopId });
    } catch (err) {
      console.warn(
        "[shopee/callback] toko tersimpan, get_shop_info gagal:",
        err instanceof GalatShopee ? err.kode : (err as Error).name,
      );
      return keSettings(req, { shopee: "ok", toko: shopId, catatan: "nama_toko_belum" });
    }
  } catch (err) {
    /* Hanya KODE yang dibawa ke URL — bukan pesan lengkapnya, yang
       untuk beberapa galat bisa memantulkan input. */
    let sebab = "tak_dikenal";
    if (err instanceof GalatShopee) sebab = err.kode;
    else if (err instanceof GalatToko) sebab = err.kode;
    else if (err instanceof GalatKonfigurasi) sebab = "konfigurasi";
    console.error("[shopee/callback] gagal:", sebab);
    return keSettings(req, { shopee: "gagal", sebab });
  }
}
