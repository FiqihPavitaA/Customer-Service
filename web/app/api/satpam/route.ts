/* ===========================================================
   Kata sensitif Gerbang 0 — sumber halaman
   Knowledge Base → Kata Sensitif.

   KENAPA MEMBACA BUTUH TOKEN, DAN MENULIS BUTUH ADMIN

   Kebijakan `satpam_rules_read` berbunyi `to authenticated`, dan
   `satpam_rules_write` berbunyi `using (public.is_admin())`. Sesi
   console disimpan di localStorage, bukan cookie, jadi route
   handler tidak melihatnya sendiri — peramban harus mengirim
   access_token lewat header Authorization.

   Yang menolak tetap DATABASE, bukan berkas ini. Pemeriksaan di
   sini hanya untuk memberi pesan yang bisa dimengerti;
   menghapusnya tidak membuat siapa pun bisa menulis.

   KENAPA TIDAK ADA JALAN UNTUK MENGIRIM REGEX

   Admin hanya mengirim `frasa`. Polanya disusun di server dengan
   buatPolaDariFrasa(), yang meng-escape seluruh karakter khusus.
   Membolehkan regex mentah lewat API akan membuka dua hal
   sekaligus: pola penghabis waktu yang menggantung server pada
   setiap pesan pelanggan, dan pola yang tidak bisa ditampilkan
   kembali sebagai kata di halaman. Aturan berpola tangan yang
   sudah ada tetap bisa dibaca dan dinonaktifkan, tetapi polanya
   tidak bisa disunting dari sini — lihat bisaDisunting().
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { segarkanSumberSatpam, statusSumberSatpam } from "@/lib/db/satpamServer";
import {
  bersihkanFrasa,
  bisaDisunting,
  polaDariFrasa,
  prioritasBaru,
  type AturanSatpam,
} from "@/lib/satpamAturan";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Daftar kolom ditulis sekali supaya keempat handler mengembalikan
   bentuk yang sama persis — halaman menerima baris yang sudah
   diperbarui dan memakainya langsung tanpa memuat ulang, jadi satu
   kolom yang tertinggal di salah satu handler akan tampak sebagai
   nilai yang "hilang sendiri" setelah menyimpan. */
const KOLOM =
  "id, kategori, priority, frasa, when_patterns, also_pattern, " +
  "unless_patterns, why, is_bawaan, is_active";

/**
 * Baris dari PostgREST -> bentuk yang dipakai berkas ini.
 *
 * Lewat `unknown` karena KOLOM di atas sebuah konstanta, bukan
 * literal di tempat pemanggilan, sehingga supabase-js tidak bisa
 * menyimpulkan bentuk barisnya dan jatuh ke tipe galat bawaannya.
 * Ditulis sebagai satu fungsi bernama, bukan `as unknown as` yang
 * berserakan, supaya jelas bahwa yang dipercaya di sini adalah
 * KOLOM — dan bahwa mengubah KOLOM berarti memeriksa ulang
 * AturanSatpam.
 */
const sebagaiAturan = (baris: unknown) => baris as AturanSatpam;
const sebagaiDaftarAturan = (baris: unknown) => (baris ?? []) as AturanSatpam[];

type Penulis = { sb: SupabaseClient; uid: string };

/**
 * Pastikan ada sesi yang sah sebelum menulis.
 *
 * Sengaja memanggil getUser() dan bukan sekadar percaya token ada:
 * token kedaluwarsa tetap berbentuk Bearer yang sah, dan tanpa
 * pemeriksaan ini gejalanya menjadi "tersimpan tapi tidak ada
 * datanya" — kegagalan diam yang sama dengan yang sudah dihindari
 * di /api/templates.
 */
async function siapkanPenulis(req: Request): Promise<Penulis | NextResponse> {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      {
        error:
          "Belum login, atau Supabase belum dikonfigurasi. Kata sensitif " +
          "hanya bisa diubah oleh Admin yang sedang masuk.",
      },
      { status: 401 },
    );
  }
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json(
      { error: "Sesi tidak berlaku lagi. Masuk ulang lalu coba lagi." },
      { status: 401 },
    );
  }
  return { sb, uid: data.user.id };
}

