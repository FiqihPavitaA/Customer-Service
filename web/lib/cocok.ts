/* ===========================================================
   Aturan pencocokan kata kunci pencarian.

   Berkas ini TIDAK meng-import apa pun, dan itu syarat: ia
   dijalankan langsung oleh Node lewat `npm run uji-cari`, yang
   tidak membaca alias "@/" maupun impor tanpa ekstensi berkas.

   KENAPA ATURAN SEKECIL INI PERLU BERKAS SENDIRI

   Kalau pencocokan meleset, tidak ada yang rusak di layar. Yang
   muncul adalah "tidak ada percakapan yang cocok" — kalimat yang
   terbaca sebagai JAWABAN, bukan sebagai kegagalan. CS akan
   menyimpulkan pesanannya memang tidak ada, lalu memberi tahu
   pelanggan begitu.

   Kegagalan yang menyamar sebagai jawaban adalah kegagalan yang
   tidak pernah dilaporkan siapa pun, dan karena itu tidak pernah
   diperbaiki. Uji terpisah adalah satu-satunya yang menangkapnya.
   =========================================================== */

/**
 * Buang segala yang bukan huruf/angka, lalu kecilkan.
 *
 * Nomor pesanan jarang sampai ke CS dalam bentuk bersih. Yang
 * ditempelkan orang biasanya "#260909KMTPRWX", "Pesanan:
 * 260909KMTPRWX", atau nomor bersambung tanda hubung dari
 * tangkapan layar.
 */
export function normalkan(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Apakah sebuah nilai BERBENTUK NOMOR identitas?
 *
 * Dipakai untuk memutuskan apakah aman mencocokkan terbalik (lihat
 * tahap 3 di cocokKata). Syaratnya dua: cukup panjang, dan ada
 * angkanya. Nomor pesanan dan nomor resi selalu memenuhi keduanya;
 * nama orang tidak pernah.
 *
 * Panjang 8 dipilih supaya potongan pendek seperti "budi" atau
 * "2026" tidak pernah lolos — keduanya terlalu umum, dan
 * mencocokkannya terbalik akan membuat pencarian melebar tanpa ada
 * yang menyadarinya.
 */
function berbentukNomor(nilaiNormal: string): boolean {
  return nilaiNormal.length >= 8 && /[0-9]/.test(nilaiNormal);
}

/**
 * Apakah nilai bidang cocok dengan kata kunci?
 *
 * Tiga tahap, berurutan, dan urutannya menentukan artinya.
 *
 *   1. Apa adanya. Menjaga pencarian nama tetap wajar — "budi
 *      santoso" tetap berarti dua kata dengan spasi di antaranya.
 *
 *   2. Setelah dinormalkan. Menyelamatkan nomor yang ditempel
 *      bersama tanda baca: "#260909KMTPRWX", "260909-KMTPRWX".
 *
 *      Kalau tahap ini dipakai SENDIRIAN, "budi santoso" berubah
 *      jadi "budisantoso" dan ikut mencocoki "budisantosoputra" —
 *      melebar diam-diam, dan baru terlihat saat ada dua pelanggan
 *      bernama mirip.
 *
 *   3. Terbalik: KUNCI yang mengandung NILAI. Hanya berlaku bila
 *      nilainya berbentuk nomor.
 *
 *      Ini menangani kunci yang lebih panjang daripada nomornya —
 *      "Pesanan: 260909KMTPRWX" atau "No. 260909/KMTPRWX", yang
 *      muncul saat orang menyalin label sekalian dari layar
 *      marketplace. Tanpa tahap ini, dua bentuk itu tidak akan
 *      pernah ketemu, dan yang terbaca di layar adalah "pesanan
 *      tidak ada" — bukan "cara Anda menempel salah".
 *
 *      Penjaga berbentukNomor() yang menahannya tetap sempit:
 *      tanpa itu, mencari "budisantosoputra" akan ikut memunculkan
 *      pelanggan bernama "budi".
 *
 * Kunci yang tidak menyisakan huruf/angka apa pun — "###", spasi,
 * string kosong — dianggap cocok. Kotak pencarian yang isinya
 * bukan apa-apa tidak boleh menyembunyikan seluruh daftar.
 */
export function cocokKata(nilai: string, kunci: string): boolean {
  const k = normalkan(kunci);
  if (k.length === 0) return true;

  if (nilai.toLowerCase().includes(kunci.toLowerCase())) return true;

  const n = normalkan(nilai);
  if (n.includes(k)) return true;

  return berbentukNomor(n) && k.includes(n);
}
