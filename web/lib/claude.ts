/* ===========================================================
   Klien Claude — port dari inisialisasi Anthropic di
   backend/server.js. Dipakai bersama oleh /api/chat & /api/health.
   =========================================================== */
import Anthropic from "@anthropic-ai/sdk";

/**
 * Model mengikuti Tech Stack di claude.md (`claude-sonnet-4-6`),
 * tetap bisa ditimpa lewat env CLAUDE_MODEL tanpa ubah kode.
 */
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

/**
 * Balasan CS itu pendek (2–5 kalimat), jadi 600 token sudah cukup
 * dan menjaga biaya tetap rendah — nilai ini diwarisi dari
 * backend/.env.example. Naikkan lewat env bila balasan terpotong.
 */
export const MAX_TOKENS = Number(process.env.MAX_TOKENS || 600);

let client: Anthropic | null = null;

/**
 * Kembalikan klien Anthropic, atau null bila ANTHROPIC_API_KEY
 * belum diset (perilaku sama dengan server.js: endpoint membalas
 * 503 yang informatif, bukan crash saat start).
 */
export function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}
