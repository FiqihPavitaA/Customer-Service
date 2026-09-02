/* ===========================================================
   Router Knowledge Base — pemilih berkas sebelum memanggil Claude.

   Tiga lapis, dari yang paling murah:

     1. Cocok template  -> balas langsung dari berkas FAQ, Rp 0,
                           Claude tidak dipanggil sama sekali.
     2. Kategori jelas  -> kirim claude-core.md + SATU berkas FAQ.
     3. Kategori tidak  -> kirim claude-core.md + KEEMPAT berkas FAQ
        jelas ('unclear')   (jaring pengaman, sedapat mungkin jarang).

   ---------------------------------------------------------------
   KENAPA ROUTING KATEGORI TIDAK MEMAKAI DAFTAR KATA KUNCI TEBAKAN
   ---------------------------------------------------------------
   Pembagian kategori aslinya tidak rapi: `faq-umum.md` ternyata
   ikut memuat banyak kode "CARA PAKAI ..." (NPK, EM4, B1, Guano,
   TDS Meter, pH Meter). Kalau router menebak "ada kata 'cara pakai'
   berarti kategori cara-pakai", pertanyaan soal NPK akan diarahkan
   ke berkas yang justru tidak memuat jawabannya.

   Karena itu kosakata routing diambil dari `index.json` — yaitu
   nama-nama kode template yang benar-benar ada di tiap berkas.
   Bobot tiap kata dihitung otomatis: kata yang hanya muncul di satu
   kategori bernilai penuh, kata yang muncul di semua kategori
   (mis. "cara", "pakai") nyaris tidak bernilai. Jadi ketika kategori
   dipecah ulang atau kode ditambah, router ikut menyesuaikan tanpa
   perlu daftar kata kunci diperbarui manual.
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Direktori berkas KB.

    Bawaannya adalah folder berkas ini sendiri — berlaku untuk Node
    biasa (backend Express, skrip uji) karena router.js memang
    diletakkan bersebelahan dengan berkas KB yang dilayaninya.

    WAJIB ditimpa lewat setKbDir() bila modul ini di-bundle (Next.js /
    Turbopack): setelah di-bundle, import.meta.url menunjuk ke lokasi
    chunk hasil build, bukan ke folder KB, sehingga pembacaan berkas
    akan gagal diam-diam. */
let kbDir = dirname(fileURLToPath(import.meta.url));

/** Tetapkan direktori berkas KB. Panggil sebelum pemakaian pertama. */
export function setKbDir(dir) {
  if (dir && dir !== kbDir) {
    kbDir = dir;
    // Cache lama berasal dari direktori berbeda — buang.
    pustaka = null;
    asalKode = null;
    kosakata = null;
  }
}

/** Direktori KB yang sedang dipakai (untuk diagnosis). */
export function getKbDir() {
  return kbDir;
}

export const CATEGORY_FILES = {
  interaksi: "faq-interaksi.md",
  "cara-pakai": "faq-cara-pakai.md",
  produk: "faq-produk.md",
  umum: "faq-umum.md",
};

export const CATEGORIES = Object.keys(CATEGORY_FILES);

/** Semua berkas FAQ, urutan tetap (menjaga prefix prompt stabil). */
export const ALL_FAQ_FILES = CATEGORIES.map((k) => CATEGORY_FILES[k]);

function baca(namaBerkas) {
  try {
    return readFileSync(join(kbDir, namaBerkas), "utf8");
  } catch (err) {
    console.warn(`[KB-ROUTER] Gagal membaca ${namaBerkas}: ${err.message}`);
    return "";
  }
}

/* ===========================================================
   Pustaka template — peta { KODE -> teks balasan }
   =========================================================== */

let pustaka = null;
/** Peta { KODE -> nama berkas }, dipakai untuk melaporkan asal jawaban. */
let asalKode = null;

