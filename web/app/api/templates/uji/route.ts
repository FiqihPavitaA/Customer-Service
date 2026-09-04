/* ===========================================================
   Kotak "Uji coba" — dipakai dua tempat dengan dua kebutuhan
   yang berbeda:

   1. Detail template TERSIMPAN (tanpa `kataKunci`)
      "Kalau pelanggan menulis ini, template mana yang menjawab?"

   2. Form Tambah Template (dengan `kataKunci`)
      "Kalau saya pakai frasa ini, apakah pesan tadi tertangkap —
       dan apakah ada template lain yang merebutnya lebih dulu?"

   Yang kedua yang membuat form tambah tidak jadi tebak-tebakan.
   Tanpa itu, tim CS harus menyimpan dulu baru tahu hasilnya.

   Semua pencocokan memakai fungsi yang sama dengan /api/chat —
   bukan tiruan. TIDAK memanggil Claude API: hanya regex + baca
   berkas .md lokal, jadi Rp 0 berapa kali pun ditekan.
   =========================================================== */

import { NextResponse } from "next/server";
import { jelaskanTidakCocok, matchTemplate, ujiDraf } from "@/lib/templates";
import type { HasilUji, HasilUjiDraft } from "@/lib/db/templateTypes";

export async function POST(req: Request) {
  let pesan = "";
  let kataKunci: string[] | null = null;

  try {
    const body = (await req.json()) as { pesan?: unknown; kataKunci?: unknown };
    pesan = String(body.pesan ?? "").trim();
    if (Array.isArray(body.kataKunci)) {
      kataKunci = body.kataKunci.map((k) => String(k));
    }
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  if (!pesan) {
    return NextResponse.json({ error: "Pesan masih kosong." }, { status: 400 });
  }

  /* ---- Mode draf: menguji frasa yang belum tersimpan ---- */
  if (kataKunci) {
    const d = ujiDraf(pesan, kataKunci);
    const hasil: HasilUjiDraft = {
      mode: "draf",
      dicegatPengaman: d.dicegatPengaman,
      cocokDraf: d.cocokDraf,
      direbutOleh: d.direbutOleh,
      pola: d.pola,
    };
    return NextResponse.json(hasil);
  }

  /* ---- Mode biasa: aturan yang sudah tersimpan ---- */
  const hit = matchTemplate(pesan);
  const hasil: HasilUji = hit
    ? { mode: "tersimpan", cocok: true, code: hit.code, why: hit.why, sebab: null }
    : {
        mode: "tersimpan",
        cocok: false,
        code: null,
        why: null,
        sebab: jelaskanTidakCocok(pesan),
      };

  return NextResponse.json(hasil);
}
