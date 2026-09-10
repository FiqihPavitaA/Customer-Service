import { NextResponse } from "next/server";
import { catatHandover } from "@/lib/db/handoverServer";
import { siapkanSumberTemplate } from "@/lib/db/templatesServer";
import { kenaliMaksud, MODE_PENGENAL } from "@/lib/pengenal";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { perkiraanBiaya } from "@/lib/voyage";
import { cariToko, DAFTAR_TOKO, susunShopName } from "@/lib/toko";
import "@/lib/templates";
import { routeToCategory, teksHandover } from "@/content/knowledge-base/router.js";

/* ===========================================================
   /api/simulasi

     POST    berpura-pura ada pesan masuk dari pelanggan
     DELETE  bersihkan seluruh percakapan buatan simulasi

   UNTUK PERAGAAN, TAPI BUKAN SANDIWARA

   Godaannya adalah menyuntik baris lewat SQL Editor: percakapan dan
   eskalasinya langsung muncul di layar berkat Realtime, dan
   penontonnya percaya. Masalahnya, kalau ada yang bertanya "jadi
   AI-nya yang memutuskan itu?", jawaban jujurnya "bukan, SQL yang
   menaruhnya di sana". Peragaan yang runtuh oleh satu pertanyaan
   bukan peragaan yang layak dipakai.

   Endpoint ini menjalankan jalur yang sama dengan yang sungguhan:
   router yang sama, catatHandover() yang sama, kolom yang sama.
   Yang dipalsukan hanya ASAL pesannya — dan itu memang satu-satunya
   bagian yang belum ada, karena webhook marketplace belum dibangun.

   TIDAK MUNGKIN MEMANGGIL CLAUDE, DAN ITU BUKAN KEBETULAN

   Endpoint ini menjalankan Gerbang 0, template, dan Gerbang 2 —
   lalu BERHENTI. Pertanyaan yang tidak terjawab ketiganya tidak
   diteruskan ke Claude; percakapannya tetap dibuat, dengan
   pemberitahuan di panel saran AI bahwa gilirannya sekarang pada
   manusia.

   Percakapannya sengaja tetap dibuat. Pertanyaan yang tidak
   terjawab adalah kejadian nyata yang harus terlihat CS, bukan
   kejadian yang dihapus karena tidak enak dilihat.

   BIAYANYA TIDAK NOL, DAN ITU HARUS DISEBUT

   Gerbang 2 memanggil Voyage: sekitar Rp 0,003 per pesan yang lolos
   dari Gerbang 0 dan template. Kecil, tetapi bukan nol — dan
   menyebut "gratis" pada sesuatu yang menagih adalah cara tercepat
   kehilangan kepercayaan pada seluruh laporan biaya lain di proyek
   ini. Yang dijamin nol hanyalah Claude.

   Kuota gratis Voyage juga cuma 3 permintaan per menit. Mengklik
   beruntun saat demo akan kena HTTP 429; itu batas laju, bukan
   kerusakan.

   Setel VOYAGE_LOCK=1 (atau AI_TEST_LOCK=1) bila peragaan harus
   benar-benar nol rupiah — Gerbang 2 akan dilewati dan hasilnya
   sama dengan "tidak ketemu".

   HANYA HIDUP DI LUAR PRODUKSI

   Dijaga NODE_ENV, bukan env var tersendiri: env var yang harus
   diisi manual cepat atau lambat akan terisi di tempat yang salah.
   =========================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penanda percakapan buatan simulasi.
 *
 * Ditaruh di `customer_id`, bukan di kolom baru: kolomnya sudah ada,
 * tidak dipakai untuk apa pun yang bertabrakan, dan tidak menuntut
 * migrasi. Konsekuensinya awalan ini menjadi kontrak — mengubahnya
 * berarti percakapan simulasi lama berhenti bisa dihapus, dan tidak
 * ada layar yang akan memberi tahu.
 */
