/* ===========================================================
   Jembatan tabel `templates` <-> router. Khusus sisi SERVER.

   Berkas ini tidak boleh diimpor komponen klien: ia memuat
   router.js, yang membaca berkas dengan node:fs.

   Dua pemakainya berbeda hak, dan bedanya menentukan bentuk berkas
   ini:

     /api/chat       kunci anon, tanpa sesi. Hanya boleh memanggil
                     pustaka_router() yang security definer, dan
                     hanya menerima template aktif & tidak sensitif.

     /api/templates  membawa token pengguna yang login. Boleh
                     membaca SELURUH baris — termasuk yang mati dan
                     yang sensitif — karena halaman Kelola Template
                     memang harus menampilkannya, dan boleh menulis
                     bila perannya admin.
   =========================================================== */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  bersihkanSumberLuar,
  getSumberAktif,
  setSumberLuar,
} from "@/content/knowledge-base/router.js";
import type { ActionCode } from "./types";
import type { KategoriTemplate, TemplateItem } from "./templateTypes";

/** Baris keluaran public.pustaka_router(). */
export type BarisPustaka = {
  code: string;
  body: string;
  action: ActionCode;
  category_slug: KategoriTemplate;
  priority: number | null;
  when_patterns: string[] | null;
  also_pattern: string | null;
  unless_patterns: string[] | null;
  flags: string | null;
  why: string | null;
};

/* ===========================================================
   1. Memasok router dari tabel  (dipakai /api/chat)
   =========================================================== */

/**
 * Berapa lama potret tabel dipakai ulang sebelum diambil lagi.
 *
 * Ada tukar-tambah yang nyata di angka ini, dan tidak ada nilai yang
 * benar untuk keduanya sekaligus:
 *
 *   terlalu pendek - setiap pesan pelanggan menambah satu perjalanan
 *                    ke Supabase sebelum apa pun dijawab, termasuk
 *                    pesan yang seharusnya dijawab seketika
 *   terlalu panjang - perbaikan dosis yang baru disimpan tim CS masih
 *                    terkirim versi lamanya selama sekian detik
 *
 * 60 detik dipilih karena sisi yang salah dari tukar-tambah ini
 * adalah yang kedua, dan satu menit masih terasa seperti "langsung"
 * bagi orang yang baru menekan Simpan.
 */
const TTL_MS = Number(process.env.TEMPLATE_TTL_DETIK || 60) * 1000;

let kadaluarsa = 0;
let sedangMuat: Promise<void> | null = null;
/** Diingat supaya peringatan yang sama tidak membanjiri log tiap chat. */
let sudahMengeluh = false;

export type StatusSumber = {
  sumber: "berkas" | "supabase";
  templates: number;
  aturan: number;
  /** Kenapa jatuh ke berkas, bila memang jatuh. */
  alasan: string | null;
};

let statusTerakhir: StatusSumber = {
  sumber: "berkas",
  templates: 0,
  aturan: 0,
  alasan: "belum pernah dimuat",
};

/** Status pemuatan terakhir, untuk /api/health dan panel diagnosa. */
export function statusSumberTemplate(): StatusSumber {
  return { ...statusTerakhir, sumber: getSumberAktif() };
}

/**
 * Pastikan router memakai isi tabel bila tabelnya tersedia.
 *
 * TIDAK PERNAH MELEMPAR. Ini jalur yang dilewati setiap pesan
 * pelanggan; kegagalannya harus berarti "pakai berkas .md seperti
 * dulu", bukan "pelanggan tidak dijawab". Sumber yang benar-benar
 * dipakai selalu bisa dibaca lewat statusSumberTemplate().
 */
export async function siapkanSumberTemplate(): Promise<void> {
  if (Date.now() < kadaluarsa) return;
  if (sedangMuat) return sedangMuat;

  sedangMuat = (async () => {
    const sb = getSupabaseServer();
    if (!sb) {
      jatuhKeBerkas("Supabase belum dikonfigurasi");
      return;
    }

    try {
      const { data, error } = await sb.rpc("pustaka_router");

      if (error) {
        // Yang paling mungkin terjadi pada pemasangan baru: berkas
        // supabase/schema-templates-baca.sql belum dijalankan.
        // Sebutkan berkasnya, jangan hanya meneruskan pesan Postgres.
        const petunjuk = /function .*pustaka_router.* does not exist/i.test(error.message)
          ? "fungsi pustaka_router() belum ada — jalankan supabase/schema-templates-baca.sql"
          : error.message;
        jatuhKeBerkas(petunjuk);
        return;
      }

      const baris = (data ?? []) as BarisPustaka[];
      if (baris.length === 0) {
        // Tabel ada tapi kosong = seed-templates.sql belum dijalankan.
        // Ini keadaan yang WAJAR dan bukan galat, jadi berkas .md
        // tetap melayani dan tidak ada yang perlu dibetulkan buru-buru.
        jatuhKeBerkas("tabel templates masih kosong");
        return;
      }

      const hasil = setSumberLuar(baris);
      statusTerakhir = {
        sumber: "supabase",
        templates: hasil.templates,
        aturan: hasil.aturan,
        alasan: null,
      };
      sudahMengeluh = false;
      console.log(
        `[KB-ROUTER] sumber=supabase — ${hasil.templates} template, ${hasil.aturan} aturan`,
      );
    } catch (err) {
      jatuhKeBerkas(err instanceof Error ? err.message : String(err));
    } finally {
      kadaluarsa = Date.now() + TTL_MS;
      sedangMuat = null;
    }
  })();

  return sedangMuat;
}

