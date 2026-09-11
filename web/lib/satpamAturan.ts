/* ===========================================================
   Aturan main halaman Kata Sensitif — logika murni, tanpa database.

   Dipisahkan dari route handler dengan sengaja. Isi berkas ini
   memutuskan kata apa yang boleh menjadi pengaman Gerbang 0, dan
   keputusan seperti itu harus bisa diuji tanpa Supabase, tanpa
   jaringan, dan tanpa satu rupiah pun — lihat
   web/scripts/uji-satpam-aturan.mjs.

   Tidak ada satu pun fungsi di sini yang menyentuh jaringan.
   =========================================================== */

import { buatPolaDariFrasa, periksaSatpam } from "@/lib/templates";

/** Sebuah aturan Gerbang 0 seperti yang dibaca halaman admin. */
export type AturanSatpam = {
  id: string;
  kategori: string;
  priority: number;
  /** null = pola ditulis tangan; tidak bisa disunting lewat halaman. */
  frasa: string[] | null;
  when_patterns: string[];
  also_pattern: string | null;
  unless_patterns: string[] | null;
  why: string;
  is_bawaan: boolean;
  is_active: boolean;
};

/* ===========================================================
   1. Membersihkan frasa yang diketik admin
   ===========================================================
   Yang dibersihkan bukan soal kerapian. Tiap aturan di bawah
   mencegah satu cara nyata sebuah kata menjadi pengaman yang
   tidak berperilaku seperti dugaan penulisnya. */

export type HasilBersih = {
  frasa: string[];
  /** Yang dibuang, beserta sebabnya — ditampilkan ke admin. */
  dibuang: { teks: string; sebab: string }[];
};

/**
 * Panjang minimum sebuah frasa.
 *
 * Satu huruf bukan kata; ia potongan yang akan muncul di dalam
 * ribuan kata lain. "a" sebagai pengaman berarti hampir setiap
 * pesan dialihkan ke CS manusia — bentuk kegagalan yang paling
 * mungkin terjadi di halaman ini, dan paling lambat disadari.
 */
const MIN_HURUF = 2;

/** Batas atas jumlah frasa dalam satu aturan. */
const MAKS_FRASA = 40;

export function bersihkanFrasa(masukan: unknown): HasilBersih {
  const dibuang: { teks: string; sebab: string }[] = [];
  const daftar = Array.isArray(masukan) ? masukan : [];
  const terlihat = new Set<string>();
  const frasa: string[] = [];

  for (const mentah of daftar) {
    const teks = String(mentah ?? "")
      .toLowerCase()
      // Spasi ganda dan tab dirapikan di sini, bukan dibiarkan
      // masuk ke pola. buatPolaDariFrasa() menyusun \s+ untuk
      // setiap spasi, jadi "ganti  rugi" dan "ganti rugi"
      // menghasilkan pola yang sama — menyimpan keduanya berarti
      // dua baris yang terlihat berbeda tapi berperilaku sama.
      .replace(/\s+/g, " ")
      .trim();

    if (!teks) continue;
    if (teks.length < MIN_HURUF) {
      dibuang.push({ teks, sebab: `terlalu pendek (minimal ${MIN_HURUF} huruf)` });
      continue;
    }
    if (terlihat.has(teks)) {
      dibuang.push({ teks, sebab: "sudah ada di daftar ini" });
      continue;
    }
    if (frasa.length >= MAKS_FRASA) {
      dibuang.push({ teks, sebab: `melebihi batas ${MAKS_FRASA} frasa per aturan` });
      continue;
    }

    // Frasa harus bisa menangkap DIRINYA SENDIRI.
    //
    // Terdengar seperti pemeriksaan yang mustahil gagal, dan itulah
    // kenapa ia ada. buatPolaDariFrasa() membungkus frasa dengan
    // \b...\b, dan \b menuntut huruf di sisinya. Frasa yang diawali
    // atau diakhiri tanda baca — "c++", "(promo)", "harga (promo)"
    // — menghasilkan pola yang SAH tetapi tidak akan pernah cocok
    // dengan kalimat mana pun. Tanpa baris ini, admin menyimpan
    // sebuah kata, halaman melaporkan berhasil, dan pengamannya
    // tidak pernah menyala. Tidak ada galat di titik mana pun.
    //
    // Ditulis sebagai uji diri, bukan sebagai daftar karakter
    // terlarang: aturannya lahir dari perilaku \b yang sebenarnya,
    // jadi ia ikut benar bila suatu hari pembuatan polanya berubah.
    const polaTunggal = buatPolaDariFrasa([teks]);
    if (!polaTunggal || !new RegExp(polaTunggal, "i").test(teks)) {
      dibuang.push({
        teks,
        sebab:
          "diawali atau diakhiri tanda baca — pola batas kata tidak akan " +
          "pernah cocok dengan kalimat mana pun",
      });
      continue;
    }

    terlihat.add(teks);
    frasa.push(teks);
  }

  return { frasa, dibuang };
}

