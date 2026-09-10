import { NextResponse } from "next/server";
import { catatHandover } from "@/lib/db/handoverServer";
import { siapkanSumberTemplate } from "@/lib/db/templatesServer";
import { kenaliMaksud, MODE_PENGENAL } from "@/lib/pengenal";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { perkiraanBiaya } from "@/lib/voyage";
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

   Endpoint ini menjalankan Gerbang 0, template, dan Gerbang 2 —
   lalu BERHENTI. Pertanyaan yang tidak terjawab ketiganya tidak
   diteruskan ke Claude; percakapannya tetap dibuat, dengan
   pemberitahuan di panel saran AI bahwa gilirannya sekarang pada
   manusia.

   Percakapannya sengaja tetap dibuat. Pertanyaan yang tidak
   terjawab adalah kejadian nyata yang harus terlihat CS, bukan
   kejadian yang dihapus karena tidak enak dilihat.

   BIAYANYA TIDAK NOL, DAN ITU HARUS DISEBUT

   Gerbang 2 memanggil Voyage: sekitar Rp 0,003 per pesan yang lolos
   dari Gerbang 0 dan template. Kecil, tetapi bukan nol — dan
   menyebut "gratis" pada sesuatu yang menagih adalah cara tercepat
   kehilangan kepercayaan pada seluruh laporan biaya lain di proyek
   ini. Yang dijamin nol hanyalah Claude.

   Kuota gratis Voyage juga cuma 3 permintaan per menit. Mengklik
   beruntun saat demo akan kena HTTP 429; itu batas laju, bukan
   kerusakan.

   Setel VOYAGE_LOCK=1 (atau AI_TEST_LOCK=1) bila peragaan harus
   benar-benar nol rupiah — Gerbang 2 akan dilewati dan hasilnya
   sama dengan "tidak ketemu".

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

  /* Keputusan router bertipe union: varian "ai" memang TIDAK punya
     teks, action, maupun kode — karena belum ada yang menjawab.
     Ditarik sekali di sini supaya penyempitan tipenya terjadi satu
     kali, bukan diulang di tiap pemakaian. */
  const adaJawabanTemplate =
    keputusan.jenis === "handover" || keputusan.jenis === "template";
  const teksTemplate = adaJawabanTemplate ? keputusan.teks : null;
  const actionTemplate = adaJawabanTemplate ? keputusan.action : null;
  const kodeTemplate = adaJawabanTemplate ? keputusan.kode : null;

  /* ---------- Gerbang 2, kalau Gerbang 0 dan template meleset ----

     Inilah bagian yang paling layak diperagakan: kalimat yang
     kata-katanya sama sekali berbeda dari template mana pun, tetapi
     maksudnya sama, tetap ditemukan. Tidak ada aturan tertulis yang
     bisa menirunya.

     BERBAYAR, dan angkanya harus disebut. Sekitar Rp 0,003 per
     pesan. Bukan nol, hanya kecil — dan menyebut "gratis" pada
     sesuatu yang menagih adalah cara tercepat kehilangan kepercayaan
     pada seluruh laporan biaya lain di proyek ini.

     kenaliMaksud() tidak pernah melempar: bila Voyage terkunci,
     kuncinya kosong, atau Supabase bermasalah, hasilnya "lewat" dan
     alur di bawah memperlakukannya sama dengan tidak ketemu. */
  let pengenal: {
    jenis: string;
    skor?: number;
    kode?: string;
    contoh?: string;
    margin?: number | null;
    alasan?: string;
    token: number;
  } | null = null;
  let balasanPengenal: string | null = null;
  let kodePengenal: string | null = null;

  const perluGerbang2 = !adaJawabanTemplate;
  if (perluGerbang2) {
    const kenal = await kenaliMaksud(teks);
    if (kenal.jenis === "lewat") {
      pengenal = { jenis: "lewat", alasan: kenal.alasan, token: kenal.token };
    } else {
      const juara = kenal.kandidat[0];
      pengenal = {
        jenis: kenal.jenis,
        skor: juara?.skor,
        kode: juara?.code,
        contoh: juara?.contoh,
        margin: kenal.margin,
        token: kenal.token,
      };
      /* Simulasi SELALU memakai hasil "yakin", walau /api/chat masih
         berjalan dalam mode bayangan. Bedanya dilaporkan apa adanya
         lewat `modeProduksi` di bawah, supaya peragaan tidak
         diam-diam menjanjikan perilaku yang belum menyala. */
      if (kenal.jenis === "yakin" && juara) {
        balasanPengenal = juara.body;
        kodePengenal = juara.code;
      }
    }
  }

  /* ---------- PENJAGA BIAYA ----------
     Sampai di sini artinya Gerbang 0, template, DAN Gerbang 2
     semuanya tidak menemukan jawaban. Di sistem sungguhan giliran
     Claude — dan justru di sinilah simulasi berhenti.

     Percakapannya TETAP DIBUAT. Itu disengaja: pertanyaan yang
     tidak terjawab adalah kejadian nyata yang harus terlihat CS,
     bukan kejadian yang dihapus karena tidak enak dilihat. Yang
     tidak terjadi hanya panggilan berbayarnya. */
  const diluarJangkauan = perluGerbang2 && !balasanPengenal;

  const sekarang = new Date().toISOString();
  const id = crypto.randomUUID();

  const messages = [{ role: "user", content: teks, timestamp: sekarang }];
  const balasan = teksTemplate || balasanPengenal;
  if (balasan) {
    messages.push({ role: "assistant", content: balasan, timestamp: sekarang });
  }

  const { data, error } = await sb
    .from("conversations")
    .insert({
      id,
      platform,
      customer_id: `sim_${id.slice(0, 8)}`,
      customer_name: nama,
      shop_name: NAMA_TOKO[platform],
      action: actionTemplate ?? (balasanPengenal ? "AUTO_REPLY" : null),
      template_code: kodeTemplate ?? kodePengenal,
      unread: true,
      messages,
      // Panel "saran AI" di halaman Chat. Untuk pertanyaan yang tidak
      // terjangkau, inilah pemberitahuan yang dilihat CS — dan
      // kalimatnya sengaja menyebut bahwa Claude TIDAK dipanggil,
      // bukan sekadar "sedang diproses". CS yang menunggu jawaban
      // yang tidak akan pernah datang lebih buruk daripada CS yang
      // tahu sejak awal bahwa gilirannya sekarang.
      ai_suggestion: diluarJangkauan
        ? "⏳ Di luar jangkauan Gerbang 0, template, dan Gerbang 2. " +
          "Di sistem sungguhan pertanyaan ini diteruskan ke Claude. " +
          "Pada peragaan ini Claude TIDAK dipanggil (penguncian saldo " +
          "aktif), jadi silakan dijawab manual."
        : null,
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
    actionTemplate === "HANDOVER_TO_CS"
      ? await catatHandover(sb, {
          conversationId: id,
          sumber: keputusan.jenis === "handover" ? "satpam" : "template",
          kode: kodeTemplate,
          kategori: keputusan.kategori,
          pesan: teks,
          balasan: teksTemplate,
        })
      : null;

  return NextResponse.json({
    ok: true,
    conversationId: id,
    nama,
    // Gerbang mana yang menjawab — inilah yang paling ingin dilihat
    // penonton, dan satu-satunya yang menjelaskan kenapa sebagian
    // pertanyaan gratis dan sebagian tidak.
    gerbang: keputusan.jenis === "handover"
      ? "0 · Satpam"
      : keputusan.jenis === "template"
        ? "1 · Penghafal"
        : balasanPengenal
          ? "2 · Pengenal (Voyage)"
          : "tidak ada",
    jenis: keputusan.jenis,
    action: actionTemplate ?? (balasanPengenal ? "AUTO_REPLY" : null),
    kode: kodeTemplate ?? kodePengenal,
    balasan: balasan ?? "",
    diluarJangkauan,
    pengenal,
    /* Mode Gerbang 2 di /api/chat, dilaporkan apa adanya. Simulasi
       memakai hasilnya walau produksi masih 'bayangan' — tanpa baris
       ini, peragaan diam-diam menjanjikan perilaku yang belum
       menyala di jalur sungguhan. */
    modeProduksi: MODE_PENGENAL,
    handover,
    biaya: pengenal
      ? `Voyage ${pengenal.token} token ≈ Rp ${(perkiraanBiaya(pengenal.token).usd * 16500).toFixed(3)} · Claude tidak dipanggil`
      : "Rp 0 — Claude maupun Voyage tidak dipanggil",
  });
}
