/* ===========================================================
   Sisi database dari handover — dipakai HANYA oleh /api/chat.

   ATURAN BERKAS INI: tidak satu pun fungsi di sini boleh melempar.

   Alasannya bukan kerapian. Kalau pencatatan handover gagal —
   Supabase mati, RLS menolak, kolomnya belum dimigrasi — yang
   BOLEH terjadi adalah CS tidak melihat barisnya. Yang TIDAK BOLEH
   adalah /api/chat ikut gagal, karena akibatnya pelanggan yang
   sedang komplain tidak dijawab sama sekali. Gagal mencatat jauh
   lebih ringan daripada gagal membalas.

   KENAPA MEMAKAI TOKEN PENGGUNA, BUKAN service_role

   Kebijakan RLS `conversations_all` dan `escalations_all` keduanya
   `to authenticated`, jadi anon tidak bisa menulis. Ada tiga jalan
   keluar dan dua di antaranya salah:

     service_role      menembus SELURUH RLS untuk mendapat dua tabel
                       yang dibutuhkan — terlalu besar, dan kuncinya
                       jadi hidup di route yang menerima input publik.
     security definer  pola yang dipakai pustaka_router(). Cocok
                       untuk MEMBACA template yang memang sama untuk
                       semua orang, tapi membuka fungsi MENULIS
                       kepada anon berarti siapa pun yang bisa
                       menjangkau endpoint ini dapat menyuntik
                       eskalasi palsu ke antrean CS.
     token pengguna    dipakai di sini.

   Konsekuensinya jujur dan perlu diketahui: selama pemanggilnya
   belum membawa sesi, handover tidak tercatat. Hari ini seluruh
   pemanggil /api/chat memang sedang login (halaman Chat dan AI
   Chatbot), jadi tidak ada yang hilang. Yang belum ada adalah
   webhook marketplace — dan justru saat itulah pertanyaan
   "bagaimana webhook membuktikan dirinya" harus dijawab dengan
   benar, bukan sekarang dengan menebak. Membuka jalur tulis untuk
   anon hari ini berarti menanggung risikonya berbulan-bulan
   sebelum ada satu pun pemakai yang membutuhkannya.
   =========================================================== */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hitungJedaSampai, JAM_JEDA_BAWAAN } from "@/lib/handover";

/**
 * Lama jeda dalam jam. Bisa diperpendek lewat env saat menguji —
 * menunggu 24 jam sungguhan untuk membuktikan jedanya berakhir
 * bukan pengujian, itu penantian.
 */
export const JAM_JEDA = Number(process.env.JEDA_HANDOVER_JAM || JAM_JEDA_BAWAAN);

/** Apa yang diketahui saat handover diputuskan. */
export type BahanHandover = {
  conversationId: string;
  /** Gerbang mana yang memutuskan: 'satpam' | 'template' | 'ai'. */
  sumber: string;
  /** Kode template bila ada — [DITERUSKAN CS], [REKENING], dan sejenisnya. */
  kode?: string | null;
  /** Kategori KB hasil router. */
  kategori?: string | null;
  /** Kalimat pelanggan yang memicunya. */
  pesan: string;
  /** Balasan yang dikirim ke pelanggan, bila ada. */
  balasan?: string | null;
};

export type HasilHandover = {
  jedaSampai: string;
  /** false bila percakapan ini sudah punya eskalasi terbuka. */
  eskalasiBaru: boolean;
};

/**
 * Sampai kapan AI harus diam untuk percakapan ini.
 *
 * @returns stempel ISO, atau null bila tidak pernah dijeda atau
 *          tidak bisa dibaca. Perhatikan: null di sini berarti
 *          "tidak ada alasan untuk diam", jadi kegagalan baca
 *          membuat AI tetap menjawab. Itu pilihan sadar — lihat
 *          sedangDijeda() di lib/handover.ts untuk alasan lengkapnya.
 */
export async function bacaJeda(
  sb: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from("conversations")
      .select("ai_paused_until")
      .eq("id", conversationId)
      .maybeSingle();

    if (error) {
      console.warn("[handover] gagal baca jeda:", error.message);
      return null;
    }
    return (data?.ai_paused_until as string | null) ?? null;
  } catch (e) {
    console.warn("[handover] gagal baca jeda:", (e as Error).message);
    return null;
  }
}

