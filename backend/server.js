/* ===========================================================
   Infarm CS — AI Engine (Layer 3, Tech Stack claude.md)
   Express + Claude API (Anthropic). Memuat claude.md sebagai
   system prompt, mengklasifikasikan aksi, dan membalas pelanggan.
   =========================================================== */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSystemPrompt, parseAction } from './knowledge.js';
import { routeToCategory, logRouting } from '../knowledge-base/router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 600);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Sajikan frontend statis (index.html, dashboard.html, dll) dari folder project
app.use(express.static(ROOT));

// Inisialisasi Claude. API key diambil dari .env (ANTHROPIC_API_KEY)
/**
 * SAKLAR PENGAMAN SALDO — lihat CLAUDE.md bagian paling atas.
 * Bila AI_TEST_LOCK=1, panggilan berbayar ke Claude ditolak sebelum
 * dikirim. Jalur template tetap jalan.
 */
function aiTerkunci() {
  const v = String(process.env.AI_TEST_LOCK || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'ya';
}

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

// System prompt disusun sekali saat start (Opsi A: inject KB)
// Prompt penuh hanya dipakai untuk laporan /api/health. Permintaan
// nyata memakai hasil routeToCategory() — lihat handler /api/chat.
const SYSTEM_PROMPT = buildSystemPrompt();

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    claudeConfigured: Boolean(client),
    systemPromptChars: SYSTEM_PROMPT.length,
  });
});

// ---------- Endpoint utama: balas chat pelanggan ----------
// body: { message: string, history?: [{role:'user'|'assistant', content:string}] }
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Field "message" wajib diisi.' });
  }

  if (!client) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY belum diset. Salin .env.example ke .env dan isi API key.',
    });
  }

  try {
    const messages = [
      ...history.filter((m) => m && m.role && m.content),
      { role: 'user', content: message },
    ];

    // Router memilih berkas FAQ yang relevan; hanya itu yang
    // ikut ke system prompt (bukan keempat berkas sekaligus).
    const keputusan = routeToCategory(message);

    if (keputusan.jenis === 'template') {
      logRouting(keputusan);
      return res.json({
        action: keputusan.action,
        reply: keputusan.teks,
        model: null,
        usage: null,
        source: 'template',
        templateCode: keputusan.kode,
      });
    }

    logRouting(keputusan);

    // ---------- Penjaga saldo ----------
    // Ditaruh SETELAH jalur template supaya balasan gratis tetap
    // jalan: yang dikunci hanya yang memotong saldo. Sepadan dengan
    // penjaga yang sama di web/app/api/chat/route.ts.
    if (aiTerkunci()) {
      console.warn('[SALDO] Panggilan Claude ditolak — AI_TEST_LOCK aktif.');
      return res.status(423).json({
        error:
          'AI_TEST_LOCK aktif — panggilan berbayar ke Claude ditolak. ' +
          'Jalur template tetap berjalan. Hapus AI_TEST_LOCK di ' +
          'backend/.env lalu jalankan ulang server untuk membukanya.',
        terkunci: true,
      });
    }

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(keputusan.berkas),
      messages,
    });

    const raw = resp.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') || '';
    const { action, reply } = parseAction(raw);

    res.json({
      action,                 // AUTO_REPLY | ASK_INFORMATION | HANDOVER_TO_CS | CHECK_ORDER_SYSTEM
      reply,                  // teks balasan untuk pelanggan
      model: MODEL,
      usage: resp.usage,      // jumlah token (untuk estimasi biaya)
      source: 'ai',
      kategori: keputusan.kategori,
      berkasKb: keputusan.berkas,
    });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: 'Gagal memproses ke Claude API.', detail: err.message });
  }
});

// ---------- Placeholder webhook marketplace (Layer 2) ----------
// Nantinya: validasi HMAC-SHA256 lalu teruskan ke /api/chat atau CHECK_ORDER_SYSTEM.
app.post('/api/webhook/:platform', (req, res) => {
  console.log(`[webhook] pesan masuk dari ${req.params.platform}`);
  // TODO: verifikasi signature + routing sesuai claude.md
  res.json({ received: true, platform: req.params.platform });
});

app.listen(PORT, () => {
  console.log(`\n🌱 Infarm CS backend berjalan di http://localhost:${PORT}`);
  console.log(`   Frontend  : http://localhost:${PORT}/index.html`);
  console.log(`   Dashboard : http://localhost:${PORT}/dashboard.html`);
  console.log(`   Model     : ${MODEL}`);
  console.log(`   Claude    : ${client ? 'siap ✅' : 'BELUM dikonfigurasi ⚠️  (set ANTHROPIC_API_KEY di .env)'}\n`);
});
