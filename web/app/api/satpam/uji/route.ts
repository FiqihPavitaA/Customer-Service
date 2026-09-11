/* ===========================================================
   POST /api/satpam/uji — coba kata SEBELUM disimpan.

   Tidak menulis apa pun dan tidak memanggil Claude. Biaya Rp 0.

   KENAPA ENDPOINT INI ADA

   Tanpa ini, admin harus menyimpan dulu baru tahu apa yang
   dilakukan kata barunya — yaitu menebak, pada satu-satunya
   lapisan yang menahan permintaan refund dan pertanyaan keracunan
   supaya tidak dijawab mesin.

   Tiga hal yang dijawab, dan urutannya sengaja dari yang paling
   sering disangka penting ke yang benar-benar penting:

     1. polanya jadi apa, dan kalimat uji tertangkap atau tidak
     2. apakah katanya sudah ditangkap kategori lain
     3. berapa banyak pertanyaan yang SELAMA INI dijawab gratis
        akan ikut tercegat

   Nomor 3 yang paling berguna. Bahaya terbesar halaman Kata
   Sensitif bukan kata yang kurang — itu terlihat dan berbiaya
   sedikit. Bahayanya adalah satu kata terlalu umum yang mencegat
   ratusan pertanyaan biasa sekaligus: tidak ada galat, tidak ada
   log, hanya antrean CS yang penuh beberapa hari kemudian.
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { periksaSatpam } from "@/lib/templates";
import { siapkanSumberSatpam, statusSumberSatpam } from "@/lib/db/satpamServer";
import {
  bersihkanFrasa,
  cariTumpangTindih,
  polaDariFrasa,
  ukurCakupan,
} from "@/lib/satpamAturan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berapa contoh pertanyaan yang diambil untuk mengukur cakupan.
 *
 * Seluruhnya, bukan sampel — tetapi dibatasi supaya satu penekanan
 * tombol tidak menarik puluhan ribu baris. Kalau suatu hari
 * contohnya melebihi angka ini, yang terukur adalah sebagiannya,
 * dan jawabannya menyebutkan itu lewat `total` apa adanya.
 */
const MAKS_CONTOH = 2000;

export async function POST(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Belum login. Uji kata butuh sesi yang sedang masuk." },
      { status: 401 },
    );
  }

  let body: { frasa?: unknown; kalimat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Isi permintaan bukan JSON." }, { status: 400 });
  }

  const { frasa, dibuang } = bersihkanFrasa(body.frasa);
  const pola = frasa.length ? polaDariFrasa(frasa) : null;

  // Sumber disiapkan supaya tumpang tindih diukur terhadap aturan
  // yang BENAR-BENAR berlaku sekarang, bukan terhadap daftar di
  // kode. Bedanya nyata: kata yang sudah ditambahkan admin kemarin
  // hanya ada di tabel.
  await siapkanSumberSatpam();

  /* --- 1. Kalimat uji dari admin --------------------------------- */
  const kalimat = String(body.kalimat ?? "").trim();
  let ujiKalimat: {
    kalimat: string;
    kenaPolaBaru: boolean;
    sudahTercegat: string | null;
  } | null = null;

  if (kalimat) {
    let kenaPolaBaru = false;
    if (pola) {
      try {
        kenaPolaBaru = new RegExp(pola, "i").test(kalimat);
      } catch {
        kenaPolaBaru = false;
      }
    }
    ujiKalimat = {
      kalimat,
      kenaPolaBaru,
      // Dilaporkan terpisah, karena keduanya berarti hal yang
      // berbeda bagi admin: "kata saya menangkapnya" tidak sama
      // dengan "kalimat ini memang sudah dialihkan sejak dulu".
      sudahTercegat: periksaSatpam(kalimat)?.kategori ?? null,
    };
  }

  /* --- 2. Tumpang tindih ----------------------------------------- */
  const tumpang = frasa.length ? cariTumpangTindih(frasa) : [];

  /* --- 3. Cakupan terhadap contoh pertanyaan yang sudah ada ------- */
  let cakupan = { kena: 0, total: 0, contoh: [] as string[], perluDitinjau: false };
  let cakupanGagal: string | null = null;

  if (pola) {
    const { data, error } = await sb
      .from("template_examples")
      .select("teks")
      .limit(MAKS_CONTOH);

    if (error) {
      // Bukan alasan menggagalkan seluruh uji. Dua jawaban lain
      // tetap berguna, dan menyembunyikannya karena satu bagian
      // gagal akan membuat admin kehilangan semuanya sekaligus.
      cakupanGagal = error.message;
    } else {
      cakupan = ukurCakupan(
        pola,
        (data ?? []).map((r) => String((r as { teks: string }).teks ?? "")),
      );
    }
  }

  return NextResponse.json(
    {
      frasa,
      dibuang,
      pola,
      ujiKalimat,
      tumpang,
      cakupan,
      cakupanGagal,
      sumber: statusSumberSatpam(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
