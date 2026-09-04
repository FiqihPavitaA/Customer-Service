/* Bangkitkan supabase/seed-demo.sql dari web/lib/db/seed.ts.
   Dibangkitkan, bukan diketik ulang, supaya isi di database persis
   sama dengan yang selama ini tampil di mode demo. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Akar repo, dua tingkat di atas web/scripts/. */
const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
import {
  SEED_CONVERSATIONS,
  SEED_ESCALATIONS,
  SEED_AI_FLAGS,
} from "../lib/db/seed.ts";

/** Kutip nilai untuk SQL. null jadi NULL, kutip tunggal digandakan. */
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
};

/** Objek/array jadi literal jsonb. */
const j = (v) => (v === null || v === undefined ? "NULL" : q(JSON.stringify(v)) + "::jsonb");

const baris = [];
const P = (...s) => baris.push(...s);

P(
  "-- ===========================================================",
  "-- Infarm CS — DATA CONTOH untuk demo (opsional)",
  "-- Dibangkitkan dari web/lib/db/seed.ts pada 4 September 2026.",
  "--",
  "-- ⚠️  INI DATA KARANGAN, BUKAN PERCAKAPAN PELANGGAN SUNGGUHAN.",
  "--",
  "-- Gunanya satu: setelah Supabase menyala, tabel conversations",
  "-- kosong, sehingga halaman Chat terlihat mati saat didemokan ke",
  "-- tim CS. Berkas ini mengisinya dengan percakapan contoh yang",
  "-- sama persis dengan yang selama ini tampil di mode demo.",
  "--",
  "-- JANGAN dijalankan di database yang sudah berisi percakapan",
  "-- pelanggan sungguhan, kecuali Anda memang ingin data contoh",
  "-- ikut muncul di sana.",
  "--",
  "-- Cara pakai : SQL Editor → tempel seluruh isi → Run",
  "-- Cara hapus : jalankan blok DELETE di bagian paling bawah",
  "--",
  "-- Semua baris memakai UUID berpola khusus supaya mudah dikenali",
  "-- dan dihapus tanpa menyentuh data nyata:",
  "--   c0000000-…  percakapan",
  "--   e0000000-…  eskalasi",
  "--   f0000000-…  flag koreksi",
  "--",
  "-- Sifat: idempoten — `on conflict do nothing`, aman diulang.",
  "-- ===========================================================",
  "",
  "begin;",
  "",
);

/* ---------------- conversations ---------------- */
P(
  "-- ---------- conversations ----------",
  "-- Kolom chat_count, product_query, order_status, order_courier",
  "-- di mode demo TIDAK ikut: keempatnya tidak punya kolom di",
  "-- schema.sql. chat_count dihitung ulang dari panjang messages,",
  "-- sisanya milik API pesanan marketplace.",
  "insert into public.conversations",
  "  (id, platform, customer_id, customer_name, shop_name, order_id,",
  "   tracking_no, messages, action, handover_summary, handover_detail,",
  "   ai_suggestion, unread, last_message_at, created_at, updated_at)",
  "values",
);

const convRows = SEED_CONVERSATIONS.map(
  (c) =>
    "  (" +
    [
      q(c.id),
      q(c.platform),
      q(c.customer_id),
      q(c.customer_name),
      q(c.shop_name),
      q(c.order_id),
      q(c.tracking_no),
      j(c.messages),
      q(c.action),
      q(c.handover_summary),
      j(c.handover_detail),
      q(c.ai_suggestion),
      q(c.unread),
      q(c.last_message_at),
      q(c.created_at),
      q(c.updated_at),
    ].join(", ") +
    ")",
);
P(convRows.join(",\n"), "on conflict (id) do nothing;", "");

