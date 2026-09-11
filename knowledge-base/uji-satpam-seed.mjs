/* ===========================================================
   Apakah seed di supabase/schema-satpam.sql benar-benar sama
   dengan daftar SATPAM di router.js?

   KENAPA UJI INI ADA

   Tahap 1 memindahkan Gerbang 0 dari kode ke tabel. Pemindahan
   seperti ini punya satu cara gagal yang khas dan sangat sunyi:
   seed-nya SALIN-TEMPEL yang meleset satu pola, tabel dipakai
   router, dan sejak itu ada kelas pesan berbahaya yang lolos —
   tanpa satu pun galat, tanpa satu pun log. Yang berubah hanya
   tagihan Claude, pelan-pelan.

   Uji ini membaca seed langsung dari berkas .sql, menyusun ulang
   aturannya seperti yang nanti dilakukan router, lalu menjalankan
   satu korpus pesan lewat DUA jalan: daftar di kode dan hasil
   seed. Kategori keduanya wajib sama persis.

   TIDAK menyentuh database dan TIDAK menyentuh jaringan. Berjalan
   sepenuhnya atas dua berkas yang ada di repo, jadi berbiaya Rp 0
   berapa kali pun dijalankan.

   Jalankan:  node knowledge-base/uji-satpam-seed.mjs
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { periksaSatpam, buatPolaDariFrasa } from "./router.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const BERKAS_SQL = join(DIR, "..", "supabase", "schema-satpam.sql");

/* ===========================================================
   1. Membaca seed dari berkas .sql
   ===========================================================
   Ditulis sebagai pemindai kecil, bukan regex satu baris. Nilai
   di dalam seed mengandung koma di dalam kurung siku array DAN
   tanda petik yang di-escape ganda ('') — dua hal yang membuat
   regex naif memotong di tempat yang salah dan melaporkan
   "semuanya cocok" atas data yang sudah rusak. */

/**
 * Ambil blok baris nilai dari INSERT seed.
 *
 * Bentuknya `insert ... select ... from (values …) as v(…)`, bukan
 * `insert ... values … on conflict`. Sebabnya ada di komentar
 * schema-satpam.sql: ON CONFLICT tidak bisa memakai constraint
 * DEFERRABLE sebagai penengah, dan constraint itu memang sengaja
 * deferrable.
 *
 * Penandanya dituntut ADA, bukan dicari dengan pola longgar. Kalau
 * bentuk berkasnya berubah lagi, uji ini harus BERHENTI dengan
 * jelas — bukan membaca nol baris lalu melaporkan "semua lulus"
 * atas data yang tidak pernah dibacanya.
 */
function ambilBlokSeed(sql) {
  const mulai = sql.indexOf("insert into public.satpam_rules");
  if (mulai === -1) throw new Error("INSERT seed satpam_rules tidak ditemukan");
  const values = sql.indexOf("from (values", mulai);
  if (values === -1) {
    throw new Error("Bentuk INSERT seed tidak dikenali: 'from (values' tidak ada");
  }
  const akhir = sql.indexOf("\n) as v(", values);
  if (akhir === -1) {
    throw new Error("Bentuk INSERT seed tidak dikenali: penutup ') as v(' tidak ada");
  }
  return sql.slice(values + "from (values".length, akhir);
}

/** Pecah blok menjadi baris-baris (…) dengan menghormati tanda petik. */
function pecahBaris(blok) {
  const baris = [];
  let dalamPetik = false;
  let kedalaman = 0;
  let mulai = -1;

  for (let i = 0; i < blok.length; i++) {
    const c = blok[i];
    if (dalamPetik) {
      // '' di dalam string adalah satu tanda petik, bukan penutup.
      if (c === "'" && blok[i + 1] === "'") i++;
      else if (c === "'") dalamPetik = false;
      continue;
    }
    if (c === "'") { dalamPetik = true; continue; }
    if (c === "(") { if (kedalaman === 0) mulai = i + 1; kedalaman++; continue; }
    if (c === ")") {
      kedalaman--;
      if (kedalaman === 0) baris.push(blok.slice(mulai, i));
    }
  }
  return baris;
}

