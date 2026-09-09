/* ===========================================================
   Periksa apakah tabel template sudah siap dipakai router.

     npm run periksa-sumber

   BIAYA Rp 0. Hanya membaca Supabase; tidak menyentuh Anthropic
   maupun Voyage sama sekali.

   KENAPA SKRIP INI ADA

   Menyalakan sumber tabel butuh TIGA berkas SQL dijalankan
   berurutan, dan kegagalan di tiap langkah punya gejala yang
   berbeda — tetapi tidak satu pun berbunyi seperti galat:

     schema-kb.sql belum jalan
       -> tabelnya tidak ada. Halaman Kelola Template menolak
          menyimpan, tetapi pesannya datang dari Postgres dan
          berbicara tentang relasi, bukan tentang berkas SQL.

     seed-templates.sql belum jalan
       -> tabel ada tapi kosong. Router diam-diam kembali ke
          berkas .md dan semuanya tampak normal.

     schema-templates-baca.sql belum jalan   <- paling sering
       -> halaman Kelola Template berubah hijau "Sumber: tabel",
          penyimpanan berhasil, tetapi PELANGGAN TETAP DIJAWAB
          isi berkas .md. Tidak ada satu pun pesan galat yang
          menjelaskannya.

   Yang ketiga itulah alasan utama berkas ini ditulis: satu-satunya
   cara melihatnya tanpa skrip adalah menyadari bahwa balasan yang
   diterima bukan yang baru disunting.
   =========================================================== */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("Kredensial Supabase belum terbaca dari web/.env.local.");
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const ref = /^https?:\/\/([^.]+)\./.exec(URL)?.[1] ?? "?";
console.log(`Proyek Supabase : ${ref}`);
console.log(
  "Pastikan ref ini SAMA dengan yang terbuka di dashboard Anda — kalau\n" +
    "berbeda, semua gejalanya menyerupai masalah izin.\n",
);

/* Dicari khusus bila disebut di argumen, mis:
     npm run periksa-sumber -- "BENIH MELON"                     */
const dicari = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

let siap = true;

/* -----------------------------------------------------------
   1. Fungsi pustaka_router() — schema-templates-baca.sql
   ----------------------------------------------------------- */
const { data: baris, error: galatFn } = await sb.rpc("pustaka_router");

if (galatFn) {
  siap = false;
  const hilang = /does not exist|schema cache/i.test(galatFn.message);
  console.log("1. pustaka_router()      : GAGAL");
  console.log(`   ${galatFn.message}`);
  console.log(
    hilang
      ? "   -> Jalankan supabase/schema-templates-baca.sql di SQL Editor."
      : "   -> Periksa hak akses; jalankan supabase/grants.sql bila perlu.",
  );
} else {
  const semua = baris ?? [];
  const kode = [...new Set(semua.map((b) => b.code))];
  const berpemicu = new Set(
    semua.filter((b) => b.priority !== null).map((b) => b.code),
  );

  console.log(`1. pustaka_router()      : ADA`);
  console.log(`   template terbaca      : ${kode.length}`);
  console.log(`   punya pemicu          : ${berpemicu.size}`);
  console.log(`   tanpa pemicu          : ${kode.length - berpemicu.size}`);

  if (kode.length === 0) {
    siap = false;
    console.log(
      "   -> Tabel `templates` masih kosong. Jalankan\n" +
        "      supabase/seed-templates.sql. Selama kosong, router tetap\n" +
        "      membaca berkas .md dan itu memang disengaja.",
    );
  }

  for (const q of dicari) {
    const cocok = kode.filter((k) => k.toLowerCase().includes(q.toLowerCase()));
    console.log(
      `\n   cari "${q}" : ${cocok.length ? cocok.map((c) => `[${c}]`).join(", ") : "TIDAK DITEMUKAN"}`,
    );
    if (!cocok.length) {
      console.log(
        "   Catatan: pustaka_router() hanya mengembalikan template yang\n" +
          "   AKTIF, TIDAK sensitif, dan masih dalam masa berlaku. Template\n" +
          "   yang sudah tersimpan tetapi is_active=false tidak akan muncul\n" +
          "   di sini — periksa langsung di SQL Editor untuk memastikan.",
      );
    }
  }
}

