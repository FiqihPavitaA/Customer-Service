/* ===========================================================
   GET /api/shopee/pesanan — uji koneksi Shopee Open Platform.

   Hanya MEMBACA. Tidak ada satu pun endpoint tulis Shopee yang
   dipanggil dari sini, dan itu disengaja: selama pengujian, console
   tidak boleh pernah mengirim apa pun ke Shopee.

   WAJIB LOGIN

   Endpoint ini memakai kredensial Shopee milik server. Dibiarkan
   terbuka, siapa pun di internet bisa menghabiskan kuota panggilan
   kita dan membaca nomor pesanan toko. Temuan SEC-004 dan SEC-007
   di Audit Security CS adalah persis bentuk itu pada endpoint lain
   — jangan menambah yang ketiga.

   Yang diperiksa hanya "sesinya sah", bukan "dia admin": membaca
   nomor pesanan setara dengan membuka halaman Chat, dan seluruh tim
   CS memang berhak. Pembuktiannya diserahkan ke Supabase lewat
   getUser(), bukan ditebak dari bentuk token.
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ambilPesanan } from "@/lib/shopee/pesanan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  /* Mode demo (Supabase belum dikonfigurasi) tidak punya sesi sama
     sekali. Menolak di situ berarti halaman uji ini mustahil dibuka
     di laptop yang belum dipasangi Supabase, padahal kredensial
     Shopee-nya bisa saja sudah ada. */
  if (isSupabaseConfigured()) {
    const sb = getSupabaseSebagai(tokenDariHeader(req));
    if (!sb) {
      return NextResponse.json(
        { error: "Butuh sesi login." },
        { status: 401 },
      );
    }
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { error: "Sesi tidak berlaku. Masuk ulang lalu coba lagi." },
        { status: 401 },
      );
    }
  }

  const hasil = await ambilPesanan();

  /* Selalu HTTP 200, bahkan saat Shopee menolak. Kegagalannya ada di
     dalam badan jawaban beserta diagnostiknya, dan itulah yang ingin
     dibaca halaman uji. Mengembalikan 500 justru menyembunyikan
     satu-satunya hal yang berguna. */
  return NextResponse.json(hasil);
}
