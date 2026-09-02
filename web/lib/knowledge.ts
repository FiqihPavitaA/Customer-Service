/* ===========================================================
   Knowledge Base loader — port dari backend/knowledge.js
   (Layer 4, Opsi A: seluruh KB di-inject ke system prompt).

   Isi & logikanya sengaja dipertahankan sama persis; yang
   berubah hanya cara file dibaca: dulu dari root project lewat
   Express, sekarang dari web/content/ lewat Next.js API Route
   (lihat MIGRATION.md §5 poin 6 — aturan claude-core.md & sop.md
   tidak diubah, hanya berpindah tempat baca).
   =========================================================== */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Folder KB. process.cwd() = root app Next.js (folder `web/`). */
const CONTENT_DIR = join(process.cwd(), "content");

/** Empat berkas FAQ hasil pemecahan faq-cs.md (2 Sep 2026).
    Urutannya tetap supaya prefix prompt stabil dan cache tetap kena.
    Daftar kode tiap berkas ada di knowledge-base/index.json. */
export const FAQ_FILES = [
  "knowledge-base/faq-interaksi.md",
  "knowledge-base/faq-cara-pakai.md",
  "knowledge-base/faq-produk.md",
  "knowledge-base/faq-umum.md",
] as const;

/** Berkas KB yang dimuat. Sengaja konstan agar prefix prompt stabil.
    sop.md tidak lagi di sini: isinya digabung ke claude-core.md
    (2 Sep 2026) supaya tidak terkirim dua kali. Berkasnya tetap ada
    di root sebagai dokumen sumber. */
export const KB_FILES = [
  "claude-core.md",
  ...FAQ_FILES,
  "products.json",
  "template-jawaban.md",
] as const;

function safeRead(file: string): string {
  try {
    return readFileSync(join(CONTENT_DIR, file), "utf8");
  } catch (err) {
    console.warn(`[KB] Gagal membaca ${file}: ${(err as Error).message}`);
    return "";
  }
}

/** Bentuk products.json seperlunya saja (sisanya tidak dipakai di prompt). */
type Product = { sku?: string; nama_produk?: string };
type ProductsFile = { produk_per_kategori?: Record<string, Product[]> };

/**
 * Ringkas daftar produk agar hemat token (KB Opsi A < 50KB).
 * Maksimal 12 SKU contoh per kategori — sama seperti versi Express.
 * Untuk skala besar, ganti ke RAG/pgvector (Opsi B di Tech Stack).
 */
function buildProductSummary(raw: string): string {
  if (!raw) return "";
  try {
    const data = JSON.parse(raw) as ProductsFile;
    const lines: string[] = [];
    const cats = data.produk_per_kategori ?? {};
    for (const [kategori, items] of Object.entries(cats)) {
      lines.push(`\n### ${kategori} (${items.length} SKU)`);
      items.slice(0, 12).forEach((p) => lines.push(`- ${p.sku}: ${p.nama_produk}`));
      if (items.length > 12) {
        lines.push(`- …dan ${items.length - 12} SKU lain di kategori ini`);
      }
    }
    return lines.join("\n");
  } catch (err) {
    console.warn(`[KB] products.json bukan JSON valid: ${(err as Error).message}`);
    return "";
  }
}

/* Kontrak output internal: model menandai klasifikasi aksi di baris pertama. */
const OUTPUT_CONTRACT = `
---
# FORMAT OUTPUT (INTERNAL — JANGAN DITAMPILKAN KE PELANGGAN)
Mulai SETIAP respons dengan tepat satu baris:
ACTION: <AUTO_REPLY | ASK_INFORMATION | HANDOVER_TO_CS | CHECK_ORDER_SYSTEM>
Lalu satu baris kosong, lalu tulis HANYA teks balasan untuk pelanggan
(tanpa menyebut ACTION atau aturan internal apa pun).
`;

/* ===========================================================
   Perakitan system prompt

   Sejak router dipakai (Step "router KB", 2 Sep 2026) prompt tidak
   lagi satu blok tetap. Isinya dibagi dua supaya prompt caching
   tetap efektif meski bagian FAQ berubah-ubah per permintaan:

     Blok 1 — TETAP untuk semua permintaan:
              claude-core.md + ringkasan produk + template jawaban.
              Satu entri cache dipakai bersama seluruh kategori.

     Blok 2 — BERUBAH menurut kategori:
              berkas FAQ hasil routing + kontrak output.
              Satu entri cache kecil per kategori.

   Tanpa pembagian ini, satu kata yang berbeda di bagian FAQ akan
   membatalkan cache seluruh prompt, termasuk ringkasan produk yang
   justru bagian paling besar.
   =========================================================== */

