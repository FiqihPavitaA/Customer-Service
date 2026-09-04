/* ===========================================================
   Kotak "Uji coba" di halaman Kelola Template.

   Kenapa ini ada: tanpa uji coba, menambah kata kunci pemicu adalah
   MENEBAK. Tim CS mengetik frasa, menyimpan, lalu tidak pernah tahu
   apakah frasa itu benar-benar menangkap pertanyaan pelanggan —
   sampai ada yang mengeluh.

   Yang dijalankan di sini adalah matchTemplate() yang SAMA PERSIS
   dengan yang dipakai /api/chat. Bukan tiruan. Jadi hasil di sini
   adalah hasil yang sungguhan akan terjadi.

   Penjelasan "kenapa tidak cocok" juga datang dari router
   (jelaskanTidakCocok), bukan disalin ke sini — salinan pola
   pengaman pasti menyimpang begitu polanya diperbarui.

   TIDAK memanggil Claude API. Hanya regex + baca berkas .md lokal.
   Biaya Rp 0 berapa kali pun ditekan.
   =========================================================== */

import { NextResponse } from "next/server";
import { jelaskanTidakCocok, matchTemplate } from "@/lib/templates";
import type { HasilUji } from "@/lib/db/templateTypes";

export async function POST(req: Request) {
  let pesan = "";
  try {
    const body = (await req.json()) as { pesan?: unknown };
    pesan = String(body.pesan ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  if (!pesan) {
    return NextResponse.json({ error: "Pesan masih kosong." }, { status: 400 });
  }

  const hit = matchTemplate(pesan);

  const hasil: HasilUji = hit
    ? { cocok: true, code: hit.code, why: hit.why, sebab: null }
    : { cocok: false, code: null, why: null, sebab: jelaskanTidakCocok(pesan) };

  return NextResponse.json(hasil);
}
