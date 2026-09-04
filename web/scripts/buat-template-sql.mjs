/* ===========================================================
   Bangkitkan supabase/seed-templates.sql dari berkas .md.

   Mengisi tabel `templates` (152 baris) dan `template_rules`
   (43 baris) yang dibuat schema-kb.sql.

   DIBANGKITKAN, BUKAN DIKETIK ULANG. Sumbernya pustaka yang sama
   yang dibaca router saat menjawab pelanggan, jadi isi database
   dijamin identik dengan isi berkas — bukan salinan yang bisa
   menyimpang diam-diam.

   Jalankan: npm run template-sql   (di folder web/)
   =========================================================== */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAsalKode,
  getRules,
  getTemplateLibrary,
  setKbDir,
} from "../content/knowledge-base/router.js";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
setKbDir(join(AKAR, "knowledge-base"));

/* ---------------- Penolong SQL ---------------- */

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};

/**
 * Array teks sebagai ARRAY['a','b'], bukan literal '{a,b}'.
 *
 * Isinya pola regex — penuh backslash, kurung, koma, dan kurung
 * kurawal. Bentuk literal '{...}' punya aturan escaping sendiri di
 * atas escaping string, dan itu sumber kesalahan yang sulit dilihat.
 * ARRAY[] hanya butuh escaping kutip tunggal biasa.
 */
const arr = (a) =>
  !a || a.length === 0 ? "'{}'::text[]" : "ARRAY[" + a.map(q).join(", ") + "]::text[]";

/* ---------------- Pemetaan ---------------- */

const SLUG = {
  "faq-interaksi.md": "interaksi",
  "faq-cara-pakai.md": "cara-pakai",
  "faq-produk.md": "produk",
  "faq-umum.md": "umum",
};

/**
 * Template yang memuat nomor rekening atau nomor telepon.
 * claude-core.md melarang mengarahkan transaksi ke luar marketplace,
 * jadi ketiganya masuk dengan is_sensitive=true DAN is_active=false —
 * tersimpan supaya CS manusia bisa menyalinnya bila memang perlu,
 * tetapi tidak pernah dipakai balasan otomatis.
 */
const PEKA = new Set(["REKENING", "CS WA", "CS KOMPLAIN"]);

/**
 * Promo bertanggal. Tidak satu pun punya aturan pemicu, jadi
 * sebenarnya sudah tidak mungkin terkirim otomatis — tetapi
 * ditandai lewat `note` supaya siapa pun yang nanti tergoda
 * menambahkan pemicunya tahu bahwa isinya kedaluwarsa.
 */
const PROMO = new Set(["NATAL", "1010", "12.12", "IDUL FITRI", "6.6"]);

/* ---------------- Susun ---------------- */

const pustaka = getTemplateLibrary();
const asal = getAsalKode();
const aturan = getRules();

const baris = [];
const P = (...s) => baris.push(...s);

P(
  "-- ===========================================================",
  "-- Infarm CS — isi tabel templates & template_rules",
  "-- Dibangkitkan dari berkas .md pada 4 September 2026.",
  "--",
  "-- Prasyarat: supabase/schema.sql dan schema-kb.sql sudah",
  "-- dijalankan lebih dulu.",
  "--",
  `-- Isi: ${pustaka.size} template, ${aturan.length} aturan pemicu.`,
  "--",
  "-- Ini BUKAN data karangan — isinya balasan CS yang sungguhan",
  "-- dipakai, disalin apa adanya dari keempat berkas FAQ.",
  "--",
  "-- Cara pakai: SQL Editor → tempel seluruh isi → Run",
  "--",
  "-- Sifat: idempoten. Menjalankan ulang MEMPERBARUI isi template",
  "-- dari berkas .md (on conflict do update), jadi berkas tetap",
  "-- bisa dipakai sebagai sumber selama tabel belum jadi acuan.",
  "--",
  "-- ⚠️  Setelah tim CS mulai mengedit lewat halaman Kelola",
  "-- Template, JANGAN jalankan ulang berkas ini — suntingan mereka",
  "-- akan tertimpa isi berkas .md yang lebih lama.",
  "-- ===========================================================",
  "",
  "begin;",
  "",
  "-- ---------- templates ----------",
  "insert into public.templates",
  "  (code, category_slug, body, action, is_active, is_sensitive, note)",
  "values",
);

