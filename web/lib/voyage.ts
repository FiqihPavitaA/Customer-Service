/* ===========================================================
   Klien Voyage — Gerbang 2 (Pengenal Maksud).

   APA YANG DIKERJAKAN VOYAGE, DAN APA YANG TIDAK.
   Voyage hanya mengubah kalimat menjadi deretan angka. Ia tidak
   menjawab, tidak memilih template, dan tidak tahu apa pun tentang
   Infarm. Yang MEMBANDINGKAN angka-angka itu adalah Supabase lewat
   pgvector; yang memutuskan adalah ambang di /api/chat.

   Memahami pembagian ini penting saat menelusuri kesalahan: kalau
   template yang terpilih salah, Voyage hampir tidak pernah jadi
   sebabnya. Yang salah biasanya contoh pertanyaannya — dan itu
   diperbaiki tim CS, bukan dengan mengganti model.
   =========================================================== */

/**
 * Model embedding. Rencananya `voyage-4-lite` (kuota gratis 200 juta
 * token), tetapi WAJIB dicocokkan dengan nama persis yang tertera di
 * dasbor Voyage — nama model berubah antar generasi, dan nama yang
 * salah membuat panggilan gagal dengan 400, bukan diam-diam keliru.
 *
 * SATU HAL YANG PERLU DIPERIKSA SEBELUM MEMILIH: dukungan bahasa
 * Indonesia. Pelanggan menulis "gmn", "brp", "kk", "blm" — kalau
 * modelnya berpusat pada bahasa Inggris, kalimat-kalimat itulah yang
 * paling dulu meleset, padahal justru itu alasan Gerbang 2 dibangun.
 * Varian multilingual biasanya lebih tepat untuk kasus ini walau
 * sedikit lebih mahal.
 */
export const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-4-lite";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

/** Batas aman jumlah teks per permintaan. */
const UKURAN_BATCH = 128;

/**
 * SAKLAR PENGAMAN SALDO — berlaku untuk Voyage juga.
 *
 * Sengaja memakai AI_TEST_LOCK yang sama dengan Claude, bukan saklar
 * sendiri. Alasannya: yang ingin dicegah pemilik proyek bukan
 * "panggilan ke Anthropic", melainkan "panggilan berbayar tanpa
 * sepengetahuan saya". Dua saklar terpisah berarti mematikan satu
 * dan mengira semuanya aman.
 *
 * VOYAGE_LOCK tetap disediakan bila suatu saat perlu mengunci Voyage
 * sendirian — misalnya saat kuota gratis 200 juta token menipis
 * sementara Claude masih boleh jalan.
 */
export function voyageTerkunci(): boolean {
  const ya = (v: string | undefined) => {
    const t = (v || "").trim().toLowerCase();
    return t === "1" || t === "true" || t === "ya";
  };
  return ya(process.env.AI_TEST_LOCK) || ya(process.env.VOYAGE_LOCK);
}

