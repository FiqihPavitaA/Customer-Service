/* ===========================================================
   Mutu contoh pertanyaan untuk Gerbang 2.

   Dipakai DUA sisi dengan sengaja: halaman Kelola Template memberi
   umpan balik saat tim CS mengetik, dan /api/templates/contoh
   memeriksa ulang sebelum menyimpan. Aturan yang sama di kedua
   tempat — kalau dipisah, layar akan menyetujui apa yang server
   tolak, dan tidak ada yang bisa menjelaskan bedanya.

   ----------------------------------------------------------
   KENAPA MUTUNYA DIPERIKSA SAMA SEKALI
   ----------------------------------------------------------
   Voyage merata-ratakan SELURUH teks jadi SATU titik dalam ruang
   1.024 dimensi. Akibatnya:

     tumpukan kata kunci  -> titik kabur; agak dekat ke semua hal,
                             tidak benar-benar dekat ke apa pun
     kalimat pertanyaan   -> titik tajam, karena model dilatih
                             dengan pasangan tanya-jawab

   Jadi untuk gerbang ini kata kunci adalah racun dan kalimat utuh
   adalah obat. Kata kunci tetap berguna — tempatnya di Gerbang 1,
   kolom yang terpisah.

   ----------------------------------------------------------
   ANGKA YANG MEMBUAT INI BUKAN TEORI
   ----------------------------------------------------------
   Audit 8 September 2026: 35 dari 36 contoh yang ada ditulis rapi
   seperti bahasa dokumen. Akibatnya terukur pada `npm run
   tes-ambang` — kalimat gaya pelanggan sungguhan
   "nem oilnya dipakenya gmn kak" KALAH ke [PAKAI POC] (0,438
   berbanding 0,410), karena satu-satunya contoh milik [PAKAI NEEM]
   berbunyi "cara pakai neem oil gimana?".

   Contoh yang ditulis rapi bukan sekadar kurang membantu. Ia
   membuat gerbang ini gagal tepat pada kalimat yang paling sering
   datang.
   =========================================================== */

/** Berapa contoh yang dianggap cukup untuk sebuah template. */
export const CONTOH_MINIMUM = 3;

/** Di atas ini hasilnya menurun dan risiko tabrakan naik. */
export const CONTOH_MAKSIMUM = 8;

/** Batas panjang satu contoh; sepadan dengan BATAS_PANJANG router. */
export const PANJANG_MAKSIMUM = 180;

/**
 * Singkatan yang membuang huruf vokal. Ciri KUAT.
 *
 * Ini pembeda yang sesungguhnya, dan menemukannya butuh satu kali
 * salah. Versi pertama daftar ini memuat "gimana" dan "kak" — dan
 * `npm run uji-mutu` langsung menunjukkan akibatnya: enam contoh
 * bootstrap yang justru jadi TEMUAN audit lolos sebagai "gaya chat",
 * termasuk "cara pakai neem oil gimana?".
 *
 * Sebabnya jelas begitu terlihat: "gimana", "berapa", dan "kak"
 * dipakai juga di kalimat yang ditulis rapi. Yang tidak pernah muncul
 * di tulisan rapi adalah vokal yang dibuang — "gmn", "brp", "blm".
 */
const SINGKATAN_KUAT = [
  "gmn", "gmna", "brp", "brpa", "blm", "kpn", "udh", "tdk", "yg", "sy",
  "trs", "kk", "knp", "dgn", "utk", "kl", "klo", "bgt", "jd", "dlm",
  "hrg", "tp", "sdh", "blh", "bs", "dr", "dpt", "sm", "tq",
  "gak", "ga", "ngga", "nggak", "engga", "sampe", "makasih", "mksh",
  // Bervokal tetapi tetap terpenggal, jadi tidak tertangkap aturan
  // "tanpa vokal" di tokenDisingkat().
  "ap", "pke", "bgmn", "gt", "gtu",
];

/**
 * Sapaan dan partikel percakapan. Ciri LEMAH — muncul juga di
 * kalimat rapi ("dosis NPK berapa kak?"), jadi tidak cukup sendirian.
 */
const PARTIKEL = [
  "kak", "ka", "sis", "min", "bang", "gan", "mimin",
  "aja", "dong", "nih", "sih", "deh", "kok", "tuh", "yaa", "yah",
];

