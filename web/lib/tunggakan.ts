/* ===========================================================
   Tunggakan — chat yang belum dijawab siapa pun.

   KENAPA DIHITUNG, BUKAN DISIMPAN

   Godaan pertama adalah menambah kolom `belum_terjawab` dan
   mengisinya setiap kali pesan masuk saat AI mati. Itu salah karena
   dua hal.

   Pertama, kolom seperti itu hanya benar untuk pesan yang lewat
   SINI. Tim CS sering membalas langsung di aplikasi Shopee atau
   TikTok, di luar console; kolomnya tidak akan pernah tahu, dan
   daftar yang menampilkan chat yang sudah dijawab akan berhenti
   dipercaya dalam sepekan.

   Kedua, ia menjawab pertanyaan yang lebih sempit dari yang
   sebenarnya ditanyakan. "Masuk saat AI mati" bukan yang ingin
   dilihat tim CS — yang ingin dilihat adalah "belum ada yang
   membalas", dan itu juga terjadi saat AI menyala: percakapan yang
   sudah dialihkan ke manusia lalu tertinggal.

   Peran pesan terakhir sudah menjawab keduanya sekaligus, tanpa
   kolom baru dan tanpa satu pun tulisan tambahan di jalur panas.

   KENAPA ADA PERINGATAN SEBELUM JENDELA DITUTUP

   Saklar jadwal menciptakan satu lubang yang tidak ada sebelumnya:
   pesan yang datang pukul 15.55, ketika tim CS sudah beres-beres,
   tidak dijawab AI (karena masih jam kerja) dan tidak dijawab orang
   (karena jamnya habis). Kalau pelanggannya kemudian diam, pesan
   itu tidak pernah dijawab siapa pun.

   Itu bertabrakan dengan aturan Infarm sendiri — balas di bawah 15
   menit, dan balasan terakhir harus dari kita. Menyuruh AI menyapu
   tunggakan pukul 16.00 tampak seperti jawabannya, tetapi justru
   memusatkan seluruh biaya delapan jam ke dalam satu menit,
   menjawab pertanyaan pukul 08.05 seolah baru datang, dan berisiko
   membalas dua kali untuk chat yang sudah ditangani di luar
   console.

   Yang dilakukan di sini karena itu bukan mengejar ketertinggalan,
   melainkan mencegahnya terbentuk: tim diberi tahu selagi masih
   sempat.
   =========================================================== */

import type { ChatMessage } from "./db/types";
import { jamWib, menitWib, type KeputusanAI } from "./jadwalAi.ts";

/**
 * Seberapa awal peringatan muncul sebelum AI menyala kembali.
 *
 * Setengah jam, bukan lima menit. Peringatan ini hanya berguna
 * kalau masih ada waktu untuk menindaklanjutinya; yang muncul tepat
 * saat orang menutup laptop cuma memberi tahu bahwa sesuatu sudah
 * terlambat.
 */
export const AMBANG_PERINGATAN_MENIT = 30;

/**
 * Apakah percakapan ini menunggu jawaban.
 *
 * Dibaca dari belakang, bukan sekadar `pesan.at(-1)`. Kolomnya
 * jsonb tanpa CHECK, jadi satu baris dengan role yang tidak dikenal
 * — sisa impor lama, atau salah ketik — akan membuat pemeriksaan
 * satu-elemen menjawab "sudah terjawab" untuk percakapan yang
 * sebenarnya masih menunggu. Diam ke arah itu adalah arah yang
 * salah: tunggakan yang tidak terlihat persis masalah yang sedang
 * dicoba dihilangkan.
 */
export function belumTerjawab(pesan: readonly ChatMessage[]): boolean {
  for (let i = pesan.length - 1; i >= 0; i--) {
    const peran = pesan[i]?.role;
    if (peran === "user") return true;
    // 'cs' = diketik manusia, 'assistant' = dijawab AI. Keduanya
    // sama-sama berarti sudah ada balasan sesudah pesan pelanggan.
    if (peran === "assistant" || peran === "cs") return false;
  }
  // Percakapan tanpa pesan sama sekali bukan tunggakan. Ia tidak
  // menunggu apa pun.
  return false;
}

/**
 * Berapa menit lagi jendela jam kerja berakhir — yaitu berapa menit
 * lagi AI menyala kembali.
 *
 * null bila pertanyaannya tidak berlaku: AI sedang boleh menjawab,
 * atau ia diam karena sebab yang tidak punya jam berakhir (saklar
 * induk, override).
 */
export function sisaJendelaMenit(k: KeputusanAI, sekarang: Date): number | null {
  if (k.sebab !== "jadwal" || k.jamBerakhir === null) return null;

  const selisihJam = (k.jamBerakhir - jamWib(sekarang) + 24) % 24;
  const sisa = selisihJam * 60 - menitWib(sekarang);

  /* Negatif seharusnya mustahil: selama sebab-nya "jadwal", jam
     sekarang ada DI DALAM jendela dan jam berakhirnya masih di
     depan. Dikembalikan 0 dan bukan angka minus supaya kalimat yang
     disusun darinya tetap masuk akal kalau asumsi itu suatu saat
     tidak berlaku. */
  return Math.max(0, sisa);
}

/**
 * Kalimat peringatan untuk header, atau null bila tidak ada yang
 * perlu diperingatkan.
 *
 * Tiga syarat harus terpenuhi sekaligus — ada tunggakannya, AI
 * sedang diam KARENA JADWAL, dan jendelanya segera tutup. Peringatan
 * yang muncul di luar ketiganya hanya melatih orang mengabaikannya.
 */
export function peringatanTunggakan(
  k: KeputusanAI,
  jumlah: number,
  sekarang: Date,
): string | null {
  if (jumlah <= 0) return null;

  const sisa = sisaJendelaMenit(k, sekarang);
  if (sisa === null || sisa > AMBANG_PERINGATAN_MENIT) return null;

  const kapan = sisa <= 1 ? "sebentar lagi" : `${sisa} menit lagi`;
  return `AI nyala ${kapan} · ${jumlah} chat belum terjawab`;
}
