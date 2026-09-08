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
export async function embed(
  teks: string[],
  jenis: "document" | "query",
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

  for (let i = 0; i < bersih.length; i += UKURAN_BATCH) {
    const batch = bersih.slice(i, i + UKURAN_BATCH);

    const res = await fetch(ENDPOINT, {
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

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Voyage menolak permintaan (HTTP ${res.status}). ` +
          `Periksa nama model "${VOYAGE_MODEL}" dan kunci API. ${detail.slice(0, 300)}`,
      );
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
