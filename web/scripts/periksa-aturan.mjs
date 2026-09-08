/* ===========================================================
   Bandingkan aturan pemicu di TABEL dengan yang di BERKAS.

     npm run periksa-aturan            ringkasan selisih
     npm run periksa-aturan -- POC     hanya kode yang memuat "POC"

   BIAYA Rp 0. Membaca Supabase lewat pustaka_router() dan membaca
   berkas .md; tidak menulis apa pun, tidak memanggil Voyage maupun
   Anthropic.

   KENAPA PERLU

   Sejak router bisa membaca dari tabel, ada DUA sumber aturan yang
   bisa menyimpang diam-diam. Gejalanya bukan galat, melainkan pesan
   pelanggan yang dulu tertangkap Gerbang 1 tiba-tiba lolos ke Claude
   — persis kejadian "halo kak, poc itu apa" pada 8 September 2026,
   yang di berkas jatuh ke [PRODUK POC] tetapi di tabel tidak.

   Yang paling sering hilang adalah `also_pattern` dan
   `unless_patterns`: keduanya tidak bisa disusun ulang dari kata
   kunci sederhana yang diketik tim CS, jadi setiap penyimpanan lewat
   halaman Kelola Template berisiko membuangnya.
   =========================================================== */

import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KB = join(AKAR, "knowledge-base");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("Kredensial Supabase belum terbaca dari web/.env.local.");
  process.exit(1);
}

const saring = process.argv.slice(2).filter((a) => !a.startsWith("-"));

/* ---------- Aturan dari BERKAS ---------- */
const r = await import(pathToFileURL(join(KB, "router.js")).href);
r.setKbDir(KB);
const berkas = new Map();
for (const a of r.getRules()) if (!berkas.has(a.code)) berkas.set(a.code, a);

/* ---------- Aturan dari TABEL ---------- */
const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const { data, error } = await sb.rpc("pustaka_router");
if (error) {
  console.error(`pustaka_router() gagal: ${error.message}`);
  console.error("Jalankan supabase/schema-templates-baca.sql lebih dulu.");
  process.exit(1);
}

const tabel = new Map();
for (const b of data ?? []) {
  if (b.priority === null || b.priority === undefined) continue;
  if (!tabel.has(b.code)) tabel.set(b.code, b);
}

console.log(`aturan di berkas : ${berkas.size}`);
console.log(`aturan di tabel  : ${tabel.size}`);

/* ---------- Bandingkan ---------- */
const semuaKode = [...new Set([...berkas.keys(), ...tabel.keys()])].sort();
const beda = [];

for (const kode of semuaKode) {
  if (saring.length && !saring.some((s) => kode.toUpperCase().includes(s.toUpperCase()))) {
    continue;
  }

  const b = berkas.get(kode);
  const t = tabel.get(kode);

  if (b && !t) {
    beda.push({ kode, jenis: "HILANG DI TABEL", rinci: "aturannya tidak ada di database" });
    continue;
  }
  if (!b && t) {
    beda.push({ kode, jenis: "hanya di tabel", rinci: "aturan baru, tidak ada di berkas" });
    continue;
  }
  if (!b || !t) continue;

  const rinci = [];
  const whenB = (b.when ?? []).join(" | ");
  const whenT = (t.when_patterns ?? []).join(" | ");
  if (whenB !== whenT) rinci.push(`when berbeda:\n      berkas: ${whenB}\n      tabel : ${whenT}`);

  const alsoB = b.also ?? null;
  const alsoT = t.also_pattern ?? null;
  if (alsoB !== alsoT) {
    rinci.push(
      `also berbeda:\n      berkas: ${alsoB ?? "(tidak ada)"}\n      tabel : ${alsoT ?? "(TIDAK ADA — hilang)"}`,
    );
  }

  const unlessB = (b.unless ?? []).join(" | ");
  const unlessT = (t.unless_patterns ?? []).join(" | ");
  if (unlessB !== unlessT) {
    rinci.push(
      `unless berbeda:\n      berkas: ${unlessB || "(tidak ada)"}\n      tabel : ${unlessT || "(TIDAK ADA — hilang)"}`,
    );
  }

  if (rinci.length) beda.push({ kode, jenis: "ISINYA BERBEDA", rinci: rinci.join("\n    ") });
}

if (!beda.length) {
  console.log("\nSemua aturan sepadan antara berkas dan tabel.");
  process.exit(0);
}

console.log(`\n${beda.length} aturan menyimpang:\n`);
for (const d of beda) {
  console.log(`  [${d.kode}] ${d.jenis}`);
  console.log(`    ${d.rinci}\n`);
}

console.log(
  "Aturan yang kehilangan `also` akan menangkap JAUH LEBIH BANYAK pesan\n" +
    "daripada yang dimaksud; yang kehilangan `unless` akan menangkap pesan\n" +
    "yang seharusnya diserahkan ke template lain. Keduanya tidak pernah\n" +
    "muncul sebagai galat.",
);
process.exitCode = 1;
