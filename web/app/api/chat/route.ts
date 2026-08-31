import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { getKnowledge, parseAction } from "@/lib/knowledge";
import { matchTemplate } from "@/lib/templates";

/* ===========================================================
   POST /api/chat — port dari app.post('/api/chat') di server.js.

   Kontrak masuk : { message, history?, useTemplates? }
   Kontrak keluar: { action, reply, model, usage, source, ... }
   Bidang lama (action, reply, model, usage) dijaga sama persis
   supaya UI lama (ai.js, dashboard.js) tetap jalan; bidang baru
   hanya tambahan.

   Dua lapisan:
   1. Template baku dari faq-cs.md — tanpa memanggil Claude, Rp 0.
   2. Claude, untuk apa pun yang tidak tertangani lapisan 1.
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
  if (useTemplates !== false) {
    const hit = matchTemplate(message);
    if (hit) {
      return NextResponse.json({
        action: hit.action,
        reply: hit.reply,
        model: null,
        usage: null,
        source: "template",
        templateCode: hit.code,
        templateWhy: hit.why,
      });
    }
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

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // System prompt (claude.md + SOP + KB) besar dan tidak berubah
      // antar permintaan, jadi di-cache agar hemat biaya & latensi.
      // Pantau usage.cache_read_input_tokens untuk memastikan kena.
      system: [
        {
          type: "text",
          text: getKnowledge().systemPrompt,
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
