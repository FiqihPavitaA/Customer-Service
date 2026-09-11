/* ===========================================================
   Jadwal & saklar AI — sumber penanda di header.

     GET    keadaan sekarang + pengaturannya
     PATCH  ubah jadwal, atau pasang/cabut override sementara

   SIAPA YANG BOLEH APA

   Membaca: semua yang sedang masuk. Itu seluruh maksud penanda di
   header — tim CS harus bisa MEMANTAU keadaan AI tanpa perlu hak
   apa pun.

   Menulis: admin, karena kebijakan `settings_write` memang berbunyi
   `using (public.is_admin())`. Yang menolak tetap database;
   pemeriksaan di berkas ini hanya supaya pesannya bisa dimengerti.

   KENAPA PATCH TIDAK MENERIMA SELURUH BARIS settings

   Tabel yang sama menyimpan ai_model dan escalation_keywords. Route
   ini hanya boleh menyentuh kolom jadwal; membiarkannya menulis
   bidang sembarang berarti satu salah ketik di header bisa
   mengganti model yang dipakai menjawab pelanggan.
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import {
  segarkanJadwalAI,
  siapkanJadwalAI,
  statusJadwalAI,
} from "@/lib/db/jadwalServer";
import {
  putusanAI,
  teksKeadaanAI,
  type PengaturanJadwal,
} from "@/lib/jadwalAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KOLOM =
  "ai_enabled, ai_jadwal_aktif, ai_jam_mulai, ai_jam_selesai, " +
  "ai_hari, ai_override_sampai, ai_override_nyala";

/**
 * Batas panjang override.
 *
 * Sengaja 12 jam, lebih pendek daripada jeda handover yang 24 jam.
 * Override adalah penyimpangan dari aturan — satu giliran kerja,
 * bukan satu kebiasaan baru. Yang butuh lebih lama dari itu
 * sebenarnya sedang mengubah jadwalnya, dan lebih baik melakukannya
 * secara terang-terangan.
 *
 * Batas ini juga yang menahan bentuk kegagalan paling mahal fitur
 * ini: AI dimatikan Jumat sore, tidak ada yang menyalakan, dan
 * seluruh akhir pekan berlalu tanpa satu pun pelanggan dijawab.
 */
const MAKS_OVERRIDE_JAM = 12;

/**
 * Baris dari PostgREST -> bentuk yang dipakai berkas ini.
 *
 * Lewat `unknown` karena KOLOM di atas sebuah konstanta, bukan
 * literal di tempat pemanggilan, sehingga supabase-js tidak bisa
 * menyimpulkan bentuk barisnya. Yang dipercaya di sini adalah
 * KOLOM — mengubahnya berarti memeriksa ulang rapikan().
 */
const sebagaiBaris = (b: unknown) => b as Record<string, unknown>;

const rapikan = (b: Record<string, unknown>): PengaturanJadwal => ({
  ai_enabled: b.ai_enabled !== false,
  ai_jadwal_aktif: b.ai_jadwal_aktif === true,
  ai_jam_mulai: Number(b.ai_jam_mulai),
  ai_jam_selesai: Number(b.ai_jam_selesai),
  ai_hari: Array.isArray(b.ai_hari) ? (b.ai_hari as unknown[]).map(Number) : [],
  ai_override_sampai: (b.ai_override_sampai as string | null) ?? null,
  ai_override_nyala: b.ai_override_nyala !== false,
});

function jawab(p: PengaturanJadwal) {
  const keputusan = putusanAI(p, new Date());
  return {
    pengaturan: p,
    keputusan,
    // Kalimatnya disusun SERVER, bukan komponen header. Dua tempat
    // yang menyusunnya sendiri-sendiri akan berselisih, dan
    // berselisih tentang "AI nyala atau mati" adalah hal terakhir
    // yang boleh terjadi di layar yang dipasang untuk memantaunya.
    teks: teksKeadaanAI(keputusan),
  };
}

function jelaskanGalat(pesan: string, kode?: string): string {
  if (/column .*ai_jadwal_aktif.* does not exist/i.test(pesan)) {
    return "Kolom jadwal belum ada. Jalankan supabase/jadwal-ai.sql di SQL Editor.";
  }
  if (kode === "23514" || /settings_ai_jam_check/i.test(pesan)) {
    return (
      "Jam tidak diterima database: harus 0-23, dan jam mulai tidak boleh " +
      "sama dengan jam selesai. Untuk mematikan AI sepanjang waktu, pakai " +
      "saklar induk — bukan jadwal."
    );
  }
  if (/settings_ai_hari_check/i.test(pesan)) {
    return "Hari harus 1-7 (Senin sampai Minggu), minimal satu hari.";
  }
  if (kode === "42501" || /permission denied/i.test(pesan)) {
    return "Ditolak database. Jalankan supabase/grants.sql di SQL Editor.";
  }
  return pesan;
}

/* ===========================================================
   GET
   =========================================================== */

