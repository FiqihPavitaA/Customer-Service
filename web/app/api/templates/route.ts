/* ===========================================================
   Daftar template jawaban — sumber halaman
   Pengaturan → Knowledge Base → Template Jawaban.

   Kenapa lewat API dan bukan import langsung: 152 template berisi
   sekitar 60 KB teks, dan router.js membacanya dengan node:fs.
   Keduanya milik server. Meng-import-nya ke komponen klien akan
   ikut masuk ke bundel JavaScript halaman Pengaturan.

   ----------------------------------------------------------
   SUMBER DATA (diperbarui 8 September 2026)
   ----------------------------------------------------------
   Sampai kini isinya hanya dibaca dari berkas .md, karena pada 4
   September Supabase sedang bergangguan dan project belum bisa
   dibuat. Gangguan itu sudah lewat, jadi urutannya kini:

     1. tabel `templates` di Supabase   <- bila terisi, ini yang menang
     2. berkas .md                      <- cadangan, selalu tersedia

   Perpindahannya dilaporkan apa adanya lewat field `sumber`, dan
   halaman menampilkannya. Sumber yang berganti diam-diam adalah
   kegagalan yang paling mahal di sini: tim CS menyunting di satu
   tempat sementara pelanggan dijawab dari tempat lain.

   ----------------------------------------------------------
   KENAPA MENULIS BUTUH TOKEN DARI PERAMBAN
   ----------------------------------------------------------
   Kebijakan `templates_write` berbunyi `using (public.is_admin())`.
   Sesi console disimpan di localStorage, bukan cookie, jadi route
   handler tidak melihatnya sendiri — peramban harus mengirim
   access_token lewat header Authorization. Tanpa itu penulisan
   berjalan sebagai anon dan ditolak database.

   Yang menolak tetap DATABASE, bukan berkas ini. Pemeriksaan peran
   di sini hanya untuk memberi pesan yang bisa dimengerti;
   menghapusnya tidak membuat siapa pun bisa menulis.
   =========================================================== */

import { NextResponse } from "next/server";
import {
  buatPolaDariFrasa,
  getAsalKode,
  getPustakaBerkas,
  getRules,
  type AturanSerial,
} from "@/lib/templates";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import {
  ambilTemplatesDb,
  keKataKunci,
  segarkanSumberTemplate,
} from "@/lib/db/templatesServer";
import type { KategoriTemplate, TemplateItem } from "@/lib/db/templateTypes";
import type { ActionCode } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nama berkas -> slug kategori, sepadan dengan tabel kb_categories. */
const SLUG: Record<string, KategoriTemplate> = {
  "faq-interaksi.md": "interaksi",
  "faq-cara-pakai.md": "cara-pakai",
  "faq-produk.md": "produk",
  "faq-umum.md": "umum",
};

const KATEGORI_SAH: KategoriTemplate[] = ["interaksi", "cara-pakai", "produk", "umum"];
const ACTION_SAH: ActionCode[] = [
  "AUTO_REPLY",
  "ASK_INFORMATION",
  "HANDOVER_TO_CS",
  "CHECK_ORDER_SYSTEM",
];

type Ringkasan = {
  total: number;
  punyaPemicu: number;
  tanpaPemicu: number;
  perKategori: Record<KategoriTemplate, { total: number; punyaPemicu: number }>;
};

function hitungRingkasan(items: TemplateItem[]): Ringkasan {
  const perKategori = {
    interaksi: { total: 0, punyaPemicu: 0 },
    "cara-pakai": { total: 0, punyaPemicu: 0 },
    produk: { total: 0, punyaPemicu: 0 },
    umum: { total: 0, punyaPemicu: 0 },
  } as Ringkasan["perKategori"];

  for (const i of items) {
    perKategori[i.kategori].total++;
    if (i.urutanAturan !== null) perKategori[i.kategori].punyaPemicu++;
  }

  const punyaPemicu = items.filter((i) => i.urutanAturan !== null).length;
  return {
    total: items.length,
    punyaPemicu,
    tanpaPemicu: items.length - punyaPemicu,
    perKategori,
  };
}

/* ===========================================================
   Jalur berkas .md — cadangan yang selalu tersedia
   =========================================================== */

let cacheBerkas: { items: TemplateItem[]; ringkasan: Ringkasan } | null = null;

