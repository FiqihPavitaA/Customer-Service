/* ===========================================================
   Jembatan kolom jadwal di `settings` <-> gerbang /api/chat.
   Khusus sisi SERVER.

   KENAPA TERPISAH DARI templatesServer / satpamServer

   Bentuknya memang mirip — TTL, satu perjalanan baca, jatuh ke
   cadangan bila gagal. Yang berbeda adalah ARTI kegagalannya, dan
   itulah yang menentukan isi berkas ini:

     templates gagal -> berkas .md melayani. Setara, tidak terasa.
     satpam gagal    -> daftar di kode melayani. Pengaman tetap
                        penuh; hanya kata tambahan yang tidak berlaku.
     jadwal gagal    -> AI MENJAWAB. Bukan keadaan setara sama
                        sekali: kalau tim CS sedang bekerja, AI
                        menyela mereka sepanjang hari, dan ongkos
                        Claude jalan terus.

   ARAH JATUHNYA DIPILIH SADAR: gagal baca berarti AI MENJAWAB,
   bukan diam. Alasannya bukan kenyamanan melainkan bentuk
   kegagalannya. AI yang menyela CS akan dikeluhkan hari itu juga.
   AI yang diam karena Supabase sedang bermasalah tengah malam tidak
   terlihat siapa pun — yang tersisa hanyalah pelanggan yang tidak
   pernah dijawab, dan persentase balas cepat yang turun beberapa
   hari kemudian tanpa ada yang menghubungkannya dengan ini.

   Potret terakhir yang berhasil dibaca TETAP DIPAKAI selama TTL
   belum habis, jadi gangguan sesaat tidak langsung menyalakan AI di
   tengah jam kerja.
   =========================================================== */

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  putusanAI,
  teksKeadaanAI,
  type KeputusanAI,
  type PengaturanJadwal,
} from "@/lib/jadwalAi";

/**
 * Sama dengan TTL sumber template & satpam, dan itu disengaja.
 * Tiga jadwal pembaruan yang berbeda berarti menelusuri "kenapa
 * balasannya begitu" butuh tiga garis waktu sekaligus.
 *
 * Untuk jadwal, 60 detik juga berarti: menekan "matikan AI
 * sekarang" di header berlaku paling lambat satu menit kemudian.
 * Itu cukup cepat untuk terasa langsung, dan cukup lambat untuk
 * tidak menambah satu perjalanan jaringan pada tiap pesan.
 */
const TTL_MS = Number(process.env.TEMPLATE_TTL_DETIK || 60) * 1000;

/** Dipakai saat tabel belum pernah berhasil dibaca. */
const BAWAAN: PengaturanJadwal = {
  ai_enabled: true,
  ai_jadwal_aktif: false,
  ai_jam_mulai: 8,
  ai_jam_selesai: 16,
  ai_hari: [1, 2, 3, 4, 5],
  ai_override_sampai: null,
  ai_override_nyala: true,
};

let kadaluarsa = 0;
let sedangMuat: Promise<void> | null = null;
let sudahMengeluh = false;

/** Potret terakhir yang BERHASIL dibaca. */
let potret: PengaturanJadwal = BAWAAN;
let pernahBerhasil = false;
let alasanGagal: string | null = "belum pernah dimuat";

export type StatusJadwal = {
  sumber: "supabase" | "bawaan";
  alasan: string | null;
  pengaturan: PengaturanJadwal;
  keputusan: KeputusanAI;
  teks: string;
};

/**
 * Keadaan AI sekarang, beserta alasannya.
 *
 * Memakai potret yang sudah ada — TIDAK menembak Supabase. Panggil
 * siapkanJadwalAI() lebih dulu bila jawabannya harus mutakhir.
 */
export function statusJadwalAI(sekarang: Date = new Date()): StatusJadwal {
  const keputusan = putusanAI(potret, sekarang);
  return {
    sumber: pernahBerhasil ? "supabase" : "bawaan",
    alasan: alasanGagal,
    pengaturan: potret,
    keputusan,
    teks: teksKeadaanAI(keputusan),
  };
}

/**
 * Pastikan potret jadwalnya mutakhir.
 *
 * TIDAK PERNAH MELEMPAR. Ini jalur yang dilewati setiap pesan
 * pelanggan; kegagalannya harus berarti "pakai potret terakhir",
 * bukan "pelanggan tidak dijawab".
 */
export async function siapkanJadwalAI(): Promise<void> {
  if (Date.now() < kadaluarsa) return;
  if (sedangMuat) return sedangMuat;

  sedangMuat = (async () => {
    const sb = getSupabaseServer();
    if (!sb) {
      gagal("Supabase belum dikonfigurasi");
      return;
    }

    try {
      const { data, error } = await sb.rpc("jadwal_ai");

      if (error) {
        const petunjuk = /function .*jadwal_ai.* does not exist/i.test(error.message)
          ? "fungsi jadwal_ai() belum ada — jalankan supabase/jadwal-ai.sql"
          : error.message;
        gagal(petunjuk);
        return;
      }

      const baris = (Array.isArray(data) ? data[0] : data) as PengaturanJadwal | undefined;
      if (!baris) {
        gagal("baris settings id=1 tidak ditemukan");
        return;
      }

      potret = {
        ai_enabled: baris.ai_enabled !== false,
        ai_jadwal_aktif: baris.ai_jadwal_aktif === true,
        ai_jam_mulai: Number(baris.ai_jam_mulai),
        ai_jam_selesai: Number(baris.ai_jam_selesai),
        // PostgREST mengembalikan smallint[] sebagai array angka,
        // tetapi data lama bisa saja berisi teks. putusanAI()
        // memang menolak nilai yang bukan bilangan bulat — dan
        // menolaknya berarti jadwal diabaikan, bukan AI diam.
        ai_hari: Array.isArray(baris.ai_hari) ? baris.ai_hari.map(Number) : [],
        ai_override_sampai: baris.ai_override_sampai ?? null,
        ai_override_nyala: baris.ai_override_nyala !== false,
      };
      pernahBerhasil = true;
      alasanGagal = null;
      sudahMengeluh = false;
    } catch (err) {
      gagal(err instanceof Error ? err.message : String(err));
    } finally {
      kadaluarsa = Date.now() + TTL_MS;
      sedangMuat = null;
    }
  })();

  return sedangMuat;
}

function gagal(alasan: string) {
  alasanGagal = alasan;
  // Potret TIDAK direset. Kalau pernah berhasil dibaca, jadwal
  // terakhir yang diketahui tetap berlaku — gangguan sesaat tidak
  // boleh menyalakan AI di tengah jam kerja.
  if (!sudahMengeluh) {
    console.warn(
      `[JADWAL-AI] gagal membaca jadwal — ${alasan}. ` +
        (pernahBerhasil
          ? "Memakai potret terakhir yang berhasil dibaca."
          : "Memakai bawaan: AI menjawab, tanpa jadwal."),
    );
    sudahMengeluh = true;
  }
}

/** Paksa pemuatan ulang pada permintaan berikutnya (dipakai sesudah menulis). */
export function segarkanJadwalAI() {
  kadaluarsa = 0;
}
