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

/**
 * Pertanyaan yang meminta DESKRIPSI produk, bukan cara pakainya.
 * "apa ya" sengaja TIDAK dimasukkan: tanpa batas kata ia tercakup
 * di dalam "ber-apa ya-ng", dan dengan batas kata pun masih terlalu
 * longgar ("POC ada apa ya" bisa berarti menanyakan stok).
 */
const MINTA_DESKRIPSI =
  /\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b/i;

/**
 * Pembatal bersama untuk keenam aturan PRODUK * di bawah.
 * Baris 1: pertanyaan pemakaian — wilayah aturan PAKAI * atau AI.
 * Baris 2: stok/harga/pengiriman — "POC ready nggak kak?" itu tanya
 *          ketersediaan, bukan minta deskripsi produk.
 */
const TOLAK_DESKRIPSI = [
  /\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b/i,
  /\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b/i,
];

/**
 * Pertanyaan yang menanyakan CARA PAKAI atau DOSIS.
 * Dipakai sebagai syarat DAN (`also`) oleh aturan Tier 1, supaya
 * menyebut nama produk saja tidak memicu balasan baku: "NPK habis"
 * bukan pertanyaan dosis, sedangkan "dosis NPK berapa" iya.
 */
const MINTA_PEMAKAIAN =
  /\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)/i;

