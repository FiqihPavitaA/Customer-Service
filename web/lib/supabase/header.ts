/* ===========================================================
   Header permintaan ke route handler kita sendiri, lengkap dengan
   token sesi bila ada.

   KENAPA INI PERLU ADA SAMA SEKALI

   Sesi console disimpan di localStorage, bukan cookie (lihat
   lib/supabase/client.ts). Route handler karena itu tidak pernah
   melihat sesi apa pun kecuali peramban mengirimkannya sendiri.
   Tanpa header ini, setiap penulisan berjalan sebagai anon dan
   ditolak RLS — dengan cara yang membingungkan, karena sebagian
   kebijakan menolak lewat galat dan sebagian lagi lewat "berhasil,
   nol baris".

   KENAPA SATU BERKAS, BUKAN SATU SALINAN DI TIAP PEMANGGIL

   Sampai 9 Sep 2026 fungsi ini ada dua salinan identik di
   lib/db/templateStore.ts dan components/settings/ContohPertanyaan.tsx.
   Keduanya benar, tapi dua salinan berarti perbaikan pada satu
   salinan tidak pernah sampai ke salinan lainnya — dan yang
   diperbaiki biasanya justru soal keamanan.
   =========================================================== */

import { getSupabase } from "@/lib/supabase/client";

/**
 * Sengaja TIDAK melempar saat sesi tidak ada.
 *
 * Sebagian permintaan memang boleh jalan tanpa sesi (membaca daftar
 * template jatuh ke berkas .md), dan untuk yang tidak boleh, yang
 * pantas menolak adalah database dengan pesannya sendiri — bukan
 * tebakan di sisi peramban tentang siapa yang berhak.
 */
export async function headerBerSesi(): Promise<HeadersInit> {
  const dasar: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  if (!sb) return dasar;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) dasar.Authorization = `Bearer ${token}`;
  } catch {
    // Sesi tidak terbaca — biarkan tanpa token; server akan menjawab
    // 401 dengan pesannya sendiri.
  }
  return dasar;
}