function muatPustaka() {
  if (pustaka) return pustaka;

  pustaka = new Map();
  asalKode = new Map();

  for (const berkas of ALL_FAQ_FILES) {
    const raw = baca(berkas);
    if (!raw) continue;

    let kode = null;
    let buffer = [];

    const simpan = () => {
      if (!kode) return;
      const teks = buffer.join("\n").trim();
      // Kode kembar (KOMPLAIN, IDUL FITRI, BERTAHAP — lihat
      // index.json bidang kode_ganda): yang PERTAMA menang.
      // Perilaku ini sama dengan templates.ts sebelumnya, jadi
      // jawaban yang sudah berjalan tidak berubah.
      if (teks && !pustaka.has(kode)) {
        pustaka.set(kode, teks);
        asalKode.set(kode, berkas);
      }
      buffer = [];
    };

    for (const baris of raw.split(/\r?\n/)) {
      const judul = baris.match(/^###\s*\[(.+?)\]\s*$/);
      if (judul) {
        simpan();
        kode = judul[1].trim();
        continue;
      }
      // Judul bagian (## Interaksi, dst) mengakhiri entri sebelumnya.
      if (/^##\s+/.test(baris)) {
        simpan();
        kode = null;
        continue;
      }
      if (kode) buffer.push(baris);
    }
    simpan();
  }

  return pustaka;
}

/** Peta { KODE -> nama berkas }. */
export function getAsalKode() {
  muatPustaka();
  return asalKode;
}

/** Peta { KODE -> teks balasan }. */
export function getTemplateLibrary() {
  return muatPustaka();
}

/* ===========================================================
   LAPIS 1 — pencocokan template persis

   Dipindahkan apa adanya dari web/lib/templates.ts supaya tidak
   ada dua pencocok yang bisa berbeda perilaku. Aturan, pengaman,
   dan alasannya tidak diubah — sudah lulus 21/21 kasus uji.
   =========================================================== */

/**
 * Kalau pesan mengandung salah satu ini, pertanyaannya menuntut
 * penilaian — bukan kalimat baku. Selalu diserahkan ke AI.
 */
const BUTUH_PENILAIAN =
  /\b(kenapa|mengapa|kok|apakah boleh|boleh nggak|boleh gak|bolehkah|bisa nggak|bisa gak|aman nggak|aman gak|bahaya|cocok nggak|cocok gak|sebaiknya|rekomendasi|saran|bagusnya|lebih baik|campur)\b/i;

/** Pesan lebih panjang dari ini biasanya bercerita/berlapis. */
const BATAS_PANJANG = 180;

const RULES = [
  {
    code: "BANTU",
    action: "ASK_INFORMATION",
    // Hanya sapaan telanjang — begitu ada pertanyaan menempel, lewat.
    // \p{P}\p{S} menampung tanda baca sekaligus emoji (🙏😊) di ekor pesan.
    when: [
      /^\s*(halo|hallo|hai|hay|hi|hello|pagi|siang|sore|malam|permisi|assalamualaikum|assalamu'alaikum)(\s+(kak|ka|kk|min|minfarm|admin|bang|sis))?[\s\p{P}\p{S}]*$/iu,
      /^\s*(min|kak|kk|admin|minfarm)[\s\p{P}\p{S}]*$/iu,
    ],
    why: "Sapaan tanpa pertanyaan. Balasan pembuka CS memang kalimat tetap.",
  },
  {
    code: "TQ",
    action: "AUTO_REPLY",
    when: [
      /^\s*(makasih|makasi|mksh|terima ?kasih|thanks|thank you|tq|oke|okey|ok|sip|siap|baik|noted)(\s+(kak|ka|kk|min|minfarm|admin))?[\s\p{P}\p{S}]*$/iu,
    ],
    why: "Ucapan terima kasih. Tidak ada informasi yang perlu dicari.",
  },
  {
    code: "LACAK",
    action: "CHECK_ORDER_SYSTEM",
    when: [
      /\b(lacak|tracking)\b/i,
      /\b(posisi|status)\s+(paket|pesanan|barang)\b/i,
      /\bpaket\w*\s+(saya|aku|ku)?\s*(sudah )?(sampai )?mana\b/i,
      /\bsampai mana\b/i,
    ],
    // Keluhan keterlambatan bukan sekadar minta cara melacak.
    unless: [/\b(belum sampai|tidak sampai|hilang|lama|telat|terlambat|refund|komplain)\b/i],
    why: "Permintaan cara melacak paket. Balasannya arahan baku ke menu lacak.",
  },
  {
    code: "HARGA",
    action: "AUTO_REPLY",
    when: [/\bharga\b/i, /\bberapa(an)? (harganya|duit|rupiah)\b/i],
    // sop.md melarang AI menyebut harga; template pun tidak menyebut
    // angka, hanya mengarahkan ke halaman produk. Aman.
    unless: [/\b(dosis|takaran|ongkir|ongkos kirim)\b/i],
    why: "Pertanyaan harga. Template mengarahkan ke halaman produk tanpa menyebut angka — sesuai larangan sop.md.",
  },
  {
    code: "GARANSI",
    action: "AUTO_REPLY",
    when: [/\bgaransi\b/i],
    why: "Syarat garansi adalah kebijakan tetap yang tidak boleh bervariasi.",
  },
  {
    code: "OFFLINE",
    action: "AUTO_REPLY",
    when: [
      /\b(toko|gerai|outlet)\s*(offline|fisik)\b/i,
      /\boffline store\b/i,
      /\b(bisa|boleh)\s+(datang|mampir|ke toko)\b/i,
    ],
    why: "Ketersediaan toko offline adalah fakta tetap.",
  },
  {
    code: "LIBUR",
    action: "AUTO_REPLY",
    when: [/\b(tanggal merah|hari libur|libur nasional)\b/i],
    why: "Jadwal operasional hari libur adalah kebijakan tetap.",
  },
  {
    code: "SENIN",
    action: "AUTO_REPLY",
    when: [
      /\b(sabtu|minggu|weekend|akhir pekan)\b.*\b(kirim|dikirim|proses|diproses)\b/i,
      /\b(kirim|dikirim|proses|diproses)\b.*\b(sabtu|minggu|weekend|akhir pekan)\b/i,
    ],
    why: "Kebijakan pemrosesan pesanan akhir pekan, kalimatnya tetap.",
  },
  {
    code: "PAKAI POC",
    action: "AUTO_REPLY",
    when: [
      /\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran)\b.*\bpoc\b/i,
      /\bpoc\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i,
    ],
    why: "Dosis POC wajib persis Knowledge Base — justru berbahaya bila dikarang AI.",
  },
  {
    code: "PAKAI NEEM",
    action: "AUTO_REPLY",
    when: [
      /\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\b(neem|pestisida)\b/i,
      /\b(neem|pestisida)\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i,
    ],
    why: "Dosis pestisida wajib persis Knowledge Base.",
  },
  {
    code: "PAKAI ABMB",
    action: "AUTO_REPLY",
    when: [
      /\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\bab ?mix\b/i,
      /\bab ?mix\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i,
    ],
    why: "Dosis AB Mix wajib persis Knowledge Base, termasuk larangan mencampur stok A dan B.",
  },
  {
    code: "KOMPLAIN",
    action: "HANDOVER_TO_CS",
    when: [
      /\b(rusak|pecah|bocor|penyok|jamuran|busuk)\b/i,
      /\b(salah kirim|kurang|tidak sesuai|gak sesuai|nggak sesuai|beda)\b.*\b(pesanan|barang|isi|produk)\b/i,
    ],
    why: "Keluhan barang. sop.md mewajibkan alih ke CS manusia — balasan baku justru lebih aman daripada AI menyusun kalimat sendiri.",
  },
];

/** Cocokkan pesan ke template. Null berarti serahkan ke AI. */
export function matchTemplate(pesan) {
  const msg = String(pesan ?? "").trim();
  if (!msg) return null;
  if (BUTUH_PENILAIAN.test(msg)) return null;
  if (msg.length > BATAS_PANJANG) return null;

  const lib = muatPustaka();

  for (const rule of RULES) {
    if (rule.unless?.some((re) => re.test(msg))) continue;
    if (!rule.when.some((re) => re.test(msg))) continue;

    const reply = lib.get(rule.code);
    if (!reply) {
      // Kode tidak ada di berkas FAQ (mis. judulnya diubah) — jangan
      // mengarang, serahkan saja ke AI.
      console.warn(`[KB-ROUTER] Kode [${rule.code}] tidak ada di berkas FAQ mana pun`);
      continue;
    }
    return { code: rule.code, action: rule.action, reply, why: rule.why };
  }
  return null;
}

/* ===========================================================
   LAPIS 2 — penentuan kategori

   Kosakata diambil dari nama kode di index.json, bukan daftar
   tebakan. Lihat penjelasan di kepala berkas.
   =========================================================== */

/** Kata yang terlalu umum untuk jadi petunjuk kategori. */
const STOPWORD = new Set([
  "yang", "dan", "atau", "di", "ke", "dari", "untuk", "dengan", "pada",
  "ada", "apa", "apakah", "gimana", "bagaimana", "berapa", "kah", "nya",
  "saya", "aku", "kami", "kakak", "kak", "min", "minfarm", "admin",
  "mau", "bisa", "boleh", "tolong", "mohon", "ya", "yaa", "dong", "kok",
  "itu", "ini", "nih", "sih", "aja", "saja", "juga", "lagi", "sudah",
  "belum", "tidak", "gak", "nggak", "ga", "bukan", "kalau", "kalo",
  "biar", "supaya", "jadi", "buat", "punya", "pakai", "pake",
]);

function tokenisasi(teks) {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORD.has(t));
}