const KATA_TANYA = [
  "apa", "apakah", "apaan", "gimana", "gmn", "bagaimana", "berapa",
  "brp", "kapan", "kpn", "bisa", "bs", "boleh", "kenapa", "knp",
  "mana", "dimana", "adakah", "ada", "cara", "caranya",
];

export type BeratCatatan = "galat" | "peringatan" | "saran";

export type CatatanMutu = {
  berat: BeratCatatan;
  pesan: string;
};

const kata = (t: string) => t.trim().split(/\s+/).filter(Boolean);

/**
 * Apakah contoh ini memuat singkatan yang membuang huruf?
 *
 * Beda dari bergayaChat(): yang itu menjawab "apakah ini terdengar
 * seperti pelanggan", yang ini menjawab "seberapa terpenggal
 * tulisannya". Sebuah contoh bisa bergaya chat tanpa singkatan
 * ("poc itu buat apa ya kak") — dan justru itulah gunanya dibedakan,
 * karena kumpulan contoh sebaiknya memuat kedua-duanya.
 */
export function bersingkatanBerat(teks: string): boolean {
  return teks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .some(tokenDisingkat);
}

/**
 * Nama produk yang kebetulan tidak bervokal.
 *
 * Tanpa pengecualian ini, "npk nya brp" akan dinilai bersingkatan
 * berat gara-gara "npk" — padahal itu nama produk, bukan singkatan
 * yang diketik pelanggan karena buru-buru.
 */
const AKRONIM_PRODUK = ["npk", "tds", "ph", "pbm", "agk", "abmix", "nph"];

/**
 * Satu kata dianggap singkatan berat bila memenuhi salah satu:
 *
 *   a. ada di SINGKATAN_KUAT, atau
 *   b. dua huruf atau lebih dan TIDAK punya satu pun vokal
 *
 * Aturan (b) ditambahkan 9 September 2026 setelah `npm run uji-mutu`
 * menunjukkan daftar tangan selalu bocor: "poc tuh bwt ap" lolos
 * tanpa terdeteksi karena "bwt" belum terdaftar.
 *
 * Itu pola yang sama dengan celah `also` pada MINTA_DESKRIPSI —
 * daftar putih hanya menangkap yang tertulis di dalamnya, dan yang
 * belum terpikir lolos diam-diam. Membuang vokal adalah CARA orang
 * menyingkat, bukan daftar kata tertentu, jadi aturannya yang harus
 * menangkap, bukan daftarnya.
 */
function tokenDisingkat(k: string): boolean {
  if (SINGKATAN_KUAT.includes(k)) return true;
  if (AKRONIM_PRODUK.includes(k)) return false;
  return k.length >= 2 && /^[a-z]+$/.test(k) && !/[aeiou]/.test(k);
}

/**
 * Apakah contoh ini terdengar seperti pelanggan sungguhan?
 *
 * Dua jalan, dan yang kedua sengaja menuntut dua syarat sekaligus:
 *
 *   1. Ada singkatan yang membuang vokal -> pasti gaya chat.
 *   2. Tidak ditutup tanda baca DAN (huruf kecil semua ATAU ada
 *      partikel percakapan).
 *
 * Tanda baca penutup adalah penanda "tulisan rapi" yang paling bisa
 * diandalkan pada data ini: keenam contoh bootstrap yang jadi temuan
 * audit semuanya berakhir dengan "?", sedangkan tidak satu pun dari
 * 19 kalimat gaya pelanggan pada tes-ambang memakainya.
 */
export function bergayaChat(teks: string): boolean {
  const t = teks.trim();
  if (!t) return false;

  const kataKata = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (kataKata.some((k) => SINGKATAN_KUAT.includes(k))) return true;

  const ditutupTandaBaca = /[.?!]$/.test(t);
  if (ditutupTandaBaca) return false;

  /* Nama produk berhuruf kapital TIDAK dihitung sebagai tanda
     tulisan rapi.

     Ditemukan dari pemakaian sungguhan: "POC cara pke nya gimana"
     ditandai "terlalu rapi" hanya karena "POC" kapital, padahal
     kalimatnya jelas gaya pelanggan. Menulis nama produk dengan
     kapital — POC, NPK, TDS, EM4, AB Mix — justru wajar di chat.

     Yang dicari sebenarnya adalah kapital di awal KALIMAT, ciri
     orang yang menulis rapi. Token yang seluruhnya kapital (atau
     kapital bercampur angka) dibuang dulu supaya tidak tertukar. */
  const tanpaNamaProduk = t
    .split(/\s+/)
    .filter((k) => {
      const bersih = k.replace(/[^\p{L}\p{N}]/gu, "");
      if (!bersih) return false;
      // Token yang tidak punya huruf kecil sama sekali = nama produk.
      return bersih !== bersih.toUpperCase();
    })
    .join(" ");

  const hurufKecilSemua =
    tanpaNamaProduk.length > 0 && tanpaNamaProduk === tanpaNamaProduk.toLowerCase();
  const adaPartikel = kataKata.some((k) => PARTIKEL.includes(k));
  return hurufKecilSemua || adaPartikel;
}

