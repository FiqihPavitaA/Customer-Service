/* ===========================================================
   Uji aturan main halaman Kata Sensitif.

     npm run uji-satpam-aturan

   Biaya Rp 0. Tanpa database, tanpa jaringan.

   KENAPA UJI INI ADA

   Halaman Kata Sensitif memberi admin kemampuan mengubah satu-
   satunya hal yang menahan permintaan refund dan pertanyaan
   keracunan supaya tidak dijawab mesin. Kemampuan itu datang
   dengan dua cara merusak yang berlawanan arah:

     terlalu sempit - kata yang dimaksud tidak tertangkap. Terlihat,
                      berbiaya, bisa diperbaiki.
     terlalu lebar  - satu kata umum mencegat ratusan pertanyaan
                      yang selama ini dijawab gratis. TIDAK
                      terlihat: tidak ada galat, tidak ada log,
                      hanya antrean CS yang penuh beberapa hari
                      kemudian.

   Yang kedua jauh lebih berbahaya, dan sebagian besar kasus di
   bawah menjaganya.
   =========================================================== */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const impor = (rel) =>
  import(join(WEB, rel).split("\\").join("/").replace(/^([A-Za-z]):/, "file:///$1:"));

// lib/satpamAturan.ts memakai alias "@/lib/templates" yang hanya
// dimengerti Turbopack, jadi fungsi murninya diuji lewat router.js
// langsung — sumber yang sama, tanpa lapisan alias.
const { buatPolaDariFrasa, periksaSatpam, setKbDir } = await impor(
  "content/knowledge-base/router.js",
);
setKbDir(join(WEB, "content", "knowledge-base"));

/* Salinan logika murni dari lib/satpamAturan.ts.

   DISALIN, BUKAN DIIMPOR, dan itu memang kerugian yang disadari:
   dua tempat yang bisa menyimpang. Alasannya, berkas .ts itu
   memakai alias "@/..." yang diselesaikan Turbopack saat build,
   sementara uji ini harus bisa jalan dengan `node` telanjang agar
   tetap gratis dan tidak butuh server. Yang menahan penyimpangan
   adalah kasus terakhir di berkas ini: ia membaca lib/satpamAturan.ts
   sebagai teks dan menuntut angka-angka penentunya masih sama. */

const MIN_HURUF = 2;
const MAKS_FRASA = 40;
const AMBANG_LEBAR = 0.02;

function bersihkanFrasa(masukan) {
  const dibuang = [];
  const daftar = Array.isArray(masukan) ? masukan : [];
  const terlihat = new Set();
  const frasa = [];

  for (const mentah of daftar) {
    const teks = String(mentah ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!teks) continue;
    if (teks.length < MIN_HURUF) {
      dibuang.push({ teks, sebab: `terlalu pendek (minimal ${MIN_HURUF} huruf)` });
      continue;
    }
    if (terlihat.has(teks)) {
      dibuang.push({ teks, sebab: "sudah ada di daftar ini" });
      continue;
    }
    if (frasa.length >= MAKS_FRASA) {
      dibuang.push({ teks, sebab: `melebihi batas ${MAKS_FRASA} frasa per aturan` });
      continue;
    }
    const polaTunggal = buatPolaDariFrasa([teks]);
    if (!polaTunggal || !new RegExp(polaTunggal, "i").test(teks)) {
      dibuang.push({
        teks,
        sebab:
          "diawali atau diakhiri tanda baca — pola batas kata tidak akan " +
          "pernah cocok dengan kalimat mana pun",
      });
      continue;
    }
    terlihat.add(teks);
    frasa.push(teks);
  }
  return { frasa, dibuang };
}

function polaDariFrasa(frasa) {
  const pola = buatPolaDariFrasa(frasa);
  if (!pola) return null;
  try { new RegExp(pola, "i"); } catch { return null; }
  return pola;
}

function cariTumpangTindih(frasa) {
  const hasil = [];
  for (const f of frasa) {
    const kena = periksaSatpam(f);
    if (kena) hasil.push({ frasa: f, kategori: kena.kategori });
  }
  return hasil;
}

function ukurCakupan(pola, contoh) {
  const total = contoh.length;
  if (!total) return { kena: 0, total: 0, contoh: [], perluDitinjau: false };
  let re;
  try { re = new RegExp(pola, "i"); } catch {
    return { kena: 0, total, contoh: [], perluDitinjau: false };
  }
  const kena = contoh.filter((t) => re.test(t));
  return {
    kena: kena.length,
    total,
    contoh: kena.slice(0, 5),
    perluDitinjau: kena.length > 1 && kena.length / total >= AMBANG_LEBAR,
  };
}