/** Pecah isi satu baris menjadi nilai, mengabaikan koma di dalam array[…]. */
function pecahNilai(isi) {
  const bagian = [];
  let dalamPetik = false;
  let kurung = 0;
  let mulai = 0;

  for (let i = 0; i < isi.length; i++) {
    const c = isi[i];
    if (dalamPetik) {
      if (c === "'" && isi[i + 1] === "'") i++;
      else if (c === "'") dalamPetik = false;
      continue;
    }
    if (c === "'") { dalamPetik = true; continue; }
    if (c === "[") kurung++;
    else if (c === "]") kurung--;
    else if (c === "," && kurung === 0) {
      bagian.push(isi.slice(mulai, i).trim());
      mulai = i + 1;
    }
  }
  bagian.push(isi.slice(mulai).trim());
  return bagian;
}

/**
 * Satu nilai SQL -> nilai JavaScript.
 *
 * Penanda tipe `::text` / `::text[]` dibuang lebih dulu. Tipe itu
 * ditulis eksplisit di seed karena PostgreSQL menyimpulkan tipe
 * kolom VALUES dari seluruh barisnya, dan kolom yang bernilai null
 * di baris pertama bisa jatuh ke tipe yang salah — perlu bagi
 * Postgres, tidak berarti apa-apa bagi pembacaan di sini.
 */
function bacaNilai(teks) {
  const t = teks.trim().replace(/::[a-z]+(\[\])?$/i, "");
  if (t === "null") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  if (t.startsWith("array[")) {
    const isi = t.slice("array[".length, -1);
    return pecahNilai(isi).filter(Boolean).map(bacaNilai);
  }
  const n = Number(t);
  if (!Number.isNaN(n)) return n;
  throw new Error(`Nilai SQL tidak dikenali: ${t}`);
}

const KOLOM = [
  "kategori", "priority", "frasa", "when_patterns",
  "also_pattern", "why", "is_bawaan",
];

function bacaSeed() {
  const sql = readFileSync(BERKAS_SQL, "utf8");
  return pecahBaris(ambilBlokSeed(sql)).map((isi) => {
    const nilai = pecahNilai(isi).map(bacaNilai);
    if (nilai.length !== KOLOM.length) {
      throw new Error(`Baris seed punya ${nilai.length} nilai, harusnya ${KOLOM.length}: ${isi.slice(0, 80)}…`);
    }
    return Object.fromEntries(KOLOM.map((k, i) => [k, nilai[i]]));
  });
}

/* ===========================================================
   2. Menyusun ulang aturan seperti yang nanti dilakukan router
   ===========================================================
   Semantiknya disalin dari periksaSatpam(): unless membatalkan,
   also wajib ikut cocok, when cukup salah satu. Ditulis ulang di
   sini dengan sengaja — kalau memanggil fungsi yang sama, uji ini
   hanya akan membuktikan bahwa fungsi itu setara dengan dirinya
   sendiri. */

function susunAturan(seed) {
  return [...seed]
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      kategori: r.kategori,
      when: r.when_patterns.map((p) => new RegExp(p, "i")),
      also: r.also_pattern ? new RegExp(r.also_pattern, "i") : null,
      unless: [],
    }));
}

function periksaDariTabel(aturan, pesan) {
  const teks = String(pesan ?? "");
  if (!teks.trim()) return null;
  for (const a of aturan) {
    if (a.unless.some((p) => p.test(teks))) continue;
    if (a.also && !a.also.test(teks)) continue;
    const kena = a.when.find((p) => p.test(teks));
    if (!kena) continue;
    return { kategori: a.kategori, cocok: (teks.match(kena) ?? [""])[0] };
  }
  return null;
}

/* ===========================================================
   3. Korpus — pesan beserta kategori yang DIHARAPKAN
   ===========================================================
   Tiap pesan diberi kategori yang seharusnya, bukan sekadar
   dibandingkan antara dua jalan. Alasannya: kalau keduanya sama-
   sama salah — misalnya seed disalin dari daftar kode yang memang
   sudah keliru — uji kesetaraan saja akan lulus dengan tenang.

   Kelompok `null` sama pentingnya dengan yang lain. Bahaya
   terbesar fitur ini bukan kata yang kurang, melainkan satu kata
   terlalu umum yang diam-diam melempar pertanyaan biasa ke CS
   manusia. */