/* ---------------- escalations ---------------- */
P("-- ---------- escalations ----------");
if (SEED_ESCALATIONS.length) {
  P(
    "insert into public.escalations",
    "  (id, conversation_id, reason, status, assigned_to, created_at)",
    "values",
  );
  P(
    SEED_ESCALATIONS.map(
      (e) =>
        "  (" +
        [
          q(e.id),
          q(e.conversation_id),
          q(e.reason),
          q(e.status),
          q(e.assigned_to),
          q(e.created_at),
        ].join(", ") +
        ")",
    ).join(",\n"),
    "on conflict (id) do nothing;",
    "",
  );
} else {
  P("-- (tidak ada data contoh)", "");
}

/* ---------------- ai_flags ---------------- */
P(
  "-- ---------- ai_flags ----------",
  "-- reporter_id & reviewed_by sengaja NULL: keduanya foreign key ke",
  "-- public.profiles, dan profil demo tidak punya baris di auth.users.",
  "-- Nama pelapornya tetap terbaca lewat kolom teks reporter_name.",
  "insert into public.ai_flags",
  "  (id, code, customer_message, ai_answer, ai_action, correct_answer,",
  "   category, reporter_id, reporter_name, note, status, reject_reason,",
  "   created_at, reviewed_at, reviewed_by)",
  "values",
);
P(
  SEED_AI_FLAGS.map(
    (f) =>
      "  (" +
      [
        q(f.id),
        q(f.code),
        q(f.customer_message),
        q(f.ai_answer),
        q(f.ai_action),
        q(f.correct_answer),
        q(f.category),
        "NULL",
        q(f.reporter_name),
        q(f.note),
        q(f.status),
        q(f.reject_reason),
        q(f.created_at),
        q(f.reviewed_at),
        "NULL",
      ].join(", ") +
      ")",
  ).join(",\n"),
  "on conflict (id) do nothing;",
  "",
  "commit;",
  "",
);

/* ---------------- pemeriksaan & penghapusan ---------------- */
P(
  "-- ===========================================================",
  "-- Periksa hasilnya",
  "-- ===========================================================",
  "-- select count(*) as percakapan from public.conversations;",
  "-- select count(*) as eskalasi   from public.escalations;",
  "-- select count(*) as flag       from public.ai_flags;",
  "",
  "",
  "-- ===========================================================",
  "-- HAPUS SELURUH DATA CONTOH",
  "-- ===========================================================",
  "-- Hapus tanda komentar di bawah, lalu Run. Hanya baris berpola",
  "-- UUID data contoh yang terhapus — percakapan pelanggan sungguhan",
  "-- tidak tersentuh. escalations ikut terhapus lewat ON DELETE",
  "-- CASCADE, tetapi ditulis eksplisit supaya jelas.",
  "--",
  "-- begin;",
  "--   delete from public.ai_flags     where id::text like 'f0000000-%';",
  "--   delete from public.escalations  where id::text like 'e0000000-%';",
  "--   delete from public.conversations where id::text like 'c0000000-%';",
  "-- commit;",
);

const isi = baris.join("\n") + "\n";
writeFileSync(join(AKAR, "supabase", "seed-demo.sql"), isi);

console.log("supabase/seed-demo.sql dibuat");
console.log("  percakapan :", SEED_CONVERSATIONS.length);
console.log("  eskalasi   :", SEED_ESCALATIONS.length);
console.log("  flag       :", SEED_AI_FLAGS.length);
console.log("  baris SQL  :", baris.length);

/* Pemeriksaan pola UUID — kalau ada yang menyimpang, blok DELETE di
   bawah tidak akan menghapusnya dan data contoh tertinggal diam-diam. */
const salah = [
  ...SEED_CONVERSATIONS.filter((c) => !c.id.startsWith("c0000000-")).map((c) => "conv " + c.id),
  ...SEED_ESCALATIONS.filter((e) => !e.id.startsWith("e0000000-")).map((e) => "esc " + e.id),
  ...SEED_AI_FLAGS.filter((f) => !f.id.startsWith("f0000000-")).map((f) => "flag " + f.id),
];
if (salah.length) {
  console.error("\n⚠️  UUID di luar pola — tidak akan terhapus blok DELETE:");
  salah.forEach((s) => console.error("   " + s));
  process.exit(1);
}
console.log("  pola UUID  : semua sesuai, blok DELETE akan bersih");