function prioritasBaru(aturan) {
  if (!aturan.length) return 10;
  return Math.max(...aturan.map((a) => a.priority)) + 10;
}

/* --------------------------------------------------------------- */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, catatan = "") {
  if (benar) {
    lulus++;
    console.log(`  v ${nama}`);
  } else {
    gagal++;
    console.log(`  X ${nama}${catatan ? ` — ${catatan}` : ""}`);
  }
}

console.log("\n=== UJI ATURAN HALAMAN KATA SENSITIF (Rp 0) ===\n");

/* --------------------------------------------------------------- */
console.log("1. Membersihkan frasa yang diketik admin");
{
  const { frasa, dibuang } = bersihkanFrasa([
    "  Penjual  ", "SELLER", "penjual", "a", "", null, "  ", "toko online",
  ]);
  periksa("huruf besar diturunkan", frasa.includes("penjual") && frasa.includes("seller"));
  periksa("spasi tepi dipangkas", !frasa.some((f) => f !== f.trim()));
  periksa("kembar dibuang", frasa.filter((f) => f === "penjual").length === 1);
  periksa("satu huruf ditolak", !frasa.includes("a"));
  periksa("kosong & null diabaikan diam-diam", frasa.length === 3, frasa.join("|"));
  periksa("yang dibuang punya sebab", dibuang.every((d) => d.sebab.length > 0));
  periksa(
    "sebab satu huruf disebutkan",
    dibuang.some((d) => d.teks === "a" && /pendek/.test(d.sebab)),
  );

  // Spasi ganda: "ganti  rugi" dan "ganti rugi" menghasilkan pola
  // yang SAMA, jadi menyimpan keduanya berarti dua baris yang
  // terlihat berbeda tapi berperilaku identik.
  const rapat = bersihkanFrasa(["ganti  rugi", "ganti rugi"]);
  periksa("spasi ganda dirapikan jadi satu frasa", rapat.frasa.length === 1, rapat.frasa.join("|"));

  const banyak = bersihkanFrasa(Array.from({ length: 45 }, (_, i) => `kata${i}`));
  periksa("batas 40 frasa ditegakkan", banyak.frasa.length === MAKS_FRASA);
  periksa("kelebihannya dilaporkan", banyak.dibuang.length === 5);
}

/* --------------------------------------------------------------- */
console.log("\n2. Pola yang dihasilkan aman dan benar");
{
  periksa("daftar kosong -> null", polaDariFrasa([]) === null);

  const pola = polaDariFrasa(["penjual", "seller"]);
  periksa("pola tersusun", pola === String.raw`\b(penjual|seller)\b`, String(pola));
  periksa("menangkap yang dimaksud", new RegExp(pola, "i").test("mau chat penjual"));
  periksa(
    "batas kata dihormati",
    !new RegExp(pola, "i").test("penjualan bulan ini"),
    "tanpa \\b, 'penjual' akan menangkap 'penjualan'",
  );

  // Inilah alasan admin tidak pernah perlu menulis regex: karakter
  // khusus yang diketik tanpa sadar tidak boleh menjadi pola.
  const nakal = polaDariFrasa(["a.b*c", "50% off"]);
  periksa("karakter khusus tidak membuat pola gagal", nakal !== null);
  periksa(
    "karakter khusus diperlakukan sebagai huruf biasa",
    new RegExp(nakal, "i").test("kode a.b*c ya") && !new RegExp(nakal, "i").test("kode abXc ya"),
    String(nakal),
  );

  // Frasa yang berakhir tanda baca menghasilkan pola yang SAH tapi
  // mandul: \b di ujungnya menuntut huruf, dan ")" atau "+" bukan
  // huruf. Ini pernah lolos dari uji ini sendiri sebelum
  // pemeriksaan diri di bersihkanFrasa() ditambahkan.
  const mandul = bersihkanFrasa(["c++", "(promo)", "harga (promo)", "penjual"]);
  periksa(
    "frasa berakhiran tanda baca ditolak lebih dulu",
    mandul.frasa.length === 1 && mandul.frasa[0] === "penjual",
    mandul.frasa.join("|"),
  );
  periksa(
    "sebabnya dijelaskan, bukan dibuang diam-diam",
    mandul.dibuang.length === 3 && mandul.dibuang.every((d) => /tanda baca/.test(d.sebab)),
  );
  periksa(
    "setiap frasa yang LOLOS pasti menangkap dirinya sendiri",
    mandul.frasa.every((f) => new RegExp(polaDariFrasa([f]), "i").test(f)),
  );

  // Pola penghabis waktu (catastrophic backtracking) tidak bisa
  // lahir dari jalan ini — seluruh karakter khususnya di-escape.
  const jahat = polaDariFrasa(["(a+)+$"]);
  const mulai = Date.now();
  new RegExp(jahat, "i").test("a".repeat(40) + "!");
  periksa("pola tetap cepat pada masukan panjang", Date.now() - mulai < 100);
}

