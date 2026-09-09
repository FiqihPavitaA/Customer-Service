/* ===========================================================
   Bangun vektor untuk contoh pertanyaan yang belum punya.

     POST /api/pengenal/bangun            -> PERKIRAAN saja, Rp 0
     POST /api/pengenal/bangun {jalankan} -> BENAR-BENAR memanggil Voyage

   ⛔ INI SATU-SATUNYA ENDPOINT DI HALAMAN PENGATURAN YANG MEMOTONG
      SALDO. Bacalah bagian ini sebelum mengubah apa pun di sini.

   TIGA LAPIS PENGAMAN, DAN KETIGANYA MEMANG PERLU

   1. Bawaannya PERKIRAAN. `jalankan` harus dikirim eksplisit.
      Memanggil endpoint ini secara polos tidak boleh memotong saldo
      sepeser pun — izin diberikan lewat tindakan yang sadar, bukan
      lewat kelalaian.

   2. Hanya ADMIN. Menulis contoh pertanyaan sengaja terbuka untuk
      seluruh tim CS (lihat /api/templates/contoh), karena yang paling
      tahu bahasa pelanggan adalah yang membalas chat setiap hari.
      Tetapi MEMBELANJAKAN saldo adalah hal lain. Dua kewenangan yang
      berbeda, dipisah dengan sengaja.

   3. AI_TEST_LOCK / VOYAGE_LOCK tetap berlaku dan diperiksa paling
      akhir, di sisi server, apa pun yang dikirim peramban.

   KENAPA TIDAK OTOMATIS SAAT CONTOH DISIMPAN

   Terasa lebih rapi, dan itu justru jebakannya: tim CS mengetik
   sepuluh contoh sambil memperbaiki kalimatnya, dan tiap simpan
   memotong saldo tanpa satu pun angka terlihat. Menumpuknya lalu
   membangun sekali jauh lebih murah — satu permintaan memuat sampai
   128 teks — dan yang lebih penting, biayanya terlihat sebelum
   dikeluarkan.
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import {
  embed,
  kiraToken,
  perkiraanBiaya,
  VOYAGE_MODEL,
  voyageSiap,
  voyageTerkunci,
} from "@/lib/voyage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Menunggu antar-batch bisa mencapai puluhan detik saat kena batas
// laju Voyage. Bawaan Vercel 10 detik akan memutusnya di tengah.
export const maxDuration = 120;

/**
 * Sekali bangun dibatasi supaya tidak ada permintaan yang menggantung.
 *
 * 256 = dua batch (128 per permintaan Voyage). Angkanya diturunkan
 * dari 500 pada 8 September 2026 setelah kena HTTP 429 sungguhan:
 * akun Voyage tanpa metode pembayaran dibatasi 3 PERMINTAAN PER
 * MENIT. Empat batch berarti menunggu 63 detik di dalam satu
 * permintaan HTTP — cukup lama untuk kena batas waktu serverless dan
 * gagal setelah sebagian vektor terlanjur ditulis.
 *
 * Dengan 256, sekali tekan paling lama menunggu ~21 detik. Sisanya
 * dilaporkan lewat `sisa` supaya Admin tahu harus menekan lagi, bukan
 * mengira sudah selesai.
 */
const BATAS_SEKALI = 256;

/** Skala penyematan contoh tersimpan. Lihat catatan panjang di bawah. */
const JENIS_SIMPAN = "query";

type BarisKosong = {
  id: string;
  teks: string;
  template_id: string;
};

