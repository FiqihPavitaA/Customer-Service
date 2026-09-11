/* ===========================================================
   Apakah gerbang jadwal siap dipakai /api/chat?

     npm run periksa-jadwal

   BIAYA Rp 0. Hanya membaca Supabase; tidak menulis apa pun, dan
   tidak menyentuh Anthropic maupun Voyage.

   KENAPA SKRIP INI ADA

   Gerbang jadwal punya satu sifat yang membuatnya sulit dipercaya
   tanpa alat: SELURUH kegagalannya terlihat normal.

     jadwal-ai.sql belum jalan
       -> kolomnya tidak ada. Gerbang memakai bawaan "AI menjawab,
          tanpa jadwal" — persis seperti sebelum fitur ini ada, jadi
          tidak ada yang terlihat aneh.

     fungsi jadwal_ai() belum ada          <- paling mudah terlewat
       -> kolom sudah terisi, halaman Pengaturan menampilkannya,
          tetapi /api/chat memakai kunci anon yang TIDAK boleh
          membaca tabel settings. Jadwalnya tersimpan rapi dan tidak
          pernah berlaku sekali pun.

     jam tersimpan benar, tetapi dihitung dengan jam server
       -> jadwalnya berlaku tujuh jam meleset. Tidak ada galat;
          hanya AI yang diam di waktu yang salah.

   Yang ketiga tidak bisa dilihat dari database sama sekali — karena
   itu skrip ini ikut mencetak jam WIB yang sedang berlaku dan
   keputusan yang dihasilkannya sekarang.
   =========================================================== */

import { createClient } from "@supabase/supabase-js";

const { putusanAI, teksKeadaanAI, jamWib, hariWib } = await import("../lib/jadwalAi.ts");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("Kredensial Supabase belum terbaca dari web/.env.local.");
  process.exit(1);
}

const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

let siap = true;

/* -----------------------------------------------------------
   1. Fungsi jadwal_ai() — dipanggil PERSIS seperti /api/chat
   -----------------------------------------------------------
   Lewat kunci anon, bukan kunci pengguna. Membaca dengan hak yang
   lebih besar daripada yang dipakai sungguhan akan membuat skrip
   ini melaporkan "siap" untuk keadaan yang sebenarnya gagal. */
const { data, error } = await sb.rpc("jadwal_ai");

console.log("");
if (error) {
  siap = false;
  const belum = /does not exist|schema cache/i.test(error.message);
  console.log("1. jadwal_ai()           : GAGAL");
  console.log(`   ${error.message}`);
  console.log(
    belum
      ? "   -> Jalankan supabase/jadwal-ai.sql di SQL Editor.\n" +
          "      Selama belum, gerbang memakai bawaan: AI menjawab,\n" +
          "      tanpa jadwal. Tidak ada yang rusak, tetapi jadwal\n" +
          "      yang Anda simpan tidak akan pernah berlaku."
      : "   -> Periksa grant execute ke anon pada fungsi itu.",
  );
} else {
  const s = Array.isArray(data) ? data[0] : data;
  if (!s) {
    siap = false;
    console.log("1. jadwal_ai()           : ADA, tetapi nol baris");
    console.log("   -> Baris settings id=1 hilang. Jalankan supabase/schema.sql.");
  } else {
    console.log("1. jadwal_ai()           : ADA");
    console.log(`   ai_enabled            : ${s.ai_enabled}`);
    console.log(`   jadwal aktif          : ${s.ai_jadwal_aktif}`);
    console.log(
      `   jendela               : ${String(s.ai_jam_mulai).padStart(2, "0")}.00 - ` +
        `${String(s.ai_jam_selesai).padStart(2, "0")}.00 WIB`,
    );
    console.log(
      `   hari                  : ${(s.ai_hari ?? []).map((h) => HARI[h] ?? `?${h}`).join(", ")}`,
    );
    console.log(`   override sampai       : ${s.ai_override_sampai ?? "(tidak ada)"}`);

    /* --------------------------------------------------------
       2. Keputusan untuk SEKARANG
       --------------------------------------------------------
       Inilah bagian yang tidak bisa dilihat dari SQL Editor. Jam
       yang dicetak adalah jam WIB hasil perhitungan kode yang
       sungguhan — kalau angkanya tidak cocok dengan jam di dinding
       Anda, di situlah kesalahan tujuh jam akan terlihat. */
    const sekarang = new Date();
    const keputusan = putusanAI(
      {
        ai_enabled: s.ai_enabled !== false,
        ai_jadwal_aktif: s.ai_jadwal_aktif === true,
        ai_jam_mulai: Number(s.ai_jam_mulai),
        ai_jam_selesai: Number(s.ai_jam_selesai),
        ai_hari: Array.isArray(s.ai_hari) ? s.ai_hari.map(Number) : [],
        ai_override_sampai: s.ai_override_sampai ?? null,
        ai_override_nyala: s.ai_override_nyala !== false,
      },
      sekarang,
    );

    console.log("");
    console.log("2. Keputusan untuk SEKARANG");
    console.log(`   waktu server (UTC)    : ${sekarang.toISOString()}`);
    console.log(
      `   jam dinding WIB       : ${HARI[hariWib(sekarang)]}, ` +
        `${String(jamWib(sekarang)).padStart(2, "0")}.00`,
    );
    console.log(`   AI boleh menjawab     : ${keputusan.boleh ? "YA" : "TIDAK"}`);
    console.log(`   sebab                 : ${keputusan.sebab}`);
    console.log(`   yang dibaca tim CS    : ${teksKeadaanAI(keputusan)}`);

    if (!s.ai_jadwal_aktif) {
      console.log("");
      console.log("   Catatan: jadwal masih MATI, jadi kolom jam di atas belum");
      console.log("   berpengaruh sama sekali. Nyalakan dari header console.");
    }
  }
}

/* -----------------------------------------------------------
   3. Tabel settings dari sisi anon — HARUS ditolak
   -----------------------------------------------------------
   Seluruh maksud jadwal_ai() yang security definer adalah membuka
   KOLOM JADWALNYA tanpa membuka tabelnya. settings juga memuat
   ai_model dan escalation_keywords; tidak ada alasan anon bisa
   membacanya. ----------------------------------------------- */
const { data: tabel, error: galatTabel } = await sb.from("settings").select("id").limit(1);

console.log("");
if (galatTabel) {
  console.log("3. select settings (anon): ditolak — INI YANG BENAR");
} else if ((tabel ?? []).length > 0) {
  siap = false;
  console.log("3. select settings (anon): TERBACA — ini MASALAH KEAMANAN");
  console.log("   Cabut kebijakan RLS yang membuka select untuk anon.");
} else {
  console.log("3. select settings (anon): nol baris (wajar — RLS menahan)");
}

console.log(`\n${"-".repeat(60)}`);
if (siap) {
  console.log("Gerbang jadwal SIAP membaca dari tabel.");
} else {
  console.log("Gerbang jadwal BELUM siap. Ikuti petunjuk di atas.");
  process.exitCode = 1;
}