/* --------------------------------------------------------------- */
console.log("\n3. Tumpang tindih dengan aturan yang sudah berlaku");
{
  const sudahAda = cariTumpangTindih(["refund", "rusak", "keracunan"]);
  periksa("kata yang sudah ditangkap terdeteksi", sudahAda.length === 3, JSON.stringify(sudahAda));
  periksa(
    "kategorinya disebutkan",
    sudahAda.find((t) => t.frasa === "refund")?.kategori === "refund_retur",
  );

  const belum = cariTumpangTindih(["penjual", "komplain", "expired"]);
  periksa(
    "kata yang memang bolong tidak dilaporkan tumpang tindih",
    belum.length === 0,
    JSON.stringify(belum),
  );
}

/* --------------------------------------------------------------- */
console.log("\n4. Peringatan cakupan — pengaman terpenting di halaman ini");
{
  // Contoh pertanyaan yang mewakili kalimat pelanggan sungguhan
  // yang SELAMA INI dijawab otomatis dan gratis.
  const contoh = [
    "dosis npk berapa", "cara pakai gimana", "kapan dikirim", "kirim ke surabaya berapa hari",
    "produk untuk cabai apa", "stok masih ada", "promo apa hari ini", "bisa buat hidroponik",
    "daunnya menguning kenapa", "media tanam apa yang bagus", "kirim pakai apa",
    "berapa lama sampai", "cocok untuk tanaman hias", "takaran per liter berapa",
    "boleh dicampur pestisida", "simpan di mana", "kadaluarsa kapan", "isi berapa ml",
    "ada varian lain", "bisa cod",
  ];

  const sempit = ukurCakupan(polaDariFrasa(["keracunan", "beracun"]), contoh);
  periksa("kata tepat: tidak ada yang tercegat", sempit.kena === 0);
  periksa("kata tepat: tidak ditandai", sempit.perluDitinjau === false);

  // 2, bukan 3. "kapan dikirim" TIDAK ikut tertangkap: \bkirim\b
  // tidak cocok dengan kata berawalan, karena batas kata terhalang
  // huruf "di". Sengaja dibiarkan begini di korpus uji — inilah
  // sifat yang paling sering mengejutkan orang saat menebak seberapa
  // luas sebuah kata akan menjaring.
  const lebar = ukurCakupan(polaDariFrasa(["kirim"]), contoh);
  periksa("kata terlalu umum tertangkap", lebar.kena === 2, `${lebar.kena} dari ${lebar.total}`);
  periksa(
    "kata berawalan TIDAK ikut tertangkap",
    !lebar.contoh.includes("kapan dikirim"),
    "batas kata terhalang awalan 'di'",
  );
  periksa("kata terlalu umum DITANDAI", lebar.perluDitinjau === true);
  periksa("contohnya ikut ditunjukkan", lebar.contoh.length === 2);
  periksa("contoh dibatasi 5 biar tidak membanjiri layar", lebar.contoh.length <= 5);

  // Satu kecocokan saja TIDAK ditandai. Kata yang memang tepat pun
  // bisa kebetulan muncul sekali; menandainya akan membuat
  // peringatan ini sering salah, dan peringatan yang sering salah
  // adalah peringatan yang berhenti dibaca.
  const sekali = ukurCakupan(polaDariFrasa(["kadaluarsa"]), contoh);
  periksa("satu kecocokan tidak ditandai", sekali.kena === 1 && !sekali.perluDitinjau);

  periksa(
    "tanpa contoh pertanyaan, tidak ada peringatan palsu",
    ukurCakupan(polaDariFrasa(["kirim"]), []).perluDitinjau === false,
  );
  periksa(
    "pola rusak tidak meledakkan perhitungan",
    ukurCakupan("(((", contoh).kena === 0,
  );
}

