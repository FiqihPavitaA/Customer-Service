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

/* ===========================================================
   SUMBER LUAR — pustaka & aturan dari tabel Supabase
   ===========================================================

   Sampai 8 September 2026 satu-satunya sumber template adalah
   keempat berkas .md. Akibatnya halaman Kelola Template tidak bisa
   berbuat apa-apa: menyimpan berarti menulis ke berkas di dalam
   repo, yaitu tetap butuh commit, deploy, dan seorang developer —
   persis pekerjaan yang halaman itu dibuat untuk menghapusnya.

   Blok ini menambah sumber KEDUA. Bila diisi, ia menang atas
   berkas; bila tidak, semuanya berjalan seperti sebelumnya.

   TIGA HAL YANG SENGAJA TIDAK DILAKUKAN DI SINI

   1. Berkas .md TIDAK dihapus dan TIDAK berhenti dibaca.
      Ia jadi cadangan. Supabase mati, kunci belum diisi, tabel
      masih kosong — ketiganya harus berujung pada balasan yang
      tetap terkirim, bukan pada pelanggan yang didiamkan. Sumber
      yang dipakai dilaporkan lewat getSumberAktif() supaya
      perpindahannya tidak pernah diam-diam.

   2. Teks FAQ yang dikirim ke Claude TIDAK ikut pindah.
      bacaBerkasFaq() tetap membaca berkas. Jadi template baru
      buatan tim CS langsung bekerja di Lapis 1 (dicocokkan dan
      dikirim, Rp 0), tetapi Claude belum mengetahuinya. Itu
      keterbatasan yang diketahui, bukan yang terlupa — memindahkan
      blok FAQ berarti menyusun ulang teks per kategori sekaligus
      kosakata penentu kategori, dan itu pekerjaan tersendiri.

   3. Pola regex dari database TIDAK dipercaya begitu saja.
      new RegExp() bisa melempar, dan pola yang buruk bisa
      menggantung server. Setiap pola disusun di dalam try/catch dan
      yang gagal dibuang beserta peringatan — satu aturan rusak
      tidak boleh mematikan seluruh pencocok. Frasa yang diketik tim
      CS sendiri sudah aman lebih dulu karena buatPolaDariFrasa()
      meng-escape seluruh karakter khusus.
   =========================================================== */

/** Peta { KODE -> teks } dari tabel, atau null bila memakai berkas. */
let pustakaLuar = null;
/** Peta { KODE -> nama berkas } padanan, supaya kategori tetap terbaca. */
let asalLuar = null;
/** Aturan hasil susun ulang dari tabel; null berarti pakai RULES bawaan. */
let aturanLuar = null;

/** Dari mana Lapis 1 sedang membaca: "berkas" atau "supabase". */
let sumberAktif = "berkas";

/** Slug kategori di tabel -> nama berkas .md padanannya. */
const BERKAS_SLUG = {
  interaksi: "faq-interaksi.md",
  "cara-pakai": "faq-cara-pakai.md",
  produk: "faq-produk.md",
  umum: "faq-umum.md",
};

/**
 * Pasang pustaka & aturan dari tabel Supabase.
 *
 * @param {Array<{
 *   code: string, body: string, action?: string, category_slug?: string,
 *   priority?: number|null, when_patterns?: string[]|null,
 *   also_pattern?: string|null, unless_patterns?: string[]|null,
 *   flags?: string|null, why?: string|null
 * }>} baris keluaran fungsi public.pustaka_router()
 * @returns {{templates: number, aturan: number, ditolak: string[]}}
 */