/** Ubah galat Postgres jadi kalimat yang bisa ditindaklanjuti. */
function jelaskanGalat(pesan: string, kode?: string): string {
  if (/relation .*satpam_rules.* does not exist/i.test(pesan)) {
    return "Tabel satpam_rules belum ada. Jalankan supabase/schema-satpam.sql di SQL Editor.";
  }
  if (kode === "42501" || /permission denied/i.test(pesan)) {
    return (
      "Ditolak database: peran authenticated belum punya hak atas tabel " +
      "satpam_rules. Jalankan supabase/grants.sql di SQL Editor."
    );
  }
  if (kode === "23503" || /foreign key/i.test(pesan)) {
    // DUA foreign key yang bisa melanggar di sini, dan sebabnya
    // sama sekali berbeda. Menyebut "kategori" untuk keduanya
    // mengirim orang menelusuri daftar kategori yang sebenarnya
    // baik-baik saja — persis jenis pesan galat yang membuang
    // waktu paling banyak.
    if (/updated_by/i.test(pesan)) {
      return (
        "Akun ini tidak punya baris di tabel profiles, jadi perubahan tidak " +
        "bisa ditandatangani. Biasanya terjadi pada pengguna yang dibuat " +
        "langsung lewat dashboard Supabase, bukan lewat halaman daftar."
      );
    }
    return "Kategori tidak dikenal. Pilih kategori yang sudah ada di daftar.";
  }
  if (kode === "23505" || /duplicate key/i.test(pesan)) {
    return "Nomor urut aturan bentrok. Muat ulang halaman lalu coba lagi.";
  }
  return pesan;
}

/**
 * Penolakan RLS datang sebagai "sukses, nol baris" — bukan galat.
 *
 * Pesannya menyebutkan CARA MEMPERBAIKINYA, bukan sekadar menyatakan
 * penolakan. Alasannya konkret: `profiles.role` berisi 'cs' secara
 * bawaan, jadi SETIAP akun baru bukan admin sampai ada yang
 * mengubahnya — ini bukan keadaan langka yang layak dijawab dengan
 * "hubungi administrator", melainkan keadaan awal semua orang.
 */
function tolakDiam(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Perubahan tidak tersimpan: akun ini bukan Admin. Kolom role di " +
        "tabel profiles berisi 'cs' secara bawaan, jadi akun baru memang " +
        "belum bisa mengubah kata sensitif. Perbaiki di SQL Editor: " +
        "update public.profiles set role = 'admin' where id = auth.uid(); " +
        "— jalankan sambil masuk sebagai akun yang bersangkutan, atau " +
        "sebutkan id-nya langsung.",
    },
    { status: 403 },
  );
}

/* ===========================================================
   GET — kategori + aturan + sumber yang sedang dipakai router
   =========================================================== */

export async function GET(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      { error: "Belum login. Halaman ini butuh sesi yang sedang masuk." },
      { status: 401 },
    );
  }

  const [kategori, aturan] = await Promise.all([
    sb.from("satpam_kategori").select("slug, label, alasan, urutan").order("urutan"),
    sb.from("satpam_rules").select(KOLOM).order("priority"),
  ]);

  const galat = kategori.error ?? aturan.error;
  if (galat) {
    return NextResponse.json(
      { error: jelaskanGalat(galat.message, galat.code) },
      { status: 500 },
    );
  }

  const items = sebagaiDaftarAturan(aturan.data);

  return NextResponse.json(
    {
      kategori: kategori.data ?? [],
      items: items.map((a) => ({ ...a, sunting: bisaDisunting(a) })),
      // Dari mana router SEDANG membaca. Ditaruh di jawaban daftar,
      // bukan hanya di /api/health, karena inilah satu-satunya cara
      // halaman bisa memberi tahu admin bahwa yang ia lihat di layar
      // belum tentu yang sedang dipakai menjawab pelanggan — misalnya
      // ketika tabelnya masih kosong dan router memakai daftar di kode.
      sumber: statusSumberSatpam(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/* ===========================================================
   POST — tambah aturan baru
   =========================================================== */

export async function POST(req: Request) {
  const siap = await siapkanPenulis(req);
  if (siap instanceof NextResponse) return siap;
  const { sb, uid } = siap;

  let body: { kategori?: string; frasa?: unknown; why?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Isi permintaan bukan JSON." }, { status: 400 });
  }

  const kategori = String(body.kategori ?? "").trim();
  if (!kategori) {
    return NextResponse.json({ error: "Kategori wajib dipilih." }, { status: 400 });
  }

  const { frasa, dibuang } = bersihkanFrasa(body.frasa);
  if (!frasa.length) {
    return NextResponse.json(
      {
        error: "Tidak ada kata yang bisa dipakai.",
        dibuang,
      },
      { status: 400 },
    );
  }

  const pola = polaDariFrasa(frasa);
  if (!pola) {
    return NextResponse.json(
      { error: "Kata-kata itu tidak bisa disusun menjadi pola.", dibuang },
      { status: 400 },
    );
  }

  // `why` wajib diisi di database, dan itu disengaja: sebuah aturan
  // berarti pelanggan dialihkan ke manusia tanpa pernah dijawab
  // otomatis, jadi alasannya harus bisa dibaca ulang saat audit.
  // Bila admin tidak menuliskannya, yang tersimpan tetap kalimat
  // yang menyebutkan siapa dan kapan — bukan string kosong.
  const why =
    String(body.why ?? "").trim() ||
    `Ditambahkan lewat halaman Kata Sensitif pada ${new Date().toISOString().slice(0, 10)}.`;

  const { data: adaAturan, error: galatBaca } = await sb
    .from("satpam_rules")
    .select("kategori, priority");
  if (galatBaca) {
    return NextResponse.json(
      { error: jelaskanGalat(galatBaca.message, galatBaca.code) },
      { status: 500 },
    );
  }

  const priority = prioritasBaru(sebagaiDaftarAturan(adaAturan));

  const { data, error } = await sb
    .from("satpam_rules")
    .insert({
      kategori,
      priority,
      frasa,
      when_patterns: [pola],
      why,
      is_bawaan: false,
      updated_by: uid,
    })
    .select(KOLOM)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: jelaskanGalat(error.message, error.code) }, { status: 400 });
  }
  if (!data) return tolakDiam();

  segarkanSumberSatpam();
  return NextResponse.json({ item: data, dibuang });
}

