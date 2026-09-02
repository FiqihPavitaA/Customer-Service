import { NextResponse } from "next/server";
import { getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { getKnowledge } from "@/lib/knowledge";
import { templateStats } from "@/lib/templates";

/* ===========================================================
   GET /api/health — port dari app.get('/api/health') di server.js.
   Dipakai untuk memastikan KB terbaca dan API key terpasang,
   tanpa memanggil (dan membayar) Claude API.
   =========================================================== */

export const runtime = "nodejs";
// Jangan di-cache: jawabannya bergantung env & berkas saat diminta.
export const dynamic = "force-dynamic";

export function GET() {
  const { stats } = getKnowledge();
  const missing = Object.entries(stats.files)
    .filter(([, chars]) => chars === 0)
    .map(([file]) => file);

  return NextResponse.json({
    ok: missing.length === 0,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    claudeConfigured: Boolean(getClient()),
    // Batas atas: bila keempat berkas FAQ ikut terkirim.
    systemPromptChars: stats.systemPromptChars,
    // Bagian yang selalu terkirim, berapa pun kategorinya.
    invariantChars: stats.invariantChars,
    kbFiles: stats.files,
    missingKbFiles: missing,
    templates: templateStats(),
  });
}
