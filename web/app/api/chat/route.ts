import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { aiTerkunci, getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { buildFaqBlock, getInvariantBlock, parseAction } from "@/lib/knowledge";
import { ukurBalasan } from "@/lib/limits";
import { AMBANG_YAKIN, kenaliMaksud, MODE_PENGENAL } from "@/lib/pengenal";
import { perkiraanBiaya } from "@/lib/voyage";
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

   Kontrak masuk : { message, history?, useTemplates?, useClaude? }
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
  let body: {
    message?: unknown;
    history?: unknown;
    useTemplates?: unknown;
    useClaude?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const { message, history, useTemplates, useClaude } = body ?? {};
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: 'Field "message" wajib diisi.' }, { status: 400 });
  }

  // ---------- Lapisan 1: template baku ----------
  // Dilewati bila pemanggil mengirim useTemplates:false — dipakai
  // panel demo untuk membandingkan biaya dengan dan tanpa lapisan ini.
  // Satu panggilan router memutuskan ketiga lapisan sekaligus.
  const keputusan = routeToCategory(message);

  // ---------- Gerbang 0: satpam ----------
  // Diperiksa lebih dulu dan TANPA syarat useTemplates. Saklar itu
  // ada untuk membandingkan biaya di panel demo; membiarkannya juga
  // mematikan pengaman berarti kasus refund dan keracunan bisa
  // sampai ke balasan otomatis hanya karena seseorang mengubah satu
  // bidang di permintaan.
  if (keputusan.jenis === "handover") {
    logRouting(keputusan);
    return NextResponse.json({
      action: keputusan.action, // HANDOVER_TO_CS
      reply: keputusan.teks,
      model: null,
      usage: null,
      source: "satpam",
      templateCode: keputusan.kode,
      templateWhy: keputusan.alasan,
      kategori: keputusan.kategori,
      satpam: keputusan.satpam,
      panjang: ukurBalasan(keputusan.teks),
    });
  }

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

  // ---------- Gerbang 2: Pengenal Maksud ----------
  // Menangkap kalimat yang maksudnya sama tapi katanya beda —
  // "nem oilnya dipakenya gmn kak" terhadap "cara pakai neem oil".
  //
  // Ikut dimatikan oleh useTemplates:false karena gerbang ini bagian
  // dari lapisan penghemat biaya, bukan pengaman. Bandingkan dengan
  // Gerbang 0 di atas, yang sengaja tidak bisa dimatikan.
  //
  // kenaliMaksud() tidak pernah melempar: bila Voyage atau Supabase
  // bermasalah, hasilnya "lewat" dan permintaan diteruskan ke Claude
  // seperti sebelum gerbang ini ada.
  let pengenalToken = 0;
  if (useTemplates !== false) {
    const kenal = await kenaliMaksud(message);
    pengenalToken = kenal.token;

    if (kenal.jenis === "yakin") {
      const pilih = kenal.kandidat[0];
      console.log(
        `[GERBANG-2] yakin ${pilih.skor.toFixed(3)} >= ${AMBANG_YAKIN} -> [${pilih.code}] ` +
          `(lewat contoh: "${pilih.contoh}") mode=${MODE_PENGENAL}`,
      );

      // Mode bayangan: dihitung dan dicatat, tetapi TIDAK dikirim.
      // Catatannya tetap terkumpul untuk dibandingkan dengan jawaban
      // Sonnet, dan itulah yang menentukan kapan gerbang ini layak
      // diaktifkan. Lihat MODE_PENGENAL di lib/pengenal.ts.
      if (MODE_PENGENAL === "aktif") {
        return NextResponse.json({
          action: "AUTO_REPLY",
          reply: pilih.body,
          model: null,
          usage: null,
          source: "pengenal",
          templateCode: pilih.code,
          templateWhy: `Kemiripan ${pilih.skor.toFixed(3)} dengan contoh "${pilih.contoh}".`,
          kategori: keputusan.kategori,
          skor: pilih.skor,
          kandidat: kenal.kandidat,
          voyage: { token: pengenalToken, usd: perkiraanBiaya(pengenalToken).usd },
          panjang: ukurBalasan(pilih.body),
        });
      }
      console.log("[GERBANG-2] mode bayangan — tidak dikirim, diteruskan ke Sonnet");
    } else if (kenal.jenis === "ragu") {
      // Di sinilah Gerbang 3 (Claude Haiku) akan berdiri: memilih
      // satu dari tiga kandidat, atau menjawab NONE. Selama gerbang
      // itu belum ada, kandidatnya dicatat lalu permintaan jatuh ke
      // Sonnet — sama seperti sebelumnya, hanya kini terlihat berapa
      // sering zona ragu sebenarnya terjadi.
      console.log(
        `[GERBANG-2] ragu ${kenal.kandidat[0].skor.toFixed(3)} — kandidat: ` +
          kenal.kandidat.map((k) => `[${k.code}] ${k.skor.toFixed(3)}`).join(", ") +
          " -> diteruskan ke Sonnet (Gerbang 3 belum dibangun)",
      );
    } else {
      console.log(`[GERBANG-2] lewat — ${kenal.alasan}`);
    }
  }

  // ---------- Saklar "Panggil Claude" dari panel uji ----------
  // Dikirim halaman AI Chatbot saat penguji ingin melihat sampai mana
  // sebuah pesan berjalan TANPA membayar Sonnet. Gerbang 0, 1, dan 2
  // tetap berjalan penuh; yang dilewati hanya lapisan terakhir.
  //
  // INI KENYAMANAN, BUKAN PENGAMAN, dan bedanya penting: nilainya
  // datang dari peramban, jadi siapa pun yang memanggil endpoint ini
  // bisa saja tidak mengirimnya. Yang benar-benar mengunci saldo
  // tetap AI_TEST_LOCK di bawah — dibaca dari env sisi server dan
  // berlaku untuk semua pemanggil. Keduanya sengaja tidak digabung.
  if (useClaude === false) {
    const jejakTanpaClaude = logRouting(keputusan);
    return NextResponse.json({
      // Bukan AUTO_REPLY: tidak ada balasan untuk pelanggan di sini.
      action: "HANDOVER_TO_CS",
      reply: "",
      model: null,
      usage: null,
      source: "tanpa-claude",
      kategori: keputusan.kategori,
      // Yang SEHARUSNYA dikirim ke Sonnet, supaya penguji tahu persis
      // apa yang barusan tidak jadi dibayar.
      berkas: keputusan.berkas,
      alasan: keputusan.alasan,
      faqKarakter: jejakTanpaClaude.terkirim,
      voyage: { token: pengenalToken, usd: perkiraanBiaya(pengenalToken).usd },
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
      // Voyage tetap ditagih walau permintaannya berakhir di Sonnet.
      // Dikirim sebagai objek berisi token DAN rupiahnya, bukan token
      // saja: tarif Voyage dibaca dari env di sisi server, dan menghitung
      // ulang di peramban berarti ada dua sumber kebenaran yang bisa
      // berbeda diam-diam.
      // Kalau tidak ikut dilaporkan, panel biaya akan menghitung
      // Gerbang 2 seolah gratis setiap kali ia gagal menemukan
      // kecocokan — justru kasus yang paling perlu terlihat.
      voyage: { token: pengenalToken, usd: perkiraanBiaya(pengenalToken).usd },
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
