/* ===========================================================
   Bangun contoh pertanyaan + vektornya -> supabase/seed-contoh.sql

   DUA MODE, DAN YANG PERTAMA ADALAH BAWAANNYA:

     npm run contoh              perkiraan saja. TIDAK memanggil
                                 Voyage, tidak memotong kuota.
     npm run contoh -- --jalankan  benar-benar memanggil Voyage.

   Pemisahan ini disengaja. Aturan pertama CLAUDE.md: jangan panggil
   API berbayar tanpa izin. Menjalankan skrip ini secara polos harus
   aman, sehingga izin diberikan lewat tindakan yang sadar, bukan
   lewat kelalaian.

   KENAPA MENULIS .sql DAN BUKAN LANGSUNG KE SUPABASE:
   menulis langsung menuntut service_role key tersimpan di komputer
   ini — kunci yang menembus SELURUH aturan RLS. Berkas .sql yang
   ditempel ke SQL Editor mencapai hasil yang sama tanpa satu pun
   kunci berbahaya berpindah tempat. Pola yang sama dipakai
   seed-templates.sql dan seed-demo.sql.
   =========================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KB = join(AKAR, "knowledge-base");

/* ---------------- Kumpulkan contoh ---------------- */

/** Petik isi kutip ganda, menghormati escape. Tanpa regex. */
function petikKutip(baris, dari) {
  const mulai = baris.indexOf('"', dari);
  if (mulai === -1) return null;
  let isi = "";
  for (let i = mulai + 1; i < baris.length; i++) {
    const c = baris[i];
    if (c === "\\") {
      isi += baris[i + 1] ?? "";
      i++;
      continue;
    }
    if (c === '"') return { isi, akhir: i };
    isi += c;
  }
  return null;
}

/**
 * Ambil pasangan [pesan, kode] dari KASUS di router.test.mjs.
 *
 * Berhenti sebelum KASUS_SATPAM: isinya pesan yang harus DITAHAN
 * Gerbang 0, jadi justru tidak boleh dijadikan contoh template.
 */
function contohDariUji() {
  const baris = readFileSync(join(KB, "router.test.mjs"), "utf8").split(/\r?\n/);
  const out = [];
  for (const b of baris) {
    if (b.includes("KASUS_SATPAM")) break;
    const t = b.trim();
    if (!t.startsWith('["')) continue;
    const pesan = petikKutip(t, 0);
    if (!pesan) continue;
    const sisa = t.slice(pesan.akhir + 1);
    if (sisa.includes("null")) continue; // sengaja diserahkan ke AI
    const kode = petikKutip(sisa, 0);
    if (kode) out.push({ teks: pesan.isi, code: kode.isi });
  }
  return out;
}

const contoh = contohDariUji();

/* Satu pesan untuk dua kode berbeda akan menarik pencarian ke dua
   arah sekaligus. Lebih baik ketahuan sekarang. */
const perTeks = new Map();
for (const c of contoh) {
  if (!perTeks.has(c.teks)) perTeks.set(c.teks, new Set());
  perTeks.get(c.teks).add(c.code);
}
const bentrok = [...perTeks].filter(([, kode]) => kode.size > 1);
if (bentrok.length) {
  console.error("\nContoh yang menunjuk lebih dari satu template:");
  for (const [teks, kode] of bentrok) console.error(`  "${teks}" -> ${[...kode].join(", ")}`);
  process.exit(1);
}

const kodeUnik = new Set(contoh.map((c) => c.code));
console.log("Contoh terkumpul  :", contoh.length);
console.log("Template tercakup :", kodeUnik.size);

/* ---------------- Perkiraan biaya ---------------- */

const { embed, kiraToken, perkiraanBiaya, VOYAGE_MODEL, voyageTerkunci, voyageSiap } =
  await import("../lib/voyage.ts");

const token = kiraToken(contoh.map((c) => c.teks));
const biaya = perkiraanBiaya(token);

console.log("\n--- perkiraan panggilan Voyage ---");
console.log("  model         :", VOYAGE_MODEL);
console.log("  permintaan    : 1 (semua muat dalam satu batch)");
console.log("  token (kira)  :", token);
console.log(`  biaya (kira)  : USD ${biaya.usd.toFixed(6)}  ~ Rp ${biaya.idr.toFixed(2)}`);