const KORPUS = Object.entries({
  refund_retur: [
    "kak mau refund dong", "saya mau retur barangnya", "minta pengembalian dana",
    "uang kembali gimana caranya", "tolong balikin uang saya", "kembalikan uang saya",
    "minta kompensasi dong", "ini ganti rugi nya gimana", "minta penggantian",
    "bisa tukar barang?", "mau tuker barang", "mau batalin pesanan",
    "batalkan saja", "cancel order saya", "batal aja deh",
  ],
  barang_bermasalah: [
    "barangnya rusak pas sampe", "botolnya pecah", "bocor semua isinya",
    "kardusnya penyok", "bungkusnya sobek", "plastiknya robek",
    "kak salah kirim produknya", "beda barang sama yang dipesan",
    "ini bukan yang saya pesan", "paketnya tidak pernah sampai",
    "nggak pernah sampai sampai sekarang", "gak pernah sampai",
    "barang hilang di jalan", "paket hilang", "isinya kurang",
    "barangnya kurang", "pesanannya kurang", "kurang satu botol",
    "kurang 2 pcs", "kurang tiga sachet",
  ],
  sengketa: [
    "ini penipuan ya", "jangan nipu pembeli", "menipu banget",
    "saya ditipu", "tipu-tipu nih", "saya mau lapor",
    "akan saya laporkan", "siapkan somasi", "saya tuntut ya",
    "saya bawa pengacara", "saya lapor polisi", "saya adukan ke ylki",
    "saya kasih bintang 1", "kasih rating satu", "saya tulis ulasan buruk",
    "review jelek nanti",
  ],
  keamanan: [
    "apa ini bisa keracunan", "produknya beracun ya", "beracunkah ini",
    "racunnya kuat gak", "anak saya tertelan", "termakan sedikit",
    "kena mata gimana", "kalau terhirup bahaya?", "aman untuk bayi?",
    "ada balita di rumah", "punya anak kecil", "aman buat kucing?",
    "anjing saya jilat", "aman buat hewan peliharaan", "buat ternak aman?",
    "sayurnya aman dimakan nggak kalau habis disemprot",
    "aman konsumsi?", "boleh dimakan langsung?", "langsung dimakan bisa?",
    "hasil panen aman?",
  ],
  // Hanya berlaku bersama sebab-akibat di also_pattern. Pasangan
  // tanpa sebab-akibat ("tanaman saya layu kenapa ya") ada di
  // kelompok null di bawah — itulah yang membuktikan also bekerja.
  tanaman_rusak: [
    "tanaman saya mati setelah dipakai", "daunnya layu sesudah disemprot",
    "gosong habis disiram", "terbakar gara-gara dikasih ini",
    "kering gegara pakai produk ini", "rontok karena disemprot",
    "batangnya mati abis dipake",
  ],
  minta_manusia: [
    "saya mau bicara dengan cs", "mau ngomong sama admin",
    "chat dengan manusia dong", "hubungi petugas", "sambungkan ke cs",
    "mau bicara sama orang asli", "ini bot ya?", "ini robot?",
    "ini ai kan", "bukan bot kan", "jangan bot dong",
    "cs nya mana", "admin nya mana", "adminnya mana",
  ],
  luar_marketplace: [
    "bisa transfer langsung?", "nomor rekening berapa", "no rek nya dong",
    "norek nya", "pakai dana bisa?", "gopay aja", "bayar ovo",
    "shopeepay ya", "ada wa?", "whatsapp nya berapa", "wa-me dong",
    "nomor hp nya", "no hp admin", "telegram ada?", "line id nya",
    "beli di luar bisa?", "order langsung ke toko", "pesan di luar aja",
  ],
  // Wajib LOLOS. "pesanan saya belum sampai" sengaja ada di sini:
  // "belum sampai" memang tidak ditangkap satpam, karena itu
  // pertanyaan pelacakan biasa yang jumlahnya paling banyak.
  null: [
    "dosis npk berapa ml per liter", "cara pakai miracle powder gimana",
    "produk untuk cabai apa ya", "kapan waktu terbaik menyemprot",
    "bisa dipakai untuk hidroponik?", "tanaman saya layu kenapa ya",
    "daunnya menguning", "berapa lama pengiriman ke surabaya",
    "stok masih ada?", "ada promo hari ini?", "buka jam berapa",
    "cocok untuk tanaman hias?", "media tanam apa yang bagus",
    "kok belum dikirim ya", "pesanan saya belum sampai",
    "terima kasih kak", "oke siap", "mantap produknya",
  ],
}).flatMap(([kategori, pesan]) =>
  pesan.map((p) => ({ pesan: p, harusnya: kategori === "null" ? null : kategori })),
);

