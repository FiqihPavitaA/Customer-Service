/* ===========================================================
   Audit kesiapan data untuk Gerbang 2 (semantic search Voyage).

     node knowledge-base/audit-voyage.mjs            ringkasan
     node knowledge-base/audit-voyage.mjs --tabel    + tabel per template
     node knowledge-base/audit-voyage.mjs --json     keluaran mesin

   BIAYA Rp 0. Tidak ada jaringan sama sekali; hanya membaca berkas
   di repo ini.

   Yang dihitung di sini hanyalah yang BISA dihitung. Kesesuaian
   contoh dengan isi jawaban (kriteria C) dan klasifikasi maksud
   (D3) menuntut penilaian manusia — skrip ini menandai calonnya,
   bukan memutuskannya. Setiap tebakan diberi label supaya tidak
   terbaca sebagai kesimpulan.
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KB = dirname(fileURLToPath(import.meta.url));
const BERKAS = [
  "faq-interaksi.md",
  "faq-cara-pakai.md",
  "faq-produk.md",
  "faq-umum.md",
];

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/* ===========================================================
   1. Baca katalog template dari berkas .md
   =========================================================== */

/** @type {{code:string,body:string,berkas:string,baris:number}[]} */
const templates = [];
/** Kode yang muncul lebih dari sekali, beserta lokasinya. */
const kemunculan = new Map();

for (const berkas of BERKAS) {
  const isi = readFileSync(join(KB, berkas), "utf8");
  const baris = isi.split(NL).map((b) => (b.endsWith(CR) ? b.slice(0, -1) : b));

  let kode = null;
  let mulai = 0;
  let buffer = [];

  const simpan = () => {
    if (!kode) return;
    const body = buffer.join(NL).trim();
    if (body) {
      templates.push({ code: kode, body, berkas, baris: mulai });
      if (!kemunculan.has(kode)) kemunculan.set(kode, []);
      kemunculan.get(kode).push(`${berkas}:${mulai}`);
    }
    buffer = [];
  };

  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    const judul = b.match(/^###\s*\[(.+?)\]\s*$/);
    if (judul) {
      simpan();
      kode = judul[1].trim();
      mulai = i + 1;
      continue;
    }
    if (/^##\s+/.test(b)) {
      simpan();
      kode = null;
      continue;
    }
    if (kode) buffer.push(b);
  }
  simpan();
}

/* ===========================================================
   2. Kata kunci (Gerbang 1) — dari RULES di router.js
   =========================================================== */

const { getRules } = await import(
  join(KB, "router.js").split("\\").join("/").replace(/^([A-Za-z]):/, "file:///$1:")
);
const aturan = getRules();
const punyaAturan = new Map();
for (const a of aturan) if (!punyaAturan.has(a.code)) punyaAturan.set(a.code, a);

/* ===========================================================
   3. Contoh pertanyaan — dari router.test.mjs (sumber bootstrap)
   =========================================================== */

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

/** @type {Map<string,string[]>} kode -> daftar contoh */
const contoh = new Map();
{
  const isi = readFileSync(join(KB, "router.test.mjs"), "utf8");
  const baris = isi.split(NL);
  for (const b of baris) {
    if (b.includes("KASUS_SATPAM")) break;
    const t = b.trim();
    if (!t.startsWith('["')) continue;
    const pesan = petikKutip(t, 0);
    if (!pesan) continue;
    const sisa = t.slice(pesan.akhir + 1);
    if (sisa.includes("null")) continue;
    const kode = petikKutip(sisa, 0);
    if (!kode) continue;
    if (!contoh.has(kode.isi)) contoh.set(kode.isi, []);
    contoh.get(kode.isi).push(pesan.isi);
  }
}

/* ===========================================================
   4. Kriteria B — kualitas tiap contoh
   =========================================================== */

const KATA_TANYA = [
  "apa", "apakah", "gimana", "gmn", "bagaimana", "berapa", "brp", "kapan",
  "kpn", "bisa", "boleh", "kenapa", "mana", "adakah", "ada",
];
/* Definisi gaya chat DISENGAJA sama persis dengan
   web/lib/mutuContoh.ts. Dua definisi yang berbeda berarti laporan
   audit dan peringatan di layar tim CS akan berselisih tentang
   kalimat yang sama — dan tidak ada yang bisa menjelaskan mana yang
   benar.

   Versi pertama daftar ini memuat "gimana" dan "kak", dan itu
   KELIRU: keduanya muncul juga di kalimat yang ditulis rapi, jadi
   contoh bootstrap seperti "cara pakai neem oil gimana?" ikut
   terhitung bergaya chat. Angka 16% pada laporan pertama berasal
   dari kekeliruan itu. Dibetulkan 8 September 2026 setelah
   `npm run uji-mutu` menunjukkannya. */
