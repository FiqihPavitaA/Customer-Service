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
 * Skor minimum juara. Syarat PERTAMA dari dua; yang kedua ada di
 * AMBANG_MARGIN di bawah, dan keduanya harus lolos.
 *
 * DITURUNKAN DARI 0,93 KE 0,50 PADA 8 SEPTEMBER 2026, dan angka 0,93
 * itu kekeliruan saya yang perlu ditulis terang-terangan supaya tidak
 * terulang.
 *
 * 0,93 diturunkan dari `npm run tes0`, yang membandingkan contoh
 * dengan contoh — dua-duanya disematkan sebagai "document". Yang
 * terjadi sungguhan bukan itu: pesan pelanggan disematkan sebagai
 * "query" lalu dibandingkan dengan contoh yang "document". Voyage
 * mengkalibrasi kedua pasangan itu pada skala yang BERBEDA:
 *
 *   document vs document (tes0)     0,80 – 1,00
 *   query vs document (kenyataan)   0,40 – 0,67
 *
 * Jadi 0,93 bukan sekadar terlalu tinggi — ia diambil dari
 * pengukuran yang bentuknya berbeda dari yang berjalan sungguhan.
 * Akibatnya nyata dan sempat terlihat: `npm run tes-ambang`
 * menunjukkan 0 dari 19 kalimat akan dijawab. Gerbang 2 mati total
 * tanpa satu pun pesan galat.
 *
 * Pelajarannya: ambang HARUS diturunkan dari pengukuran yang
 * bentuknya sama persis dengan yang berjalan di produksi.
 *
 * ---
 * DIPERIKSA ULANG 9 SEPTEMBER 2026, setelah contoh tersimpan pindah
 * dari "document" ke "query". Skalanya berubah lagi:
 *
 *   query vs query (sekarang)       0,50 – 0,90
 *
 * 0,50 kebetulan tetap pas — skor juara benar terendah 0,504. Tetapi
 * "kebetulan pas" bukan alasan yang cukup, jadi perlu dicatat: pada
 * skala ini ambang skor hampir tidak berperan. Jawaban yang SALAH
 * justru berskor 0,833, lebih tinggi daripada sebagian besar jawaban
 * benar. Yang benar-benar memutuskan adalah AMBANG_MARGIN di bawah.
 */
export const AMBANG_YAKIN = Number(process.env.AMBANG_YAKIN || 0.5);

/**
 * SYARAT KEDUA, dan ternyata yang lebih menentukan: jarak skor juara
 * terhadap pesaing terdekat yang templatenya berbeda.
 *
 * Diturunkan dari `npm run tes-ambang` pada 8 September 2026, 19
 * kalimat bergaya pelanggan. Angka-angkanya:
 *
 *   juara benar          17 dari 19
 *   skor juara benar     0,404 – 0,672  (median 0,555)
 *   skor tertinggi SALAH 0,621
 *
 * Perhatikan bahwa 0,621 yang salah itu lebih tinggi daripada 11 dari
 * 17 juara yang benar. Ambang berupa skor tunggal karena itu tidak
 * bisa memisahkan keduanya — berapa pun angkanya, ia akan menolak
 * banyak yang benar atau meloloskan yang salah.
 *
 * Marginnya justru memisahkan dengan rapi:
 *
 *   margin dua yang SALAH    0,027 dan 0,061
 *   margin juara yang benar  median 0,173
 *
 * Dengan syarat margin >= 0,10, kedua jawaban salah tertahan dan 12
 * jawaban benar tetap lolos — tanpa satu pun kesalahan.
 *
 * Masuk akal secara sebab-akibat, bukan kebetulan angka: skor mutlak
 * ikut naik-turun mengikuti bentuk kalimat, sedangkan margin mengukur
 * hal yang benar-benar ditanyakan — apakah template ini menonjol
 * dibanding tetangganya.
 */
