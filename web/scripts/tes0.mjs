/* Tes 0 mini — kebingungan antar-template, dari vektor yang SUDAH
   dibuat. Tidak memanggil Voyage sama sekali: vektornya dibaca dari
   supabase/seed-contoh.sql. Biaya Rp 0. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Ambang dibaca dari .env.local bila ada, lewat --env-file-if-exists
   di package.json. */

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = join(AKAR, "supabase", "seed-contoh.sql");

/* Dibaca dari env supaya angka di sini selalu sama dengan yang
   dipakai lib/pengenal.ts saat melayani pelanggan. Laporan yang
   memakai ambang berbeda dari yang berjalan sungguhan lebih buruk
   daripada tidak ada laporan sama sekali. */
const AMBANG_YAKIN = Number(process.env.AMBANG_YAKIN || 0.93);
const AMBANG_RAGU = Number(process.env.AMBANG_RAGU || 0.6);

/* Tiap baris data berbentuk:
     ('KODE', 'teks', '[0.1,0.2,...]'::vector, 'model')
   Diurai dengan pemindai kutip, bukan regex. */
function petik(baris, dari) {
  const mulai = baris.indexOf("'", dari);
  if (mulai === -1) return null;
  let isi = "";
  for (let i = mulai + 1; i < baris.length; i++) {
    if (baris[i] === "'") {
      if (baris[i + 1] === "'") {
        isi += "'";
        i++;
        continue;
      }
      return { isi, akhir: i };
    }
    isi += baris[i];
  }
  return null;
}

const data = [];
for (const baris of readFileSync(SQL, "utf8").split(/\r?\n/)) {
  const t = baris.trim();
  if (!t.startsWith("('")) continue;
  const code = petik(t, 0);
  if (!code) continue;
  const teks = petik(t, code.akhir + 1);
  if (!teks) continue;
  const vek = petik(t, teks.akhir + 1);
  if (!vek) continue;
  const v = vek.isi.slice(1, -1).split(",").map(Number);
  data.push({ code: code.isi, teks: teks.isi, v });
}

console.log("Contoh terbaca :", data.length);
console.log("Dimensi        :", data[0]?.v.length ?? 0);

/* Vektor Voyage sudah dinormalisasi, tapi jangan diandalkan —
   kosinus dihitung penuh. */
const norm = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
for (const d of data) d.n = norm(d.v);
const cos = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.v.length; i++) s += a.v[i] * b.v[i];
  return s / (a.n * b.n);
};

/* ---------- 1. Tetangga terdekat SELAIN dirinya ---------- */
let benar = 0;
for (const a of data) {
  let terbaik = null;
  for (const b of data) {
    if (a === b) continue;
    const s = cos(a, b);
    if (!terbaik || s > terbaik.s) terbaik = { b, s };
  }
  if (!terbaik) continue;
  if (terbaik.b.code === a.code) benar++;
}
console.log(`\n1. Tetangga terdekat satu template : ${benar}/${data.length}`);
console.log("   (hanya 1 template punya 2 contoh, jadi angka ini memang rendah)");

/* ---------- 2. Pasangan beda template yang berbahaya ---------- */
const bahaya = [];
for (let i = 0; i < data.length; i++)
  for (let j = i + 1; j < data.length; j++) {
    if (data[i].code === data[j].code) continue;
    const s = cos(data[i], data[j]);
    if (s >= AMBANG_YAKIN) bahaya.push({ a: data[i], b: data[j], s });
  }
bahaya.sort((x, y) => y.s - x.s);

console.log(`\n2. Pasangan BEDA template dengan skor >= ${AMBANG_YAKIN} : ${bahaya.length}`);
console.log("   Setiap satu di sini berarti ambang 'yakin' bisa memilih yang salah.");
for (const p of bahaya.slice(0, 15)) {
  console.log(`   ${p.s.toFixed(3)}  [${p.a.code}] "${p.a.teks}"`);
  console.log(`          vs [${p.b.code}] "${p.b.teks}"`);
}

/* ---------- 3. Sebaran skor ---------- */
const semua = [];
for (let i = 0; i < data.length; i++)
  for (let j = i + 1; j < data.length; j++) semua.push(cos(data[i], data[j]));
semua.sort((a, b) => a - b);
const p = (q) => semua[Math.floor(semua.length * q)].toFixed(3);
console.log("\n3. Sebaran kemiripan antar semua pasangan");
console.log(`   min ${semua[0].toFixed(3)}  p25 ${p(0.25)}  median ${p(0.5)}  p75 ${p(0.75)}  p95 ${p(0.95)}  maks ${semua[semua.length - 1].toFixed(3)}`);
console.log(`   di atas ambang ragu (${AMBANG_RAGU}) : ${semua.filter((s) => s >= AMBANG_RAGU).length}/${semua.length}`);
console.log(`   di atas ambang yakin (${AMBANG_YAKIN}): ${semua.filter((s) => s >= AMBANG_YAKIN).length}/${semua.length}`);
