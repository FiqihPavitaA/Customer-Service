import { NextResponse } from "next/server";
import { aiTerkunci, getClient, MAX_TOKENS, MODEL } from "@/lib/claude";
import { getKnowledge } from "@/lib/knowledge";
import { templateStats } from "@/lib/templates";
import {
  siapkanSumberTemplate,
  statusSumberTemplate,
} from "@/lib/db/templatesServer";
import { siapkanSumberSatpam, statusSumberSatpam } from "@/lib/db/satpamServer";
import { siapkanJadwalAI, statusJadwalAI } from "@/lib/db/jadwalServer";

/* ===========================================================
   GET /api/health — port dari app.get('/api/health') di server.js.
   Dipakai untuk memastikan KB terbaca dan API key terpasang,
   tanpa memanggil (dan membayar) Claude API.
   =========================================================== */

export const runtime = "nodejs";
// Jangan di-cache: jawabannya bergantung env & berkas saat diminta.
export const dynamic = "force-dynamic";

export async function GET() {
  // Panggil dulu supaya yang dilaporkan adalah keadaan sekarang,
  // bukan sisa pemuatan terakhir yang mungkin belum pernah terjadi.
  // Keduanya berjalan bersamaan: keduanya sekadar satu perjalanan
  // baca ke Supabase dan tidak saling bergantung.
  await Promise.all([siapkanSumberTemplate(), siapkanSumberSatpam(), siapkanJadwalAI()]);

  const { stats } = getKnowledge();
  const missing = Object.entries(stats.files)
    .filter(([, chars]) => chars === 0)
    .map(([file]) => file);

  return NextResponse.json({
    ok: missing.length === 0,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    claudeConfigured: Boolean(getClient()),
    // Saklar pengaman saldo. Dilaporkan supaya halaman AI Chatbot bisa
    // menjelaskan kenapa balasan AI ditolak, alih-alih terlihat rusak.
    aiTerkunci: aiTerkunci(),
    // Batas atas: bila keempat berkas FAQ ikut terkirim.
    systemPromptChars: stats.systemPromptChars,
    // Bagian yang selalu terkirim, berapa pun kategorinya.
    invariantChars: stats.invariantChars,
    kbFiles: stats.files,
    missingKbFiles: missing,
    templates: templateStats(),
    // Dari mana Lapis 1 membaca template: "supabase" atau "berkas".
    // Dilaporkan di sini karena inilah satu-satunya cara memastikan
    // dari luar bahwa penyuntingan tim CS benar-benar sampai ke
    // pelanggan — sumber yang berganti diam-diam tidak akan pernah
    // muncul sebagai galat.
    sumberTemplate: statusSumberTemplate(),
    // Dari mana Gerbang 0 membaca kata sensitif: "supabase" atau
    // "kode". Lebih penting daripada sumberTemplate di atas, karena
    // jatuh ke "kode" berarti kata yang baru ditambahkan admin
    // TIDAK berlaku — dan satu-satunya gejalanya adalah pesan yang
    // seharusnya dialihkan malah dijawab mesin. `ditolak` memuat
    // aturan yang polanya tidak sah, bila ada.
    sumberSatpam: statusSumberSatpam(),
    // Keadaan AI sekarang beserta alasannya. Dilaporkan di sini
    // supaya "kenapa pelanggan tidak dijawab" bisa dijawab dari
    // luar, tanpa membuka console dan tanpa menebak jam berapa
    // server mengira sekarang.
    jadwalAI: statusJadwalAI(),
  });
}
