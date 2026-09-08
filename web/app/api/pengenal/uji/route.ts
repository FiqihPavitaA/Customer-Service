/* ===========================================================
   POST /api/pengenal/uji — menguji Gerbang 2 SENDIRIAN.

   KENAPA ENDPOINT INI ADA.
   Gerbang 2 berjalan dalam mode bayangan: ia menghitung, lalu
   permintaannya tetap diteruskan ke Claude Sonnet. Akibatnya,
   sekali menguji lewat halaman AI Chatbot berbiaya ~Rp 30 untuk
   panggilan Sonnet yang hasilnya tidak sedang kita perhatikan —
   padahal yang ingin dilihat cuma skor kemiripannya.

   Di sini Sonnet tidak pernah dipanggil. Yang dibayar hanya
   embedding satu kalimat, sekitar Rp 0,003. Cukup murah untuk
   dijalankan puluhan kali sambil menyetel ambang, dan itulah
   memang yang dibutuhkan sebelum ambangnya bisa dipercaya.

   TETAP BERBAYAR, sekecil apa pun. Endpoint ini tunduk pada
   AI_TEST_LOCK dan VOYAGE_LOCK seperti jalur lain — bandingkan
   dengan /api/templates/uji yang benar-benar Rp 0 karena hanya
   regex dan berkas lokal.
   =========================================================== */

import { NextResponse } from "next/server";
import { AMBANG_RAGU, AMBANG_YAKIN, kenaliMaksud, MODE_PENGENAL } from "@/lib/pengenal";
import { perkiraanBiaya, VOYAGE_MODEL } from "@/lib/voyage";
// Gerbang 0 diperiksa lebih dulu, sama seperti di /api/chat: kalau
// satpam menahan sebuah pesan, tidak ada gunanya mengukur kemiripan
// dan tidak ada alasan membayar embedding untuknya.
import { matchTemplate, periksaSatpam } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  /* ---- Gerbang 0 ---- */
  const satpam = periksaSatpam(pesan);
  if (satpam) {
    return NextResponse.json({
      berhentiDi: "satpam",
      satpam,
      catatan:
        "Ditahan Gerbang 0, jadi Voyage tidak dipanggil sama sekali. Biaya Rp 0.",
    });
  }

  /* ---- Gerbang 1 ---- */
  const template = matchTemplate(pesan);
  if (template) {
    return NextResponse.json({
      berhentiDi: "template",
      kode: template.code,
      alasan: template.why,
      catatan:
        "Kata kuncinya cocok persis, jadi Voyage tidak perlu dipanggil. Biaya Rp 0.",
    });
  }

  /* ---- Gerbang 2 ---- */
  const kenal = await kenaliMaksud(pesan);
  const biaya = perkiraanBiaya(kenal.token);

  const dasar = {
    model: VOYAGE_MODEL,
    mode: MODE_PENGENAL,
    ambang: { yakin: AMBANG_YAKIN, ragu: AMBANG_RAGU },
    voyage: { token: kenal.token, usd: biaya.usd, idr: biaya.idr },
  };

  if (kenal.jenis === "lewat") {
    return NextResponse.json({
      ...dasar,
      berhentiDi: "lewat",
      alasan: kenal.alasan,
      catatan:
        "Gerbang 2 tidak menghasilkan apa-apa; di /api/chat permintaan ini " +
        "akan diteruskan ke Claude Sonnet.",
    });
  }

  return NextResponse.json({
    ...dasar,
    berhentiDi: kenal.jenis, // "yakin" | "ragu"
    kandidat: kenal.kandidat,
    catatan:
      kenal.jenis === "yakin"
        ? MODE_PENGENAL === "aktif"
          ? "Skor di atas ambang yakin — di /api/chat balasan ini yang dikirim."
          : "Skor di atas ambang yakin, TETAPI mode bayangan aktif: di " +
            "/api/chat permintaan ini tetap diteruskan ke Sonnet."
        : "Zona ragu. Di sinilah Gerbang 3 (Haiku) akan memilih satu dari " +
          "kandidat di atas. Selama gerbang itu belum ada, permintaan " +
          "diteruskan ke Sonnet.",
  });
}