/* ===========================================================
   4. Jalankan
   =========================================================== */

let gagal = 0;
const laporGagal = (judul, rincian) => {
  gagal++;
  console.log(`  GAGAL  ${judul}`);
  if (rincian) console.log(`         ${rincian}`);
};

console.log("\n=== UJI SEED SATPAM (tanpa database, tanpa biaya) ===\n");

const seed = bacaSeed();
const aturan = susunAturan(seed);

// --- 4a. Bentuk seed ---
console.log(`1. Bentuk seed — ${seed.length} aturan terbaca`);

const prioritas = seed.map((r) => r.priority);
if (new Set(prioritas).size !== prioritas.length) {
  laporGagal("priority tidak unik", "UNIQUE di tabel akan menolak seed ini");
}
if (prioritas.some((p) => !Number.isInteger(p) || p <= 0)) {
  laporGagal("ada priority yang bukan bilangan bulat positif");
}
for (const r of seed) {
  if (!r.when_patterns?.length) laporGagal(`[${r.kategori}] aturan tanpa pola`);
  if (!r.why) laporGagal(`[${r.kategori}] why kosong — kolomnya NOT NULL`);
  if (r.is_bawaan !== true) {
    laporGagal(`[${r.kategori}] priority ${r.priority} tidak ditandai is_bawaan`);
  }
  for (const p of r.when_patterns) {
    try { new RegExp(p, "i"); } catch (e) {
      laporGagal(`[${r.kategori}] pola tidak sah`, `${p} -> ${e.message}`);
    }
  }
  if (r.also_pattern) {
    try { new RegExp(r.also_pattern, "i"); } catch (e) {
      laporGagal(`[${r.kategori}] also_pattern tidak sah`, e.message);
    }
  }
}

// --- 4a2. ON CONFLICT tidak boleh kembali ke seed aturan ---
//
// Migrasi pertama gagal karena seed memakai
// `on conflict (priority) do nothing`, sementara
// satpam_rules_priority_key sengaja DEFERRABLE:
//
//   ERROR 55000: ON CONFLICT does not support deferrable unique
//   constraints/exclusion constraints as arbiters
//
// Bentuk WHERE NOT EXISTS yang menggantikannya terlihat lebih
// bertele-tele, jadi ia mengundang orang untuk "merapikannya"
// kembali. Kasus ini menahan itu — dan menahannya di sini, bukan
// nanti saat migrasi dijalankan orang lain di depan layar Supabase.
{
  const sqlSeed = readFileSync(BERKAS_SQL, "utf8");
  const blokInsert = sqlSeed.slice(sqlSeed.indexOf("insert into public.satpam_rules"));
  // Baris komentar dibuang dulu: penjelasan galatnya memang MEMUAT
  // kalimat "on conflict (priority)", dan itu bukan pelanggaran.
  const tanpaKomentar = blokInsert
    .split("\n")
    .filter((b) => !b.trimStart().startsWith("--"))
    .join("\n");

  if (/on\s+conflict\s*\(\s*priority\s*\)/i.test(tanpaKomentar)) {
    laporGagal(
      "seed aturan memakai ON CONFLICT (priority)",
      "constraint itu DEFERRABLE — PostgreSQL menolaknya sebagai penengah (55000). Pakai WHERE NOT EXISTS.",
    );
  }
  if (!/where not exists/i.test(tanpaKomentar)) {
    laporGagal(
      "seed aturan tidak lagi idempoten",
      "tanpa WHERE NOT EXISTS, menjalankan ulang berkas ini menggandakan 21 aturan bawaan",
    );
  }
}