/* -----------------------------------------------------------
   1b. Kesehatan vektor Gerbang 2
   -----------------------------------------------------------
   Yang dijaga di sini bukan "ada vektornya atau tidak", melainkan
   apakah semuanya masih SATU SKALA. Vektor dari model berbeda, atau
   dari input_type berbeda, tidak bisa dibandingkan satu sama lain —
   dan campurannya tidak pernah muncul sebagai galat, hanya sebagai
   skor yang aneh. ----------------------------------------------- */
const { data: vek, error: galatVek } = await sb.rpc("periksa_vektor");

console.log("");
if (galatVek) {
  const belum = /does not exist|schema cache/i.test(galatVek.message);
  console.log(`1b. periksa_vektor()     : ${belum ? "BELUM ADA" : "GAGAL"}`);
  console.log(`   ${galatVek.message}`);
  if (belum) {
    console.log("   -> Jalankan supabase/tambah-input-type.sql di SQL Editor.");
    console.log(
      "      Tanpa itu, vektor yang bercampur dua skala tidak bisa\n" +
        "      dideteksi sama sekali.",
    );
  }
} else {
  const v = (vek ?? [])[0] ?? {};
  console.log(`1b. Kesehatan vektor     :`);
  console.log(`   contoh total          : ${v.total ?? 0}`);
  console.log(`   sudah bervektor       : ${v.bervektor ?? 0}`);
  console.log(`   belum bervektor       : ${v.belum_bervektor ?? 0}`);
  console.log(`   model dipakai         : ${v.daftar_model ?? "-"}`);
  console.log(`   skala (input_type)    : ${v.daftar_skala ?? "-"}`);

  if ((v.jumlah_model ?? 0) > 1) {
    siap = false;
    console.log(
      "\n   ⛔ LEBIH DARI SATU MODEL. Vektornya tidak bisa dibandingkan.\n" +
        "      Bangun ulang SELURUHNYA — sebagian justru itulah masalahnya.",
    );
  }
  if ((v.jumlah_skala ?? 0) > 1) {
    siap = false;
    console.log(
      "\n   ⛔ LEBIH DARI SATU SKALA input_type. Vektor 'document' dan\n" +
        "      'query' dikalibrasi pada rentang yang berbeda, jadi skornya\n" +
        "      tidak sebanding. Ini TIDAK akan muncul sebagai galat.\n" +
        "      Kosongkan embedding lalu bangun ulang seluruhnya.",
    );
  }
  if ((v.belum_bervektor ?? 0) > 0) {
    console.log(
      `\n   ⚠️  ${v.belum_bervektor} contoh belum punya vektor — belum berpengaruh\n` +
        "      sama sekali. Bangun lewat tombol di halaman Kelola Template.",
    );
  }
}

/* -----------------------------------------------------------
   2. Tabel templates dari sisi anon — HARUS ditolak
   ----------------------------------------------------------- */
const { data: tabel, error: galatTabel } = await sb
  .from("templates")
  .select("code")
  .limit(3);

console.log("");
if (galatTabel) {
  console.log("2. select templates (anon): ditolak — INI YANG BENAR");
  console.log(`   ${galatTabel.message}`);
} else if ((tabel ?? []).length > 0) {
  siap = false;
  console.log("2. select templates (anon): TERBACA — ini MASALAH KEAMANAN");
  console.log(
    "   Anon seharusnya tidak bisa membaca tabel ini sama sekali.\n" +
      "   Ada kebijakan RLS tambahan yang membuka select untuk anon —\n" +
      "   artinya [REKENING], [CS WA], dan [CS KOMPLAIN] ikut terbuka\n" +
      "   bagi siapa pun yang memegang anon key. Cabut kebijakan itu.",
  );
} else {
  console.log("2. select templates (anon): nol baris (wajar — RLS menahan)");
}

/* -----------------------------------------------------------
   Kesimpulan
   ----------------------------------------------------------- */
console.log(`\n${"-".repeat(60)}`);
if (siap) {
  console.log("Router SIAP membaca dari tabel templates.");
  console.log("Pastikan juga /api/health menyebut sumberTemplate.sumber = supabase.");
} else {
  console.log("Router MASIH memakai berkas .md. Ikuti petunjuk di atas.");
  process.exitCode = 1;
}
