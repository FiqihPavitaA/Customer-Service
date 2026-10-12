/* ===========================================================
   /api/sync/shopee-orders — tarik pesanan semua toko aktif.

   GET maupun POST diterima: pg_net memanggil dengan POST, Vercel
   Cron (kalau nanti dipakai) dengan GET, tombol di Pengaturan dengan
   POST. Isinya sama.

   Pemicu yang sah: Bearer CRON_SECRET, atau sesi admin. Lihat
   lib/sync/penjaga.ts.

   maxDuration 60: 18 toko x beberapa panggilan Shopee tidak muat di
   10 detik bawaan Hobby. Kalau tetap kurang, pecah per toko lewat
   parameter ?toko=<uuid> — belum dibangun, dicatat supaya gejalanya
   dikenali: ringkasan yang berhenti di tengah tanpa galat per toko.
   =========================================================== */

import { NextResponse } from "next/server";
import { periksaPemicu } from "@/lib/sync/penjaga";
import { sinkronSemuaToko } from "@/lib/shopee/sinkron";
import { GalatKonfigurasiAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function jalankan(req: Request) {
  const pemicu = await periksaPemicu(req);
  if (!pemicu) {
    return NextResponse.json({ error: "Tidak berhak memicu sinkronisasi." }, { status: 401 });
  }

  try {
    const ringkasan = await sinkronSemuaToko();
    console.log(
      `[sync/shopee-orders] oleh ${pemicu.lewat}:`,
      ringkasan.toko.map((t) => `${t.toko}=${t.ok ? t.disimpan : "GAGAL:" + t.galat}`).join(", "),
    );
    return NextResponse.json({ pemicu: pemicu.lewat, ...ringkasan });
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