/* Bentuk satu aturan:
     code    kode entri di berkas FAQ
     action  klasifikasi yang dilaporkan, setara keluaran AI
     when    daftar pola; cukup SALAH SATU cocok (bersifat ATAU)
     also    pola tambahan yang WAJIB ikut cocok (bersifat DAN)
     unless  bila salah satu cocok, aturan dibatalkan
     why     alasan aturan ini aman tanpa AI, untuk audit          */
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
    when: [/\bharga(nya)?\b/i, /\bberapa(an)? (harganya|duit|rupiah)\b/i],
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
    // Varian instan punya dosis sendiri ([PAKAI ABMC]: 5 ml + 5 ml,
    // bukan dilarutkan ke 500 ml). Tanpa pengecualian ini, aturan
    // ABMB yang lebih dulu dalam urutan akan mengirim dosis yang salah.
    unless: [/\binstan(t)?\b/i],
    why: "Dosis AB Mix wajib persis Knowledge Base, termasuk larangan mencampur stok A dan B.",
  },
  /* ---------- Tier 1: dosis & cara pakai (2 Sep 2026) ----------
     Dua puluh lima entri yang jawabannya berupa DOSIS atau LANGKAH
     baku. Justru inilah kelompok yang paling berbahaya bila dikarang
     AI: sop.md melarang mengubah dosis yang tercantum di Knowledge
     Base, jadi membalas dari berkas lebih aman daripada menyusun
     kalimat sendiri.

     Semua memakai also: MINTA_PEMAKAIAN — menyebut nama produk saja
     tidak cukup. "NPK habis, mau beli lagi" tetap ke AI.

     Ditaruh SEBELUM blok PRODUK * di bawah supaya pertanyaan cara
     pakai menang atas pertanyaan deskripsi: "cara pakai miracle
     powder" -> [MIRACLE POWDER], bukan [PRODUK MIRACLE].

     Urutan di dalam blok ini juga disengaja: yang lebih spesifik
     lebih dulu (kalibrasi sebelum cara pakai alat, hitung ppm
     sebelum TDS meter).                                           */
  {
    code: "CARA KALIBRASI ULANG TDS METER",
    action: "AUTO_REPLY",
    when: [/\bkalibrasi\b.*\btds\b|\btds\b.*\bkalibrasi\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Prosedur kalibrasi TDS meter — langkah baku, salah urutan bikin alat meleset.",
  },
  {
    code: "CARA KALIBRASI ULANG PH METER",
    action: "AUTO_REPLY",
    when: [/\bkalibrasi\b.*\bph\b|\bph\b.*\bkalibrasi\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Prosedur kalibrasi pH meter — langkah baku.",
  },
  {
    code: "HITUNG PPM TDS",
    action: "AUTO_REPLY",
    when: [/\b(hitung|ngitung|menghitung)\b.*\bppm\b|\bppm\b.*\b(hitung|ngitung|rumus)\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Rumus ppm nutrisi = ppm TDS dikurangi ppm air baku. Angka tetap.",
  },
  {
    code: "CARA PAKAI TDS METER",
    action: "AUTO_REPLY",
    when: [/\btds( ?meter)?\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah pemakaian TDS meter — prosedur baku.",
  },
  {
    code: "CARA PAKAI PH METER",
    action: "AUTO_REPLY",
    when: [/\bph ?meter\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah pemakaian pH meter — prosedur baku.",
  },
  {
    code: "SOIL METER",
    action: "AUTO_REPLY",
    when: [/\bsoil ?meter\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah pemakaian soil meter — prosedur baku.",
  },
  {
    code: "PAKAI ABMC",
    action: "AUTO_REPLY",
    when: [/\bab ?mix instan(t)?\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis AB Mix instan 5 ml A + 5 ml B — wajib persis Knowledge Base.",
  },
  {
    code: "PAKAI FRUITEXPERT",
    action: "AUTO_REPLY",
    when: [/\bfruit ?expert\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Jadwal selang-seling Fruit Expert & POC — aturan tetap, bukan penilaian.",
  },
  {
    code: "VITAMIN AKAR",
    action: "AUTO_REPLY",
    when: [/\bvitamin akar\b|\bvitamin b ?1\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Jadwal selang-seling vitamin akar — aturan tetap.",
  },
  {
    code: "PAKAI AKAR",
    action: "AUTO_REPLY",
    when: [/\b(nutrisi|hormon) akar\b|\bauksin\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis hormon akar 0,5 ml/L untuk stek — wajib persis Knowledge Base.",
  },
  {
    code: "PAKAI B1",
    action: "AUTO_REPLY",
    when: [/\bb ?1\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis B1: 1 tutup botol per 2 liter — wajib persis.",
  },
  {
    code: "MAGNESIUM",
    action: "AUTO_REPLY",
    when: [/\b(magnesium|mgso4|garam inggris)\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis Magnesium Sulfat kocor 5-10 gr/L — wajib persis.",
  },
  {
    code: "CARA PAKAI NPK",
    action: "AUTO_REPLY",
    when: [/\bnpk\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis NPK 1 sdm per liter — wajib persis.",
  },
  {
    code: "PAKAI GUANO",
    action: "AUTO_REPLY",
    when: [/\bguano\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis pupuk guano — wajib persis Knowledge Base.",
  },
  {
    code: "DOLOMIT",
    action: "AUTO_REPLY",
    when: [/\bdolomit\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis dolomit 100-200 gr/m2 — wajib persis.",
  },
  {
    code: "MIRACLE POWDER",
    action: "AUTO_REPLY",
    when: [/\bmiracle( ?powder)?\b|\basam humat\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis Miracle Powder (asam humat) — wajib persis. Ditaruh sebelum [PRODUK MIRACLE] supaya pertanyaan pemakaian tidak dijawab deskripsi.",
  },
  {
    code: "NUTRIPOD",
    action: "AUTO_REPLY",
    when: [/\bnutripod\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis Nutripod 1 sachet per 10 liter — wajib persis.",
  },
  {
    code: "CARA PAKAI ASAM AMINO",
    action: "AUTO_REPLY",
    when: [/\basam amino\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis asam amino 5 ml/L — wajib persis.",
  },
  {
    code: "CARA PAKAI EM4",
    action: "AUTO_REPLY",
    when: [/\bem ?4\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah pengomposan dengan EM4 — prosedur baku.",
  },
  {
    code: "PBM",
    action: "AUTO_REPLY",
    when: [/\bpbm\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis POC Sayur pada paket PBM — wajib persis.",
  },
  {
    code: "PAKAI AGK LENGKAP",
    action: "AUTO_REPLY",
    when: [/\bagk\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Urutan pemakaian paket AGK lengkap — prosedur baku.",
  },
  {
    code: "COCOPEAT",
    action: "AUTO_REPLY",
    when: [/\bcocopeat\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah merendam & memakai cocopeat block — prosedur baku.",
  },
  {
    code: "CANGKOK",
    action: "AUTO_REPLY",
    when: [/\b(cangkok|groot)\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah stek/cangkok dengan groot — prosedur baku.",
  },
  {
    code: "ATRAKTAN PETROGENOL",
    action: "AUTO_REPLY",
    when: [/\b(petrogenol|atraktan)\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Langkah pemasangan perangkap atraktan — prosedur baku.",
  },
  {
    code: "BIVI",
    action: "AUTO_REPLY",
    when: [/\bbivi\b/i],
    also: MINTA_PEMAKAIAN,
    why: "Dosis BIVI 0,5 gr/L pencegahan — wajib persis.",
  },
  /* ---------- Enam entri PRODUK * (ditambahkan 2 Sep 2026) ----------
     Semuanya deskripsi produk yang tetap ("apa itu X", "X untuk apa"),
     bukan penilaian — aman dijawab baku.

     Sengaja diletakkan SETELAH aturan PAKAI * di atas. Aturan dinilai
     berurutan, jadi "cara pakai POC" tetap jatuh ke [PAKAI POC], bukan
     ke [PRODUK POC]. TOLAK_DESKRIPSI hanya jaring kedua bila pola
     PAKAI * meleset.

     Semua tetap tunduk pada BUTUH_PENILAIAN, jadi "POC cocok nggak
     buat cabai" atau "boleh dicampur nggak" tetap diserahkan ke AI. */
  {
    code: "PRODUK POC",
    action: "AUTO_REPLY",
    when: [/\bpoc\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi POC: pupuk organik cair untuk melebatkan buah & sayur. Kalimat tetap, tidak bergantung situasi pelanggan.",
  },
  {
    code: "PRODUK MIRACLE",
    action: "AUTO_REPLY",
    when: [/\bmiracle( ?powder)?\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi Miracle Powder: menggemburkan tanah yang mengeras. Kalimat tetap.",
  },
  {
    code: "PRODUK AKAR",
    action: "AUTO_REPLY",
    when: [/\b(produk|nutrisi|booster) akar\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi nutrisi akar: melebatkan akar & mengurangi stres tanaman stek. Kalimat tetap.",
  },
  {
    code: "PRODUK PELEBAT",
    action: "AUTO_REPLY",
    when: [/\b(paket )?pelebat\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi paket pelebat untuk tanaman berbuah. Kalimat tetap.",
  },
  {
    code: "PRODUK PESTISIDA",
    action: "AUTO_REPLY",
    when: [/\bpestisida\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi pestisida organik untuk ulat & kutu. Kalimat tetap; dosisnya tetap milik [PAKAI NEEM] atau AI.",
  },
  {
    code: "PRODUK SEEDBOOSTER",
    action: "AUTO_REPLY",
    when: [/\bseed ?booster\b/i],
    also: MINTA_DESKRIPSI,
    unless: TOLAK_DESKRIPSI,
    why: "Deskripsi seed booster untuk mempercepat benih dorman bertunas. Kalimat tetap.",
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
    if (rule.also && !rule.also.test(msg)) continue;

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

/**
 * Kenapa sebuah pesan TIDAK tertangkap template.
 *
 * Dipakai kotak "Uji coba" di halaman Kelola Template. Ditaruh di
 * sini, bersebelahan dengan pengamannya, dan bukan disalin ke sisi
 * Next.js — salinan pola pengaman pasti menyimpang begitu polanya
 * diperbarui, dan halaman akan menjelaskan sebab yang keliru.
 *
 * @returns kalimat penjelasan, atau null bila pesannya justru COCOK.
 */
export function jelaskanTidakCocok(pesan) {
  const msg = String(pesan ?? '').trim();
  if (!msg) return 'Pesannya masih kosong.';

  if (msg.length > BATAS_PANJANG) {
    return (
      `Pesan lebih dari ${BATAS_PANJANG} karakter, jadi selalu diserahkan ke AI. ` +
      'Pesan sepanjang ini biasanya pelanggan sedang bercerita, bukan menanyakan satu hal.'
    );
  }

  if (BUTUH_PENILAIAN.test(msg)) {
    const kena = msg.match(BUTUH_PENILAIAN);
    return (
      `Pesan mengandung kata "${kena ? kena[0] : ''}" yang menuntut penilaian, ` +
      'jadi selalu diserahkan ke AI walaupun kata kuncinya cocok. ' +
      'Balasan baku berisiko keliru untuk pertanyaan seperti ini.'
    );
  }

  if (matchTemplate(msg)) return null;

  return 'Belum ada kata kunci pemicu yang cocok dengan pesan ini.';
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

/**
 * Susun pola pemicu dari frasa biasa yang diketik tim CS.
 *
 * INILAH yang membuat halaman Kelola Template aman dipakai orang
 * non-teknis: mereka mengetik "dosis npk", bukan pola regex. Semua
 * karakter khusus di-escape, jadi frasa seperti "12.12" atau "(promo)"
 * diperlakukan sebagai teks biasa dan tidak bisa menjadi pola liar
 * yang menggantung server.
 *
 * Spasi jadi \\s+ supaya "cara pakai" tetap cocok pada "cara  pakai".
 *
 * @param {string[]} frasa
 * @returns {string|null} sumber regex, atau null bila tidak ada frasa.
 */
export function buatPolaDariFrasa(frasa) {
  const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bagian = (frasa ?? [])
    .map((t) => String(t ?? '').trim().toLowerCase())
    .filter(Boolean)
    .map((t) => escape(t).replace(/\s+/g, '\\s+'));
  if (!bagian.length) return null;
  return `\\b(${bagian.join('|')})\\b`;
}

/**
 * Uji kata kunci yang BELUM tersimpan sebagai aturan.
 *
 * Dipakai form "Tambah Template": tanpa ini, tim CS harus menyimpan
 * dulu baru tahu apakah kata kuncinya menangkap — yaitu menebak.
 *
 * Yang dilaporkan tiga hal, karena ketiganya butuh tindakan berbeda:
 *   dicegatPengaman - kata kunci tidak akan pernah dipakai untuk pesan
 *                     seperti ini, apa pun frasanya
 *   cocokDraf       - frasa yang diketik menangkap pesan ini
 *   direbut         - ada template TERSIMPAN yang menang lebih dulu
 *
 * @param {string} pesan
 * @param {string[]} frasa
 */
export function ujiDraf(pesan, frasa) {
  const msg = String(pesan ?? '').trim();
  const sumber = buatPolaDariFrasa(frasa);

  const alasanPengaman =
    msg.length > BATAS_PANJANG || BUTUH_PENILAIAN.test(msg)
      ? jelaskanTidakCocok(msg)
      : null;

  let cocokDraf = false;
  if (sumber) {
    try {
      cocokDraf = new RegExp(sumber, 'i').test(msg);
    } catch {
      // buatPolaDariFrasa sudah meng-escape semuanya, jadi ini
      // seharusnya tidak terjadi. Kalau toh terjadi, anggap tidak
      // cocok — jangan sampai satu frasa aneh menjatuhkan halaman.
      cocokDraf = false;
    }
  }

  const tersimpan = matchTemplate(msg);

  return {
    dicegatPengaman: alasanPengaman,
    cocokDraf,
    direbutOleh: tersimpan ? tersimpan.code : null,
    pola: sumber,
  };
}

/** Jumlah aturan pencocokan template (dipakai /api/health). */
export function jumlahAturan() {
  return RULES.length;
}

/**
 * Aturan pencocokan dalam bentuk yang bisa dikirim sebagai JSON.
 *
 * RegExp tidak bisa di-JSON.stringify (hasilnya {}), jadi tiap pola
 * dikembalikan sebagai teks sumbernya. Halaman Kelola Template
 * memakainya untuk menunjukkan kata kunci pemicu tiap template dan
 * — yang lebih penting — template mana yang BELUM punya pemicu sama
 * sekali (109 dari 152 pada 4 Sep 2026).
 *
 * `urutan` sengaja ikut dikirim: urutan aturan adalah logika, dan
 * tanpa nomor itu tidak terlihat kenapa satu pesan jatuh ke template
 * A dan bukan B.
 */
export function getRules() {
  const sumber = (re) => (re instanceof RegExp ? re.source : String(re));
  return RULES.map((r, i) => ({
    urutan: i + 1,
    code: r.code,
    action: r.action,
    when: r.when.map(sumber),
    also: r.also ? sumber(r.also) : null,
    unless: r.unless ? r.unless.map(sumber) : [],
    why: r.why,
  }));
}