export async function POST(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Belum login, atau Supabase belum dikonfigurasi." },
      { status: 401 },
    );
  }

  let badan: { jalankan?: unknown } = {};
  try {
    badan = (await req.json()) as typeof badan;
  } catch {
    // Body kosong sah — artinya mode perkiraan.
  }
  const jalankan = badan.jalankan === true;

  /* ---------- Daftar kerja ---------- */
  // count: "exact" supaya sisa antrean bisa dilaporkan tanpa
  // permintaan kedua — Admin perlu tahu apakah masih harus menekan
  // lagi, bukan mengira sudah selesai.
  const { data, error, count } = await sb
    .from("template_examples")
    .select("id, teks, template_id", { count: "exact" })
    .is("embedding", null)
    .order("created_at", { ascending: true })
    .limit(BATAS_SEKALI);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const antre = (data ?? []) as BarisKosong[];
  const token = kiraToken(antre.map((b) => b.teks));
  const biaya = perkiraanBiaya(token);

  const perkiraan = {
    model: VOYAGE_MODEL,
    contoh: antre.length,
    permintaan: Math.max(1, Math.ceil(antre.length / 128)),
    token,
    usd: biaya.usd,
    idr: biaya.idr,
  };

  if (antre.length === 0) {
    return NextResponse.json({
      jalan: false,
      perkiraan,
      pesan: "Semua contoh sudah punya vektor. Tidak ada yang perlu dibangun.",
    });
  }

  /* ---------- Mode perkiraan: berhenti di sini ---------- */
  if (!jalankan) {
    return NextResponse.json({
      jalan: false,
      perkiraan,
      pesan:
        `${antre.length} contoh belum punya vektor. Perkiraan biaya ` +
        `Rp ${biaya.idr.toFixed(4)} (${token} token). Kirim ulang dengan ` +
        `jalankan:true untuk benar-benar membangunnya.`,
    });
  }

  /* ---------- Pengaman 2: hanya admin ---------- */
  const { data: adminData, error: galatAdmin } = await sb.rpc("is_admin");
  if (galatAdmin) {
    return NextResponse.json(
      {
        error:
          `Tidak bisa memastikan peran: ${galatAdmin.message}. ` +
          `Panggilan berbayar ditolak karena ragu lebih aman daripada ` +
          `memotong saldo atas nama orang yang belum tentu berhak.`,
      },
      { status: 403 },
    );
  }
  if (adminData !== true) {
    return NextResponse.json(
      {
        error:
          "Hanya Admin yang boleh membangun vektor, karena langkah ini " +
          "memotong saldo Voyage. Menulis contoh pertanyaan tetap boleh " +
          "dilakukan seluruh tim CS.",
      },
      { status: 403 },
    );
  }

  /* ---------- Pengaman 3: kunci sisi server ---------- */
  if (voyageTerkunci()) {
    return NextResponse.json(
      {
        error:
          "AI_TEST_LOCK / VOYAGE_LOCK aktif — panggilan berbayar ditolak " +
          "sebelum dikirim. Hapus dari web/.env.local lalu jalankan ulang " +
          "server untuk membukanya.",
        terkunci: true,
        perkiraan,
      },
      { status: 423 },
    );
  }
  if (!voyageSiap()) {
    return NextResponse.json(
      { error: "VOYAGE_API_KEY belum diisi di web/.env.local.", perkiraan },
      { status: 503 },
    );
  }

  /* ---------- Panggil Voyage ---------- */
  let hasil;
  try {
    /* "query" DI KEDUA SISI — diubah dari "document" pada 9 September
       2026 setelah diukur, bukan ditebak.

       Penanda document/query dirancang untuk pencarian ASIMETRIS:
       pertanyaan pendek dicocokkan ke paragraf panjang berisi
       jawaban. Yang kita simpan bukan paragraf jawaban melainkan
       CONTOH PERTANYAAN — bentuknya sama dengan pesan yang masuk.
       Itu tugas simetris, jadi kedua sisi memakai penanda yang sama.

       Diukur `npm run uji-input-type`, 19 kalimat, Rp 0,13:

                                    query<->dok   query<->query
         juara benar                17/19         18/19
         margin BENAR median        0,173         0,318
         margin SALAH terbesar      0,061         0,051
         dijawab tanpa satu pun salah  12         17

       Yang membuktikan ini bukan sekadar pergeseran skala: margin
       jawaban BENAR naik hampir dua kali lipat sementara margin
       jawaban SALAH justru turun. Kalau semua angka hanya naik
       bersama, keduanya akan bergerak searah.

       Rinciannya di docs/hasil-uji-input-type.md, termasuk batas
       ketelitiannya: 19 kalimat itu karangan, bukan chat pelanggan.
       Wajib diukur ulang pada Tahap E. */
    hasil = await embed(
      antre.map((b) => b.teks),
      JENIS_SIMPAN,
      // Tidak ada pelanggan yang menunggu di sini, jadi kena batas
      // laju cukup ditunggu — jauh lebih baik daripada memaksa Admin
      // menekan tombolnya berkali-kali dan tidak pernah tahu berapa
      // yang sudah masuk.
      { ulangSaatPadat: true },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Voyage gagal: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  if (hasil.vektor.length !== antre.length) {
    // Menulis sebagian saat jumlahnya tidak cocok berarti menempelkan
    // vektor ke baris yang salah — kerusakan yang tidak akan terlihat
    // sebagai galat, hanya sebagai skor yang aneh selamanya.
    return NextResponse.json(
      {
        error:
          `Voyage mengembalikan ${hasil.vektor.length} vektor untuk ` +
          `${antre.length} contoh. Tidak ada yang ditulis — jumlah yang ` +
          `tidak cocok berarti pasangannya tidak bisa dipastikan.`,
      },
      { status: 502 },
    );
  }

  /* ---------- Tulis balik ---------- */
  const waktu = new Date().toISOString();
  let tersimpan = 0;
  const gagal: string[] = [];

  for (let i = 0; i < antre.length; i++) {
    const { error: galatTulis } = await sb
      .from("template_examples")
      .update({
        // pgvector menerima bentuk teks '[0.1,0.2,...]'.
        embedding: JSON.stringify(hasil.vektor[i]),
        embedding_model: VOYAGE_MODEL,
        // Skala vektor ikut dicatat. Tanpa ini, vektor "document" lama
        // dan "query" baru tidak bisa dibedakan sama sekali, dan
        // campurannya tidak pernah muncul sebagai galat.
        embedding_input_type: JENIS_SIMPAN,
        embedding_dibuat: waktu,
      })
      .eq("id", antre[i].id);

    if (galatTulis) gagal.push(`${antre[i].teks}: ${galatTulis.message}`);
    else tersimpan++;
  }

  const biayaNyata = perkiraanBiaya(hasil.token);
  const sisa = Math.max(0, (count ?? antre.length) - tersimpan);

  return NextResponse.json({
    jalan: true,
    tersimpan,
    sisa,
    gagal,
    perkiraan,
    nyata: {
      model: VOYAGE_MODEL,
      token: hasil.token,
      usd: biayaNyata.usd,
      idr: biayaNyata.idr,
    },
    pesan:
      `${tersimpan} contoh kini punya vektor. Biaya nyata ` +
      `Rp ${biayaNyata.idr.toFixed(4)} (${hasil.token} token).` +
      (gagal.length ? ` ${gagal.length} gagal ditulis.` : "") +
      (sisa > 0
        ? ` Masih ada ${sisa} yang antre — tekan sekali lagi untuk melanjutkan.`
        : ""),
  });
}