/* ===========================================================
   PATCH — ubah kata, atau nyalakan/matikan aturan
   =========================================================== */

export async function PATCH(req: Request) {
  const siap = await siapkanPenulis(req);
  if (siap instanceof NextResponse) return siap;
  const { sb, uid } = siap;

  let body: { id?: string; frasa?: unknown; is_active?: boolean; why?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Isi permintaan bukan JSON." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id aturan wajib diisi." }, { status: 400 });

  const { data: lama, error: galatBaca } = await sb
    .from("satpam_rules")
    .select(KOLOM)
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) {
    return NextResponse.json(
      { error: jelaskanGalat(galatBaca.message, galatBaca.code) },
      { status: 500 },
    );
  }
  if (!lama) {
    return NextResponse.json({ error: "Aturan itu tidak ditemukan." }, { status: 404 });
  }

  const ubahan: Record<string, unknown> = { updated_by: uid };
  let dibuang: { teks: string; sebab: string }[] = [];

  if (body.frasa !== undefined) {
    // Aturan berpola tangan tidak bisa diubah jadi daftar kata dari
    // sini. Membolehkannya berarti mengganti pola yang lebih kaya
    // dengan yang lebih sempit tanpa penulisnya sadar — misalnya
    // pola pembatalan yang menangkap batal/batalin/batalkan menjadi
    // hanya kata yang sempat diketik ulang admin.
    const izin = bisaDisunting(sebagaiAturan(lama));
    if (!izin.boleh) {
      return NextResponse.json({ error: izin.sebab }, { status: 400 });
    }

    const bersih = bersihkanFrasa(body.frasa);
    dibuang = bersih.dibuang;
    if (!bersih.frasa.length) {
      return NextResponse.json(
        { error: "Tidak ada kata yang bisa dipakai.", dibuang },
        { status: 400 },
      );
    }
    const pola = polaDariFrasa(bersih.frasa);
    if (!pola) {
      return NextResponse.json(
        { error: "Kata-kata itu tidak bisa disusun menjadi pola.", dibuang },
        { status: 400 },
      );
    }
    ubahan.frasa = bersih.frasa;
    ubahan.when_patterns = [pola];
  }

  if (typeof body.is_active === "boolean") ubahan.is_active = body.is_active;
  if (typeof body.why === "string" && body.why.trim()) ubahan.why = body.why.trim();

  if (Object.keys(ubahan).length === 1) {
    return NextResponse.json({ error: "Tidak ada yang diubah." }, { status: 400 });
  }

  const { data, error } = await sb
    .from("satpam_rules")
    .update(ubahan)
    .eq("id", id)
    .select(KOLOM)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: jelaskanGalat(error.message, error.code) }, { status: 400 });
  }
  if (!data) return tolakDiam();

  segarkanSumberSatpam();
  return NextResponse.json({ item: data, dibuang });
}

/* ===========================================================
   DELETE — hapus aturan
   =========================================================== */

export async function DELETE(req: Request) {
  const siap = await siapkanPenulis(req);
  if (siap instanceof NextResponse) return siap;
  const { sb, uid } = siap;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id aturan wajib diisi." }, { status: 400 });

  // updated_by ditulis LEBIH DULU, bukan bersamaan dengan DELETE.
  // Trigger snapshot_satpam() menyalin baris lama ke
  // satpam_revisions dan mengambil changed_by dari old.updated_by —
  // yang pada penghapusan adalah satu-satunya cara mengetahui siapa
  // yang menghapus. Tanpa baris ini, catatan penghapusan tersimpan
  // tanpa nama, dan itu justru catatan yang paling perlu bernama.
  const { error: galatTanda } = await sb
    .from("satpam_rules")
    .update({ updated_by: uid })
    .eq("id", id);
  if (galatTanda) {
    return NextResponse.json(
      { error: jelaskanGalat(galatTanda.message, galatTanda.code) },
      { status: 400 },
    );
  }

  const { data, error } = await sb
    .from("satpam_rules")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: jelaskanGalat(error.message, error.code) }, { status: 400 });
  }
  if (!data) return tolakDiam();

  segarkanSumberSatpam();
  return NextResponse.json({ ok: true, id });
}