export function setSumberLuar(baris) {
  if (!Array.isArray(baris) || baris.length === 0) {
    // Tabel kosong bukan alasan untuk mendiamkan pelanggan. Kembali
    // ke berkas, dan katakan begitu lewat getSumberAktif().
    return bersihkanSumberLuar();
  }

  const pustaka = new Map();
  const asal = new Map();
  const aturan = [];
  const ditolak = [];

  for (const b of baris) {
    const code = String(b?.code ?? "").trim();
    if (!code) continue;

    // Baris pertama untuk sebuah kode yang menentukan teksnya. Satu
    // template bisa muncul beberapa kali karena LEFT JOIN ke aturan.
    if (!pustaka.has(code)) {
      pustaka.set(code, String(b.body ?? "").trim());
      asal.set(code, BERKAS_SLUG[b.category_slug] ?? "faq-umum.md");
    }

    // Baris tanpa priority = template tanpa pemicu. Teksnya tetap
    // dipakai (Gerbang 2 membutuhkannya), aturannya memang tidak ada.
    if (b.priority === null || b.priority === undefined) continue;

    const bendera = String(b.flags ?? "i") || "i";
    const susun = (sumber) => new RegExp(String(sumber), bendera);

    try {
      const when = (b.when_patterns ?? []).map(susun);
      if (!when.length) {
        ditolak.push(`[${code}] aturan tanpa pola`);
        continue;
      }
      aturan.push({
        code,
        action: b.action ?? "AUTO_REPLY",
        when,
        also: b.also_pattern ? susun(b.also_pattern) : null,
        unless: (b.unless_patterns ?? []).map(susun),
        why: b.why ?? "",
        priority: Number(b.priority),
      });
    } catch (e) {
      // Satu pola rusak membuang SATU aturan, bukan seluruh pencocok.
      ditolak.push(`[${code}] pola tidak sah: ${e.message}`);
    }
  }

  // Urutan aturan adalah logika — tegakkan di sini, jangan bersandar
  // pada urutan baris yang kebetulan datang dari jaringan.
  aturan.sort((a, b) => a.priority - b.priority);

  pustakaLuar = pustaka;
  asalLuar = asal;
  aturanLuar = aturan;
  sumberAktif = "supabase";

  if (ditolak.length) {
    console.warn(`[KB-ROUTER] ${ditolak.length} aturan dibuang: ${ditolak.join("; ")}`);
  }
  return { templates: pustaka.size, aturan: aturan.length, ditolak };
}

/** Kembali membaca berkas .md. */
export function bersihkanSumberLuar() {
  pustakaLuar = null;
  asalLuar = null;
  aturanLuar = null;
  sumberAktif = "berkas";
  return { templates: 0, aturan: 0, ditolak: [] };
}

/**
 * Sumber yang sedang dipakai Lapis 1: "berkas" atau "supabase".
 *
 * Dilaporkan ke UI dan /api/health. Perpindahan sumber yang tidak
 * terlihat adalah kegagalan paling mahal di sini: tim CS menyunting
 * template di database, router diam-diam masih membaca berkas, dan
 * tidak ada satu pun pesan galat yang menjelaskannya.
 */
export function getSumberAktif() {
  return sumberAktif;
}

/** Pustaka yang berlaku sekarang — tabel bila ada, berkas bila tidak. */
function pustakaAktif() {
  return pustakaLuar ?? muatPustaka();
}

/** Aturan yang berlaku sekarang. */
function aturanAktif() {
  return aturanLuar ?? RULES;
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
      // Yang PERTAMA menang bila ada kode kembar.
      //
      // Sejak 8 September 2026 tidak ada lagi kode kembar di berkas
      // KB, tetapi penjaga ini dipertahankan sebagai jaring pengaman.
      // Sebelumnya ada tiga ([KOMPLAIN], [BERTAHAP], [IDUL FITRI])
      // dan akibatnya halus: versi kedua terbaca oleh tim CS di
      // berkas, tetapi tidak pernah sekali pun terkirim ke pelanggan.
      // Sekarang periksa-katalog.mjs yang menangkapnya, bukan
      // pelanggan.
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
  if (asalLuar) return asalLuar;
  muatPustaka();
  return asalKode;
}