/**
 * Catat sebuah handover: tandai percakapannya, jeda AI 24 jam, dan
 * masukkan ke antrean eskalasi.
 *
 * Kolom `messages` sengaja TIDAK disentuh. Pemilik log percakapan
 * adalah halaman Chat (store.appendMessage) dan — nanti — webhook
 * marketplace. Kalau route ini ikut menambah pesan, satu kalimat
 * pelanggan bisa tercatat dua kali oleh dua penulis yang tidak
 * saling mengetahui keberadaan satu sama lain.
 *
 * @returns null bila gagal atau tidak ada sesi; kegagalannya sudah
 *          dicatat ke console dan bukan urusan pemanggil.
 */
export async function catatHandover(
  sb: SupabaseClient,
  bahan: BahanHandover,
): Promise<HasilHandover | null> {
  const jedaSampai = hitungJedaSampai(JAM_JEDA);

  try {
    const { data, error } = await sb
      .from("conversations")
      .update({
        action: "HANDOVER_TO_CS",
        ai_paused_until: jedaSampai,
        handover_summary: ringkasan(bahan),
        handover_detail: rincian(bahan),
        // Handover selalu perlu dilihat orang, walau percakapannya
        // sudah pernah dibuka sebelumnya.
        unread: true,
      })
      .eq("id", bahan.conversationId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[handover] gagal menandai percakapan:", error.message);
      return null;
    }
    // Berhasil tetapi nol baris = RLS menolak diam-diam, atau id-nya
    // tidak ada. Keduanya berarti tidak ada yang tercatat, jadi
    // jangan mengaku sudah dijeda.
    if (!data) {
      console.warn(
        "[handover] percakapan tidak terjangkau (tidak ada, atau ditolak RLS):",
        bahan.conversationId,
      );
      return null;
    }

    const eskalasiBaru = await buatEskalasi(sb, bahan);
    return { jedaSampai, eskalasiBaru };
  } catch (e) {
    console.warn("[handover] gagal menandai percakapan:", (e as Error).message);
    return null;
  }
}

/**
 * Satu eskalasi terbuka per percakapan.
 *
 * Tanpa penjaga ini, tombol saran AI yang ditekan tiga kali
 * menghasilkan tiga baris antrean untuk satu pelanggan yang sama —
 * dan antrean yang isinya duplikat berhenti dipercaya dengan cepat.
 */
async function buatEskalasi(
  sb: SupabaseClient,
  bahan: BahanHandover,
): Promise<boolean> {
  try {
    const { data: adaTerbuka, error: galatCari } = await sb
      .from("escalations")
      .select("id")
      .eq("conversation_id", bahan.conversationId)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (galatCari) {
      console.warn("[handover] gagal cek eskalasi terbuka:", galatCari.message);
      return false;
    }
    if (adaTerbuka) return false;

    const { error } = await sb.from("escalations").insert({
      conversation_id: bahan.conversationId,
      reason: alasan(bahan),
      status: "open",
    });

    if (error) {
      console.warn("[handover] gagal membuat eskalasi:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[handover] gagal membuat eskalasi:", (e as Error).message);
    return false;
  }
}

/* -----------------------------------------------------------
   Penyusun teks

   Hanya menuliskan yang benar-benar diketahui. Format ringkasan
   handover di claude-core.md punya tujuh bidang — termasuk Tingkat
   Urgensi dan Yang Perlu Ditindaklanjuti CS — dan tidak satu pun
   dari keduanya bisa disimpulkan dari sebuah pencocokan template.
   Mengisinya dengan tebakan berarti CS membaca "Urgensi: Normal"
   pada kasus yang sebetulnya genting. Bidang yang belum diketahui
   dibiarkan kosong sampai Gerbang 3 bisa mengisinya sungguhan.
   ----------------------------------------------------------- */

const NAMA_SUMBER: Record<string, string> = {
  satpam: "Gerbang 0 (kata kunci pengaman)",
  template: "template baku",
  ai: "Claude",
};

function alasan(b: BahanHandover): string {
  const asal = NAMA_SUMBER[b.sumber] ?? b.sumber;
  return b.kode ? asal + " — " + b.kode : asal;
}

function ringkasan(b: BahanHandover): string {
  const potongan = b.pesan.trim().slice(0, 300);
  return (
    "Dialihkan oleh " + alasan(b) + ".\n\n" + 'Pesan pelanggan:\n"' + potongan + '"'
  );
}

function rincian(b: BahanHandover): Record<string, string> {
  const hasil: Record<string, string> = { "Dialihkan oleh": alasan(b) };
  if (b.kategori) hasil["Kategori"] = b.kategori;
  if (b.balasan?.trim()) hasil["Sudah dibalas otomatis"] = "Ya";
  return hasil;
}