/**
 * Periksa SATU contoh pertanyaan.
 *
 * Hanya kesalahan yang benar-benar membuat contohnya tidak berguna
 * yang diberi berat "galat". Sisanya peringatan atau saran — tim CS
 * yang paling tahu bahasa pelanggannya, dan alat ini tidak boleh
 * merasa lebih tahu daripada mereka.
 *
 * @returns daftar catatan; kosong berarti tidak ada yang perlu
 *          disampaikan.
 */
export function periksaContoh(teks: string): CatatanMutu[] {
  const t = teks.trim();
  const catatan: CatatanMutu[] = [];

  if (!t) {
    return [{ berat: "galat", pesan: "Contoh masih kosong." }];
  }

  if (t.length > PANJANG_MAKSIMUM) {
    catatan.push({
      berat: "galat",
      pesan:
        `Terlalu panjang (${t.length} karakter, batas ${PANJANG_MAKSIMUM}). ` +
        `Pesan sepanjang ini juga tidak akan diproses router.`,
    });
  }

  const n = kata(t).length;
  if (n < 3) {
    catatan.push({
      berat: "galat",
      pesan:
        `Hanya ${n} kata. Terlalu pendek untuk jadi titik yang tajam — ` +
        `tulis sebagai kalimat utuh seperti yang pelanggan ketik.`,
    });
  }

  const koma = (t.match(/,/g) ?? []).length;
  if (koma >= 3) {
    catatan.push({
      berat: "galat",
      pesan:
        `Ada ${koma} koma. Ini terbaca sebagai daftar kata kunci, bukan ` +
        `pertanyaan. Daftar kata membuat titiknya kabur dan justru ` +
        `menyedot chat milik template lain. Kata kunci tempatnya di ` +
        `kolom "Kata kunci pemicu" di atas.`,
    });
  }

  const rendah = ` ${t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
  const adaTanya = KATA_TANYA.some((k) => rendah.includes(` ${k} `));
  if (!adaTanya && n >= 3) {
    catatan.push({
      berat: "saran",
      pesan:
        "Tidak mengandung kata tanya. Boleh saja bila memang begitu " +
        'pelanggan menulis (mis. "minta info dong"), tetapi periksa ' +
        "sekali lagi apakah ini pertanyaan.",
    });
  }

  if (!bergayaChat(t)) {
    catatan.push({
      berat: "peringatan",
      pesan:
        "Terbaca terlalu rapi. Pelanggan menulis \"nem oilnya dipakenya " +
        'gmn kak", bukan "Bagaimana cara penggunaan produk ini?". ' +
        "Contoh yang rapi membuat gerbang ini gagal justru pada kalimat " +
        "yang paling sering datang.",
    });
  }

  return catatan;
}

/** Ada catatan yang membuat contoh ini tidak boleh disimpan? */
export function adaGalat(catatan: CatatanMutu[]): boolean {
  return catatan.some((c) => c.berat === "galat");
}

export type MutuTemplate = {
  jumlah: number;
  /** Sudah memenuhi CONTOH_MINIMUM? */
  cukup: boolean;
  /** Ada minimal satu contoh bergaya chat pelanggan? */
  adaGayaChat: boolean;
  /** Selisih panjang terpanjang & terpendek, dalam kata. */
  rentangPanjang: number;
  catatan: CatatanMutu[];
};

/**
 * Nilai SEKUMPULAN contoh milik satu template.
 *
 * Yang diperiksa di sini adalah hal-hal yang tidak terlihat saat
 * menilai satu contoh sendirian: jumlah, ragam, dan apakah ada yang
 * benar-benar bergaya pelanggan.
 */
export function periksaKumpulan(daftar: string[]): MutuTemplate {
  const bersih = daftar.map((t) => t.trim()).filter(Boolean);
  const catatan: CatatanMutu[] = [];
  const jumlah = bersih.length;

  if (jumlah === 0) {
    catatan.push({
      berat: "galat",
      pesan:
        "Belum ada contoh sama sekali. Tanpa contoh, template ini tidak " +
        "pernah bisa terpilih Gerbang 2 — hanya lewat kata kunci persis.",
    });
  } else if (jumlah < CONTOH_MINIMUM) {
    catatan.push({
      berat: "peringatan",
      pesan:
        `Baru ${jumlah} dari ${CONTOH_MINIMUM} contoh. Di bawah ${CONTOH_MINIMUM}, ` +
        `template ini belum layak dipakai untuk balasan otomatis.`,
    });
  } else if (jumlah > CONTOH_MAKSIMUM) {
    catatan.push({
      berat: "saran",
      pesan:
        `${jumlah} contoh — lebih dari ${CONTOH_MAKSIMUM} biasanya tidak lagi ` +
        `menambah ketepatan, tetapi menaikkan peluang menyerobot chat ` +
        `milik template lain.`,
    });
  }

  const adaGayaChat = bersih.some(bergayaChat);
  if (jumlah > 0 && !adaGayaChat) {
    catatan.push({
      berat: "peringatan",
      pesan:
        "Tidak satu pun contoh bergaya chat pelanggan. Tambahkan minimal " +
        "satu yang memakai singkatan dan sapaan seperti yang benar-benar " +
        "diketik pelanggan.",
    });
  }

  let rentangPanjang = 0;
  if (jumlah >= 2) {
    const panjang = bersih.map((t) => kata(t).length);
    rentangPanjang = Math.max(...panjang) - Math.min(...panjang);
    if (rentangPanjang < 3) {
      catatan.push({
        berat: "saran",
        pesan:
          "Semua contoh nyaris sama panjang. Pelanggan menulis dengan " +
          'panjang yang sangat berbeda — dari "poc gmn" sampai satu ' +
          "kalimat penuh. Ragam itu yang membuat gerbang ini tahan " +
          "terhadap bentuk kalimat yang tak terduga.",
      });
    }

    const pembuka = new Set(
      bersih.map((t) => kata(t).slice(0, 2).join(" ").toLowerCase()),
    );
    if (pembuka.size === 1) {
      catatan.push({
        berat: "saran",
        pesan:
          "Semua contoh dibuka dengan kata yang sama. Variasikan " +
          'pembukanya — "cara pakai...", "...gmn kak", "takarannya brp".',
      });
    }

    /* Ragam TINGKAT SINGKATAN — bukan sekadar ragam panjang.
     *
     * Voyage mencocokkan bentuk kalimat, bukan huruf. Tiga contoh
     * yang semuanya rapi menutup satu wilayah sempit; tiga yang
     * semuanya disingkat berat menutup wilayah sempit yang lain.
     * Yang menutup luas adalah tiga titik yang BERJAUHAN.
     *
     * Terbukti dari pemakaian sungguhan 9 September 2026:
     * "pke poc biar ap?" tertangkap 0,811 lewat contoh "pakai poc
     * biar apa" — sedangkan contoh bawaan yang rapi ("cara pakai POC
     * gimana ya kak?") jauh tertinggal untuk kalimat yang sama.
     */
    const berat = bersih.filter(bersingkatanBerat).length;
    if (jumlah >= CONTOH_MINIMUM && (berat === 0 || berat === jumlah)) {
      catatan.push({
        berat: "saran",
        pesan:
          berat === 0
            ? "Belum ada contoh dengan singkatan berat. Tambahkan satu yang " +
              'ditulis sesingkat mungkin — mis. "poc tuh bwt ap". Pelanggan ' +
              "yang mengetik sambil buru-buru menulis seperti itu, dan contoh " +
              "yang semuanya lengkap tidak menjangkaunya."
            : "Semua contoh disingkat berat. Tambahkan satu yang agak lengkap — " +
              "pelanggan juga ada yang mengetik utuh, dan tiga contoh yang " +
              "mirip satu sama lain hampir sama saja dengan satu contoh.",
      });
    }
  }

  return {
    jumlah,
    cukup: jumlah >= CONTOH_MINIMUM,
    adaGayaChat,
    rentangPanjang,
    catatan,
  };
}
