import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { aiTerkunci, getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { buildFaqBlock, getInvariantBlock, parseAction } from "@/lib/knowledge";
import { ukurBalasan } from "@/lib/limits";
// Router dipakai lewat pembungkus bertipe di lib/templates supaya
// setKbDir() sudah dijalankan sebelum berkas KB dibaca.
import "@/lib/templates";
import {
  bacaBerkasFaq,
  logRouting,
  routeToCategory,
} from "@/content/knowledge-base/router.js";

/* ===========================================================
   POST /api/chat — port dari app.post('/api/chat') di server.js.

   Kontrak masuk : { message, history?, useTemplates? }
   Kontrak keluar: { action, reply, model, usage, source, ... }
   Bidang lama (action, reply, model, usage) dijaga sama persis
   supaya UI lama (ai.js, dashboard.js) tetap jalan; bidang baru
   hanya tambahan.

   Tiga lapisan (knowledge-base/router.js yang memutuskan):
   1. Template baku dari berkas FAQ — Claude tidak dipanggil, Rp 0.
   2. Kategori jelas  -> kirim claude-core + SATU berkas FAQ.
   3. Kategori kabur  -> kirim keempat berkas FAQ (jaring pengaman).
   =========================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = { role?: string; content?: string };

export async function POST(req: Request) {
  let body: { message?: unknown; history?: unknown; useTemplates?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const { message, history, useTemplates } = body ?? {};
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: 'Field "message" wajib diisi.' }, { status: 400 });
  }

  // ---------- Lapisan 1: template baku ----------
  // Dilewati bila pemanggil mengirim useTemplates:false — dipakai
  // panel demo untuk membandingkan biaya dengan dan tanpa lapisan ini.
  // Satu panggilan router memutuskan ketiga lapisan sekaligus.
  const keputusan = routeToCategory(message);

  if (useTemplates !== false && keputusan.jenis === "template") {
    logRouting(keputusan);
    return NextResponse.json({
      action: keputusan.action,
      reply: keputusan.teks,
      model: null,
      usage: null,
      source: "template",
      templateCode: keputusan.kode,
      templateWhy: keputusan.alasan,
      kategori: keputusan.kategori,
      // Ke-152 template sudah di bawah 600 karakter saat aturan ini
      // dibuat; diukur juga di sini supaya template baru yang
      // melanggar langsung ketahuan, bukan setelah sampai pelanggan.
      panjang: ukurBalasan(keputusan.teks),
    });
  }

  // ---------- Penjaga saldo ----------
  // Diperiksa SEBELUM apa pun yang menyentuh Anthropic. Ditaruh
  // setelah jalur template supaya balasan gratis tetap jalan: yang
  // dikunci hanya yang memotong saldo, bukan seluruh console.
  if (aiTerkunci()) {
    console.warn("[SALDO] Panggilan Claude ditolak — AI_TEST_LOCK aktif.");
    return NextResponse.json(
      {
        error:
          "AI_TEST_LOCK aktif — panggilan berbayar ke Claude ditolak. " +
          "Jalur template tetap berjalan. Hapus AI_TEST_LOCK di " +
          "web/.env.local lalu jalankan ulang server untuk membukanya.",
        terkunci: true,
      },
      { status: 423 },
    );
  }

  // ---------- Lapisan 2: Claude ----------
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY belum diset. Salin .env.example ke .env.local dan isi API key.",
      },
      { status: 503 },
    );
  }

  // Saring riwayat: hanya entri yang punya role & content yang sah.
  const past: Anthropic.MessageParam[] = (Array.isArray(history) ? history : [])
    .filter((m): m is IncomingMessage => Boolean(m) && typeof m === "object")
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0,
    )
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));

  const messages: Anthropic.MessageParam[] = [...past, { role: "user", content: message }];

  // Rakit system prompt sesuai hasil routing. Dua blok, keduanya
  // di-cache terpisah: blok pertama sama untuk semua kategori
  // (dipakai ulang lintas permintaan), blok kedua hanya sebesar
  // berkas FAQ yang benar-benar relevan.
  const invarian = getInvariantBlock();
  const { teks: faqTeks } = bacaBerkasFaq(keputusan.berkas);
  const blokFaq = buildFaqBlock(faqTeks);
  const jejak = logRouting(keputusan);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: invarian.teks,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: blokFaq.teks,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const raw = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const { action, reply } = parseAction(raw);

    return NextResponse.json({
      action, // AUTO_REPLY | ASK_INFORMATION | HANDOVER_TO_CS | CHECK_ORDER_SYSTEM
      reply, // teks balasan untuk pelanggan
      model: MODEL,
      usage: response.usage, // jumlah token (untuk estimasi biaya)
      source: "ai",
      // Info routing — dipakai panel demo untuk menampilkan
      // berapa berkas KB yang benar-benar dikirim.
      kategori: keputusan.kategori,
      berkasKb: keputusan.berkas,
      promptChars: invarian.karakter + blokFaq.karakter,
      faqChars: jejak.terkirim,
      faqCharsPenuh: jejak.total,
      // Balasan kepanjangan TIDAK dipangkas — alasannya di lib/limits.ts.
      // Diukur dan dilaporkan supaya bisa ditindaklanjuti.
      panjang: ukurBalasan(reply),
    });
  } catch (err) {
    // Kelas error spesifik dulu, baru yang umum.
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[chat] API key ditolak:", err.message);
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY ditolak Anthropic. Periksa kembali key-nya." },
        { status: 401 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[chat] kena rate limit:", err.message);
      return NextResponse.json(
        { error: "Terlalu banyak permintaan ke Claude API. Coba lagi sebentar lagi." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[chat] error API ${err.status}:`, err.message);
      return NextResponse.json(
        { error: "Gagal memproses ke Claude API.", detail: err.message },
        { status: 502 },
      );
    }
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: "Gagal memproses ke Claude API.", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