// --- 4b. Kategori seed harus ada di seed satpam_kategori ---
const sqlMentah = readFileSync(BERKAS_SQL, "utf8");
const blokKategori = sqlMentah.slice(
  sqlMentah.indexOf("insert into public.satpam_kategori"),
  sqlMentah.indexOf("on conflict (slug)"),
);
for (const r of seed) {
  if (!blokKategori.includes(`'${r.kategori}'`)) {
    laporGagal(
      `kategori "${r.kategori}" tidak ada di seed satpam_kategori`,
      "foreign key akan menolak seed ini saat dijalankan",
    );
  }
}

// --- 4c. Invarian frasa -> pola ---
console.log("2. Invarian: frasa terisi => when_patterns = buatPolaDariFrasa(frasa)");
let berfrasa = 0;
for (const r of seed) {
  if (!r.frasa) continue;
  berfrasa++;
  const harusnya = buatPolaDariFrasa(r.frasa);
  if (r.when_patterns.length !== 1 || r.when_patterns[0] !== harusnya) {
    laporGagal(
      `[${r.kategori}] priority ${r.priority} melanggar invarian`,
      `seed: ${r.when_patterns[0]}\n         hitung: ${harusnya}`,
    );
  }
}
console.log(`   ${berfrasa} aturan ber-frasa, ${seed.length - berfrasa} aturan pola tangan`);

// --- 4d. Kategori yang benar, di kedua jalan ---
console.log(`3. Kategori yang benar atas ${KORPUS.length} pesan`);
let dicegat = 0;
for (const { pesan, harusnya } of KORPUS) {
  const kode = periksaSatpam(pesan)?.kategori ?? null;
  const tabel = periksaDariTabel(aturan, pesan)?.kategori ?? null;
  const nama = (k) => k ?? "(lolos)";
  if (harusnya) dicegat++;

  if (kode !== tabel) {
    laporGagal(`"${pesan}" — kode dan tabel berbeda`, `kode: ${nama(kode)} | tabel: ${nama(tabel)}`);
    continue;
  }
  if (kode !== harusnya) {
    laporGagal(`"${pesan}" — kategori meleset`, `harusnya: ${nama(harusnya)} | dapat: ${nama(kode)}`);
  }
}
console.log(`   ${dicegat} wajib dicegat, ${KORPUS.length - dicegat} wajib lolos — cocok di kedua jalan`);

// --- 4e. Perbedaan yang DISENGAJA: spasi ganda ---
// buatPolaDariFrasa() menyusun \s+, bukan spasi tunggal. Baris ini
// bukan sekadar mencatat perbedaannya — ia menuntut perbedaan itu
// ADA. Kalau suatu hari seseorang "merapikan" seed menjadi spasi
// tunggal, pengamannya menyempit diam-diam dan uji ini berhenti.
console.log("4. Perbedaan yang disengaja: frasa ber-spasi jadi \\s+");
const UJI_SPASI = ["minta uang  kembali", "ini  ganti  rugi nya", "paket  hilang"];
for (const pesan of UJI_SPASI) {
  const kode = periksaSatpam(pesan);
  const tabel = periksaDariTabel(aturan, pesan);
  if (kode) {
    laporGagal(`"${pesan}"`, "daftar di kode ternyata sudah menangkapnya — catatan di schema-satpam.sql perlu diperbarui");
  } else if (!tabel) {
    laporGagal(`"${pesan}"`, "seed TIDAK menangkap spasi ganda — \\s+ hilang dari pola");
  }
}
console.log(`   ${UJI_SPASI.length} pesan berspasi ganda: lolos di kode, tertangkap di tabel`);

console.log(
  gagal === 0
    ? "\nSEMUA LULUS — seed setara dengan daftar SATPAM di router.js\n"
    : `\n${gagal} GAGAL\n`,
);
process.exit(gagal === 0 ? 0 : 1);
