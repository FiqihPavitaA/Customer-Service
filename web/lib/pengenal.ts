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
 * ANGKA INI BELUM TERUKUR. 0,85 adalah tebakan kerja dari artefak
 * alur, bukan hasil pengujian. Nilai yang benar hanya bisa didapat
 * dari tabel ambang pada Tes 2 dengan chat asli berlabel — terlalu
 * rendah berarti pelanggan menerima jawaban yang salah, terlalu
 * tinggi berarti biaya membengkak tanpa manfaat.
 *
 * Dibuat bisa diubah lewat env supaya penyetelannya tidak menuntut
 * penggantian kode.
 */
export const AMBANG_YAKIN = Number(process.env.AMBANG_YAKIN || 0.85);

/** Di bawah ini dianggap tidak ada template yang cocok sama sekali. */
export const AMBANG_RAGU = Number(process.env.AMBANG_RAGU || 0.6);

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
