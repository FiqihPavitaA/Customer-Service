/* ===========================================================
   Daftar template jawaban — sumber halaman
   Pengaturan → Knowledge Base → Template Jawaban.

   Kenapa lewat API dan bukan import langsung: 152 template berisi
   sekitar 60 KB teks, dan router.js membacanya dengan node:fs.
   Keduanya milik server. Meng-import-nya ke komponen klien akan
   ikut masuk ke bundel JavaScript halaman Pengaturan.

   Berkasnya sama persis dengan yang dipakai system prompt dan
   pencocok template — satu sumber, tidak digandakan. Jadi apa yang
   dilihat tim CS di halaman ini memang yang dipakai AI.

   CATATAN SUMBER DATA (4 Sep 2026)
   Untuk sementara isinya dibaca dari berkas .md, karena Supabase
   sedang mengalami gangguan sehingga project belum bisa dibuat.
   Bentuk keluarannya sengaja sudah menyerupai baris tabel
   `templates` + `template_rules` di supabase/schema-kb.sql, supaya
   penggantinya nanti tidak mengubah komponen UI.
   =========================================================== */

import { NextResponse } from "next/server";
import {
  getAsalKode,
  getRules,
  getTemplateLibrary,
  type AturanSerial,
} from "@/lib/templates";
import type { KategoriTemplate, TemplateItem } from "@/lib/db/templateTypes";

/** Nama berkas -> slug kategori, sepadan dengan tabel kb_categories. */
const SLUG: Record<string, KategoriTemplate> = {
  "faq-interaksi.md": "interaksi",
  "faq-cara-pakai.md": "cara-pakai",
  "faq-produk.md": "produk",
  "faq-umum.md": "umum",
};

/**
 * Ubah pola regex jadi kata kunci yang bisa dibaca orang.
 *
 * Halaman Kelola Template ditujukan untuk tim CS yang tidak menulis
 * kode, jadi menampilkan `\b(cara pakai|dosis)\b` mentah-mentah tidak
 * membantu. Yang ditampilkan adalah frasa di dalamnya.
 *
 * Ini SATU ARAH dan memang tidak sempurna — pola yang rumit tidak
 * selalu bisa diringkas jadi frasa. Karena itu pola aslinya tetap
 * ikut dikirim (`polaAsli`), dan halaman menandai aturan yang tidak
 * bisa disederhanakan supaya tidak ada yang mengira sudah melihat
 * keseluruhannya.
 */
function keKataKunci(pola: string[]): { kata: string[]; utuh: boolean } {
  const kata = new Set<string>();
  let utuh = true;

  for (const p of pola) {
    // Buang jangkar & pembatas kata, lalu ambil isi kelompok pilihan.
    const bersih = p
      .replace(/\\b/g, "")
      .replace(/^\^\\s\*/, "")
      .replace(/\[\\s\\p\{P\}\\p\{S\}\]\*\$/, "")
      .trim();

    // Pola yang masih mengandung penanda regex lanjutan tidak
    // diterjemahkan — lebih baik jujur daripada menyesatkan.
    if (/[.*+?^${}()[\]\\]/.test(bersih.replace(/[()|?]/g, ""))) {
      utuh = false;
      continue;
    }

    for (const bagian of bersih.split("|")) {
      const frasa = bagian.replace(/[()?]/g, " ").replace(/\s+/g, " ").trim();
      if (frasa && frasa.length > 1) kata.add(frasa);
    }
  }

  return { kata: [...kata].slice(0, 12), utuh };
}

let cache: { items: TemplateItem[]; ringkasan: Ringkasan } | null = null;

type Ringkasan = {
  total: number;
  punyaPemicu: number;
  tanpaPemicu: number;
  perKategori: Record<KategoriTemplate, { total: number; punyaPemicu: number }>;
};

function susun() {
  if (cache) return cache;

  const pustaka = getTemplateLibrary();
  const asal = getAsalKode();
  const aturan = getRules();

  const perKode = new Map<string, AturanSerial>();
  for (const a of aturan) if (!perKode.has(a.code)) perKode.set(a.code, a);

  const items: TemplateItem[] = [];
  const perKategori = {
    interaksi: { total: 0, punyaPemicu: 0 },
    "cara-pakai": { total: 0, punyaPemicu: 0 },
    produk: { total: 0, punyaPemicu: 0 },
    umum: { total: 0, punyaPemicu: 0 },
  } as Ringkasan["perKategori"];

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
      // Dua field di bawah menunggu routing_log ditulis /api/chat.
      // Sengaja null, BUKAN 0 — supaya halaman bisa membedakan
      // "belum ada datanya" dari "benar-benar tidak pernah dipakai".
      usageCount: null,
      lastUsedAt: null,
    });

    perKategori[kategori].total++;
    if (r) perKategori[kategori].punyaPemicu++;
  }

  const punyaPemicu = items.filter((i) => i.urutanAturan !== null).length;

  cache = {
    items,
    ringkasan: {
      total: items.length,
      punyaPemicu,
      tanpaPemicu: items.length - punyaPemicu,
      perKategori,
    },
  };
  return cache;
}

export async function GET() {
  try {
    const { items, ringkasan } = susun();
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