/** { token -> { kategori -> jumlah kode } }, dibangun dari index.json. */
let kosakata = null;

function muatKosakata() {
  if (kosakata) return kosakata;

  kosakata = new Map();
  let index;
  try {
    index = JSON.parse(readFileSync(join(kbDir, "index.json"), "utf8"));
  } catch (err) {
    console.warn(`[KB-ROUTER] index.json tidak terbaca: ${err.message}`);
    return kosakata;
  }

  for (const berkas of index.berkas ?? []) {
    const kategori = Object.keys(CATEGORY_FILES).find(
      (k) => berkas.file.endsWith(CATEGORY_FILES[k]),
    );
    if (!kategori) continue;

    for (const kode of berkas.kode ?? []) {
      for (const token of tokenisasi(kode)) {
        if (!kosakata.has(token)) kosakata.set(token, {});
        const per = kosakata.get(token);
        per[kategori] = (per[kategori] ?? 0) + 1;
      }
    }
  }
  return kosakata;
}

/** Skor minimum sebelum sebuah kategori dianggap benar-benar cocok. */
const AMBANG_SKOR = 0.9;
/** Pemenang harus sekian kali lebih kuat dari runner-up. */
const AMBANG_UNGGUL = 1.5;

/**
 * Hitung skor tiap kategori untuk sebuah pesan.
 * Bobot tiap token = 1 / (jumlah kategori yang memakainya), jadi
 * kata seperti "cara" (muncul di banyak kategori) hampir tak
 * berpengaruh, sedangkan "polybag" atau "abmix" sangat menentukan.
 */
