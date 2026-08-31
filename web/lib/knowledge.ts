/* ===========================================================
   Knowledge Base loader — port dari backend/knowledge.js
   (Layer 4, Opsi A: seluruh KB di-inject ke system prompt).

   Isi & logikanya sengaja dipertahankan sama persis; yang
   berubah hanya cara file dibaca: dulu dari root project lewat
   Express, sekarang dari web/content/ lewat Next.js API Route
   (lihat MIGRATION.md §5 poin 6 — aturan claude.md & sop.md
   tidak diubah, hanya berpindah tempat baca).
   =========================================================== */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Folder KB. process.cwd() = root app Next.js (folder `web/`). */
const CONTENT_DIR = join(process.cwd(), "content");

/** Berkas KB yang dimuat. Sengaja konstan agar prefix prompt stabil. */
export const KB_FILES = [
  "claude.md",
  "sop.md",
  "faq-cs.md",
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

export type KbStats = {
  /** Jumlah karakter tiap berkas KB — 0 berarti berkas gagal dibaca. */
  files: Record<string, number>;
  systemPromptChars: number;
};

type Kb = { systemPrompt: string; stats: KbStats };

let cache: Kb | null = null;

/**
 * Susun system prompt lengkap:
 *   claude.md + sop.md + ringkasan produk + FAQ + kontrak output.
 * Dibaca sekali lalu di-cache di memori proses (setara `const
 * SYSTEM_PROMPT = buildSystemPrompt()` saat start di server.js),
 * tetapi malas (lazy) supaya tidak ada I/O berkas saat build.
 */
export function getKnowledge(): Kb {
  if (cache) return cache;

  const claudeMd = safeRead("claude.md");
  const sop = safeRead("sop.md");
  const faq = safeRead("faq-cs.md");
  // Salinan dari "template jawaban.md" di root (nama tanpa spasi).
  // Berisi aturan konsultasi tanaman, aturan membaca foto, dan contoh
  // balasan per ACTION. Versi Express tidak pernah memuatnya.
  const templates = safeRead("template-jawaban.md");
  const productsRaw = safeRead("products.json");
  const products = buildProductSummary(productsRaw);

  const systemPrompt = [
    claudeMd,
    "\n\n---\n# ATURAN OPERASIONAL (SOP)\n" + sop,
    "\n\n---\n# KNOWLEDGE BASE — DAFTAR PRODUK (RINGKAS)\n" + products,
    "\n\n---\n# KNOWLEDGE BASE — FAQ CS\n" + faq,
    "\n\n---\n# ATURAN KONSULTASI & CONTOH TEMPLATE JAWABAN\n" + templates,
    OUTPUT_CONTRACT,
  ].join("\n");

  cache = {
    systemPrompt,
    stats: {
      files: {
        "claude.md": claudeMd.length,
        "sop.md": sop.length,
        "faq-cs.md": faq.length,
        "products.json": productsRaw.length,
        "template-jawaban.md": templates.length,
      },
      systemPromptChars: systemPrompt.length,
    },
  };
  return cache;
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