function susunDariBerkas() {
  if (cacheBerkas) return cacheBerkas;

  // getPustakaBerkas(), bukan getTemplateLibrary(): begitu router
  // memakai tabel, getTemplateLibrary() ikut mengembalikan isi tabel
  // dan cadangan ini berhenti menjadi cadangan.
  const pustaka = getPustakaBerkas();
  const asal = getAsalKode();
  const aturan = getRules();

  const perKode = new Map<string, AturanSerial>();
  for (const a of aturan) if (!perKode.has(a.code)) perKode.set(a.code, a);

  const items: TemplateItem[] = [];

  for (const [code, body] of pustaka) {
    const berkas = asal.get(code) ?? "faq-umum.md";
    const kategori = SLUG[berkas] ?? "umum";
    const r = perKode.get(code) ?? null;
    const { kata, utuh } = r ? keKataKunci(r.when) : { kata: [], utuh: true };

    items.push({
      code,
      kategori,
      berkas,
      body,
      action: r?.action ?? "AUTO_REPLY",
      urutanAturan: r?.urutan ?? null,
      kataKunci: kata,
      kataKunciUtuh: utuh,
      polaAsli: r?.when ?? [],
      also: r?.also ?? null,
      unless: r?.unless ?? [],
      why: r?.why ?? null,
      usageCount: null,
      lastUsedAt: null,
    });
  }

  cacheBerkas = { items, ringkasan: hitungRingkasan(items) };
  return cacheBerkas;
}

/* ===========================================================
   GET — daftar template
   =========================================================== */

