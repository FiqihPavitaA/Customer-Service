/* ===========================================================
   Gerbang 2 — Pengenal Maksud.

   Berjalan setelah Gerbang 1 (kata kunci persis) gagal, dan sebelum
   Gerbang 4 (Sonnet). Tugasnya menangkap kalimat yang MAKSUDNYA
   sama tapi KATANYA beda:

     "cara pakai neem oil"          -> Gerbang 1, gratis
     "nem oilnya dipakenya gmn kak" -> Gerbang 1 bengong, ke sini

   Pembagian kerjanya:
     Voyage   mengubah kalimat jadi angka. Hanya itu.
     Supabase membandingkan angka dan mengembalikan yang terdekat.
     Berkas ini memutuskan apa artinya skor itu.
   =========================================================== */

import { embed, voyageSiap, voyageTerkunci } from "@/lib/voyage";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Skor di atas ini dianggap cukup yakin untuk langsung dipakai.
 *
 * DINAIKKAN DARI 0,85 KE 0,93 PADA 8 SEPTEMBER 2026, berdasarkan
 * pengukuran — bukan firasat. Angka 0,85 berasal dari artefak alur
 * sebagai tebakan kerja; setelah 36 contoh disematkan dengan
 * voyage-4-lite, `npm run tes0` menemukan 15 pasangan template
 * BERBEDA yang skornya di atas 0,85. Contohnya:
 *
 *   0,882  "cara pakai petrogenol gimana?"  vs  "cara pakai neem oil gimana?"
 *   0,867  "cara pakai cocopeat gimana?"    vs  "cara pakai neem oil gimana?"
 *
 * Produknya berbeda sama sekali. Yang membuat skornya tinggi adalah
 * KERANGKA KALIMAT "cara pakai ... gimana?", yang ditimbang model
 * lebih berat daripada nama produknya. Pada ambang 0,85, pelanggan
 * yang bertanya soal cocopeat bisa menerima petunjuk pemakaian neem
 * oil — kesalahan dosis, bukan sekadar jawaban kurang tepat.
 *
 * 0,93 pun belum aman untuk semuanya. Dua tabrakan tetap lolos:
 * "cara pakai pH meter" vs "cara kalibrasi pH meter" (0,945) dan
 * [MIRACLE POWDER] vs [PRODUK MIRACLE] (0,932). Pasangan seperti itu
 * memang tidak bisa dipisahkan ambang mana pun — bedanya satu kata,
 * dan justru kata itu yang menentukan. Itulah pekerjaan Gerbang 3.
 *
 * Nilai sesungguhnya tetap harus diukur dengan chat asli berlabel
 * (Tes 2). Sampai itu ada, angka ini menyisakan lebih banyak ke
 * gerbang berikutnya — lebih mahal, tetapi salah jawab lebih mahal
 * lagi.
 */
export const AMBANG_YAKIN = Number(process.env.AMBANG_YAKIN || 0.93);

/**
 * Di bawah ini dianggap tidak ada template yang cocok sama sekali.
 *
 * Perlu diketahui saat menyetel: pada contoh bootstrap, 513 dari 630
 * pasangan sudah berada di atas 0,6. Lantainya memang tinggi karena
 * kalimat contohnya seragam. Jangan menyimpulkan apa pun dari angka
 * itu sebelum ada contoh yang ditulis tim CS.
 */
export const AMBANG_RAGU = Number(process.env.AMBANG_RAGU || 0.6);

/**
 * "bayangan" — Gerbang 2 menghitung dan mencatat, TETAPI tidak
 *              pernah membalas pelanggan. Permintaan diteruskan
 *              seperti gerbang ini tidak ada.
 * "aktif"    — skor di atas AMBANG_YAKIN langsung dikirim.
 *
 * Bawaannya "bayangan", dan itu disengaja. Tahap F pada rencana
 * memang meminta dua minggu berjalan paralel sebelum dipercaya, dan
 * pengukuran di atas menunjukkan alasannya nyata. Yang berbahaya
 * bukan gerbangnya salah — melainkan gerbangnya salah tanpa ada yang
 * tahu, karena tidak ada yang membandingkan.
 *
 * Mode bayangan membuat catatannya tetap terkumpul: berapa sering
 * zona yakin muncul, template apa yang terpilih, berapa skornya.
 * Itulah bahan untuk memutuskan kapan boleh diaktifkan.
 */
export const MODE_PENGENAL = (process.env.PENGENAL_MODE || "bayangan").toLowerCase();

/** Berapa kandidat teratas yang diambil untuk Gerbang 3. */
const JUMLAH_KANDIDAT = 3;

export type Kandidat = {
  code: string;
  body: string;
  /** Contoh pertanyaan yang membuat template ini terpilih. */
  contoh: string;
  skor: number;
};

export type HasilPengenal =
  | { jenis: "yakin"; kandidat: Kandidat[]; token: number }
  | { jenis: "ragu"; kandidat: Kandidat[]; token: number }
  | { jenis: "lewat"; alasan: string; token: number };

/**
 * Cari template terdekat untuk sebuah pesan pelanggan.
 *
 * TIDAK PERNAH melempar. Gerbang ini adalah penghemat biaya, bukan
 * pengaman — kalau Voyage mati, kunci belum diisi, atau Supabase
 * tidak menjawab, jalur yang benar adalah meneruskan ke Gerbang 4
 * seperti sebelum gerbang ini ada. Menjatuhkan permintaan pelanggan
 * karena penghemat biaya sedang bermasalah adalah tukar-tambah yang
 * salah arah.
 */
export async function kenaliMaksud(pesan: string): Promise<HasilPengenal> {
  const lewat = (alasan: string, token = 0): HasilPengenal => ({
    jenis: "lewat",
    alasan,
    token,
  });

  if (!voyageSiap()) return lewat("VOYAGE_API_KEY belum diisi");
  if (voyageTerkunci()) return lewat("AI_TEST_LOCK/VOYAGE_LOCK aktif");

  const sb = getSupabaseServer();
  if (!sb) return lewat("Supabase belum dikonfigurasi");

  let token = 0;
  try {
    // "query", bukan "document". Voyage menempatkan pertanyaan dan
    // dokumen di ruang yang saling cocok berdasarkan penanda ini;
    // memakai penanda yang keliru menurunkan ketepatan tanpa satu
    // pun pesan galat.
    const hasil = await embed([pesan], "query");
    token = hasil.token;
    if (!hasil.vektor.length) return lewat("Voyage tidak mengembalikan vektor", token);

    const { data, error } = await sb.rpc("cari_template", {
      q: JSON.stringify(hasil.vektor[0]),
      batas: JUMLAH_KANDIDAT,
    });

    if (error) return lewat(`cari_template gagal: ${error.message}`, token);

    const kandidat = ((data ?? []) as Kandidat[]).filter(
      (k) => Number.isFinite(k.skor) && k.skor >= AMBANG_RAGU,
    );
    if (kandidat.length === 0) return lewat("tidak ada kandidat di atas ambang", token);

    return {
      jenis: kandidat[0].skor >= AMBANG_YAKIN ? "yakin" : "ragu",
      kandidat,
      token,
    };
  } catch (err) {
    return lewat(err instanceof Error ? err.message : String(err), token);
  }
}
