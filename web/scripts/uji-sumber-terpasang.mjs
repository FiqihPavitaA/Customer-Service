/* ===========================================================
   Setiap rute yang menilai Gerbang 0 WAJIB memuat sumbernya dulu.

     npm run uji-sumber-terpasang

   Biaya Rp 0. Hanya membaca berkas .ts di web/app/api.

   KENAPA UJI INI ADA

   Ditulis setelah bug nyata, 11 Sep 2026. Gerbang 0 sudah bisa
   membaca kata sensitif dari tabel, dan /api/chat sudah dipasangi
   siapkanSumberSatpam(). Yang terlewat adalah /api/simulasi: ia
   memanggil routeToCategory() yang sama, tetapi tidak pernah
   memuat tabelnya.

   Akibatnya persis kebalikan dari yang orang duga saat melihat
   gejalanya. Pengamannya BEKERJA pada pelanggan sungguhan; yang
   tidak bekerja adalah layar peragaan — satu-satunya tempat orang
   mengujinya sebelum percaya. Simulator melaporkan "di luar
   jangkauan template", yang terbaca sebagai "kata saya tidak
   berfungsi", sehingga orang akan menyunting kata yang sebenarnya
   sudah benar.

   Kesalahannya sendiri sepele: satu baris await yang lupa ditulis
   di rute keempat. Tidak ada galat, tidak ada tipe yang menolak,
   dan tidak ada uji lama yang gagal — karena seluruh uji berjalan
   pada pemanggilan langsung, bukan lewat rute.

   Yang dijaga di sini karena itu bukan perilakunya, melainkan
   PEMASANGANNYA: setiap rute yang menilai Gerbang 0 harus
   menyiapkan sumbernya di berkas yang sama.
   =========================================================== */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = join(WEB, "app", "api");

/** Semua route.ts di bawah app/api, serekursif apa pun letaknya. */
function cariRute(dir) {
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) hasil.push(...cariRute(penuh));
    else if (nama === "route.ts") hasil.push(penuh);
  }
  return hasil;
}

/* Fungsi yang MENILAI Gerbang 0. routeToCategory ikut, karena
   gerbang itu dinilai di dalamnya — inilah yang membuat bug
   /api/simulasi tidak kelihatan: berkas itu tidak pernah menyebut
   kata "satpam" sama sekali. */
const MENILAI = /\b(periksaSatpam|routeToCategory)\s*\(/;
const MENYIAPKAN = /\bsiapkanSumberSatpam\s*\(/;

/* Fungsi yang memakai template. Dijaga sekalian karena bentuk
   kegagalannya sama persis, hanya lapisannya berbeda. */
const MENILAI_TEMPLATE = /\b(matchTemplate|routeToCategory)\s*\(/;
const MENYIAPKAN_TEMPLATE = /\bsiapkanSumberTemplate\s*\(/;

/* Gerbang jadwal — ditambahkan 11 Sep 2026, setelah kesalahan yang
   SAMA terulang.

   Gerbang kata sensitif sempat dipasang di /api/chat dan lupa di
   /api/simulasi. Penjaga ini ditulis untuk menangkapnya. Lalu
   gerbang JADWAL dipasang, juga hanya di /api/chat — dan penjaga
   ini tidak menangkapnya, karena ia hanya tahu tentang dua gerbang
   yang sudah ada.

   Pelajarannya bukan "tambahkan satu pemeriksaan lagi", melainkan
   bahwa daftar tertutup akan selalu tertinggal satu langkah. Karena
   itu aturannya sekarang berbentuk kewajiban MENULIS: rute yang
   menjalankan Gerbang 2 harus memuat jadwalnya, ATAU menuliskan
   pengecualiannya. Rute baru tidak bisa diam-diam lolos — ia harus
   memilih salah satu, dan pilihannya terbaca orang berikutnya. */
const MENILAI_JADWAL = /\bkenaliMaksud\s*\(/;
const MENYIAPKAN_JADWAL = /\bsiapkanJadwalAI\s*\(/;
const DIKECUALIKAN_JADWAL = /JADWAL-AI:\s*DIKECUALIKAN\s*—\s*\S/;

let lulus = 0;
let gagal = 0;
const laporan = [];

console.log("\n=== UJI PEMASANGAN SUMBER DI RUTE API (Rp 0) ===\n");

for (const berkas of cariRute(API)) {
  const isi = readFileSync(berkas, "utf8");
  const nama = relative(WEB, berkas).split("\\").join("/");

  // Baris komentar dibuang: penjelasan bug ini MEMUAT nama-nama
  // fungsinya, dan komentar bukan pemanggilan.
  const kode = isi
    .split("\n")
    .filter((b) => {
      const t = b.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

  const perluSatpam = MENILAI.test(kode);
  const perluTemplate = MENILAI_TEMPLATE.test(kode);
  const perluJadwal = MENILAI_JADWAL.test(kode);
  if (!perluSatpam && !perluTemplate && !perluJadwal) continue;

  const masalah = [];
  if (perluJadwal && !MENYIAPKAN_JADWAL.test(kode) && !DIKECUALIKAN_JADWAL.test(isi)) {
    masalah.push(
      "menjalankan Gerbang 2 tanpa siapkanJadwalAI() — saklar AI TIDAK berlaku di rute ini.\n" +
        '      Kalau memang disengaja, tulis komentar: "JADWAL-AI: DIKECUALIKAN — <alasannya>"',
    );
  }
  if (perluSatpam && !MENYIAPKAN.test(kode)) {
    masalah.push(
      "menilai Gerbang 0 tanpa siapkanSumberSatpam() — kata sensitif dari tabel TIDAK berlaku di rute ini",
    );
  }
  if (perluTemplate && !MENYIAPKAN_TEMPLATE.test(kode)) {
    masalah.push(
      "memakai template tanpa siapkanSumberTemplate() — rute ini membaca berkas .md, bukan tabel",
    );
  }

  if (masalah.length) {
    gagal++;
    console.log(`  X ${nama}`);
    for (const m of masalah) console.log(`      ${m}`);
  } else {
    lulus++;
    laporan.push(nama);
  }
}

for (const n of laporan) console.log(`  v ${n}`);

console.log(`\n${"-".repeat(52)}`);
console.log(`Pemasangan sumber : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);

if (gagal > 0) {
  console.error(
    `\n${gagal} rute belum memuat sumbernya.\n` +
      "Tambahkan await siapkanSumberSatpam() / siapkanSumberTemplate()\n" +
      "SEBELUM baris yang menilai gerbangnya.",
  );
  process.exit(1);
}

if (lulus === 0) {
  // Nol rute terperiksa berarti polanya tidak lagi cocok dengan
  // kode — uji yang "lulus" tanpa memeriksa apa pun lebih berbahaya
  // daripada tidak ada uji sama sekali.
  console.error("\nTidak ada satu pun rute yang terperiksa. Pola pencariannya sudah basi.");
  process.exit(1);
}

console.log("\nSemua rute memuat sumbernya lebih dulu");