const SINGKATAN_KUAT = [
  "gmn", "gmna", "brp", "brpa", "blm", "kpn", "udh", "tdk", "yg", "sy",
  "trs", "kk", "knp", "dgn", "utk", "kl", "klo", "bgt", "jd", "dlm",
  "hrg", "tp", "sdh", "blh", "bs", "dr", "dpt", "sm", "tq",
  "gak", "ga", "ngga", "nggak", "engga", "sampe", "makasih", "mksh",
];

const PARTIKEL = [
  "kak", "ka", "sis", "min", "bang", "gan", "mimin",
  "aja", "dong", "nih", "sih", "deh", "kok", "tuh", "yaa", "yah",
];

const kata = (t) => t.trim().split(/\s+/).filter(Boolean);

function nilaiContoh(t) {
  const masalah = [];
  const n = kata(t).length;
  if (n < 4) masalah.push(`pendek (${n} kata)`);
  const koma = (t.match(/,/g) ?? []).length;
  if (koma >= 3) masalah.push(`${koma} koma — mirip daftar kata`);
  const rendah = ` ${t.toLowerCase()} `;
  const adaTanya = KATA_TANYA.some((k) => rendah.includes(` ${k} `) || rendah.includes(` ${k}`));
  if (!adaTanya) masalah.push("tanpa kata tanya");
  return masalah;
}

function gayaChat(teks) {
  const t = String(teks ?? "").trim();
  if (!t) return false;

  const kataKata = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (kataKata.some((k) => SINGKATAN_KUAT.includes(k))) return true;

  // Tanda baca penutup adalah penanda "tulisan rapi" yang paling
  // bisa diandalkan pada data ini.
  if (/[.?!]$/.test(t)) return false;

  // Nama produk berhuruf kapital (POC, NPK, TDS, EM4) TIDAK dihitung
  // sebagai tanda tulisan rapi — menulisnya kapital justru wajar di
  // chat pelanggan. Sepadan dengan web/lib/mutuContoh.ts.
  const tanpaNamaProduk = t
    .split(/\s+/)
    .filter((k) => {
      const bersih = k.replace(/[^\p{L}\p{N}]/gu, "");
      return bersih && bersih !== bersih.toUpperCase();
    })
    .join(" ");

  const hurufKecilSemua =
    tanpaNamaProduk.length > 0 && tanpaNamaProduk === tanpaNamaProduk.toLowerCase();
  return hurufKecilSemua || kataKata.some((k) => PARTIKEL.includes(k));
}

/* ---- B5: duplikat lintas template ---- */
const normal = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const perTeks = new Map();
for (const [kode, daftar] of contoh) {
  for (const t of daftar) {
    const k = normal(t);
    if (!perTeks.has(k)) perTeks.set(k, new Set());
    perTeks.get(k).add(kode);
  }
}
const duplikatLintas = [...perTeks]
  .filter(([, kode]) => kode.size > 1)
  .map(([teks, kode]) => ({ teks, kode: [...kode] }));

/* ===========================================================
   5. Kriteria D2 — kemiripan leksikal antar isi template
   =========================================================== */

/** Trigram karakter, dipakai sebagai pengganti embedding. */
function trigram(teks) {
  const t = ` ${normal(teks)} `;
  const set = new Map();
  for (let i = 0; i + 3 <= t.length; i++) {
    const g = t.slice(i, i + 3);
    set.set(g, (set.get(g) ?? 0) + 1);
  }
  return set;
}

// idf supaya potongan yang muncul di mana-mana ("nya", " ka") tidak
// membuat semua pasangan terlihat mirip.
const df = new Map();
const vektor = templates.map((t) => {
  const g = trigram(t.body);
  for (const k of g.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  return g;
});
const N = templates.length;
const berbobot = vektor.map((g) => {
  const out = new Map();
  let norma = 0;
  for (const [k, v] of g) {
    const w = (1 + Math.log(v)) * Math.log(N / (df.get(k) ?? 1));
    if (w > 0) {
      out.set(k, w);
      norma += w * w;
    }
  }
  norma = Math.sqrt(norma) || 1;
  for (const [k, v] of out) out.set(k, v / norma);
  return out;
});

function cosinus(a, b) {
  const [kecil, besar] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, v] of kecil) {
    const w = besar.get(k);
    if (w) s += v * w;
  }
  return s;
}