const AWALAN_SIMULASI = "sim_";

/* Toko diterima sebagai NAMA, bukan platform.
   Versi pertama endpoint ini hanya menerima platform dan menulis
   shop_name "infarm · Shopee" untuk semuanya — akibatnya seluruh
   chat simulasi menumpuk di satu toko, betapa pun berbedanya toko
   yang dipilih di layar pembeli. */
const TOKO_BAWAAN = DAFTAR_TOKO[1];

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Tidak tersedia." }, { status: 404 });
  }

  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Butuh sesi login. Simulasi menulis sebagai pengguna yang sedang masuk." },
      { status: 401 },
    );
  }

  let body: { teks?: unknown; nama?: unknown; toko?: unknown; foto?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  /* Peragaan "pelanggan mengirim foto".
     URL-nya karangan dan memang tidak akan memuat gambar apa pun —
     yang diperagakan bukan fotonya, melainkan KEPUTUSANNYA. Foto
     sungguhan baru ada setelah webhook marketplace dibangun. */
  const adaFoto = body.foto === true;

  const teks = typeof body.teks === "string" ? body.teks.trim() : "";
  if (!teks && !adaFoto) {
    return NextResponse.json(
      { error: 'Field "teks" wajib diisi, kecuali mengirim foto.' },
      { status: 400 },
    );
  }

  const nama = typeof body.nama === "string" && body.nama.trim() ? body.nama.trim() : "pelanggan.baru";

  /* Nama toko HARUS ada di daftar. Menerima nama bebas berarti chat
     simulasi bisa mendarat di toko yang tidak pernah muncul di panel
     kiri console — hilang tanpa jejak, dan tidak ada layar yang bisa
     menunjukkan ke mana perginya. */
  const toko =
    (typeof body.toko === "string" ? cariToko(body.toko.trim()) : undefined) ?? TOKO_BAWAAN;

  // Router memutuskan persis seperti pada /api/chat.
  await siapkanSumberTemplate();
  const keputusan = routeToCategory(teks);

  /* Keputusan router bertipe union: varian "ai" memang TIDAK punya
     teks, action, maupun kode — karena belum ada yang menjawab.
     Ditarik sekali di sini supaya penyempitan tipenya terjadi satu
     kali, bukan diulang di tiap pemakaian. */
  /* GERBANG -0.5 mendahului semuanya: lampiran mengalihkan ke CS
     tanpa memeriksa isinya, dan tanpa memedulikan apakah teksnya
     sebenarnya cocok template. `adaFoto` karena itu ikut mematikan
     kedua gerbang di bawah — bukan menimpanya belakangan, supaya
     Gerbang 2 tidak sempat memanggil Voyage untuk pesan yang sudah
     pasti dialihkan. */
  const adaJawabanTemplate =
    !adaFoto &&
    (keputusan.jenis === "handover" || keputusan.jenis === "template");
  const teksTemplate = adaJawabanTemplate ? keputusan.teks : null;
  const actionTemplate = adaJawabanTemplate ? keputusan.action : null;
  const kodeTemplate = adaJawabanTemplate ? keputusan.kode : null;

  /* ---------- Gerbang 2, kalau Gerbang 0 dan template meleset ----

     Inilah bagian yang paling layak diperagakan: kalimat yang
     kata-katanya sama sekali berbeda dari template mana pun, tetapi
     maksudnya sama, tetap ditemukan. Tidak ada aturan tertulis yang
     bisa menirunya.

     BERBAYAR, dan angkanya harus disebut. Sekitar Rp 0,003 per
     pesan. Bukan nol, hanya kecil — dan menyebut "gratis" pada
     sesuatu yang menagih adalah cara tercepat kehilangan kepercayaan
     pada seluruh laporan biaya lain di proyek ini.

     kenaliMaksud() tidak pernah melempar: bila Voyage terkunci,
     kuncinya kosong, atau Supabase bermasalah, hasilnya "lewat" dan
     alur di bawah memperlakukannya sama dengan tidak ketemu. */
  let pengenal: {
    jenis: string;
    skor?: number;
    kode?: string;
    contoh?: string;
    margin?: number | null;
    alasan?: string;
    token: number;
  } | null = null;
  let balasanPengenal: string | null = null;
  let kodePengenal: string | null = null;

  const perluGerbang2 = !adaFoto && !adaJawabanTemplate;
  if (perluGerbang2) {
    const kenal = await kenaliMaksud(teks);
    if (kenal.jenis === "lewat") {
      pengenal = { jenis: "lewat", alasan: kenal.alasan, token: kenal.token };
    } else {
      const juara = kenal.kandidat[0];
      pengenal = {
        jenis: kenal.jenis,
        skor: juara?.skor,
        kode: juara?.code,
        contoh: juara?.contoh,
        margin: kenal.margin,
        token: kenal.token,
      };
      /* Simulasi SELALU memakai hasil "yakin", walau /api/chat masih
         berjalan dalam mode bayangan. Bedanya dilaporkan apa adanya
         lewat `modeProduksi` di bawah, supaya peragaan tidak
         diam-diam menjanjikan perilaku yang belum menyala. */
      if (kenal.jenis === "yakin" && juara) {
        balasanPengenal = juara.body;
        kodePengenal = juara.code;
      }
    }
  }

  /* ---------- PENJAGA BIAYA ----------
     Sampai di sini artinya Gerbang 0, template, DAN Gerbang 2
     semuanya tidak menemukan jawaban. Di sistem sungguhan giliran
     Claude — dan justru di sinilah simulasi berhenti.

     Percakapannya TETAP DIBUAT. Itu disengaja: pertanyaan yang
     tidak terjawab adalah kejadian nyata yang harus terlihat CS,
     bukan kejadian yang dihapus karena tidak enak dilihat. Yang
     tidak terjadi hanya panggilan berbayarnya. */
  const diluarJangkauan = perluGerbang2 && !balasanPengenal;

  /* Lampiran memakai kalimat handover yang SAMA dengan Gerbang 0,
     lewat fungsi yang sama — bukan salinannya. */
  const balasanLampiran = adaFoto ? teksHandover() : null;

  const sekarang = new Date().toISOString();
  const id = crypto.randomUUID();

  const messages: Record<string, unknown>[] = [
    {
      role: "user",
      content: teks || "(mengirim foto tanpa keterangan)",
      timestamp: sekarang,
      ...(adaFoto
        ? {
            lampiran: [
              {
                url: "https://contoh.marketplace/foto-simulasi.jpg",
                jenis: "gambar",
                nama: "foto-pelanggan.jpg",
              },
            ],
          }
        : {}),
    },
  ];
  const balasan = balasanLampiran || teksTemplate || balasanPengenal;
  if (balasan) {
    messages.push({ role: "assistant", content: balasan, timestamp: sekarang });
  }

  const { data, error } = await sb
    .from("conversations")
    .insert({
      id,
      platform: toko.platform,
      customer_id: AWALAN_SIMULASI + id.slice(0, 8),
      customer_name: nama,
      shop_name: susunShopName(toko.nama, toko.platform),
      action: adaFoto ? "HANDOVER_TO_CS" : (actionTemplate ?? (balasanPengenal ? "AUTO_REPLY" : null)),
      template_code: kodeTemplate ?? kodePengenal,
      unread: true,
      messages,
      // Panel "saran AI" di halaman Chat. Untuk pertanyaan yang tidak
      // terjangkau, inilah pemberitahuan yang dilihat CS — dan
      // kalimatnya sengaja menyebut bahwa Claude TIDAK dipanggil,
      // bukan sekadar "sedang diproses". CS yang menunggu jawaban
      // yang tidak akan pernah datang lebih buruk daripada CS yang
      // tahu sejak awal bahwa gilirannya sekarang.
      ai_suggestion: diluarJangkauan
        ? "⏳ Di luar jangkauan Gerbang 0, template, dan Gerbang 2. " +
          "Di sistem sungguhan pertanyaan ini diteruskan ke Claude. " +
          "Pada peragaan ini Claude TIDAK dipanggil (penguncian saldo " +
          "aktif), jadi silakan dijawab manual."
        : null,
      created_at: sekarang,
      updated_at: sekarang,
      last_message_at: sekarang,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[simulasi] gagal membuat percakapan:", error.message);
    return NextResponse.json(
      { error: "Gagal membuat percakapan.", detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Database tidak menyimpan baris apa pun — umumnya RLS menolak." },
      { status: 403 },
    );
  }

  /* Jalur yang SAMA dengan /api/chat, bukan salinannya. Kalau
     catatHandover() berubah, peragaan ikut berubah — dan itulah
     yang membuat peragaan ini tetap jujur seiring waktu. */
  const perluHandover = adaFoto || actionTemplate === "HANDOVER_TO_CS";
  const handover =
    perluHandover
      ? await catatHandover(sb, {
          conversationId: id,
          sumber: adaFoto
            ? "lampiran"
            : keputusan.jenis === "handover"
              ? "satpam"
              : "template",
          kode: adaFoto ? null : kodeTemplate,
          kategori: adaFoto ? null : keputusan.kategori,
          pesan: teks || "(mengirim foto tanpa keterangan)",
          balasan: balasan,
        })
      : null;

  /* ---------- Kegagalan mencatat handover harus terdengar --------

     catatHandover() sengaja tidak pernah melempar: gagal mencatat
     lebih ringan daripada gagal membalas. Konsekuensinya, kalau
     pencatatan itu gagal, satu-satunya jejaknya ada di terminal
     server — dan orang yang sedang memperagakan justru sedang
     menatap peramban.

     Yang terlihat kemudian persis seperti yang dilaporkan pemilik
     proyek pada 10 Sep 2026: percakapannya tetap dibuat dan
     lencana "belum dibaca" tetap naik, tetapi antrean "Perlu CS"
     tidak pernah menampilkannya. Tidak ada satu pun kalimat di
     layar yang menyebut ada yang gagal.

     eskalasiBaru === false juga dihitung gagal DI SINI, walau di
     /api/chat artinya "sudah ada eskalasi terbuka". Percakapan ini
     baru dibuat sedetik yang lalu, jadi mustahil punya eskalasi
     lama — nilai false hanya bisa berarti insert-nya ditolak. */
  const peringatan = !perluHandover
    ? null
    : !handover
      ? "Percakapan dibuat, tetapi penandaan handover GAGAL — antrean " +
        "'Perlu CS' tidak akan menampilkannya. Alasannya tercetak di " +
        "terminal server (cari baris berawalan [handover])."
      : !handover.eskalasiBaru
        ? "Percakapan ditandai handover, tetapi barisnya GAGAL masuk " +
          "tabel escalations — tab 'Perlu CS' bekerja atas tabel itu, " +
          "jadi percakapan ini tidak akan muncul di sana. Alasannya " +
          "tercetak di terminal server (cari baris berawalan [handover])."
        : null;

  return NextResponse.json({
    ok: true,
    conversationId: id,
    nama,
    toko: toko.nama,
    peringatan,
    // Gerbang mana yang menjawab — inilah yang paling ingin dilihat
    // penonton, dan satu-satunya yang menjelaskan kenapa sebagian
    // pertanyaan gratis dan sebagian tidak.
    gerbang: adaFoto || keputusan.jenis === "handover"
      ? (adaFoto ? "-0.5 · Lampiran" : "0 · Satpam")
      : keputusan.jenis === "template"
        ? "1 · Penghafal"
        : balasanPengenal
          ? "2 · Pengenal (Voyage)"
          : "tidak ada",
    jenis: keputusan.jenis,
    action: adaFoto ? "HANDOVER_TO_CS" : (actionTemplate ?? (balasanPengenal ? "AUTO_REPLY" : null)),
    kode: kodeTemplate ?? kodePengenal,
    balasan: balasan ?? "",
    diluarJangkauan,
    pengenal,
    /* Mode Gerbang 2 di /api/chat, dilaporkan apa adanya. Simulasi
       memakai hasilnya walau produksi masih 'bayangan' — tanpa baris
       ini, peragaan diam-diam menjanjikan perilaku yang belum
       menyala di jalur sungguhan. */
    modeProduksi: MODE_PENGENAL,
    handover,
    biaya: pengenal
      ? `Voyage ${pengenal.token} token ≈ Rp ${(perkiraanBiaya(pengenal.token).usd * 16500).toFixed(3)} · Claude tidak dipanggil`
      : "Rp 0 — Claude maupun Voyage tidak dipanggil",
  });
}

/* ===========================================================
   DELETE /api/simulasi — bersihkan percakapan buatan simulasi.

   KENAPA PERLU ADA

   Mencoba peragaan beberapa kali meninggalkan belasan percakapan
   karangan di daftar, bercampur dengan yang sungguhan. Layar yang
   kotor bukan sekadar tidak enak dilihat: angka Beranda dan
   Statistik ikut menghitungnya, dan itu persis masalah "angka
   karangan bercampur angka nyata" yang baru diperbaiki di commit
   f89ee86.

   YANG DIHAPUS, DAN YANG TIDAK

   HANYA percakapan yang customer_id-nya berawalan "sim_", yaitu
   yang dibuat POST di atas. Yang TIDAK ikut terhapus:

     - percakapan sungguhan dari pelanggan
     - data contoh bawaan (seed-demo.sql)
     - data peragaan handover (demo-handover.sql, id d0000000…)

   Yang terakhir sengaja dikecualikan. Berkas itu disiapkan dengan
   waktu tunggu yang diatur khusus untuk demo; menghapusnya lewat
   tombol yang sama berarti satu klik keliru menghancurkan
   persiapan setengah jam sebelum demo dimulai. Pembersihannya ada
   di bagian akhir demo-handover.sql, terpisah dan disengaja.

   Eskalasi ikut terhapus sendiri lewat `on delete cascade` pada
   escalations.conversation_id — tidak perlu dihapus terpisah, dan
   menghapusnya terpisah justru membuka celah gagal separuh jalan.
   =========================================================== */

export async function DELETE(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Tidak tersedia." }, { status: 404 });
  }

  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Butuh sesi login. Penghapusan berjalan sebagai pengguna yang sedang masuk." },
      { status: 401 },
    );
  }

  const { data, error } = await sb
    .from("conversations")
    .delete()
    .like("customer_id", `${AWALAN_SIMULASI}%`)
    .select("id");

  if (error) {
    console.error("[simulasi] gagal menghapus:", error.message);
    return NextResponse.json(
      { error: "Gagal menghapus percakapan simulasi.", detail: error.message },
      { status: 500 },
    );
  }

  const jumlah = data?.length ?? 0;
  console.log(`[simulasi] ${jumlah} percakapan simulasi dihapus.`);

  return NextResponse.json({
    ok: true,
    dihapus: jumlah,
    // Dibalikkan apa adanya supaya sisi peramban tidak perlu menebak
    // apa yang barusan terjadi bila jumlahnya nol — nol bisa berarti
    // "memang tidak ada" ATAU "RLS menolak diam-diam", dan keduanya
    // menuntut tindakan yang berbeda.
    catatan:
      jumlah === 0
        ? "Tidak ada percakapan simulasi untuk dihapus. Kalau Anda yakin ada, " +
          "periksa apakah RLS menolak — penghapusan berjalan sebagai pengguna yang login."
        : null,
  });
}