/* --------------------------------------------------------------- */
console.log("\n5. Nomor urut aturan baru");
{
  /* Datanya MENIRU bentuk tabel sungguhan: kategori sebagai blok
     berurutan, tanpa celah di antaranya. Versi pertama uji ini
     memakai angka karangan yang berjarak longgar, dan justru itulah
     yang menyembunyikan bug-nya — max+10 di dalam kategori terlihat
     benar pada data longgar, tetapi pada blok rapat ia selalu
     mendarat di nomor milik kategori berikutnya. */
  const SEPERTI_TABEL = [
    ...[10, 20, 30].map((p) => ({ kategori: "refund_retur", priority: p })),
    ...[40, 50, 60, 70, 80].map((p) => ({ kategori: "barang_bermasalah", priority: p })),
    ...[90, 100, 110].map((p) => ({ kategori: "sengketa", priority: p })),
    ...[120, 130, 140, 150].map((p) => ({ kategori: "keamanan", priority: p })),
    { kategori: "tanaman_rusak", priority: 160 },
    ...[170, 180].map((p) => ({ kategori: "minta_manusia", priority: p })),
    ...[190, 200, 210].map((p) => ({ kategori: "luar_marketplace", priority: p })),
  ];
  const terpakai = new Set(SEPERTI_TABEL.map((a) => a.priority));

  // Inti persoalannya: priority unik untuk SELURUH tabel, jadi nomor
  // yang diusulkan tidak boleh sudah dipakai kategori mana pun.
  let bentrok = 0;
  for (const kategori of new Set(SEPERTI_TABEL.map((a) => a.kategori))) {
    if (terpakai.has(prioritasBaru(SEPERTI_TABEL, kategori))) bentrok++;
  }
  periksa(
    "tidak bentrok untuk SEMUA kategori",
    bentrok === 0,
    `${bentrok} kategori mendapat nomor yang sudah dipakai — database akan menolak dengan duplicate key`,
  );

  periksa(
    "selalu di belakang aturan terakhir",
    prioritasBaru(SEPERTI_TABEL, "refund_retur") === 220,
    `dapat ${prioritasBaru(SEPERTI_TABEL, "refund_retur")}`,
  );
  periksa(
    "kategori mana pun mendapat nomor yang sama",
    new Set(
      [...new Set(SEPERTI_TABEL.map((a) => a.kategori))].map((k) =>
        prioritasBaru(SEPERTI_TABEL, k),
      ),
    ).size === 1,
    "nomornya milik tabel, bukan milik kategori",
  );
  periksa("tabel kosong mulai dari 10", prioritasBaru([], "apa pun") === 10);
  periksa(
    "tidak pernah menyisipkan di depan",
    prioritasBaru(SEPERTI_TABEL, "refund_retur") > Math.max(...terpakai),
  );
}

/* --------------------------------------------------------------- */
console.log("\n6. Angka penentu masih sepadan dengan lib/satpamAturan.ts");
{
  // Berkas ini menyalin logika dari lib/satpamAturan.ts supaya bisa
  // jalan dengan node telanjang. Salinan bisa menyimpang, jadi
  // angka-angka yang menentukan perilakunya dibaca ulang dari
  // sumbernya sebagai teks dan dituntut masih sama.
  const { readFileSync } = await import("node:fs");
  const ts = readFileSync(join(WEB, "lib", "satpamAturan.ts"), "utf8");
  const ambil = (nama) => {
    const cocok = new RegExp(`const ${nama} = ([0-9.]+);`).exec(ts);
    return cocok ? Number(cocok[1]) : null;
  };
  periksa("MIN_HURUF sama", ambil("MIN_HURUF") === MIN_HURUF, `ts=${ambil("MIN_HURUF")}`);
  periksa("MAKS_FRASA sama", ambil("MAKS_FRASA") === MAKS_FRASA, `ts=${ambil("MAKS_FRASA")}`);
  periksa("AMBANG_LEBAR sama", ambil("AMBANG_LEBAR") === AMBANG_LEBAR, `ts=${ambil("AMBANG_LEBAR")}`);
}

/* --------------------------------------------------------------- */
console.log(`\n${"-".repeat(52)}`);
console.log(`Aturan kata sensitif : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