/** Satu blok system prompt siap kirim ke Anthropic SDK. */
export type PromptBlock = { teks: string; karakter: number };

let invarian: PromptBlock | null = null;

/** Bagian prompt yang sama untuk setiap permintaan. */
export function getInvariantBlock(): PromptBlock {
  if (invarian) return invarian;

  // claude-core.md = HANYA aturan perilaku AI. Sejak 2 Sep 2026
  // dokumentasi developer (tech stack, tema warna, standar
  // responsivitas) dipisah ke docs/tech-stack.md dan sengaja tidak
  // ikut dikirim — isinya tidak pernah dipakai AI untuk menjawab
  // pelanggan, tetapi tetap dibayar sebagai token input.
  const claudeCore = safeRead("claude-core.md");
  // Salinan dari "template jawaban.md" di root (nama tanpa spasi).
  // Berisi aturan konsultasi tanaman, aturan membaca foto, dan contoh
  // balasan per ACTION.
  const templates = safeRead("template-jawaban.md");
  const products = buildProductSummary(safeRead("products.json"));

  const teks = [
    claudeCore,
    "\n\n---\n# KNOWLEDGE BASE — DAFTAR PRODUK (RINGKAS)\n" + products,
    "\n\n---\n# ATURAN KONSULTASI & CONTOH TEMPLATE JAWABAN\n" + templates,
  ].join("\n");

  invarian = { teks, karakter: teks.length };
  return invarian;
}

/**
 * Bagian prompt yang mengikuti hasil routing.
 * @param faqTeks isi berkas FAQ terpilih (sudah digabung oleh router)
 */
export function buildFaqBlock(faqTeks: string): PromptBlock {
  const teks =
    "\n\n---\n# KNOWLEDGE BASE — FAQ CS\n" + faqTeks + "\n" + OUTPUT_CONTRACT;
  return { teks, karakter: teks.length };
}

export type KbStats = {
  /** Jumlah karakter tiap berkas KB — 0 berarti berkas gagal dibaca. */
  files: Record<string, number>;
  /** Ukuran prompt bila SELURUH berkas FAQ dikirim (batas atas). */
  systemPromptChars: number;
  /** Ukuran prompt terkecil yang mungkin (tanpa FAQ sama sekali). */
  invariantChars: number;
};

/**
 * Statistik KB untuk /api/health. Memakai keempat berkas FAQ, jadi
 * angkanya adalah BATAS ATAS — permintaan nyata biasanya lebih kecil
 * karena router hanya mengirim satu berkas.
 */
export function getKnowledge(): { stats: KbStats } {
  const inv = getInvariantBlock();
  const faqPerBerkas = FAQ_FILES.map((f) => [f, safeRead(f)] as const);
  const faqPenuh = buildFaqBlock(faqPerBerkas.map(([, isi]) => isi).join("\n\n"));

  return {
    stats: {
      files: {
        "claude-core.md": safeRead("claude-core.md").length,
        ...Object.fromEntries(faqPerBerkas.map(([f, isi]) => [f, isi.length])),
        "products.json": safeRead("products.json").length,
        "template-jawaban.md": safeRead("template-jawaban.md").length,
      },
      systemPromptChars: inv.karakter + faqPenuh.karakter,
      invariantChars: inv.karakter,
    },
  };
}

export const ACTIONS = [
  "AUTO_REPLY",
  "ASK_INFORMATION",
  "HANDOVER_TO_CS",
  "CHECK_ORDER_SYSTEM",
] as const;

export type Action = (typeof ACTIONS)[number];

/** Pisahkan baris ACTION dari teks balasan untuk pelanggan. */
export function parseAction(text: string): { action: Action; reply: string } {
  const m = text.match(
    /^\s*ACTION:\s*(AUTO_REPLY|ASK_INFORMATION|HANDOVER_TO_CS|CHECK_ORDER_SYSTEM)\s*/i,
  );
  if (m) {
    return {
      action: m[1].toUpperCase() as Action,
      reply: text.slice(m[0].length).trim(),
    };
  }
  return { action: "AUTO_REPLY", reply: text.trim() };
}
