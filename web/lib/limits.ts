/* ===========================================================
   Batas panjang balasan ke pelanggan.

   Diminta tim CS pada 4 September 2026: setiap balasan yang keluar
   ke pelanggan maksimal 600 karakter.

   Saat aturan ini masuk, ke-152 template yang ada SUDAH memenuhinya
   — yang terpanjang 599 karakter ([PBM]), median 189. Jadi ini bukan
   perubahan gaya, melainkan menuliskan kebiasaan yang sudah berjalan
   supaya AI ikut mematuhinya dan template baru tidak melanggarnya.

   ----------------------------------------------------------
   KENAPA TIDAK DIPOTONG OTOMATIS
   ----------------------------------------------------------
   Balasan AI yang kepanjangan TIDAK dipangkas di /api/chat, dan itu
   disengaja. Sebagian besar balasan berisi dosis; memotongnya di
   tengah bisa menghasilkan "2 ml per" tanpa satuan, atau menghapus
   peringatan di kalimat terakhir. Balasan yang 40 karakter kelebihan
   adalah masalah gaya; balasan yang terpotong di tengah adalah
   masalah keamanan.

   Yang dilakukan: aturannya ditegakkan di system prompt
   (claude-core.md), panjangnya diukur di setiap balasan, dan
   pelanggarannya ditampilkan supaya bisa ditindaklanjuti.

   MAX_TOKENS sengaja TIDAK diturunkan menjadi ~200. Biaya keluaran
   dihitung dari token yang benar-benar dipakai, bukan dari batas
   atasnya, jadi menurunkannya tidak menghemat apa pun — hanya
   menambah kemungkinan terpotong di tengah.
   =========================================================== */

/** Panjang maksimal balasan ke pelanggan, dalam karakter. */
export const BATAS_BALASAN = 600;

/** Ambang peringatan "sudah mepet" — 90% dari batas. */
export const AMBANG_MEPET = Math.round(BATAS_BALASAN * 0.9);

/**
 * Ukur sebuah balasan terhadap batas.
 * Spasi di ujung tidak dihitung; itu bukan isi.
 */
export function ukurBalasan(teks: string) {
  const panjang = teks.trim().length;
  return {
    panjang,
    lewat: panjang > BATAS_BALASAN,
    mepet: panjang > AMBANG_MEPET && panjang <= BATAS_BALASAN,
    sisa: BATAS_BALASAN - panjang,
  };
}
