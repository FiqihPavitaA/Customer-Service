/* ===========================================================
   Contoh pertanyaan pelanggan per template — Tahap C.

   Tabel `template_examples` sudah ada sejak schema-vektor.sql, tetapi
   sampai 8 September 2026 tidak ada satu pun cara mengisinya selain
   menempel SQL. Itu yang menghambat Tahap C — bukan kemauan tim CS,
   melainkan tidak adanya pintu masuk.

   ----------------------------------------------------------
   SIAPA YANG BOLEH MENULIS, DAN KENAPA BERBEDA DARI TEMPLATE
   ----------------------------------------------------------
   Mengubah isi template dibatasi admin: satu salah ketik pada dosis
   terkirim ke semua pelanggan sekaligus.

   Menulis contoh pertanyaan TIDAK dibatasi admin — kebijakan
   `template_examples_write` berbunyi `to authenticated using (true)`.
   Itu disengaja dan alasannya penting: contoh pertanyaan tidak
   pernah dikirim ke pelanggan. Ia hanya menentukan template mana
   yang terpilih. Salah menulis contoh berakibat template yang
   kurang tepat terpilih — buruk, tetapi bisa diperbaiki. Dan yang
   paling tahu bagaimana pelanggan sungguhan menulis adalah CS yang
   membalas chat setiap hari, bukan admin.

   ----------------------------------------------------------
   VEKTOR SENGAJA TIDAK DIBUAT DI SINI
   ----------------------------------------------------------
   Menyimpan contoh menulis baris dengan `embedding = null`.
   Membuat vektornya adalah panggilan BERBAYAR ke Voyage, dan aturan
   pertama CLAUDE.md melarang panggilan berbayar tanpa izin sadar.
   Kalau menyimpan langsung memanggil Voyage, tim CS akan memotong
   saldo tanpa pernah tahu.

   Jadi vektornya dibuat terpisah lewat /api/pengenal/bangun, yang
   menampilkan perkiraan biaya dulu dan hanya jalan bila diminta.
   Skema sudah menyiapkan daftar kerjanya:
   `template_examples_belum_vektor_idx`.
   =========================================================== */

import { NextResponse } from "next/server";
import { getSupabaseSebagai, tokenDariHeader } from "@/lib/supabase/server";
import { adaGalat, periksaContoh, PANJANG_MAKSIMUM } from "@/lib/mutuContoh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Baris = {
  id: string;
  teks: string;
  sumber: "cs" | "bootstrap" | "chat";
  embedding_model: string | null;
  embedding_dibuat: string | null;
  created_at: string;
};

/** Klien bersesi, atau jawaban penolakan yang bisa dibaca orang. */
async function penulis(req: Request) {
  const sb = getSupabaseSebagai(tokenDariHeader(req));
  if (!sb) {
    return NextResponse.json(
      {
        error:
          "Belum login, atau Supabase belum dikonfigurasi. Contoh pertanyaan " +
          "hanya bisa disimpan oleh pengguna yang sedang masuk.",
      },
      { status: 401 },
    );
  }
  return sb;
}

/** Ambil id template dari kodenya. */
async function idTemplate(
  sb: NonNullable<ReturnType<typeof getSupabaseSebagai>>,
  code: string,
): Promise<string | NextResponse> {
  const { data, error } = await sb
    .from("templates")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json(
      {
        error:
          `Template [${code}] tidak ada di tabel. Jalankan ` +
          `supabase/seed-templates.sql lebih dulu, atau simpan templatenya.`,
      },
      { status: 404 },
    );
  }
  return data.id as string;
}

