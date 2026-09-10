import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { aiTerkunci, getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { buildFaqBlock, getInvariantBlock, parseAction } from "@/lib/knowledge";
import { ukurBalasan } from "@/lib/limits";
import {
  AMBANG_MARGIN,
  AMBANG_RAGU,
  AMBANG_YAKIN,
  kenaliMaksud,
  MODE_PENGENAL,
} from "@/lib/pengenal";
import { perkiraanBiaya } from "@/lib/voyage";
// Router dipakai lewat pembungkus bertipe di lib/templates supaya
// setKbDir() sudah dijalankan sebelum berkas KB dibaca.
import "@/lib/templates";
import {
  siapkanSumberTemplate,
  statusSumberTemplate,
} from "@/lib/db/templatesServer";
import {
  bacaJeda,
  catatHandover,
  type BahanHandover,
  type HasilHandover,
} from "@/lib/db/handoverServer";
import { sedangDijeda, teksSisaJeda } from "@/lib/handover";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import {
  bacaBerkasFaq,
  logRouting,
  routeToCategory,
  teksHandover,
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
    conversationId?: unknown;
    lampiran?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const { message, history, useTemplates, useClaude, conversationId, lampiran } = body ?? {};

  /* Lampiran diperiksa SEBELUM syarat "message wajib diisi".
     Pelanggan yang mengirim foto tanpa satu kata pun adalah kejadian
     biasa — dan sampai 10 Sep 2026 permintaan itu dijawab HTTP 400.
     Bukan handover, bukan balasan: galat. */
  const berkas = Array.isArray(lampiran)
    ? lampiran.filter(
        (l): l is { url: string; jenis: string } =>
          Boolean(l) && typeof (l as { url?: unknown }).url === "string",
      )
    : [];

  if (!berkas.length && (!message || typeof message !== "string")) {
    return NextResponse.json(
      { error: 'Field "message" wajib diisi, kecuali ada lampiran.' },
      { status: 400 },
    );
  }
  const teksMasuk = typeof message === "string" ? message : "";

  // ---------- Sambungan ke percakapan sungguhan ----------
  // conversationId bersifat OPSIONAL, dan itu yang memisahkan meja
  // uji dari kenyataan. Halaman AI Chatbot mengirim kalimat karangan
  // untuk mengukur biaya dan ambang; kalau ia ikut membuat eskalasi,
  // antrean CS akan penuh oleh pelanggan yang tidak pernah ada.
  // Tanpa id, route ini berperilaku persis seperti sebelumnya:
  // memutuskan, menjawab, tidak menulis apa pun.
  const convId = typeof conversationId === "string" && conversationId ? conversationId : null;
  const sb = convId ? getSupabaseSebagai(tokenDariHeader(req)) : null;

  /**
   * Catat handover bila permintaan ini memang menempel pada
   * percakapan sungguhan. Mengembalikan null pada semua keadaan
   * lain — tanpa id, tanpa sesi, atau gagal menulis — dan itu tidak
   * pernah menghentikan balasan ke pelanggan.
   */
  const catat = async (
    bahan: Omit<BahanHandover, "conversationId">,
  ): Promise<HasilHandover | null> => {
    if (!sb || !convId) return null;
    return catatHandover(sb, { ...bahan, conversationId: convId });
  };

  // ---------- Gerbang -1: percakapan sedang ditangani manusia ----------
  // Sengaja diperiksa PALING AWAL, sebelum Gerbang 0 dan sebelum
  // pustaka template dibaca. Dua alasan:
  //
  //   Biaya    pemeriksaannya satu SELECT ke satu baris. Menaruhnya
  //            setelah Gerbang 2 berarti sebagian permintaan yang
  //            seharusnya diam tetap membayar Voyage.
  //
  //   Cakupan  Gerbang 0 hanya menangkap kalimat yang mengandung
  //            kata pemicu. Pesan lanjutan di tengah kasus refund —
  //            "12345", "oke kak makasih" — tidak mengandung satu
  //            pun, jadi Gerbang 0 akan meloloskannya ke Claude
  //            tepat di saat CS sedang menangani orangnya. Jeda
  //            inilah yang menutup celah itu, bukan Gerbang 0.
  if (sb && convId) {
    const jedaSampai = await bacaJeda(sb, convId);
    if (sedangDijeda(jedaSampai)) {
      return NextResponse.json({
        // Bukan AUTO_REPLY: tidak ada balasan untuk pelanggan di
        // sini, dan itu memang tujuannya.
        action: "HANDOVER_TO_CS",
        reply: "",
        model: null,
        usage: null,
        source: "dijeda",
        jedaSampai,
        sisaJeda: teksSisaJeda(jedaSampai),
      });
    }
  }

  /* ---------- Gerbang -0.5: ada lampiran ----------

     KEHADIRAN LAMPIRAN SUDAH CUKUP. Isinya tidak diperiksa, dan
     memang tidak bisa: gambar tidak pernah ikut dikirim ke Claude
     dari route ini. Menjawab pesan berlampiran berarti menjawab
     sesuatu yang tidak pernah dilihat — AI akan terdengar yakin
     tentang tanaman yang tidak ada di hadapannya.

     BERLAKU JUGA SAAT TEKSNYA SEBENARNYA BISA DIJAWAB.
     "dosis NPK berapa ya? [foto struk]" memang cocok template, dan
     tetap dialihkan. Foto yang diabaikan lebih buruk daripada CS
     yang membaca satu chat mudah: pelanggan mengirimnya karena
     merasa ada yang perlu dilihat, dan balasan yang mengabaikannya
     memberi tahu dia bahwa tidak ada yang melihat.

     Ditaruh sebelum Gerbang 0 dan sebelum pustaka template dibaca,
     jadi tidak pernah menyentuh Voyage maupun Claude. */
  if (berkas.length) {
    const teksBalasan = teksHandover();
    const handover = await catat({
      sumber: "lampiran",
      kategori: null,
      pesan: teksMasuk || `[${berkas.length} lampiran tanpa teks]`,
      balasan: teksBalasan,
    });
    return NextResponse.json({
      action: "HANDOVER_TO_CS",
      reply: teksBalasan,
      model: null,
      usage: null,
      source: "lampiran",
      lampiran: berkas.length,
      alasan:
        "Pesan berisi lampiran. AI tidak bisa melihat gambar, jadi " +
        "seluruh pesan berlampiran dialihkan ke CS.",
      handover,
      panjang: ukurBalasan(teksBalasan),
    });
  }

  // ---------- Sumber template ----------
  // Pastikan router memakai isi tabel `templates` bila tabelnya
  // sudah terisi; bila tidak, ia tetap membaca berkas .md seperti
  // sebelumnya. Menunggu di sini disengaja: memutuskan balasan
  // dengan pustaka yang setengah berganti lebih buruk daripada
  // menunggu satu perjalanan ke Supabase yang hasilnya di-cache 60
  // detik. Fungsinya tidak pernah melempar.
  await siapkanSumberTemplate();
  const sumberTemplate = statusSumberTemplate().sumber;

  // ---------- Lapisan 1: template baku ----------
  // Dilewati bila pemanggil mengirim useTemplates:false — dipakai
  // panel demo untuk membandingkan biaya dengan dan tanpa lapisan ini.
  // Satu panggilan router memutuskan ketiga lapisan sekaligus.
  const keputusan = routeToCategory(teksMasuk);

  // ---------- Gerbang 0: satpam ----------
  // Diperiksa lebih dulu dan TANPA syarat useTemplates. Saklar itu
  // ada untuk membandingkan biaya di panel demo; membiarkannya juga
  // mematikan pengaman berarti kasus refund dan keracunan bisa
  // sampai ke balasan otomatis hanya karena seseorang mengubah satu
  // bidang di permintaan.
  if (keputusan.jenis === "handover") {
    logRouting(keputusan);
    const handover = await catat({
      sumber: "satpam",
      kode: keputusan.kode,
      kategori: keputusan.kategori,
      pesan: teksMasuk,
      balasan: keputusan.teks,
    });
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
      sumberTemplate,
      panjang: ukurBalasan(keputusan.teks),
      // null bila permintaan ini tidak menempel pada percakapan
      // sungguhan — bukan tanda kegagalan.
      handover,
    });
  }

  if (useTemplates !== false && keputusan.jenis === "template") {
    logRouting(keputusan);
    // Sebagian besar template menjawab sendiri dan selesai. Yang
    // ber-action HANDOVER_TO_CS — [DITERUSKAN CS], [REKENING],
    // [CS KOMPLAIN] — hanya menenangkan pelanggan sambil menunggu
    // orang; tanpa baris antrean, "mohon ditunggu sebentar" itu
    // janji yang tidak pernah sampai ke siapa pun.
    const handover =
      keputusan.action === "HANDOVER_TO_CS"
        ? await catat({
            sumber: "template",
            kode: keputusan.kode,
            kategori: keputusan.kategori,
            pesan: teksMasuk,
            balasan: keputusan.teks,
          })
        : null;
    return NextResponse.json({
      action: keputusan.action,
      reply: keputusan.teks,
      model: null,
      usage: null,
      source: "template",
      handover,
      templateCode: keputusan.kode,
      templateWhy: keputusan.alasan,
      kategori: keputusan.kategori,
      sumberTemplate,
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

  /**
   * Keputusan Gerbang 2, dibawa keluar dari blok di bawah supaya ikut
   * dilaporkan pada jawaban mana pun — termasuk saat permintaannya
   * berakhir di Sonnet.
   *
   * Tanpa ini, satu-satunya jejak Gerbang 2 adalah log dev server.
   * Akibatnya dari layar tidak ada bedanya antara "Voyage menemukan
   * kecocokan tapi ditahan mode bayangan" dan "Voyage tidak menemukan
   * apa-apa" — padahal dua keadaan itu menuntut tindakan yang
   * berlawanan: yang pertama berarti ambangnya bisa diturunkan, yang
   * kedua berarti contoh pertanyaannya yang kurang.
   */
  let pengenal: {
    jenis: "yakin" | "ragu" | "lewat";
    kandidat?: { code: string; contoh: string; skor: number }[];
    alasan?: string;
    ambang: { yakin: number; ragu: number; margin: number };
    /** null = tidak ada template lain di sepuluh tetangga terdekat. */
    margin?: number | null;
    /** Kode template pembanding, atau null bila tidak ada. */
    pesaing?: string | null;
    mode: string;
    dipakai: boolean;
  } | null = null;

  if (useTemplates !== false) {
    const kenal = await kenaliMaksud(teksMasuk);
    pengenalToken = kenal.token;
    pengenal = {
      jenis: kenal.jenis,
      kandidat:
        kenal.jenis === "lewat"
          ? undefined
          : kenal.kandidat.map((k) => ({
              code: k.code,
              contoh: k.contoh,
              skor: k.skor,
            })),
      alasan: kenal.jenis === "lewat" ? kenal.alasan : undefined,
      ambang: { yakin: AMBANG_YAKIN, ragu: AMBANG_RAGU, margin: AMBANG_MARGIN },
      margin: kenal.jenis === "lewat" ? undefined : kenal.margin,
      pesaing: kenal.jenis === "lewat" ? undefined : kenal.pesaing,
      mode: MODE_PENGENAL,
      // Diisi ulang di bawah bila jawabannya benar-benar dikirim.
      dipakai: false,
    };

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
        pengenal.dipakai = true;
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
          pengenal,
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
    // SENGAJA tidak memanggil catat(). Nilai HANDOVER_TO_CS di
    // bawah bukan keputusan tentang pelanggan — tidak ada yang
    // pernah menilai pesannya; permintaannya cuma dihentikan karena
    // saklar demo dimatikan. Mencatatnya berarti setiap percobaan
    // di panel biaya menaruh satu eskalasi palsu di antrean CS.
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
      pengenal,
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

  /* teksMasuk, bukan `message`. Keduanya sama isinya di titik ini —
     permintaan tanpa teks sudah berhenti di Gerbang -0.5 jauh di
     atas — tetapi hanya teksMasuk yang bertipe string. `message`
     tetap `unknown` sejak lampiran membuatnya boleh kosong. */
  const messages: Anthropic.MessageParam[] = [...past, { role: "user", content: teksMasuk }];

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

    // Claude memutuskan handover untuk hal yang tidak tertangkap
    // kata kunci mana pun — pelanggan yang marah, informasi yang
    // saling bertentangan, permintaan bicara dengan manusia. Justru
    // kasus-kasus inilah yang paling perlu masuk antrean, karena
    // tidak ada aturan tertulis yang akan menangkapnya lain kali.
    const handover =
      action === "HANDOVER_TO_CS"
        ? await catat({
            sumber: "ai",
            kategori: keputusan.kategori,
            pesan: teksMasuk,
            balasan: reply,
          })
        : null;

    return NextResponse.json({
      action, // AUTO_REPLY | ASK_INFORMATION | HANDOVER_TO_CS | CHECK_ORDER_SYSTEM
      reply, // teks balasan untuk pelanggan
      handover,
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
      // Keputusan Gerbang 2 ikut dilaporkan justru pada jalur INI —
      // di sinilah bedanya paling perlu terlihat: apakah Voyage
      // sebenarnya menemukan kecocokan lalu ditahan mode bayangan,
      // atau memang tidak menemukan apa-apa.
      pengenal,
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