/*
 * DITURUNKAN DARI 0,10 KE 0,06 PADA 9 SEPTEMBER 2026, mengikuti
 * pemindahan contoh tersimpan dari input_type "document" ke "query".
 *
 * Angka 0,10 di atas diturunkan dari skala LAMA (query-vs-document).
 * Pada skala baru sebarannya berbeda, dan diukur ulang dengan 19
 * kalimat yang sama (`npm run uji-input-type`, Rp 0,13):
 *
 *   margin jawaban SALAH terbesar   0,051
 *   margin jawaban BENAR median     0,318
 *
 * 0,06 dipilih tepat di atas 0,051 — setinggi mungkin yang masih
 * menahan seluruh jawaban salah. Hasilnya 17 dari 19 kalimat bisa
 * dijawab otomatis tanpa satu pun kesalahan, naik dari 12.
 *
 * PERHATIKAN: ambang SKOR hampir tidak berperan lagi di skala ini.
 * Jawaban yang salah justru berskor TINGGI (0,833) — lebih tinggi
 * daripada banyak jawaban benar. Yang menahannya semata margin.
 * Itu memperkuat alasan margin dipakai sejak awal, bukan skor.
 */
export const AMBANG_MARGIN = Number(process.env.AMBANG_MARGIN || 0.06);

/**
 * Di bawah ini dianggap tidak ada template yang cocok sama sekali.
 *
 * DITURUNKAN DARI 0,6 KE 0,35 PADA 8 SEPTEMBER 2026, karena 0,6
 * membuat gerbang ini diam untuk hampir semua pesan sungguhan.
 * Sumber angka lamanya sama dengan kekeliruan di atas: sebaran
 * document-vs-document. Pada skala query-vs-document yang sebenarnya,
 * juara yang BENAR berkisar 0,404 – 0,672 — jadi 0,6 membuang
 * sebagian besar kecocokan yang benar sebelum sempat dinilai, lalu
 * melapor "tidak ada kandidat di atas ambang".
 *
 * Inilah yang membuat "nem oilnya dipakenya gmn kak" (0,438) terlihat
 * seolah Gerbang 2 tidak menemukan apa-apa, padahal ia menemukan
 * kandidat dan hanya dibuang oleh saringan ini.
 *
 * Angka ini sekarang berfungsi sebagai lantai kasar saja. Yang
 * benar-benar memutuskan adalah AMBANG_YAKIN dan AMBANG_MARGIN.
 */
export const AMBANG_RAGU = Number(process.env.AMBANG_RAGU || 0.35);

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
  | { jenis: "yakin"; kandidat: Kandidat[]; margin: number; token: number }
  | { jenis: "ragu"; kandidat: Kandidat[]; margin: number; token: number }
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

    const semua = ((data ?? []) as Kandidat[]).filter((k) => Number.isFinite(k.skor));
    if (semua.length === 0 || semua[0].skor < AMBANG_RAGU) {
      return lewat("tidak ada kandidat di atas ambang", token);
    }

    /* Pesaing terdekat yang TEMPLATENYA BERBEDA. Dua contoh dari
       template yang sama menempati peringkat 1 dan 2 bukan
       persaingan — itu justru tanda kecocokannya kuat.

       Dihitung dari daftar YANG BELUM DISARING. Kalau pesaingnya
       ikut terbuang lantai AMBANG_RAGU lebih dulu, marginnya jadi
       palsu-besar dan syarat margin justru paling longgar tepat saat
       skornya paling lemah — kebalikan dari yang dimaksud. */
    const penantang = semua.find((k) => k.code !== semua[0].code);
    const margin = semua[0].skor - (penantang?.skor ?? 0);

    const kandidat = semua.filter((k) => k.skor >= AMBANG_RAGU);

    const yakin = kandidat[0].skor >= AMBANG_YAKIN && margin >= AMBANG_MARGIN;

    return {
      jenis: yakin ? "yakin" : "ragu",
      kandidat,
      margin,
      token,
    };
  } catch (err) {
    return lewat(err instanceof Error ? err.message : String(err), token);
  }
}