const jalankan = process.argv.includes("--jalankan");
if (!jalankan) {
  console.log("\nMODE PERKIRAAN. Voyage TIDAK dipanggil, kuota tidak terpakai.");
  console.log("Untuk benar-benar menjalankan:  npm run contoh -- --jalankan");
  process.exit(0);
}

if (voyageTerkunci()) {
  console.error("\nAI_TEST_LOCK/VOYAGE_LOCK aktif — panggilan ditolak sebelum dikirim.");
  process.exit(1);
}
if (!voyageSiap()) {
  console.error("\nVOYAGE_API_KEY belum diisi di web/.env.local.");
  process.exit(1);
}

/* ---------------- Panggil Voyage ---------------- */

console.log("\nMemanggil Voyage...");
const hasil = await embed(
  contoh.map((c) => c.teks),
  // "document": contoh ini DISIMPAN untuk dicari nanti. Pesan
  // pelanggan yang masuk nanti disematkan sebagai "query".
  "document",
);

console.log("  dimensi vektor:", hasil.dimensi);
console.log("  token ditagih :", hasil.token);
const nyata = perkiraanBiaya(hasil.token);
console.log(`  biaya nyata   : USD ${nyata.usd.toFixed(6)}  ~ Rp ${nyata.idr.toFixed(2)}`);

if (hasil.vektor.length !== contoh.length) {
  console.error("Jumlah vektor tidak sama dengan jumlah contoh — dihentikan.");
  process.exit(1);
}

/* ---------------- Tulis SQL ---------------- */

const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const vec = (v) => "'[" + v.map((x) => x.toFixed(6)).join(",") + "]'::vector";

const baris = [];
const P = (...s) => baris.push(...s);

P(
  "-- ===========================================================",
  "-- Infarm CS — contoh pertanyaan + vektornya (Gerbang 2)",
  `-- Dibangkitkan ${new Date().toISOString().slice(0, 10)} oleh web/scripts/bangun-contoh.mjs`,
  "--",
  `-- Model    : ${hasil.model}`,
  `-- Dimensi  : ${hasil.dimensi}`,
  `-- Contoh   : ${contoh.length} untuk ${kodeUnik.size} template`,
  "--",
  "-- ⚠️  SUMBER 'bootstrap', BUKAN DATA SUNGGUHAN.",
  "-- Isinya diambil dari kasus uji router — kalimatnya terlalu rapi",
  "-- dan terlalu sedikit untuk mewakili cara pelanggan sungguhan",
  "-- mengetik. Gunanya hanya supaya Gerbang 2 bisa dijalankan dan",
  "-- diukur sebelum tim CS selesai mengisi contoh yang sebenarnya.",
  "-- Jangan pernah menyimpulkan akurasi sistem dari baris-baris ini.",
  "--",
  "-- Prasyarat : schema-vektor.sql sudah dijalankan.",
  "-- Cara pakai: SQL Editor -> tempel seluruh isi -> Run",
  "-- Sifat     : idempoten (on conflict do update).",
  "-- ===========================================================",
  "",
  "begin;",
  "",
  "insert into public.template_examples",
  "  (template_id, teks, sumber, embedding, embedding_model, embedding_dibuat)",
  "select t.id, v.teks, 'bootstrap', v.embedding, v.model, now()",
  "from (values",
);

P(
  contoh
    .map(
      (c, i) =>
        "  (" +
        [q(c.code), q(c.teks), vec(hasil.vektor[i]), q(hasil.model)].join(", ") +
        ")",
    )
    .join(",\n"),
  ") as v(code, teks, embedding, model)",
  "join public.templates t on t.code = v.code",
  "on conflict (template_id, teks) do update set",
  "  embedding        = excluded.embedding,",
  "  embedding_model  = excluded.embedding_model,",
  "  embedding_dibuat = excluded.embedding_dibuat;",
  "",
  "commit;",
  "",
  "-- Periksa:",
  `-- select count(*) as contoh, count(embedding) as bervektor from public.template_examples;  -- harus ${contoh.length}`,
);

const tujuan = join(AKAR, "supabase", "seed-contoh.sql");
writeFileSync(tujuan, baris.join("\n") + "\n");
console.log("\nsupabase/seed-contoh.sql ditulis —", contoh.length, "baris contoh.");
console.log("Jalankan berkas itu di SQL Editor Supabase untuk memuatnya.");