export async function GET(req: Request) {
  // Tanpa token, jalur tabel bahkan tidak dicoba: kebijakan
  // `templates_read` berbunyi `to authenticated`, jadi anon pasti
  // mendapat nol baris — dan nol baris tidak bisa dibedakan dari
  // "tabel memang kosong". Lebih baik tidak menebak.
  const token = tokenDariHeader(req);
  const sb = getSupabaseSebagai(token);

  if (sb) {
    try {
      const db = await ambilTemplatesDb(sb);
      if (db) {
        return NextResponse.json(
          {
            sumber: "supabase" as const,
            ringkasan: hitungRingkasan(db.items),
            items: db.items,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      // null = tabelnya kosong. Bukan galat; seed-templates.sql
      // memang mungkin belum dijalankan. Turun ke berkas.
    } catch (err) {
      // Tabel tidak terbaca (izin, jaringan, skema belum dipasang).
      // Halaman tetap harus tampil, jadi turun ke berkas — TETAPI
      // alasannya ikut dikirim, bukan disembunyikan.
      const { items, ringkasan } = susunDariBerkas();
      return NextResponse.json(
        {
          sumber: "berkas" as const,
          ringkasan,
          items,
          peringatan: `Tabel templates tidak terbaca: ${(err as Error).message}`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  try {
    const { items, ringkasan } = susunDariBerkas();
    return NextResponse.json(
      { sumber: "berkas" as const, ringkasan, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Kegagalan membaca KB tidak boleh mematikan halaman Pengaturan.
    return NextResponse.json(
      {
        sumber: "berkas" as const,
        ringkasan: null,
        items: [],
        error: (err as Error).message,
      },
      { status: 500 },
    );
  }
}

/* ===========================================================
   Alat bantu penulisan
   =========================================================== */

type Penulis = { sb: NonNullable<ReturnType<typeof getSupabaseSebagai>>; uid: string };

/**
 * Siapkan klien penulis, atau kembalikan jawaban penolakan.
 *
 * Sengaja memanggil getUser() dan bukan sekadar percaya token ada:
 * token kedaluwarsa tetap berbentuk Bearer yang sah, dan tanpa
 * pemeriksaan ini gejalanya menjadi "tersimpan tapi tidak ada
 * datanya" — kegagalan diam yang persis sama dengan yang pernah
 * menghabiskan waktu pada pengaturan ambang keyakinan.
 */
async function siapkanPenulis(req: Request): Promise<Penulis | NextResponse> {
  const token = tokenDariHeader(req);
  const sb = getSupabaseSebagai(token);
  if (!sb) {
    return NextResponse.json(
      {
        error:
          "Belum login, atau Supabase belum dikonfigurasi. Template hanya " +
          "bisa disimpan oleh Admin yang sedang masuk.",
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

/**
 * Ubah galat Postgres jadi kalimat yang bisa ditindaklanjuti.
 *
 * Dua yang paling sering muncul di sini punya sebab yang sama sekali
 * berbeda, dan pesan aslinya tidak membedakannya bagi pembacanya:
 * 42501 berarti hak tabel belum diberikan (grants.sql), sedangkan
 * penolakan RLS datang tanpa kode dan tanpa baris.
 */
function jelaskanGalat(pesan: string, kode?: string): string {
  if (kode === "42501" || /permission denied/i.test(pesan)) {
    return (
      "Ditolak database: peran authenticated belum punya hak atas tabel " +
      "templates. Jalankan supabase/grants.sql di SQL Editor."
    );
  }
  if (kode === "23505" || /duplicate key/i.test(pesan)) {
    return "Kode template itu sudah dipakai. Pilih kode lain.";
  }
  if (kode === "23503" || /foreign key/i.test(pesan)) {
    return "Kategori tidak dikenal. Jalankan supabase/schema-kb.sql lebih dulu.";
  }
  return pesan;
}

/** Penolakan RLS datang sebagai "sukses, nol baris" — bukan sebagai galat. */
function tolakDiam(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Perubahan tidak tersimpan. Database menerima permintaannya tetapi " +
        "tidak mengubah satu baris pun — biasanya berarti peran akun ini " +
        "bukan admin. Periksa kolom role di tabel profiles.",
    },
    { status: 403 },
  );
}

/**
 * Nomor urut untuk aturan baru: paling belakang.
 *
 * Ini bukan sekadar kemudahan. Urutan aturan adalah logika, dan
 * menyisipkan aturan baru di depan berarti ia bisa merebut pesan
 * yang selama ini dijawab template lain — perubahan diam-diam pada
 * template yang tidak sedang disunting siapa pun. Menaruhnya di
 * belakang membuat aturan yang sudah teruji selalu menang, dan
 * halaman Kelola Template menunjukkan siapa yang merebut lewat
 * kotak "Uji coba".
 */
async function prioritasBerikutnya(sb: Penulis["sb"]): Promise<number> {
  const { data } = await sb
    .from("template_rules")
    .select("priority")
    .order("priority", { ascending: false })
    .limit(1);
  const tertinggi = (data ?? [])[0]?.priority;
  return typeof tertinggi === "number" ? tertinggi + 1 : 1;
}

type BadanTulis = {
  code?: unknown;
  kategori?: unknown;
  body?: unknown;
  action?: unknown;
  kataKunci?: unknown;
  catatan?: unknown;
  aktif?: unknown;
};

function bacaBadan(b: BadanTulis) {
  const code = String(b.code ?? "").trim().toUpperCase();
  const kategori = String(b.kategori ?? "umum") as KategoriTemplate;
  const body = String(b.body ?? "").trim();
  const action = String(b.action ?? "AUTO_REPLY") as ActionCode;
  const kataKunci = Array.isArray(b.kataKunci)
    ? b.kataKunci.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : [];
  return { code, kategori, body, action, kataKunci };
}

/* ===========================================================
   POST — tambah template baru
   =========================================================== */

export async function POST(req: Request) {
  const penulis = await siapkanPenulis(req);
  if (penulis instanceof NextResponse) return penulis;
  const { sb, uid } = penulis;

  let badan: BadanTulis;
  try {
    badan = (await req.json()) as BadanTulis;
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const { code, kategori, body, action, kataKunci } = bacaBadan(badan);

  if (!code) return NextResponse.json({ error: "Kode belum diisi." }, { status: 400 });
  if (!/^[A-Z0-9 ._-]+$/.test(code)) {
    return NextResponse.json(
      { error: "Kode hanya boleh huruf, angka, spasi, titik, garis bawah, dan strip." },
      { status: 400 },
    );
  }
  if (!body) return NextResponse.json({ error: "Isi jawaban belum diisi." }, { status: 400 });
  if (!KATEGORI_SAH.includes(kategori)) {
    return NextResponse.json({ error: `Kategori "${kategori}" tidak dikenal.` }, { status: 400 });
  }
  if (!ACTION_SAH.includes(action)) {
    return NextResponse.json({ error: `Action "${action}" tidak dikenal.` }, { status: 400 });
  }

  const { data: baru, error } = await sb
    .from("templates")
    .insert({
      code,
      category_slug: kategori,
      body,
      action,
      note: badan.catatan ? String(badan.catatan) : null,
      updated_by: uid,
    })
    .select("id, code")
    .single();

  if (error) {
    return NextResponse.json(
      { error: jelaskanGalat(error.message, error.code) },
      { status: 400 },
    );
  }
  if (!baru) return tolakDiam();

  // ---- Aturan pemicu, bila tim CS mengisi kata kuncinya ----
  let urutanAturan: number | null = null;
  const pola = buatPolaDariFrasa(kataKunci);
  if (pola) {
    const priority = await prioritasBerikutnya(sb);
    const { data: aturan, error: galatAturan } = await sb
      .from("template_rules")
      .insert({
        template_id: baru.id,
        priority,
        when_patterns: [pola],
        // Kolom `why` wajib diisi: sebuah aturan berarti pelanggan
        // dijawab tanpa AI, dan alasannya harus bisa dibaca ulang
        // saat audit dosis. Kalimat otomatis di bawah setidaknya
        // mencatat asal-usul dan kata kuncinya.
        why:
          `Dibuat lewat halaman Kelola Template. Kata kunci: ` +
          kataKunci.join(", ") +
          ".",
        updated_by: uid,
      })
      .select("priority")
      .single();

    if (galatAturan) {
      // Templatenya sudah masuk; aturannya yang gagal. Katakan
      // keduanya — melaporkan kegagalan total akan membuat penyunting
      // mencoba lagi dan bertabrakan dengan kode yang kini sudah ada.
      return NextResponse.json(
        {
          code: baru.code,
          urutanAturan: null,
          peringatan:
            `Template [${baru.code}] tersimpan, tetapi kata kuncinya gagal ` +
            `disimpan: ${jelaskanGalat(galatAturan.message, galatAturan.code)}. ` +
            `Template ada di daftar, hanya belum punya pemicu.`,
        },
        { status: 207 },
      );
    }
    urutanAturan = aturan?.priority ?? null;
  }

  segarkanSumberTemplate();
  return NextResponse.json({ code: baru.code, urutanAturan }, { status: 201 });
}

/* ===========================================================
   PATCH — ubah template yang sudah ada
   =========================================================== */

export async function PATCH(req: Request) {
  const penulis = await siapkanPenulis(req);
  if (penulis instanceof NextResponse) return penulis;
  const { sb, uid } = penulis;

  let badan: BadanTulis;
  try {
    badan = (await req.json()) as BadanTulis;
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const code = String(badan.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Kode belum diisi." }, { status: 400 });

  // Hanya field yang benar-benar dikirim yang diubah. Mengirim
  // seluruh baris akan menimpa kolom yang tidak sedang disunting
  // dengan nilai lama yang kebetulan ada di layar penyunting.
  const patch: Record<string, unknown> = { updated_by: uid };

  if (badan.body !== undefined) {
    const body = String(badan.body).trim();
    if (!body) {
      return NextResponse.json({ error: "Isi jawaban tidak boleh kosong." }, { status: 400 });
    }
    patch.body = body;
  }
  if (badan.action !== undefined) {
    const action = String(badan.action) as ActionCode;
    if (!ACTION_SAH.includes(action)) {
      return NextResponse.json({ error: `Action "${action}" tidak dikenal.` }, { status: 400 });
    }
    patch.action = action;
  }
  if (badan.kategori !== undefined) {
    const kategori = String(badan.kategori) as KategoriTemplate;
    if (!KATEGORI_SAH.includes(kategori)) {
      return NextResponse.json({ error: `Kategori "${kategori}" tidak dikenal.` }, { status: 400 });
    }
    patch.category_slug = kategori;
  }
  if (badan.catatan !== undefined) patch.note = badan.catatan ? String(badan.catatan) : null;
  if (badan.aktif !== undefined) patch.is_active = Boolean(badan.aktif);

  // .select() WAJIB di sini. Tanpa itu, penolakan RLS kembali sebagai
  // "sukses" tanpa satu baris pun berubah, dan layar menampilkan
  // perubahan yang tidak pernah tersimpan — persis kegagalan yang
  // pernah membuat ambang keyakinan seolah kembali sendiri dari 70
  // ke 80.
  const { data, error } = await sb
    .from("templates")
    .update(patch)
    .eq("code", code)
    .select("id, code");

  if (error) {
    return NextResponse.json(
      { error: jelaskanGalat(error.message, error.code) },
      { status: 400 },
    );
  }
  if (!data || data.length === 0) return tolakDiam();

  // ---- Kata kunci pemicu ----
  // Hanya disentuh bila memang dikirim. Mengirim array kosong BUKAN
  // hal yang sama dengan tidak mengirim apa-apa: yang pertama berarti
  // "cabut pemicunya", yang kedua "jangan diapa-apakan".
  if (badan.kataKunci !== undefined) {
    const galatAturan = await simpanAturan(
      sb,
      uid,
      data[0].id as string,
      bacaBadan(badan).kataKunci,
    );
    if (galatAturan) {
      return NextResponse.json(
        {
          code: data[0].code,
          peringatan:
            `Isi template [${data[0].code}] tersimpan, tetapi kata kuncinya ` +
            `gagal: ${galatAturan}`,
        },
        { status: 207 },
      );
    }
  }

  segarkanSumberTemplate();
  return NextResponse.json({ code: data[0].code });
}

/**
 * Pasang ulang aturan pemicu sebuah template.
 *
 * Nonaktifkan yang lama lalu sisipkan yang baru, bukan UPDATE di
 * tempat. Alasannya nomor urut: aturan yang dinonaktifkan tetap
 * memegang priority-nya, jadi tidak ada nomor yang bergeser dan tidak
 * ada aturan lain yang berubah perilakunya hanya karena template ini
 * disunting. Yang lama juga tetap terbaca saat menelusuri "kenapa
 * dulu pesan ini tertangkap".
 *
 * @returns pesan galat, atau null bila berhasil.
 */
async function simpanAturan(
  sb: Penulis["sb"],
  uid: string,
  templateId: string,
  kataKunci: string[],
): Promise<string | null> {
  const { error: galatMati } = await sb
    .from("template_rules")
    .update({ is_active: false, updated_by: uid })
    .eq("template_id", templateId)
    .eq("is_active", true);

  if (galatMati) return jelaskanGalat(galatMati.message, galatMati.code);

  const pola = buatPolaDariFrasa(kataKunci);
  if (!pola) return null; // kata kunci dikosongkan — pemicunya dicabut

  const { error } = await sb.from("template_rules").insert({
    template_id: templateId,
    priority: await prioritasBerikutnya(sb),
    when_patterns: [pola],
    why: `Diubah lewat halaman Kelola Template. Kata kunci: ${kataKunci.join(", ")}.`,
    updated_by: uid,
  });

  return error ? jelaskanGalat(error.message, error.code) : null;
}

/* ===========================================================
   DELETE — matikan template (bukan hapus)
   =========================================================== */

/**
 * Kenapa is_active=false dan bukan DELETE:
 *
 *   1. routing_log menyimpan kode template yang pernah menjawab.
 *      Menghapus barisnya membuat riwayat biaya kehilangan artinya —
 *      log berkata [PAKAI NEEM] menjawab 400 kali, dan tidak ada lagi
 *      cara membaca isi jawabannya waktu itu.
 *   2. template_revisions ikut terhapus lewat ON DELETE CASCADE.
 *      Sebagian besar template berisi DOSIS; jejak siapa mengubah apa
 *      justru paling dibutuhkan setelah sebuah template ditarik.
 */
export async function DELETE(req: Request) {
  const penulis = await siapkanPenulis(req);
  if (penulis instanceof NextResponse) return penulis;
  const { sb, uid } = penulis;

  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Parameter "code" wajib diisi.' }, { status: 400 });
  }

  const { data, error } = await sb
    .from("templates")
    .update({ is_active: false, updated_by: uid })
    .eq("code", code)
    .select("code");

  if (error) {
    return NextResponse.json(
      { error: jelaskanGalat(error.message, error.code) },
      { status: 400 },
    );
  }
  if (!data || data.length === 0) return tolakDiam();

  segarkanSumberTemplate();
  return NextResponse.json({ code: data[0].code, nonaktif: true });
}