export function skorKategori(pesan) {
  const vocab = muatKosakata();
  const skor = Object.fromEntries(CATEGORIES.map((k) => [k, 0]));

  for (const token of new Set(tokenisasi(pesan))) {
    const per = vocab.get(token);
    if (!per) continue;
    const jumlahKategori = Object.keys(per).length;
    const bobot = 1 / jumlahKategori;
    for (const kategori of Object.keys(per)) {
      // Sengaja tidak menghitung berapa kode yang memuat token ini:
      // yang menentukan adalah seberapa KHAS token itu bagi sebuah
      // kategori, bukan seberapa sering dipakai. Menghitung frekuensi
      // justru membuat kode satu kata (BANTU, LIBUR) kalah ambang.
      skor[kategori] += bobot;
    }
  }
  return skor;
}

/**
 * Tentukan kategori paling relevan.
 * @returns {{kategori: string, skor: object, alasan: string}}
 *          kategori bernilai salah satu CATEGORIES atau 'unclear'.
 */
export function tentukanKategori(pesan) {
  const skor = skorKategori(pesan);
  const urut = Object.entries(skor).sort((a, b) => b[1] - a[1]);
  const [juara, nilaiJuara] = urut[0];
  const nilaiKedua = urut[1]?.[1] ?? 0;

  if (nilaiJuara < AMBANG_SKOR) {
    return {
      kategori: "unclear",
      skor,
      alasan: `skor tertinggi ${nilaiJuara.toFixed(2)} di bawah ambang ${AMBANG_SKOR}`,
    };
  }
  if (nilaiKedua > 0 && nilaiJuara < nilaiKedua * AMBANG_UNGGUL) {
    return {
      kategori: "unclear",
      skor,
      alasan: `${juara} (${nilaiJuara.toFixed(2)}) tidak cukup unggul dari ${urut[1][0]} (${nilaiKedua.toFixed(2)})`,
    };
  }
  return {
    kategori: juara,
    skor,
    alasan: `${juara} menang ${nilaiJuara.toFixed(2)} vs ${nilaiKedua.toFixed(2)}`,
  };
}