const pasangan = [];
for (let i = 0; i < templates.length; i++) {
  for (let j = i + 1; j < templates.length; j++) {
    const s = cosinus(berbobot[i], berbobot[j]);
    if (s >= 0.6) {
      pasangan.push({
        a: templates[i].code,
        b: templates[j].code,
        skor: s,
        lokasiA: `${templates[i].berkas}:${templates[i].baris}`,
        lokasiB: `${templates[j].berkas}:${templates[j].baris}`,
      });
    }
  }
}
pasangan.sort((x, y) => y.skor - x.skor);

/* ===========================================================
   6. Kriteria D3 — calon klasifikasi (TEBAKAN, bukan keputusan)
   =========================================================== */

const POLA_KELAS = [
  [
    "SENSITIF",
    /refund|retur|komplain|klaim|batal|pengembalian|ganti rugi|rusak|bocor|pecah|kurang|salah kirim|sengketa|rekening|nomor wa|whatsapp/i,
  ],
  [
    "KONDISI_INTERNAL",
    /belum (di)?kirim|belum dikirim|libur|tanggal merah|overload|pickup|bertahap|antre|antri|gudang|packing|proses kirim|estimasi (sampai|tiba)|resi belum/i,
  ],
  [
    "BROADCAST",
    /promo|diskon|flash sale|voucher|gratis ongkir|harbolnas|12\.12|11\.11|10\.10|9\.9|6\.6|natal|idul fitri|lebaran|tahun baru|ramadhan/i,
  ],
  [
    "OUTBOUND",
    /terima kasih|makasih|selamat (pagi|siang|sore|malam)|sama-sama|semoga|ditunggu orderan|selamat berbelanja|salam|jangan lupa (rating|bintang)|mohon (rating|ulasan)/i,
  ],
];

function tebakKelas(t) {
  for (const [kelas, pola] of POLA_KELAS) {
    if (pola.test(t.code) || pola.test(t.body)) return kelas;
  }
  return "INTI";
}

/* ===========================================================
   7. Kriteria D4 — sebutan tanggal / acara
   =========================================================== */