function jatuhKeBerkas(alasan: string) {
  bersihkanSumberLuar();
  statusTerakhir = { sumber: "berkas", templates: 0, aturan: 0, alasan };
  if (!sudahMengeluh) {
    console.warn(`[KB-ROUTER] sumber=berkas .md — ${alasan}`);
    sudahMengeluh = true;
  }
}

/** Paksa pemuatan ulang pada permintaan berikutnya (dipakai sesudah menulis). */
export function segarkanSumberTemplate() {
  kadaluarsa = 0;
}

/* ===========================================================
   2. Membaca SELURUH template  (dipakai /api/templates)
   =========================================================== */

type BarisAturan = {
  priority: number;
  when_patterns: string[];
  also_pattern: string | null;
  unless_patterns: string[] | null;
  why: string;
  is_active: boolean;
};

type BarisTemplate = {
  code: string;
  category_slug: KategoriTemplate;
  body: string;
  action: ActionCode;
  is_active: boolean;
  is_sensitive: boolean;
  note: string | null;
  usage_count: number | null;
  last_used_at: string | null;
  template_rules: BarisAturan[] | null;
};

const BERKAS_SLUG: Record<KategoriTemplate, string> = {
  interaksi: "faq-interaksi.md",
  "cara-pakai": "faq-cara-pakai.md",
  produk: "faq-produk.md",
  umum: "faq-umum.md",
};

/**
 * Ubah pola regex jadi kata kunci yang bisa dibaca orang.
 *
 * Dipindahkan ke sini dari app/api/templates/route.ts supaya jalur
 * berkas dan jalur tabel memakai penerjemah yang SAMA. Dua salinan
 * akan menyimpang, dan gejalanya adalah halaman menampilkan kata
 * kunci berbeda tergantung sumbernya — persis hal yang paling
 * membingungkan saat menelusuri kenapa sebuah pesan tidak tertangkap.
 *
 * Satu arah dan memang tidak sempurna; pola yang tidak bisa
 * disederhanakan ditandai lewat `utuh: false` supaya tidak ada yang
 * mengira sudah melihat keseluruhannya.
 */
export function keKataKunci(pola: string[]): { kata: string[]; utuh: boolean } {
  const kata = new Set<string>();
  let utuh = true;

  for (const p of pola) {
    const bersih = p
      .replace(/\\b/g, "")
      .replace(/^\^\\s\*/, "")
      .replace(/\[\\s\\p\{P\}\\p\{S\}\]\*\$/, "")
      .replace(/\\s\+/g, " ")
      .trim();

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

/**
 * Baca seluruh template beserta aturannya dari tabel.
 *
 * @param sb klien yang membawa token pengguna (kebijakan
 *           `templates_read` berbunyi `to authenticated`).
 * @returns null bila tabelnya kosong — pemanggil lalu memakai berkas.
 */
export async function ambilTemplatesDb(
  sb: SupabaseClient,
): Promise<{ items: TemplateItem[] } | null> {
  const { data, error } = await sb
    .from("templates")
    .select(
      "code, category_slug, body, action, is_active, is_sensitive, note, " +
        "usage_count, last_used_at, " +
        "template_rules ( priority, when_patterns, also_pattern, unless_patterns, why, is_active )",
    )
    .order("code");

  if (error) throw new Error(error.message);

  const baris = (data ?? []) as unknown as BarisTemplate[];
  if (baris.length === 0) return null;

  const items: TemplateItem[] = baris.map((t) => {
    // Satu template boleh punya beberapa aturan; yang menentukan
    // urutannya adalah priority terkecil yang masih aktif.
    const aturan = (t.template_rules ?? [])
      .filter((r) => r.is_active)
      .sort((a, b) => a.priority - b.priority)[0];

    const { kata, utuh } = aturan
      ? keKataKunci(aturan.when_patterns ?? [])
      : { kata: [], utuh: true };

    return {
      code: t.code,
      kategori: t.category_slug,
      berkas: BERKAS_SLUG[t.category_slug] ?? "faq-umum.md",
      body: t.body,
      action: t.action,
      urutanAturan: aturan?.priority ?? null,
      kataKunci: kata,
      kataKunciUtuh: utuh,
      polaAsli: aturan?.when_patterns ?? [],
      also: aturan?.also_pattern ?? null,
      unless: aturan?.unless_patterns ?? [],
      why: aturan?.why ?? null,
      // Kolomnya sudah ada di tabel, tetapi belum ada yang mengisi:
      // /api/chat belum menulis ke routing_log. Dikirim null, BUKAN 0,
      // supaya halaman bisa membedakan "belum ada datanya" dari
      // "benar-benar tidak pernah dipakai".
      usageCount: t.usage_count ?? null,
      lastUsedAt: t.last_used_at ?? null,
      nonaktif: !t.is_active,
      sensitif: t.is_sensitive,
      catatan: t.note,
    };
  });

  return { items };
}