/** Apakah kunci Voyage sudah diisi? */
export function voyageSiap(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export type HasilEmbedding = {
  /** Satu vektor per teks masukan, urutannya dijamin sama. */
  vektor: number[][];
  /** Panjang tiap vektor — dicatat supaya perubahan model ketahuan. */
  dimensi: number;
  /** Token yang ditagih Voyage. */
  token: number;
  model: string;
};

/**
 * Kesalahan yang perlu dibedakan pemanggil dari kegagalan jaringan
 * biasa: ini berarti panggilan sengaja TIDAK dikirim.
 */
export class VoyageTerkunciError extends Error {
  constructor() {
    super(
      "AI_TEST_LOCK/VOYAGE_LOCK aktif — panggilan berbayar ke Voyage ditolak " +
        "sebelum dikirim. Hapus saklarnya di web/.env.local untuk membukanya.",
    );
    this.name = "VoyageTerkunciError";
  }
}

/**
 * Ubah teks menjadi vektor.
 *
 * @param teks     daftar kalimat. Dipecah otomatis per 128.
 * @param jenis    "document" untuk contoh pertanyaan yang disimpan,
 *                 "query" untuk pesan pelanggan yang masuk.
 *
 *                 BUKAN detail sepele: Voyage memakai penanda ini
 *                 untuk menempatkan pertanyaan dan dokumen pada
 *                 ruang yang saling cocok. Memakai jenis yang sama
 *                 untuk keduanya menurunkan ketepatan tanpa satu pun
 *                 pesan galat.
 * @throws VoyageTerkunciError bila saklar pengaman aktif.
 */
/**
 * Voyage menolak karena batas laju, bukan karena salah konfigurasi.
 *
 * Dipisahkan jadi kelas sendiri karena tindakannya berlawanan dengan
 * galat lain: yang ini cukup ditunggu, sedangkan salah kunci atau
 * salah nama model tidak akan pernah membaik walau dicoba seribu
 * kali.
 */
export class VoyagePadatError extends Error {
  /** Detik yang disarankan Voyage lewat header Retry-After, bila ada. */
  readonly tungguDetik: number;
  constructor(pesan: string, tungguDetik: number) {
    super(pesan);
    this.name = "VoyagePadatError";
    this.tungguDetik = tungguDetik;
  }
}

/**
 * Ubah status HTTP jadi kalimat yang menunjuk sebab yang benar.
 *
 * Versi pertama berkas ini menjawab SEMUA status dengan "Periksa nama
 * model dan kunci API". Itu menyesatkan pada kasus yang justru paling
 * sering terjadi: HTTP 429 sama sekali bukan soal kunci — kunci dan
 * modelnya benar, hanya kuotanya sedang habis. Pesan yang menuduh
 * bagian yang benar membuat orang mengubah yang tidak perlu diubah.
 */
function galatVoyage(status: number, detail: string): Error {
  const potong = detail.slice(0, 300);

  if (status === 429) {
    // Akun Voyage tanpa metode pembayaran dibatasi 3 permintaan per
    // menit dan 10.000 token per menit. Batas itu berlaku walau
    // kuota gratis 200 juta token masih utuh — keduanya hal yang
    // berbeda, dan itulah yang paling membingungkan di sini.
    const cocok = /(\d+)\s*RPM/i.exec(detail);
    const rpm = cocok ? cocok[1] : "3";
    return new VoyagePadatError(
      `Voyage sedang membatasi laju (HTTP 429) — bukan masalah kunci ` +
        `maupun nama model. Akun tanpa metode pembayaran dibatasi ${rpm} ` +
        `permintaan per menit. Tunggu sekitar satu menit lalu coba lagi, ` +
        `atau tambahkan metode pembayaran di dashboard.voyageai.com untuk ` +
        `membuka batas standar. Kuota gratisnya sendiri tidak berkurang ` +
        `karena permintaan yang ditolak. ${potong}`,
      60,
    );
  }

  if (status === 401 || status === 403) {
    return new Error(
      `Voyage menolak kunci API (HTTP ${status}). Periksa VOYAGE_API_KEY ` +
        `di web/.env.local, lalu jalankan ulang server — nilai env dibaca ` +
        `sekali saat modul dimuat. ${potong}`,
    );
  }

  if (status === 400 || status === 404) {
    return new Error(
      `Voyage menolak permintaan (HTTP ${status}). Kemungkinan terbesar ` +
        `nama model salah: sekarang terpasang "${VOYAGE_MODEL}". Cocokkan ` +
        `dengan nama persis di dashboard.voyageai.com. ${potong}`,
    );
  }

  return new Error(
    `Voyage menolak permintaan (HTTP ${status}). ${potong}`,
  );
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type OpsiEmbed = {
  /**
   * Tunggu lalu ulangi bila kena batas laju (HTTP 429).
   *
   * Bawaannya false, dan itu disengaja. Jalur yang dipakai
   * /api/chat harus GAGAL CEPAT: Gerbang 2 adalah penghemat biaya,
   * dan menahan pelanggan 60 detik demi menghemat Rp 30 adalah
   * tukar-tambah yang salah arah. Di sana kegagalan berarti
   * "teruskan ke Claude seperti sebelum gerbang ini ada".
   *
   * Yang membangun vektor secara borongan justru sebaliknya: tidak
   * ada pelanggan yang menunggu, dan mengulang jauh lebih baik
   * daripada memaksa Admin menekan tombolnya berkali-kali.
   */
  ulangSaatPadat?: boolean;
};

export async function embed(
  teks: string[],
  jenis: "document" | "query",
  opsi: OpsiEmbed = {},
): Promise<HasilEmbedding> {
  if (voyageTerkunci()) throw new VoyageTerkunciError();

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY belum diisi di web/.env.local. Ambil di " +
        "https://dashboard.voyageai.com/ lalu jalankan ulang server.",
    );
  }

  const bersih = teks.map((t) => String(t ?? "").trim()).filter(Boolean);
  if (bersih.length === 0) {
    return { vektor: [], dimensi: 0, token: 0, model: VOYAGE_MODEL };
  }

  const vektor: number[][] = [];
  let token = 0;

  /** Maksimal berapa kali satu batch diulang saat kena batas laju. */
  const MAKS_ULANG = opsi.ulangSaatPadat ? 3 : 0;

  for (let i = 0; i < bersih.length; i += UKURAN_BATCH) {
    const batch = bersih.slice(i, i + UKURAN_BATCH);

    /* Beri jarak antar-batch saat memborong. Batas laju bawaan
       Voyage adalah 3 permintaan per menit; menembakkan empat batch
       beruntun dijamin kena 429 pada batch keempat, dan mengulang
       sesudah ditolak lebih lambat daripada menunggu sejak awal. */
    if (opsi.ulangSaatPadat && i > 0) await tidur(21_000);

    let res: Response | null = null;
    for (let percobaan = 0; percobaan <= MAKS_ULANG; percobaan++) {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: batch,
          model: VOYAGE_MODEL,
          input_type: jenis,
        }),
      });

      if (res.ok) break;

      const detail = await res.text().catch(() => "");
      const galat = galatVoyage(res.status, detail);

      // Hanya 429 yang layak diulang. Kunci salah atau nama model
      // salah tidak akan membaik walau dicoba seribu kali — mengulang
      // hanya menunda pesan galat yang justru perlu dibaca.
      if (!(galat instanceof VoyagePadatError) || percobaan === MAKS_ULANG) {
        throw galat;
      }

      const jeda = galat.tungguDetik * 1000 * (percobaan + 1);
      console.warn(
        `[VOYAGE] batas laju — menunggu ${Math.round(jeda / 1000)} detik ` +
          `lalu mengulang (percobaan ${percobaan + 1}/${MAKS_ULANG}).`,
      );
      await tidur(jeda);
    }

    if (!res || !res.ok) {
      throw new Error("Voyage tidak menjawab setelah beberapa percobaan.");
    }

    const json = (await res.json()) as {
      data?: { embedding: number[]; index: number }[];
      usage?: { total_tokens?: number };
    };

    const data = json.data ?? [];
    if (data.length !== batch.length) {
      throw new Error(
        `Voyage mengembalikan ${data.length} vektor untuk ${batch.length} teks. ` +
          "Urutan tidak bisa dipercaya, jadi dihentikan di sini.",
      );
    }

    // Urutan dipulihkan lewat `index`, bukan diasumsikan dari posisi
    // dalam larik. Kalau tertukar, tiap contoh pertanyaan menempel ke
    // template yang salah — dan itu tidak akan terlihat sampai
    // jawaban ke pelanggan mulai aneh.
    const urut = [...data].sort((a, b) => a.index - b.index);
    for (const d of urut) vektor.push(d.embedding);

    token += json.usage?.total_tokens ?? 0;
  }

  const dimensi = vektor[0]?.length ?? 0;
  const beda = vektor.find((v) => v.length !== dimensi);
  if (beda) {
    throw new Error(
      `Panjang vektor tidak seragam (${dimensi} vs ${beda.length}). ` +
        "Jangan disimpan — perbandingan kedekatan akan salah.",
    );
  }

  return { vektor, dimensi, token, model: VOYAGE_MODEL };
}

/**
 * Perkiraan biaya, untuk dilaporkan SEBELUM memanggil.
 *
 * Tarif sengaja dibaca dari env: harga Voyage berubah dan menuliskan
 * angka mati di kode membuat laporan biaya diam-diam menjadi bohong.
 * Nilai bawaan mengikuti tarif kelas "lite" saat berkas ini dibuat —
 * cocokkan dengan halaman harga Voyage sebelum dipercaya.
 */
export function perkiraanBiaya(token: number): { usd: number; idr: number } {
  const usdPerJutaToken = Number(process.env.VOYAGE_USD_PER_MTOK || 0.02);
  const kurs = Number(process.env.USD_TO_IDR || 16500);
  const usd = (token / 1_000_000) * usdPerJutaToken;
  return { usd, idr: usd * kurs };
}

/**
 * Hitung kasar jumlah token tanpa memanggil Voyage.
 * Dipakai untuk melaporkan perkiraan biaya sebelum meminta izin.
 * Sengaja dilebihkan sedikit — lebih baik perkiraannya terlalu besar.
 */
export function kiraToken(teks: string[]): number {
  const huruf = teks.reduce((n, t) => n + String(t ?? "").length, 0);
  return Math.ceil(huruf / 3.5);
}
