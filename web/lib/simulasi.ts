/* ===========================================================
   Satu saklar untuk seluruh perkakas simulasi.

   KENAPA BUKAN NODE_ENV LAGI

   Sampai 10 September 2026 ketiga penjaganya berbunyi
   `NODE_ENV === "production"`, dengan alasan yang ditulis
   terang-terangan di /api/simulasi: "env var yang harus diisi
   manual cepat atau lambat akan terisi di tempat yang salah."

   Alasan itu masih benar. Yang keliru adalah anggapan di
   belakangnya — bahwa "produksi" dan "tempat yang tidak boleh
   diperagakan" adalah hal yang sama. Vercel menyetel
   NODE_ENV=production pada SETIAP deployment, termasuk proyek uji
   coba yang belum punya satu pun pengguna. Akibatnya perkakas
   peragaan mati justru di tempat ia paling dibutuhkan: URL yang
   bisa dibuka tim CS dari ponsel masing-masing, bukan laptop
   pengembang.

   KENAPA SATU VARIABEL, BUKAN DUA

   Panel di halaman Chat adalah komponen klien, jadi ia hanya bisa
   membaca NEXT_PUBLIC_*. Route API bisa membaca apa saja. Godaannya
   memakai dua variabel — satu publik untuk tampilan, satu rahasia
   untuk penulisan — supaya menyalakan tampilan tidak ikut membuka
   jalur tulis.

   Ditolak, karena dua saklar untuk satu fitur pasti akan berselisih
   suatu hari: panel muncul, tombolnya ditekan, API membalas 404, dan
   tidak ada satu pun kalimat di layar yang menjelaskan kenapa. Itu
   persis jenis kegagalan diam yang sudah tiga kali memakan waktu di
   proyek ini.

   Nilainya sendiri bukan rahasia — ia hanya menjawab "deployment ini
   untuk peragaan atau bukan". Pengaman yang sesungguhnya tidak
   berubah sedikit pun: /api/simulasi tetap menuntut sesi login yang
   sah dan tetap menulis di bawah RLS sebagai pengguna itu.

   YANG TIDAK BERUBAH

   Di localhost tetap menyala tanpa mengisi apa pun. Yang bertambah
   hanya kemampuan menyalakannya pada deployment tertentu — dan
   deployment yang tidak mengisinya tetap tertutup persis seperti
   sebelumnya, termasuk produksi nanti setelah cutover.
   =========================================================== */

/**
 * Longgar terhadap "true" selain "1".
 *
 * Bukan kemudahan: salah tulis di dashboard Vercel baru ketahuan
 * setelah build berikutnya selesai, dan menerima dua bentuk yang
 * sama-sama wajar menghapus satu putaran tunggu yang tidak
 * mengajarkan apa pun.
 */
function menyala(nilai: string | undefined): boolean {
  const v = (nilai ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "ya";
}

/**
 * Apakah perkakas simulasi boleh hidup di deployment ini?
 *
 * PENTING: NEXT_PUBLIC_* dipanggang ke dalam bundel saat build,
 * bukan dibaca saat jalan. Mengisinya di dashboard tidak cukup —
 * harus ada Redeploy sesudahnya, kalau tidak nilainya masih yang
 * lama.
 */
export const SIMULASI_HIDUP =
  menyala(process.env.NEXT_PUBLIC_SIMULASI) ||
  process.env.NODE_ENV !== "production";

/** Kalimat yang sama di mana pun penjaga ini menolak. */
export const PESAN_SIMULASI_MATI =
  "Perkakas simulasi tidak aktif di deployment ini. " +
  "Setel NEXT_PUBLIC_SIMULASI=1 di environment variables, lalu Redeploy.";