const POLA_TANGGAL =
  /\b(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\b|\b(natal|idul fitri|lebaran|ramadhan|tahun baru|imlek|nyepi|waisak|harbolnas)\b/i;

const bertanggal = templates
  .filter((t) => POLA_TANGGAL.test(t.code) || POLA_TANGGAL.test(t.body))
  .map((t) => ({
    code: t.code,
    lokasi: `${t.berkas}:${t.baris}`,
    cocok: (t.code.match(POLA_TANGGAL) ?? t.body.match(POLA_TANGGAL))?.[0] ?? "",
  }));

/* ===========================================================
   8. Susun hasil per template
   =========================================================== */

const hasil = templates.map((t) => {
  const c = contoh.get(t.code) ?? [];
  const masalah = [];

  if (c.length === 0) masalah.push("0 contoh");
  else if (c.length < 3) masalah.push(`hanya ${c.length} contoh`);
  else if (c.length > 8) masalah.push(`${c.length} contoh (berlebihan)`);

  const cacat = c.flatMap((x) => nilaiContoh(x).map((m) => `"${x}": ${m}`));
  const adaGayaChat = c.some(gayaChat);
  if (c.length > 0 && !adaGayaChat) masalah.push("tidak ada contoh bergaya chat");

  // B4 — ragam
  if (c.length >= 2) {
    const panjang = c.map((x) => kata(x).length);
    const rentang = Math.max(...panjang) - Math.min(...panjang);
    if (rentang < 5) masalah.push(`ragam panjang sempit (${rentang} kata)`);
    const pembuka = new Set(c.map((x) => kata(x).slice(0, 3).join(" ").toLowerCase()));
    if (pembuka.size === 1) masalah.push("semua contoh berpembuka sama");
  }

  return {
    code: t.code,
    berkas: t.berkas,
    baris: t.baris,
    lokasi: `${t.berkas}:${t.baris}`,
    kelas: tebakKelas(t),
    jumlahContoh: c.length,
    contoh: c,
    gayaChat: adaGayaChat,
    punyaKataKunci: punyaAturan.has(t.code),
    panjangBody: t.body.length,
    masalah,
    cacatContoh: cacat,
  };
});

/* ===========================================================
   9. Keluaran
   =========================================================== */

const inti = hasil.filter((h) => h.kelas === "INTI");
const intiSiap = inti.filter((h) => h.jumlahContoh >= 3);
const intiGaya = inti.filter((h) => h.gayaChat);
const kodeGanda = [...kemunculan].filter(([, l]) => l.length > 1);

const ringkas = {
  totalTemplate: templates.length,
  totalAturanKataKunci: aturan.length,
  templateDenganKataKunci: punyaAturan.size,
  totalContoh: [...contoh.values()].reduce((n, d) => n + d.length, 0),
  templateDenganContoh: [...contoh.keys()].filter((k) => kemunculan.has(k)).length,
  kelas: Object.fromEntries(
    ["INTI", "BROADCAST", "OUTBOUND", "SENSITIF", "KONDISI_INTERNAL"].map((k) => [
      k,
      hasil.filter((h) => h.kelas === k).length,
    ]),
  ),
  inti: inti.length,
  intiPunya3Contoh: intiSiap.length,
  persenIntiPunya3Contoh: inti.length ? Math.round((intiSiap.length / inti.length) * 100) : 0,
  intiGayaChat: intiGaya.length,
  persenIntiGayaChat: inti.length ? Math.round((intiGaya.length / inti.length) * 100) : 0,
  kodeGanda: kodeGanda.length,
  duplikatContohLintasTemplate: duplikatLintas.length,
  pasanganMirip60: pasangan.length,
  pasanganMirip80: pasangan.filter((p) => p.skor >= 0.8).length,
  templateBertanggal: bertanggal.length,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ringkas, hasil, pasangan, duplikatLintas, bertanggal }, null, 2));
  process.exit(0);
}

console.log("=== RINGKASAN ===");
for (const [k, v] of Object.entries(ringkas)) {
  console.log(`  ${k.padEnd(30)} ${typeof v === "object" ? JSON.stringify(v) : v}`);
}

console.log(`\n=== D1. Kode ganda (${kodeGanda.length}) ===`);
for (const [kode, lokasi] of kodeGanda) console.log(`  [${kode}] ${lokasi.join(" & ")}`);
if (!kodeGanda.length) console.log("  tidak ada");

console.log(`\n=== D2. Pasangan mirip >= 0.60 (${pasangan.length}) ===`);
for (const p of pasangan.slice(0, 40)) {
  console.log(
    `  ${p.skor.toFixed(3)} ${p.skor >= 0.8 ? "WAJIB GABUNG" : "            "} [${p.a}] <-> [${p.b}]  (${p.lokasiA} | ${p.lokasiB})`,
  );
}

console.log(`\n=== B5. Contoh kembar lintas template (${duplikatLintas.length}) ===`);
for (const d of duplikatLintas) console.log(`  "${d.teks}" -> ${d.kode.join(", ")}`);
if (!duplikatLintas.length) console.log("  tidak ada");

console.log(`\n=== D4. Template menyebut tanggal/acara (${bertanggal.length}) ===`);
for (const b of bertanggal) console.log(`  [${b.code}] "${b.cocok}" (${b.lokasi})`);

console.log(`\n=== Contoh yang cacat bentuknya ===`);
let nCacat = 0;
for (const h of hasil) {
  for (const c of h.cacatContoh) {
    console.log(`  [${h.code}] ${c}`);
    nCacat++;
  }
}
console.log(`  total ${nCacat}`);

if (process.argv.includes("--tabel")) {
  console.log(`\n=== TABEL PER TEMPLATE ===`);
  console.log("| Kode | Kelas | Contoh | Gaya chat | Kata kunci | Masalah | Lokasi |");
  console.log("|---|---|---|---|---|---|---|");
  for (const h of hasil) {
    console.log(
      `| \`${h.code}\` | ${h.kelas} | ${h.jumlahContoh} | ${h.gayaChat ? "ya" : "—"} | ${
        h.punyaKataKunci ? "ya" : "—"
      } | ${h.masalah.join("; ") || "—"} | ${h.lokasi} |`,
    );
  }
}