/**
 * Susun pola dari frasa, sekaligus buktikan polanya bisa dipakai.
 *
 * buatPolaDariFrasa() sudah meng-escape seluruh karakter khusus,
 * jadi secara teori hasilnya selalu sah. `new RegExp` tetap
 * dijalankan di sini karena "secara teori" bukan jaminan yang
 * pantas untuk sesuatu yang akan berjalan pada setiap pesan
 * pelanggan — dan gagal di sini jauh lebih murah daripada gagal
 * saat router memuat tabelnya.
 */
export function polaDariFrasa(frasa: string[]): string | null {
  const pola = buatPolaDariFrasa(frasa);
  if (!pola) return null;
  try {
    new RegExp(pola, "i");
  } catch {
    return null;
  }
  return pola;
}

/* ===========================================================
   2. Tumpang tindih dengan aturan yang sudah ada
   ===========================================================
   Menambahkan kata yang sudah ditangkap kategori lain bukan galat
   — pesannya tetap dialihkan ke manusia. Yang rusak adalah
   KATEGORINYA: yang dilaporkan ke tim CS tetap kategori lama
   (priority-nya lebih kecil), jadi admin mengira sudah menambah
   sesuatu padahal tidak ada yang berubah. Itulah bentuk kegagalan
   yang paling membingungkan di halaman ini, karena tidak ada yang
   terlihat salah. */

export type Tumpang = {
  frasa: string;
  /** Kategori yang sudah menangkapnya lebih dulu. */
  kategori: string;
};

/**
 * Frasa mana yang sudah tertangkap aturan yang berlaku sekarang?
 *
 * Memakai periksaSatpam() yang sungguhan, bukan mencocokkan teks
 * antar-daftar frasa. Alasannya: "penjual" tidak ada di daftar
 * frasa mana pun, tetapi pola minta_manusia yang ditulis tangan
 * bisa saja menangkapnya lewat cabang lain. Membandingkan daftar
 * kata akan melewatkan justru kasus yang paling sulit dilihat
 * manusia.
 */
export function cariTumpangTindih(frasa: string[]): Tumpang[] {
  const hasil: Tumpang[] = [];
  for (const f of frasa) {
    const kena = periksaSatpam(f);
    if (kena) hasil.push({ frasa: f, kategori: kena.kategori });
  }
  return hasil;
}

/* ===========================================================
   3. Seberapa lebar kata baru ini menjaring?
   ===========================================================
   Pengaman inilah yang paling berguna di seluruh halaman, dan
   alasannya berlawanan dengan dugaan pertama orang.

   Bahaya terbesar fitur ini BUKAN kata yang kurang. Kata yang
   kurang berarti satu pesan lolos ke Claude — berbiaya, tetapi
   terlihat dan bisa diperbaiki. Bahayanya adalah satu kata
   terlalu umum: "kirim", "produk", "beli". Kata seperti itu
   mencegat ratusan pertanyaan yang selama ini dijawab gratis,
   seluruhnya mendarat di meja CS manusia, dan tidak ada satu pun
   galat yang muncul. Yang terlihat hanyalah antrean yang tiba-
   tiba penuh — beberapa hari kemudian.

   Angka ini dihitung terhadap contoh pertanyaan yang SUDAH ada di
   template_examples, yaitu kalimat pelanggan sungguhan yang
   memang seharusnya dijawab otomatis. */

export type Cakupan = {
  /** Berapa contoh pertanyaan yang akan ikut tercegat. */
  kena: number;
  /** Dari berapa contoh seluruhnya. */
  total: number;
  /** Sampai 5 contoh, supaya admin melihat kalimatnya sendiri. */
  contoh: string[];
  /** true bila cukup lebar untuk pantas ditahan dulu. */
  perluDitinjau: boolean;
};