/* ===========================================================
   GET /api/templates/contoh?code=PAKAI%20NEEM
   =========================================================== */

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Parameter "code" wajib diisi.' }, { status: 400 });
  }

  const sb = await penulis(req);
  if (sb instanceof NextResponse) return sb;

  const id = await idTemplate(sb, code);
  if (id instanceof NextResponse) return id;

  const { data, error } = await sb
    .from("template_examples")
    .select("id, teks, sumber, embedding_model, embedding_dibuat, created_at")
    .eq("template_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const baris = (data ?? []) as Baris[];
  return NextResponse.json(
    {
      code,
      items: baris.map((b) => ({
        id: b.id,
        teks: b.teks,
        sumber: b.sumber,
        // Vektor belum ada = contoh ini belum ikut menentukan apa pun.
        // Dibedakan tegas supaya tim CS tidak mengira pekerjaannya
        // sudah berpengaruh padahal belum.
        bervektor: Boolean(b.embedding_dibuat),
        model: b.embedding_model,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/* ===========================================================
   POST /api/templates/contoh   { code, teks }
   =========================================================== */

export async function POST(req: Request) {
  const sb = await penulis(req);
  if (sb instanceof NextResponse) return sb;

  let badan: { code?: unknown; teks?: unknown };
  try {
    badan = (await req.json()) as typeof badan;
  } catch {
    return NextResponse.json({ error: "Body harus JSON yang valid." }, { status: 400 });
  }

  const code = String(badan.code ?? "").trim().toUpperCase();
  const teks = String(badan.teks ?? "").trim().replace(/\s+/g, " ");

  if (!code) {
    return NextResponse.json({ error: 'Field "code" wajib diisi.' }, { status: 400 });
  }
  if (!teks) {
    return NextResponse.json({ error: "Contoh masih kosong." }, { status: 400 });
  }
  if (teks.length > PANJANG_MAKSIMUM) {
    return NextResponse.json(
      { error: `Terlalu panjang (${teks.length} karakter, batas ${PANJANG_MAKSIMUM}).` },
      { status: 400 },
    );
  }

  // Diperiksa ulang di server, bukan hanya di layar. Pemeriksaan yang
  // hanya ada di peramban bukan pemeriksaan — ia hanya saran yang
  // kebetulan sulit dilewati.
  const catatan = periksaContoh(teks);
  if (adaGalat(catatan)) {
    return NextResponse.json(
      {
        error: catatan.find((c) => c.berat === "galat")!.pesan,
        catatan,
      },
      { status: 400 },
    );
  }

  const id = await idTemplate(sb, code);
  if (id instanceof NextResponse) return id;

  const { data: pengguna } = await sb.auth.getUser();

  const { data, error } = await sb
    .from("template_examples")
    .insert({
      template_id: id,
      teks,
      sumber: "cs",
      created_by: pengguna?.user?.id ?? null,
      // embedding sengaja null — lihat catatan kepala berkas.
    })
    .select("id, teks")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      return NextResponse.json(
        { error: "Contoh yang sama persis sudah ada untuk template ini." },
        { status: 409 },
      );
    }
    if (error.code === "42501" || /permission denied/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Ditolak database: peran authenticated belum punya hak atas " +
            "tabel template_examples. Jalankan supabase/schema-vektor.sql.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json(
      {
        error:
          "Tidak tersimpan. Database menerima permintaannya tetapi tidak " +
          "menulis satu baris pun — biasanya berarti sesi sudah tidak berlaku.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      teks: data.teks,
      // Catatan non-fatal tetap dikirim supaya penulisnya melihatnya
      // walau contohnya diterima.
      catatan: catatan.filter((c) => c.berat !== "galat"),
    },
    { status: 201 },
  );
}

/* ===========================================================
   DELETE /api/templates/contoh?id=<uuid>
   =========================================================== */

export async function DELETE(req: Request) {
  const sb = await penulis(req);
  if (sb instanceof NextResponse) return sb;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  // DELETE sungguhan, berbeda dari template.
  //
  // Template dimatikan (is_active=false) karena kodenya dirujuk
  // routing_log sebagai riwayat. Contoh pertanyaan tidak dirujuk apa
  // pun: ia hanya bahan pencarian. Menyimpan contoh yang salah dalam
  // keadaan "mati" justru menambah baris yang harus disaring setiap
  // kali, tanpa ada yang pernah membacanya lagi.
  const { data, error } = await sb
    .from("template_examples")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Contoh itu tidak ditemukan, atau sudah dihapus orang lain." },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: data[0].id });
}
