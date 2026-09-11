/* ===========================================================
   Jembatan tabel `satpam_rules` <-> router. Khusus sisi SERVER.

   Berkas ini tidak boleh diimpor komponen klien: ia memuat
   router.js, yang membaca berkas dengan node:fs.

   KENAPA TERPISAH DARI templatesServer.ts

   Keduanya memang mirip — TTL, satu perjalanan ke Supabase, jatuh
   ke cadangan bila gagal. Tetapi apa yang terjadi saat gagal
   berbeda secara mendasar, dan perbedaan itulah yang membuat
   keduanya tidak boleh digabung jadi satu fungsi bersaklar:

     templates gagal -> berkas .md melayani. Isinya setara, dan
                        pelanggan tidak merasakan apa-apa.
     satpam gagal    -> daftar SATPAM di kode melayani. Ini BUKAN
                        keadaan setara: daftar di kode tidak
                        memuat kata apa pun yang baru ditambahkan
                        admin, jadi pesan yang seharusnya dicegat
                        bisa lolos ke Claude.

   Karena itu kegagalan di sini dilaporkan lebih keras, dan
   statusnya ikut disertakan di /api/health supaya "kenapa kata
   yang baru saya tambahkan tidak berfungsi" punya jawaban yang
   bisa dilihat, bukan ditebak.
   =========================================================== */

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  bersihkanSatpamLuar,
  getSumberSatpam,
  jumlahSatpam,
  setSatpamLuar,
} from "@/content/knowledge-base/router.js";
import type { BarisSatpamRouter } from "@/content/knowledge-base/router.js";

/**
 * Berapa lama potret tabel dipakai ulang sebelum diambil lagi.
 *
 * Sengaja memakai env var yang SAMA dengan templates. Dua nilai
 * berbeda berarti dua sumber bisa berganti pada saat yang berbeda,
 * dan menelusuri "kenapa balasannya begitu" jadi butuh dua jadwal
 * sekaligus. Tukar-tambahnya juga sama persis: terlalu pendek =
 * satu perjalanan jaringan tambahan sebelum tiap pesan dijawab,
 * terlalu panjang = kata yang baru disimpan admin belum berlaku.
 */
const TTL_MS = Number(process.env.TEMPLATE_TTL_DETIK || 60) * 1000;

let kadaluarsa = 0;
let sedangMuat: Promise<void> | null = null;
/** Diingat supaya peringatan yang sama tidak membanjiri log tiap chat. */
let sudahMengeluh = false;

export type StatusSatpam = {
  sumber: "kode" | "supabase";
  /** Aturan yang sedang benar-benar berlaku, sumber mana pun itu. */
  aturan: number;
  /** Aturan tabel yang dibuang karena polanya tidak sah. */
  ditolak: string[];
  /** Kenapa jatuh ke daftar di kode, bila memang jatuh. */
  alasan: string | null;
};

let statusTerakhir: StatusSatpam = {
  sumber: "kode",
  aturan: 0,
  ditolak: [],
  alasan: "belum pernah dimuat",
};

/** Status pemuatan terakhir, untuk /api/health dan panel diagnosa. */
export function statusSumberSatpam(): StatusSatpam {
  return { ...statusTerakhir, sumber: getSumberSatpam(), aturan: jumlahSatpam() };
}

/**
 * Pastikan Gerbang 0 memakai isi tabel bila tabelnya tersedia.
 *
 * TIDAK PERNAH MELEMPAR. Ini jalur yang dilewati setiap pesan
 * pelanggan; kegagalannya harus berarti "pakai daftar di kode",
 * bukan "pelanggan tidak dijawab" dan sama sekali bukan "lewati
 * pengamannya". Sumber yang benar-benar dipakai selalu bisa dibaca
 * lewat statusSumberSatpam().
 */
export async function siapkanSumberSatpam(): Promise<void> {
  if (Date.now() < kadaluarsa) return;
  if (sedangMuat) return sedangMuat;

  sedangMuat = (async () => {
    const sb = getSupabaseServer();
    if (!sb) {
      jatuhKeKode("Supabase belum dikonfigurasi");
      return;
    }

    try {
      const { data, error } = await sb.rpc("satpam_router");

      if (error) {
        // Yang paling mungkin terjadi pada pemasangan baru: berkas
        // supabase/schema-satpam.sql belum dijalankan. Sebutkan
        // berkasnya, jangan hanya meneruskan pesan Postgres.
        const petunjuk = /function .*satpam_router.* does not exist/i.test(error.message)
          ? "fungsi satpam_router() belum ada — jalankan supabase/schema-satpam.sql"
          : error.message;
        jatuhKeKode(petunjuk);
        return;
      }

      const baris = (data ?? []) as BarisSatpamRouter[];
      if (baris.length === 0) {
        // Tabel ada tapi kosong = seed di schema-satpam.sql belum
        // dijalankan, atau admin menonaktifkan seluruh barisnya.
        // Daftar di kode tetap melayani secara utuh, jadi tidak ada
        // pesan berbahaya yang lolos karena ini.
        jatuhKeKode("tabel satpam_rules masih kosong");
        return;
      }

      const hasil = setSatpamLuar(baris);

      // setSatpamLuar() mengembalikan aturan: 0 bila SELURUH isi
      // tabel ditolak — ia sudah memulihkan daftar di kode sendiri.
      // Yang tersisa di sini hanyalah melaporkannya sebagai
      // kegagalan, bukan sebagai keberhasilan dengan nol aturan.
      if (hasil.aturan === 0) {
        jatuhKeKode(
          `seluruh ${baris.length} baris tabel ditolak: ${hasil.ditolak.join("; ")}`,
        );
        statusTerakhir = { ...statusTerakhir, ditolak: hasil.ditolak };
        return;
      }

      statusTerakhir = {
        sumber: "supabase",
        aturan: hasil.aturan,
        ditolak: hasil.ditolak,
        alasan: null,
      };
      sudahMengeluh = false;

      const catatan = hasil.ditolak.length ? `, ${hasil.ditolak.length} ditolak` : "";
      console.log(`[KB-ROUTER] satpam=supabase — ${hasil.aturan} aturan${catatan}`);
    } catch (err) {
      jatuhKeKode(err instanceof Error ? err.message : String(err));
    } finally {
      kadaluarsa = Date.now() + TTL_MS;
      sedangMuat = null;
    }
  })();

  return sedangMuat;
}

function jatuhKeKode(alasan: string) {
  bersihkanSatpamLuar();
  statusTerakhir = { sumber: "kode", aturan: jumlahSatpam(), ditolak: [], alasan };
  if (!sudahMengeluh) {
    // console.warn, bukan console.log. Jatuh ke daftar di kode
    // berarti kata yang baru ditambahkan admin TIDAK berlaku —
    // keadaan yang harus terlihat, bukan sekadar tercatat.
    console.warn(`[KB-ROUTER] satpam=kode — ${alasan}`);
    sudahMengeluh = true;
  }
}

/** Paksa pemuatan ulang pada permintaan berikutnya (dipakai sesudah menulis). */
export function segarkanSumberSatpam() {
  kadaluarsa = 0;
}