const barisTemplate = [];
for (const [code, body] of pustaka) {
  const berkas = asal.get(code) ?? "faq-umum.md";
  const slug = SLUG[berkas] ?? "umum";
  const peka = PEKA.has(code);
  const promo = PROMO.has(code);

  const note = peka
    ? "Memuat nomor rekening/telepon — dimatikan agar tidak terkirim otomatis (claude-core.md melarang mengarahkan transaksi ke luar marketplace)."
    : promo
      ? "Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun."
      : null;

  barisTemplate.push(
    "  (" +
      [q(code), q(slug), q(body), "'AUTO_REPLY'", q(!peka), q(peka), q(note)].join(", ") +
      ")",
  );
}

P(
  barisTemplate.join(",\n"),
  "on conflict (code) do update set",
  "  category_slug = excluded.category_slug,",
  "  body          = excluded.body,",
  "  is_active     = excluded.is_active,",
  "  is_sensitive  = excluded.is_sensitive,",
  "  note          = excluded.note;",
  "",
);

/* ---------------- template_rules ---------------- */

P(
  "-- ---------- template_rules ----------",
  "-- priority = urutan penilaian di router.js. URUTAN ADALAH LOGIKA:",
  '-- "cara pakai miracle powder" jatuh ke [MIRACLE POWDER] dan bukan',
  "-- [PRODUK MIRACLE] semata karena nomornya lebih kecil.",
  "--",
  "-- Dikosongkan dulu supaya penomoran ulang tidak bertabrakan dengan",
  "-- baris lama. Aman: barisnya memang selalu dibangkitkan dari",
  "-- router.js, bukan diedit langsung di database.",
  "delete from public.template_rules;",
  "",
  "insert into public.template_rules",
  "  (template_id, priority, when_patterns, also_pattern, unless_patterns, why)",
  "select t.id, v.priority, v.when_patterns, v.also_pattern, v.unless_patterns, v.why",
  "from (values",
);

const barisAturan = aturan.map(
  (a) =>
    "  (" +
    [
      q(a.code),
      String(a.urutan),
      arr(a.when),
      q(a.also),
      arr(a.unless),
      q(a.why),
    ].join(", ") +
    ")",
);

P(
  barisAturan.join(",\n"),
  ") as v(code, priority, when_patterns, also_pattern, unless_patterns, why)",
  "join public.templates t on t.code = v.code;",
  "",
  "commit;",
  "",
  "-- ===========================================================",
  "-- Periksa hasilnya",
  "-- ===========================================================",
  "-- select count(*) as template from public.templates;          -- harus " +
    pustaka.size,
  "-- select count(*) as aturan   from public.template_rules;     -- harus " +
    aturan.length,
  "--",
  "-- Template yang BELUM punya pemicu — ini daftar kerja tim CS,",
  "-- tiap satu yang ditutup memindahkan pertanyaannya dari jalur",
  "-- berbayar ke jalur Rp 0:",
  "-- select t.code, t.category_slug",
  "-- from public.templates t",
  "-- left join public.template_rules r on r.template_id = t.id",
  "-- where r.id is null and t.is_active",
  "-- order by t.category_slug, t.code;",
);

writeFileSync(join(AKAR, "supabase", "seed-templates.sql"), baris.join("\n") + "\n");

/* ---------------- Laporan & pemeriksaan ---------------- */

const tanpaAturan = pustaka.size - new Set(aturan.map((a) => a.code)).size;
console.log("supabase/seed-templates.sql dibuat");
console.log("  template        :", pustaka.size);
console.log("  aturan pemicu   :", aturan.length);
console.log("  tanpa pemicu    :", tanpaAturan);
console.log("  ditandai peka   :", [...PEKA].filter((k) => pustaka.has(k)).join(", "));

/* Aturan yang kodenya tidak ada di pustaka akan hilang diam-diam
   karena JOIN-nya tidak ketemu — lebih baik berhenti sekarang. */
const yatim = aturan.filter((a) => !pustaka.has(a.code));
if (yatim.length) {
  console.error("\n⚠️  Aturan menunjuk kode yang tidak ada di berkas FAQ:");
  yatim.forEach((a) => console.error("   [" + a.code + "]"));
  process.exit(1);
}

/* Kode peka yang punya aturan berarti bisa terkirim otomatis
   walaupun is_active=false — periksa, jangan diasumsikan. */
const pekaBeraturan = aturan.filter((a) => PEKA.has(a.code));
if (pekaBeraturan.length) {
  console.error("\n⚠️  Kode peka punya aturan pemicu:");
  pekaBeraturan.forEach((a) => console.error("   [" + a.code + "]"));
  process.exit(1);
}

console.log("  pemeriksaan     : tidak ada aturan yatim, tidak ada kode peka berpemicu");