export async function GET(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const { data, error } = await sb
    .from("settings")
    .select(KOLOM)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: jelaskanGalat(error.message, error.code) }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Baris settings id=1 tidak ada." }, { status: 500 });
  }

  /* Apakah GERBANGNYA benar-benar bisa membaca jadwal ini?

     Pertanyaan ini terpisah dari "apakah SAYA bisa membacanya", dan
     bedanya pernah menimbulkan kebingungan yang mahal pada 11 Sep
     2026. Route ini membaca settings dengan token pengguna yang
     sedang masuk — dan kebijakan settings_read memang mengizinkan
     `authenticated`. Tetapi /api/chat membacanya dengan kunci ANON,
     yang tidak diizinkan, dan karena itu bergantung sepenuhnya pada
     fungsi jadwal_ai().

     Selama fungsi itu belum ada, header akan menampilkan "AI mati"
     dengan yakin sementara pelanggan tetap dijawab. Tombol yang
     berbohong seperti itu lebih buruk daripada tidak ada tombol
     sama sekali, jadi keadaannya ikut dilaporkan dan header
     menampilkannya sebagai peringatan.

     Diperiksa lewat jalur yang SAMA dengan /api/chat — kunci anon,
     fungsi yang sama — bukan dengan menebak dari sini. */
  await siapkanJadwalAI();
  const gerbang = statusJadwalAI();

  return NextResponse.json(
    {
      ...jawab(rapikan(sebagaiBaris(data))),
      gerbang: { sumber: gerbang.sumber, alasan: gerbang.alasan },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/* ===========================================================
   PATCH
   =========================================================== */

export async function PATCH(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Belum login. Jadwal AI hanya bisa diubah Admin yang sedang masuk." },
      { status: 401 },
    );
  }
  const { data: sesi, error: galatSesi } = await sb.auth.getUser();
  if (galatSesi || !sesi?.user) {
    return NextResponse.json(
      { error: "Sesi tidak berlaku lagi. Masuk ulang lalu coba lagi." },
      { status: 401 },
    );
  }

  let body: {
    ai_enabled?: boolean;
    ai_jadwal_aktif?: boolean;
    ai_jam_mulai?: number;
    ai_jam_selesai?: number;
    ai_hari?: number[];
    /** Berapa jam override berlaku. 0 / null = cabut override. */
    override_jam?: number | null;
    /** Arah override: true = paksa nyala, false = paksa diam. */
    override_nyala?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Isi permintaan bukan JSON." }, { status: 400 });
  }

  const ubahan: Record<string, unknown> = { updated_by: sesi.user.id };

  if (typeof body.ai_enabled === "boolean") ubahan.ai_enabled = body.ai_enabled;
  if (typeof body.ai_jadwal_aktif === "boolean") ubahan.ai_jadwal_aktif = body.ai_jadwal_aktif;
  if (Number.isInteger(body.ai_jam_mulai)) ubahan.ai_jam_mulai = body.ai_jam_mulai;
  if (Number.isInteger(body.ai_jam_selesai)) ubahan.ai_jam_selesai = body.ai_jam_selesai;
  if (Array.isArray(body.ai_hari)) {
    const hari = [...new Set(body.ai_hari.map(Number))]
      .filter((h) => Number.isInteger(h) && h >= 1 && h <= 7)
      .sort((a, b) => a - b);
    if (!hari.length) {
      return NextResponse.json(
        { error: "Pilih minimal satu hari (1 = Senin sampai 7 = Minggu)." },
        { status: 400 },
      );
    }
    ubahan.ai_hari = hari;
  }

  if ("override_jam" in body) {
    const jam = body.override_jam;
    if (jam === null || jam === 0) {
      // Mencabut override. Ditulis sebagai null, bukan sebagai
      // waktu lampau: null berarti "tidak ada", dan itu yang
      // seharusnya terbaca orang yang memeriksa barisnya nanti.
      ubahan.ai_override_sampai = null;
    } else {
      const n = Number(jam);
      if (!Number.isFinite(n) || n <= 0 || n > MAKS_OVERRIDE_JAM) {
        return NextResponse.json(
          {
            error:
              `Override paling lama ${MAKS_OVERRIDE_JAM} jam. Yang butuh lebih ` +
              "lama sebenarnya sedang mengubah jadwal — lakukan itu secara " +
              "terang-terangan, supaya tidak ada yang lupa mengembalikannya.",
          },
          { status: 400 },
        );
      }
      ubahan.ai_override_sampai = new Date(Date.now() + n * 3_600_000).toISOString();
      ubahan.ai_override_nyala = body.override_nyala !== false;
    }
  }

  if (Object.keys(ubahan).length === 1) {
    return NextResponse.json({ error: "Tidak ada yang diubah." }, { status: 400 });
  }

  const { data, error } = await sb
    .from("settings")
    .update(ubahan)
    .eq("id", 1)
    .select(KOLOM)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: jelaskanGalat(error.message, error.code) }, { status: 400 });
  }
  if (!data) {
    // Penolakan RLS datang sebagai "sukses, nol baris" — bukan galat.
    return NextResponse.json(
      {
        error:
          "Tidak tersimpan: akun ini bukan Admin. Kolom role di tabel " +
          "profiles berisi 'cs' secara bawaan. Perbaiki di SQL Editor: " +
          "update public.profiles set role = 'admin' where id = auth.uid();",
      },
      { status: 403 },
    );
  }

  // Gerbang di /api/chat menyimpan potret selama 60 detik. Tanpa
  // baris ini, menekan "matikan AI sekarang" baru berlaku sampai
  // satu menit kemudian — dan satu menit itu cukup untuk membuat
  // orang mengira tombolnya tidak bekerja lalu menekannya lagi.
  segarkanJadwalAI();

  return NextResponse.json(jawab(rapikan(sebagaiBaris(data))));
}