/* ===========================================================
   Fungsi utama
   =========================================================== */

/**
 * Tentukan bagaimana sebuah pesan pelanggan harus dilayani.
 *
 * @param {string} pesanPelanggan
 * @returns {object} keputusan:
 *
 *   { jenis: 'template', kode, teks, action, kategori, berkas, alasan }
 *     -> balas langsung, JANGAN panggil Claude.
 *
 *   { jenis: 'ai', kategori, berkas: string[], skor, alasan }
 *     -> panggil Claude dengan claude-core.md + berkas di daftar.
 *        kategori 'unclear' berarti keempat berkas ikut (fallback).
 */
export function routeToCategory(pesanPelanggan) {
  // --- Lapis 1: template persis ---
  const template = matchTemplate(pesanPelanggan);
  if (template) {
    const berkas = getAsalKode().get(template.code) ?? null;
    const kategori =
      CATEGORIES.find((k) => CATEGORY_FILES[k] === berkas) ?? "unclear";
    return {
      jenis: "template",
      kode: template.code,
      teks: template.reply,
      action: template.action,
      kategori,
      berkas: berkas ? [berkas] : [],
      alasan: template.why,
    };
  }

  // --- Lapis 2 & 3: kategori, atau fallback semua berkas ---
  const { kategori, skor, alasan } = tentukanKategori(pesanPelanggan);
  return {
    jenis: "ai",
    kategori,
    berkas: kategori === "unclear" ? [...ALL_FAQ_FILES] : [CATEGORY_FILES[kategori]],
    skor,
    alasan,
  };
}

/**
 * Baca isi berkas FAQ hasil routing, siap disambung ke system prompt.
 * @param {string[]} daftarBerkas
 * @returns {{teks: string, rincian: {berkas: string, karakter: number}[]}}
 */
export function bacaBerkasFaq(daftarBerkas) {
  const rincian = [];
  const potongan = [];
  for (const berkas of daftarBerkas) {
    const isi = baca(berkas);
    rincian.push({ berkas, karakter: isi.length });
    if (isi) potongan.push(isi);
  }
  return { teks: potongan.join("\n\n"), rincian };
}

/** Total karakter seluruh berkas FAQ — pembanding untuk log penghematan. */
export function totalKarakterFaq() {
  return ALL_FAQ_FILES.reduce((n, f) => n + baca(f).length, 0);
}

/**
 * Satu baris log per permintaan: kategori, berkas terkirim, dan
 * berapa karakter FAQ yang dihemat dibanding mengirim keempatnya.
 */
export function logRouting(keputusan, prefix = "[KB-ROUTER]") {
  if (keputusan.jenis === "template") {
    console.log(
      `${prefix} template [${keputusan.kode}] dari ${keputusan.berkas[0] ?? "?"} — Claude tidak dipanggil (0 berkas FAQ terkirim)`,
    );
    return { terkirim: 0, total: totalKarakterFaq(), hemat: totalKarakterFaq() };
  }

  const total = totalKarakterFaq();
  const { rincian } = bacaBerkasFaq(keputusan.berkas);
  const terkirim = rincian.reduce((n, r) => n + r.karakter, 0);
  const hemat = total - terkirim;
  const persen = total ? ((hemat / total) * 100).toFixed(1) : "0";

  console.log(
    `${prefix} kategori=${keputusan.kategori} berkas=${keputusan.berkas.length}/${ALL_FAQ_FILES.length} ` +
      `(${keputusan.berkas.join(", ") || "-"}) faq=${terkirim}/${total} karakter, hemat ${hemat} (${persen}%) — ${keputusan.alasan}`,
  );

  return { terkirim, total, hemat };
}

/** Jumlah aturan pencocokan template (dipakai /api/health). */
export function jumlahAturan() {
  return RULES.length;
}