/**
 * Ambang "terlalu lebar".
 *
 * 2% dipilih, bukan angka bulat seperti 10%, karena contoh
 * pertanyaan dikumpulkan per template dan jumlahnya ratusan:
 * mencegat 2% sudah berarti puluhan pertanyaan gratis berpindah ke
 * manusia setiap hari. Ambangnya sengaja rendah — ini peringatan
 * yang bisa diabaikan admin, bukan larangan, jadi salah di sisi
 * terlalu sering bertanya lebih murah daripada terlambat.
 */
const AMBANG_LEBAR = 0.02;

export function ukurCakupan(pola: string, contohPertanyaan: string[]): Cakupan {
  const total = contohPertanyaan.length;
  if (!total) {
    return { kena: 0, total: 0, contoh: [], perluDitinjau: false };
  }

  let re: RegExp;
  try {
    re = new RegExp(pola, "i");
  } catch {
    return { kena: 0, total, contoh: [], perluDitinjau: false };
  }

  const kena = contohPertanyaan.filter((t) => re.test(t));
  return {
    kena: kena.length,
    total,
    contoh: kena.slice(0, 5),
    // Satu contoh saja tidak cukup untuk menahan admin — kata yang
    // memang tepat pun bisa kebetulan muncul di satu kalimat. Yang
    // ditandai adalah pola yang menjaring LUAS.
    perluDitinjau: kena.length > 1 && kena.length / total >= AMBANG_LEBAR,
  };
}

/* ===========================================================
   4. Nomor urut untuk aturan baru
   =========================================================== */

/**
 * Taruh aturan baru PALING BELAKANG di seluruh tabel.
 *
 * Urutan adalah logika: menyisipkan aturan baru di depan berarti ia
 * bisa merebut pesan yang selama ini dilaporkan sebagai kategori
 * lain — perubahan diam-diam pada aturan yang tidak sedang disunting
 * siapa pun. Menaruhnya paling belakang menjamin itu tidak terjadi.
 *
 * KENAPA SELURUH TABEL, BUKAN DI DALAM KATEGORINYA
 *
 * Versi pertama menghitung max+10 di dalam kategori, dan itu SALAH.
 * `priority` unik untuk seluruh tabel, sedangkan kategorinya
 * tersusun sebagai blok berurutan (refund 10-30, barang 40-80,
 * sengketa 90-110, …). Nomor sesudah blok mana pun karena itu
 * sudah dipakai blok berikutnya: 6 dari 7 kategori langsung
 * bentrok, dan hanya kategori terakhir yang kebetulan berhasil.
 *
 * Ketahuan 11 Sep 2026 saat kata pertama dari tim CS ditolak
 * database dengan "duplicate key". Uji yang ada waktu itu lolos
 * karena datanya dikarang berjarak longgar — bukan blok berurutan
 * seperti tabel sungguhan.
 *
 * Harga yang dibayar: aturan baru untuk sebuah kategori dinilai
 * SETELAH seluruh aturan kategori lain. Kalau kata barunya
 * bertabrakan dengan kategori lain, yang dilaporkan tetap kategori
 * lama. Itu memang sudah diperingatkan cariTumpangTindih() di form,
 * dan arah salahnya benar: aturan baru tidak pernah diam-diam
 * merebut pesan dari aturan yang sudah ada.
 *
 * Berjarak 10 supaya masih ada ruang menyisipkan di antaranya
 * tanpa menomori ulang seluruh tabel.
 */
export function prioritasBaru(aturan: AturanSatpam[]): number {
  if (!aturan.length) return 10;
  return Math.max(...aturan.map((a) => a.priority)) + 10;
}

/* ===========================================================
   5. Apakah aturan ini boleh disunting dari halaman?
   =========================================================== */

export type Kesuntingan = {
  boleh: boolean;
  /** Kalimat untuk ditampilkan bila tidak boleh. */
  sebab: string | null;
};

/**
 * Tiga keadaan, bukan dua — sama seperti kata kunci pemicu
 * template. Aturan berpola tangan DITAMPILKAN tetapi tidak bisa
 * disunting; menyembunyikannya akan membuat halaman berbohong
 * tentang apa yang sebenarnya menjaga Gerbang 0, dan menandainya
 * "belum punya kata" akan sama salahnya.
 */
export function bisaDisunting(aturan: AturanSatpam): Kesuntingan {
  if (aturan.frasa === null) {
    return {
      boleh: false,
      sebab:
        "Aturan ini ditulis sebagai pola, bukan daftar kata — misalnya karena " +
        "punya awalan atau akhiran opsional. Mengubahnya butuh perubahan kode.",
    };
  }
  return { boleh: true, sebab: null };
}
