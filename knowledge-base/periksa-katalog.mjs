/* ===========================================================
   Pemeriksa katalog template — tanpa jaringan, tanpa biaya.

   KENAPA ADA: sampai 8 September 2026 ada 3 kode yang dipakai
   dua kali ([KOMPLAIN], [BERTAHAP], [IDUL FITRI]). Router hanya
   menyimpan kemunculan PERTAMA, jadi versi kedua tidak pernah
   terkirim ke pelanggan — tetapi tetap terbaca oleh tim CS di
   berkas. Tidak ada yang menyadarinya selama berbulan-bulan
   karena tidak ada yang memeriksa.

   Sengaja tidak memakai regex sama sekali: pola dengan backslash
   pernah rusak saat berkas ini ditulis lewat skrip.

   Jalankan: node knowledge-base/periksa-katalog.mjs
   =========================================================== */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KB = dirname(fileURLToPath(import.meta.url));
const BATAS_BALASAN = 600; // sama dengan web/lib/limits.ts

const AWALAN = "### [";
const AKHIRAN = "]";

/* Berkas KB disimpan dengan akhir baris CRLF di Windows. Memotong
   hanya pada LF menyisakan satu CR di ujung tiap baris, dan itu ikut
   terhitung saat mengukur panjang balasan — [PBM] terbaca 608 padahal
   sebenarnya 599. Router memakai /\r?\n/ sehingga tidak kena.
   Ditulis lewat fromCharCode, bukan escape, karena berkas ini pernah
   ditulis oleh skrip yang menggerus backslash. */
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const pisahBaris = (teks) =>
  teks.split(LF).map((b) => (b.endsWith(CR) ? b.slice(0, -1) : b));

/** Nama kode bila baris ini heading template, selain itu null. */
function kodeDari(baris) {
  const t = baris.trim();
  if (!t.startsWith(AWALAN) || !t.endsWith(AKHIRAN)) return null;
  const isi = t.slice(AWALAN.length, -AKHIRAN.length).trim();
  return isi.length ? isi : null;
}

/** Semua kemunculan template, termasuk yang kembar. */
function bacaSemua() {
  const out = [];
  for (const f of readdirSync(KB).filter((n) => n.startsWith("faq-") && n.endsWith(".md"))) {
    const baris = pisahBaris(readFileSync(join(KB, f), "utf8"));
    let kode = null;
    let isi = [];
    let mulai = 0;
    const tutup = () => {
      if (kode) out.push({ kode, isi: isi.join(LF).trim(), berkas: f, baris: mulai });
      kode = null;
      isi = [];
    };
    baris.forEach((b, i) => {
      const k = kodeDari(b);
      if (k) {
        tutup();
        kode = k;
        mulai = i + 1;
        return;
      }
      const t = b.trim();
      if (t.startsWith("## ") || t.startsWith("# ") || t === "---") {
        tutup();
        return;
      }
      if (kode) isi.push(b);
    });
    tutup();
  }
  return out;
}

let gagal = 0;
const salah = (pesan) => {
  console.error("  x " + pesan);
  gagal++;
};
const benar = (pesan) => console.log("  v " + pesan);

const semua = bacaSemua();
console.log(`Katalog: ${semua.length} entri di ${new Set(semua.map((t) => t.berkas)).size} berkas\n`);

/* ---------- 1. Tidak boleh ada kode kembar ---------- */
console.log("1. Kode kembar");
const per = new Map();
for (const t of semua) {
  if (!per.has(t.kode)) per.set(t.kode, []);
  per.get(t.kode).push(t);
}
const kembar = [...per.entries()].filter(([, v]) => v.length > 1);
if (kembar.length === 0) {
  benar("tidak ada kode yang dipakai dua kali");
} else {
  for (const [kode, v] of kembar) {
    salah(
      `[${kode}] dipakai ${v.length}x — hanya yang pertama yang terkirim, ` +
        `sisanya tidak akan pernah dipakai: ` +
        v.map((x) => `${x.berkas}:${x.baris}`).join(", "),
    );
  }
}

/* ---------- 2. index.json harus cocok dengan berkas ---------- */
console.log("\n2. index.json sinkron dengan berkas .md");
const idx = JSON.parse(readFileSync(join(KB, "index.json"), "utf8"));
const dariIndex = idx.berkas.flatMap((b) => b.kode);
const dariBerkas = semua.map((t) => t.kode);

const hilang = dariBerkas.filter((k) => !dariIndex.includes(k));
const lebih = dariIndex.filter((k) => !dariBerkas.includes(k));

if (hilang.length) salah(`ada di berkas tapi tidak di index.json: ${hilang.join(", ")}`);
if (lebih.length) salah(`ada di index.json tapi tidak di berkas: ${lebih.join(", ")}`);
if (idx.ringkasan.jumlah_entri !== dariIndex.length)
  salah(`ringkasan.jumlah_entri ${idx.ringkasan.jumlah_entri}, seharusnya ${dariIndex.length}`);
if (!hilang.length && !lebih.length) benar(`${dariBerkas.length} kode cocok di kedua sisi`);

/* ---------- 3. Batas 600 karakter ---------- */
console.log("\n3. Batas panjang balasan");
const lewat = semua.filter((t) => t.isi.length > BATAS_BALASAN);
if (lewat.length === 0) {
  const panjang = semua.reduce((a, b) => (b.isi.length > a.isi.length ? b : a));
  benar(`semua di bawah ${BATAS_BALASAN} karakter (terpanjang [${panjang.kode}] = ${panjang.isi.length})`);
} else {
  for (const t of lewat) salah(`[${t.kode}] ${t.isi.length} karakter, batasnya ${BATAS_BALASAN}`);
}

console.log(gagal ? `\n${gagal} PEMERIKSAAN GAGAL` : "\nSemua pemeriksaan lulus");
process.exit(gagal ? 1 : 0);