/** Peta { KODE -> teks balasan }. */
export function getTemplateLibrary() {
  return pustakaAktif();
}

/**
 * Pustaka dari BERKAS saja, mengabaikan sumber luar.
 *
 * Dipakai /api/templates untuk menunjukkan selisih antara isi berkas
 * dan isi tabel. Tanpa pintu ini, begitu tabel dipakai tidak ada lagi
 * cara melihat apa yang masih tertinggal di berkas .md.
 */
export function getPustakaBerkas() {
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
 *
 * DIPERLUAS 8 SEPTEMBER 2026 setelah "poc tuh singkatan dari apa"
 * lolos ke Claude. Kodenya tidak salah — daftarnya saja yang kurang,
 * dan kekurangan itu tidak pernah muncul sebagai galat: pesan yang
 * seharusnya gratis diam-diam jadi berbayar.
 *
 * Empat rumpun yang ditambahkan, semuanya cara wajar bertanya
 * "produk ini apa" yang sebelumnya tidak tercakup:
 *
 *   singkatan/kepanjangan  "poc tuh singkatan dari apa"
 *   guna(nya)              "poc gunanya apa" — daftar lama hanya
 *                          memuat "kegunaan(nya)", dan \b membuat
 *                          keduanya tidak saling menutupi
 *   arti(nya)              "poc artinya apa"
 *   maksud(nya)            "poc maksudnya apa"
 *
 * Semuanya aman terhadap salah tangkap karena masih harus lolos
 * `when` (nama produknya wajib disebut) DAN `unless` (pertanyaan
 * dosis, stok, dan harga tetap dibuang).
 *
 * "digunakan" TIDAK ikut tertangkap oleh `guna(nya)?`: batas kata di
 * depan pola menuntut huruf non-kata sebelum "guna", sedangkan pada
 * "digunakan" huruf sebelumnya adalah "i".
 */
const MINTA_DESKRIPSI =
  /\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|guna(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|singkatan(nya)?|kepanjangan(nya)?|arti(nya)?|maksud(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b/i;

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

/* ===========================================================
   GERBANG 0 — SATPAM
   ===========================================================
   Berjalan SEBELUM pencocokan template, dan mengalahkan seluruh
   gerbang di belakangnya. Kalau satpam bilang sensitif, tidak ada
   balasan otomatis — sepintar apa pun modelnya.

   KENAPA HARUS DI DEPAN, BUKAN DISERAHKAN KE CLAUDE.
   claude-core.md memang menyuruh Claude melakukan HANDOVER_TO_CS
   untuk kasus-kasus ini, dan Claude umumnya menurut. Tetapi:

     1. Berbayar. Menempuh jalur Claude untuk sampai pada kesimpulan
        "ini harus ditangani manusia" membakar token untuk keputusan
        yang bisa diambil gratis dan pasti.
     2. Bergantung perilaku model. Instruksi prompt adalah imbauan,
        bukan jaminan. Untuk refund dan keracunan, imbauan tidak
        cukup — yang dibutuhkan adalah aturan yang tidak bisa
        dibujuk.

   ISI DAFTAR INI DITURUNKAN DARI claude-core.md bagian
   "C. HANDOVER_TO_CS — Wajib gunakan jika", bukan dikarang. Tiap
   entri menyebut butir asalnya di `why`.

   YANG SENGAJA TIDAK MASUK: "belum sampai". Itu pertanyaan
   pelacakan biasa dan jumlahnya paling banyak; memasukkannya akan
   membanjiri CS manusia dengan pertanyaan yang jawabannya ada di
   sistem pesanan (CHECK_ORDER_SYSTEM), bukan di tangan manusia.
   Yang masuk hanya "tidak/belum pernah sampai" yang sudah bernada
   kehilangan barang.

   Bentuknya sama dengan RULES di bawah supaya sekali paham,
   paham keduanya: when (ATAU), also (DAN), unless (pembatal).   */
const SATPAM = [
  {
    kategori: "refund_retur",
    when: [
      /\b(refund|retur|pengembalian dana|uang kembali|balikin uang|kembalikan uang)\b/i,
      /\b(kompensasi|ganti rugi|penggantian|tukar barang|tuker barang)\b/i,
      /\b(batal(in|kan)?|cancel)\b/i,
    ],
    why: "claude-core.md: pelanggan meminta refund, retur, pembatalan, kompensasi, atau penggantian. Hanya CS manusia yang berwenang menjanjikan ini.",
  },
  {
    kategori: "barang_bermasalah",
    when: [
      /\b(rusak|pecah|bocor|penyok|sobek|robek)\b/i,
      /\b(salah (kirim|barang|produk)|beda (barang|produk)|bukan yang (saya|aku) pesan)\b/i,
      /\b(tidak pernah sampai|nggak pernah sampai|gak pernah sampai|barang hilang|paket hilang)\b/i,
      /\b(isi|barang|paket|pesanan)(nya)? kurang\b/i,
      /\bkurang (satu|dua|tiga|\d+) (item|barang|pcs|botol|sachet|bungkus)\b/i,
    ],
    why: "claude-core.md: barang rusak, bocor, kurang, salah kirim, atau tidak sampai.",
  },
  {
    kategori: "sengketa",
    when: [
      /\b(penipuan|nipu|menipu|ditipu|tipu-tipu)\b/i,
      /\b(lapor(kan)?|somasi|tuntut|pengacara|polisi|ylki)\b/i,
      /\b(bintang (1|satu)|rating (1|satu)|ulasan buruk|review jelek)\b/i,
    ],
    why: "claude-core.md: pelanggan marah, mengancam, atau menyampaikan sengketa. Kemarahan tanpa kata-kata di atas tidak ditangkap di sini — itu memang lebih baik dinilai manusia lewat halaman Chat.",
  },
  {
    kategori: "keamanan",
    when: [
      /\b(keracunan|beracun|beracunkah|racunnya)\b/i,
      /\b(tertelan|termakan|kena mata|terhirup)\b/i,
      /\b(bayi|balita|anak kecil|kucing|anjing|hewan peliharaan|ternak)\b/i,
      // "Konsumsi hasil panen" disebut eksplisit di claude-core.md.
      // Ketahuan hilang saat menguji daftar ini terhadap kasus
      // "sayurnya aman dimakan nggak kalau habis disemprot".
      /\b(aman (di)?(makan|konsumsi|dimakan)|boleh dimakan|langsung dimakan|hasil panen)\b/i,
    ],
    why: "claude-core.md: pertanyaan menyangkut keamanan pestisida, keracunan, hewan peliharaan, anak-anak, atau konsumsi hasil panen. Dibiarkan lewat hanya bila jawabannya tertulis jelas di KB — dan satpam tidak bisa menilai itu, jadi selalu ditahan.",
  },
  {
    kategori: "tanaman_rusak",
    when: [/\b(mati|layu|gosong|terbakar|kering|rontok)\b/i],
    also: /\b(setelah|sesudah|habis|gara-gara|gegara|karena|abis) (di)?(pakai|pake|semprot|siram|kasih|aplikasi)/i,
    why: "claude-core.md: tanaman diduga rusak setelah menggunakan produk Infarm. Butuh `also` karena kata 'layu' sendirian adalah pertanyaan konsultasi biasa — yang menjadikannya sengketa adalah kaitan sebab-akibat dengan produk kami.",
  },
  {
    kategori: "minta_manusia",
    when: [
      /\b(bicara|ngomong|chat|hubungi|sambung(kan)?) (dengan |sama |ke )?(cs|admin|orang|manusia|petugas)( asli| beneran| langsung)?\b/i,
      /\b(ini (bot|robot|ai)|bukan bot|jangan bot|cs nya mana|admin nya mana|adminnya mana)\b/i,
    ],
    why: "claude-core.md: pelanggan secara eksplisit meminta berbicara dengan manusia. Menahannya di sini membuat permintaan itu dipenuhi seketika, bukan setelah satu putaran balasan otomatis lagi.",
  },
  {
    kategori: "luar_marketplace",
    when: [
      /\b(transfer|rekening|no rek|norek|dana|gopay|ovo|shopeepay)\b/i,
      /\b(wa|whatsapp|wa-?me|nomor hp|no hp|telegram|line)\b/i,
      /\b(beli|order|pesan) (di ?)?(luar|langsung)\b/i,
    ],
    why: "claude-core.md: menghindari pengarahan transaksi di luar ekosistem marketplace. Melanggar ketentuan Shopee/TikTok, dan sanksinya menimpa toko — bukan pelanggan.",
  },
];

/* ===========================================================
   SATPAM DARI TABEL — sumber kedua untuk Gerbang 0
   ===========================================================
   Ditambahkan 11 Sep 2026. Tim CS menemukan sendiri bahwa "chat
   penjual" tidak pernah tertangkap: pola minta_manusia hanya
   mengenal cs/admin/orang/manusia/petugas. Memperbaikinya dulu
   berarti commit + deploy, jadi daftarnya dipindahkan ke tabel
   `satpam_rules` yang bisa disunting admin.

   BEDANYA DENGAN setSumberLuar() DI ATAS, DAN KENAPA BERBEDA

   Untuk templates, "tabel kosong" berarti kembali membaca berkas
   .md — dua sumber yang setara isinya. Di sini tidak ada berkas;
   yang jadi cadangan adalah daftar SATPAM di kode ini. Maka:

     tabel terisi  -> tabel yang berlaku, kode diabaikan
     tabel kosong  -> daftar di kode, LENGKAP
     tabel gagal   -> daftar di kode, LENGKAP

   "Tidak ada pengaman" bukan salah satu kemungkinannya, dan itu
   disengaja. Gerbang 0 adalah satu-satunya hal yang menahan
   permintaan refund dan pertanyaan keracunan supaya tidak dijawab
   mesin; ia tidak boleh bisa dimatikan oleh sebuah tabel kosong,
   sebuah salah ketik, atau Supabase yang sedang tidak bisa
   dihubungi. */

/** Aturan hasil susun ulang dari tabel; null berarti pakai SATPAM. */
let satpamLuar = null;

/** Dari mana Gerbang 0 sedang membaca: "kode" atau "supabase". */
let sumberSatpam = "kode";

/**
 * Pasang aturan Gerbang 0 dari tabel Supabase.
 *
 * @param {Array<{
 *   kategori: string, priority?: number|null,
 *   when_patterns?: string[]|null, also_pattern?: string|null,
 *   unless_patterns?: string[]|null, flags?: string|null, why?: string|null
 * }>} baris keluaran fungsi public.satpam_router()
 * @returns {{aturan: number, ditolak: string[]}}
 */
export function setSatpamLuar(baris) {
  if (!Array.isArray(baris) || baris.length === 0) {
    return bersihkanSatpamLuar();
  }

  const aturan = [];
  const ditolak = [];

  for (const b of baris) {
    const kategori = String(b?.kategori ?? "").trim();
    if (!kategori) continue;

    const bendera = String(b.flags ?? "i") || "i";
    const susun = (sumber) => new RegExp(String(sumber), bendera);

    try {
      const when = (b.when_patterns ?? []).map(susun);
      if (!when.length) {
        ditolak.push(`[${kategori}] aturan tanpa pola`);
        continue;
      }
      aturan.push({
        kategori,
        when,
        also: b.also_pattern ? susun(b.also_pattern) : null,
        unless: (b.unless_patterns ?? []).map(susun),
        why: b.why ?? "",
        priority: Number(b.priority ?? 0),
      });
    } catch (e) {
      // Satu pola rusak membuang SATU aturan, bukan seluruh
      // pengaman — sama seperti setSumberLuar(). Tetapi di sini
      // akibatnya lebih tajam: aturan yang hilang berarti satu
      // kelas pesan berbahaya lolos. Karena itu yang dibuang
      // dikembalikan ke pemanggil, bukan sekadar dicatat di log,
      // supaya /api/health bisa menunjukkannya.
      ditolak.push(`[${kategori}] pola tidak sah: ${e.message}`);
    }
  }

  if (aturan.length === 0) {
    // Seluruh isi tabel ditolak. Berjalan tanpa satu pun aturan
    // jauh lebih buruk daripada memakai daftar bawaan yang sudah
    // teruji, jadi ini diperlakukan sama dengan tabel kosong.
    console.warn(
      `[KB-ROUTER] Gerbang 0: seluruh ${baris.length} baris tabel ditolak — ` +
        `kembali ke daftar di kode. ${ditolak.join("; ")}`,
    );
    const hasil = bersihkanSatpamLuar();
    return { ...hasil, ditolak };
  }

  // Urutan aturan adalah logika: pesan yang cocok dua kategori
  // dilaporkan sebagai kategori yang dinilai lebih dulu, dan itulah
  // yang dibaca tim CS. Ditegakkan di sini, bukan disandarkan pada
  // urutan baris yang kebetulan datang dari jaringan.
  aturan.sort((a, b) => a.priority - b.priority);

  satpamLuar = aturan;
  sumberSatpam = "supabase";

  if (ditolak.length) {
    console.warn(
      `[KB-ROUTER] Gerbang 0: ${ditolak.length} aturan dibuang: ${ditolak.join("; ")}`,
    );
  }
  return { aturan: aturan.length, ditolak };
}

/** Kembali memakai daftar SATPAM di kode. */
export function bersihkanSatpamLuar() {
  satpamLuar = null;
  sumberSatpam = "kode";
  return { aturan: 0, ditolak: [] };
}

/**
 * Sumber yang sedang dipakai Gerbang 0: "kode" atau "supabase".
 *
 * Dilaporkan ke /api/health. Alasannya sama dengan
 * getSumberAktif(): perpindahan sumber yang tidak terlihat adalah
 * kegagalan paling mahal di sini — admin menambah kata di halaman
 * Kata Sensitif, router diam-diam masih memakai daftar di kode, dan
 * tidak ada satu pun pesan galat yang menjelaskannya.
 */
export function getSumberSatpam() {
  return sumberSatpam;
}

/** Aturan Gerbang 0 yang berlaku sekarang — tabel bila ada, kode bila tidak. */
function satpamAktif() {
  return satpamLuar ?? SATPAM;
}

/** Berapa aturan Gerbang 0 yang sedang berlaku — untuk pengujian & health. */
export function jumlahSatpam() {
  return satpamAktif().length;
}

/**
 * Gerbang 0. Apakah pesan ini wajib langsung ke CS manusia?
 *
 * @param {string} pesanPelanggan
 * @returns {{kategori: string, why: string, cocok: string} | null}
 *   null berarti aman dilanjutkan ke gerbang berikutnya.
 */
export function periksaSatpam(pesanPelanggan) {
  const pesan = String(pesanPelanggan ?? "");
  if (!pesan.trim()) return null;

  for (const s of satpamAktif()) {
    if (s.unless && s.unless.some((p) => p.test(pesan))) continue;
    if (s.also && !s.also.test(pesan)) continue;
    const kena = s.when.find((p) => p.test(pesan));
    if (!kena) continue;
    return {
      kategori: s.kategori,
      why: s.why,
      // Potongan teks yang memicu — dipakai halaman Chat supaya CS
      // tahu KENAPA kasus ini mendarat di mejanya.
      cocok: (pesan.match(kena) ?? [""])[0],
    };
  }
  return null;
}

/**
 * Daftar kategori satpam — untuk UI dan pengujian.
 *
 * Dibaca dari sumber yang sedang berlaku, bukan selalu dari kode.
 * Sejak aturan bisa datang dari tabel, satu kategori diwakili
 * beberapa baris aturan, jadi di sini dikerucutkan kembali menjadi
 * satu entri per kategori — `why` yang dipakai adalah milik aturan
 * yang dinilai paling dulu, sama seperti yang akan dilaporkan
 * periksaSatpam() bila kategori itu yang mencegat.
 */
export function getKategoriSatpam() {
  const terlihat = new Map();
  for (const s of satpamAktif()) {
    if (!terlihat.has(s.kategori)) {
      terlihat.set(s.kategori, { kategori: s.kategori, why: s.why });
    }
  }
  return [...terlihat.values()];
}

/**
 * Balasan penerimaan saat satpam menahan sebuah pesan.
 *
 * Menahan BUKAN berarti diam. claude-core.md mewajibkan dua hal yang
 * tetap berlaku: balas kurang dari 15 menit, dan gelembung chat
 * terakhir harus dari kita — keduanya dinilai marketplace. Jadi
 * pelanggan tetap menerima satu kalimat penerimaan seketika,
 * sementara kasusnya menunggu CS manusia.
 *
 * Teksnya sengaja ditaruh di berkas KB, bukan di kode, supaya tim CS
 * bisa memperbaikinya sendiri lewat halaman Kelola Template.
 * Kalimatnya juga sengaja netral — tidak diawali permintaan maaf —
 * karena satpam juga menangkap hal yang bukan keluhan, misalnya
 * permintaan nomor WhatsApp.
 */
const KODE_HANDOVER = "DITERUSKAN CS";

/* Balasan terakhir bila [DITERUSKAN CS] tidak ada di sumber mana pun.

   Ditulis di kode — satu-satunya teks balasan di berkas ini yang
   tidak datang dari berkas KB, dan pengecualian itu disengaja.

   Semua teks lain boleh hilang tanpa membahayakan: Gerbang 1 yang
   kodenya tidak ketemu cukup menyerah dan menyerahkan pesan ke AI.
   Yang satu ini tidak punya jalan menyerah. Ia dipakai justru pada
   pesan yang paling tidak boleh didiamkan — refund, barang rusak,
   dugaan keracunan, pelanggan yang marah — dan pada saat itu
   Gerbang 0 sudah memutuskan Claude TIDAK akan dipanggil. Kalau
   teksnya kosong, yang sampai ke pelanggan adalah layar kosong. */
const CADANGAN_HANDOVER =
  "Halo kak, terima kasih infonya \u{1F64F} Untuk hal ini kakak akan " +
  "dibantu langsung oleh tim CS kami ya, mohon ditunggu sebentar.";

/** Supaya peringatan yang sama tidak membanjiri log tiap pesan. */
let sudahMengeluhHandover = false;

/**
 * Teks penerimaan Gerbang 0, dengan dua jaring pengaman.
 *
 * KENAPA INI ADA — kejadian 8 September 2026, terukur bukan dugaan.
 *
 * [DITERUSKAN CS] ditambahkan ke faq-interaksi.md setelah
 * seed-templates.sql dibangkitkan, jadi kodenya ada di berkas tetapi
 * TIDAK ada di tabel. Begitu router berpindah membaca tabel,
 * `.get()` mengembalikan undefined dan `?? ""` mengubahnya jadi
 * balasan kosong:
 *
 *   SUMBER BERKAS   : panjang=121
 *   SUMBER SUPABASE : panjang=0
 *
 * Gerbang 0 tetap menahan pesannya dengan benar. Yang hilang justru
 * kalimat yang memberi tahu pelanggan bahwa kasusnya sedang
 * ditangani — dan hilangnya tanpa satu pun pesan galat.
 *
 * Urutannya: sumber aktif -> berkas .md -> teks di kode. Turun satu
 * tingkat selalu disertai peringatan, karena jatuh ke cadangan
 * berarti ada yang harus dibetulkan; yang tidak boleh adalah
 * pelanggan ikut menanggung akibatnya sementara itu.
 */
/* Diekspor sejak 10 Sep 2026: Gerbang -0.5 (lampiran) di
   /api/chat perlu balasan handover yang SAMA dengan Gerbang 0.
   Menyalin kalimatnya ke sana berarti dua kalimat yang harus
   dijaga tetap sepadan, dan yang satu pasti tertinggal. */
export function teksHandover() {
  const dariSumber = pustakaAktif().get(KODE_HANDOVER);
  if (dariSumber && dariSumber.trim()) return dariSumber;

  const dariBerkas = muatPustaka().get(KODE_HANDOVER);
  if (dariBerkas && dariBerkas.trim()) {
    if (!sudahMengeluhHandover) {
      console.warn(
        `[KB-ROUTER] [${KODE_HANDOVER}] tidak ada di sumber "${sumberAktif}" — ` +
          `memakai berkas .md. Jalankan "npm run template-sql" lalu seed ulang.`,
      );
      sudahMengeluhHandover = true;
    }
    return dariBerkas;
  }

  if (!sudahMengeluhHandover) {
    console.error(
      `[KB-ROUTER] [${KODE_HANDOVER}] tidak ada di sumber mana pun — ` +
        `memakai teks cadangan di kode. Katalog KB perlu diperiksa.`,
    );
    sudahMengeluhHandover = true;
  }
  return CADANGAN_HANDOVER;
}

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

  const lib = pustakaAktif();

  for (const rule of aturanAktif()) {
    if (rule.unless?.some((re) => re.test(msg))) continue;
    if (!rule.when.some((re) => re.test(msg))) continue;
    if (rule.also && !rule.also.test(msg)) continue;

    const reply = lib.get(rule.code);
    if (!reply) {
      // Kode tidak ada di sumber yang sedang dipakai (mis. judulnya
      // diubah, atau templatenya dinonaktifkan sementara aturannya
      // tertinggal) — jangan mengarang, serahkan saja ke AI.
      console.warn(
        `[KB-ROUTER] Kode [${rule.code}] tidak ada di sumber "${sumberAktif}"`,
      );
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
  // --- Gerbang 0: satpam, mengalahkan semua yang di belakangnya ---
  //
  // Ditaruh paling depan dan TIDAK bisa dilewati. Bandingkan dengan
  // jalur template, yang sengaja bisa dimatikan lewat
  // useTemplates:false untuk membandingkan biaya di panel demo:
  // gerbang ini bukan penghemat biaya, melainkan pengaman. Sesuatu
  // yang bisa dimatikan untuk kenyamanan bukan pengaman.
  const satpam = periksaSatpam(pesanPelanggan);
  if (satpam) {
    return {
      jenis: "handover",
      kode: KODE_HANDOVER,
      teks: teksHandover(),
      action: "HANDOVER_TO_CS",
      // Tidak ada berkas FAQ yang perlu dikirim: Claude tidak dipanggil.
      kategori: "unclear",
      berkas: [],
      alasan: satpam.why,
      satpam,
    };
  }

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
  if (keputusan.jenis === "handover") {
    console.log(
      `${prefix} SATPAM ${keputusan.satpam.kategori} — dicegat "${keputusan.satpam.cocok}", ` +
        `langsung ke CS manusia (Claude tidak dipanggil)`,
    );
    return { terkirim: 0, total: totalKarakterFaq(), hemat: totalKarakterFaq() };
  }

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
  return aturanAktif().length;
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
  return aturanAktif().map((r, i) => ({
    urutan: i + 1,
    code: r.code,
    action: r.action,
    when: r.when.map(sumber),
    also: r.also ? sumber(r.also) : null,
    unless: r.unless ? r.unless.map(sumber) : [],
    why: r.why,
  }));
}
