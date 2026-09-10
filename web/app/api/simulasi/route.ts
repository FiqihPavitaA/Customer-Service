import { NextResponse } from "next/server";
import { catatHandover } from "@/lib/db/handoverServer";
import { siapkanSumberTemplate } from "@/lib/db/templatesServer";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import "@/lib/templates";
import { routeToCategory } from "@/content/knowledge-base/router.js";

/* ===========================================================
   POST /api/simulasi — berpura-pura ada pesan masuk dari pelanggan.

   UNTUK PERAGAAN, TAPI BUKAN SANDIWARA

   Godaannya adalah menyuntik baris lewat SQL Editor: percakapan dan
   eskalasinya langsung muncul di layar berkat Realtime, dan
   penontonnya percaya. Masalahnya, kalau ada yang bertanya "jadi
   AI-nya yang memutuskan itu?", jawaban jujurnya "bukan, SQL yang
   menaruhnya di sana". Peragaan yang runtuh oleh satu pertanyaan
   bukan peragaan yang layak dipakai.

   Endpoint ini menjalankan jalur yang sama dengan yang sungguhan:
   router yang sama, catatHandover() yang sama, kolom yang sama.
   Yang dipalsukan hanya ASAL pesannya — dan itu memang satu-satunya
   bagian yang belum ada, karena webhook marketplace belum dibangun.

   TIDAK MUNGKIN MEMANGGIL CLAUDE, DAN ITU BUKAN KEBETULAN

   Permintaan yang tidak tertangkap Gerbang 0 maupun template akan
   DITOLAK, bukan diteruskan. Di layar demo, satu kalimat meleset
   berarti saldo terpotong di depan penonton — dan orang yang sedang
   memperagakan tidak sedang dalam posisi memeriksa biaya.

   Karena itu endpoint ini aman ditekan berapa kali pun. Ia satu-
   satunya jalur di proyek ini yang menyentuh router tapi tidak
   pernah bisa berbiaya.

   HANYA HIDUP DI LUAR PRODUKSI

   Dijaga NODE_ENV, bukan env var tersendiri: env var yang harus
   diisi manual cepat atau lambat akan terisi di tempat yang salah.
   =========================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM = ["shopee", "tiktok", "lazada"] as const;
type Platform = (typeof PLATFORM)[number];

const NAMA_TOKO: Record<Platform, string> = {
  shopee: "infarm · Shopee",
  tiktok: "infarm · TikTok Shop",
  lazada: "infarm · Lazada",
};

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Tidak tersedia." }, { status: 404 });
  }

  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Butuh sesi login. Simulasi menulis sebagai pengguna yang sedang masuk." },
      { status: 401 },
    );
  }

  let body: { teks?: unknown; nama?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const teks = typeof body.teks === "string" ? body.teks.trim() : "";
  if (!teks) {
    return NextResponse.json({ error: 'Field "teks" wajib diisi.' }, { status: 400 });
  }

  const nama = typeof body.nama === "string" && body.nama.trim() ? body.nama.trim() : "pelanggan.baru";
  const platform: Platform = PLATFORM.includes(body.platform as Platform)
    ? (body.platform as Platform)
    : "shopee";

  // Router memutuskan persis seperti pada /api/chat.
  await siapkanSumberTemplate();
  const keputusan = routeToCategory(teks);

  /* PENJAGA BIAYA. Hanya dua jenis yang boleh lewat, dan keduanya
     dijawab tanpa jaringan sama sekali. Sisanya ditolak dengan
     penjelasan — yang justru berguna saat demo: penonton melihat
     bahwa sistemnya tahu kapan ia tidak tahu. */
  if (keputusan.jenis !== "handover" && keputusan.jenis !== "template") {
    return NextResponse.json({
      ditolak: true,
      jenis: keputusan.jenis,
      kategori: keputusan.kategori ?? null,
      alasan:
        "Kalimat ini tidak tertangkap Gerbang 0 maupun template, jadi di " +
        "sistem sungguhan ia diteruskan ke Claude — berbayar. Simulasi " +
        "sengaja berhenti di sini. Coba kalimat yang mengandung kata " +
        "seperti refund, retur, rusak, bocor, atau salah kirim.",
    });
  }

  const sekarang = new Date().toISOString();
  const id = crypto.randomUUID();

  const messages = [{ role: "user", content: teks, timestamp: sekarang }];
  if (keputusan.teks) {
    messages.push({ role: "assistant", content: keputusan.teks, timestamp: sekarang });
  }

  const { data, error } = await sb
    .from("conversations")
    .insert({
      id,
      platform,
      customer_id: `sim_${id.slice(0, 8)}`,
      customer_name: nama,
      shop_name: NAMA_TOKO[platform],
      action: keputusan.action ?? null,
      template_code: keputusan.kode ?? null,
      unread: true,
      messages,
      created_at: sekarang,
      updated_at: sekarang,
      last_message_at: sekarang,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[simulasi] gagal membuat percakapan:", error.message);
    return NextResponse.json(
      { error: "Gagal membuat percakapan.", detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Database tidak menyimpan baris apa pun — umumnya RLS menolak." },
      { status: 403 },
    );
  }

  /* Jalur yang SAMA dengan /api/chat, bukan salinannya. Kalau
     catatHandover() berubah, peragaan ikut berubah — dan itulah
     yang membuat peragaan ini tetap jujur seiring waktu. */
  const handover =
    keputusan.action === "HANDOVER_TO_CS"
      ? await catatHandover(sb, {
          conversationId: id,
          sumber: keputusan.jenis === "handover" ? "satpam" : "template",
          kode: keputusan.kode,
          kategori: keputusan.kategori,
          pesan: teks,
          balasan: keputusan.teks,
        })
      : null;

  return NextResponse.json({
    ok: true,
    conversationId: id,
    nama,
    jenis: keputusan.jenis,
    action: keputusan.action ?? null,
    kode: keputusan.kode ?? null,
    balasan: keputusan.teks ?? "",
    handover,
    biaya: "Rp 0 — Claude tidak dipanggil",
  });
}
