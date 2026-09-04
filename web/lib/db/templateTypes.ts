/* ===========================================================
   Tipe untuk halaman Kelola Template.

   Dipisah dari types.ts karena sifatnya beda: types.ts berisi
   salinan persis baris tabel schema.sql, sedangkan berkas ini
   adalah bentuk GABUNGAN — satu template beserta aturan pemicunya.

   Di database keduanya dua tabel (`templates` dan `template_rules`
   di supabase/schema-kb.sql). Digabung di sini karena tim CS tidak
   memikirkannya sebagai dua hal: bagi mereka "template" adalah
   jawaban beserta kapan ia muncul.
   =========================================================== */

import type { ActionCode } from "./types";

export type KategoriTemplate = "interaksi" | "cara-pakai" | "produk" | "umum";

export const KATEGORI_LABEL: Record<KategoriTemplate, string> = {
  interaksi: "Interaksi",
  "cara-pakai": "Cara Pakai",
  produk: "Produk",
  umum: "Umum",
};

export const KATEGORI_URUT: KategoriTemplate[] = [
  "interaksi",
  "cara-pakai",
  "produk",
  "umum",
];

export type TemplateItem = {
  /** Kode [KODE] di berkas FAQ; unik, jadi kunci alami. */
  code: string;
  kategori: KategoriTemplate;
  /** Nama berkas .md asalnya — sementara, sampai pindah ke tabel. */
  berkas: string;
  /** Isi balasan, apa adanya. */
  body: string;
  action: ActionCode;

  /**
   * Nomor urut aturan pemicunya, atau null bila template ini TIDAK
   * punya pemicu sama sekali.
   *
   * Ini pembeda paling penting di halaman ini: 109 dari 152 template
   * bernilai null — ada teksnya, tapi tidak pernah bisa terkirim
   * otomatis. Tanpa penanda ini tim CS akan mengira semuanya bekerja.
   */
  urutanAturan: number | null;

  /** Frasa pemicu yang sudah disederhanakan agar terbaca orang. */
  kataKunci: string[];
  /** false bila ada pola yang terlalu rumit untuk disederhanakan. */
  kataKunciUtuh: boolean;
  /** Pola regex asli — untuk yang ingin melihat apa adanya. */
  polaAsli: string[];
  also: string | null;
  unless: string[];
  /** Alasan aturan ini aman dijawab tanpa AI; untuk audit. */
  why: string | null;

  /**
   * Statistik pemakaian. null = BELUM ADA DATANYA, bukan nol.
   * Terisi setelah /api/chat menulis ke tabel routing_log —
   * ditunda atas keputusan pemilik proyek (4 Sep 2026).
   */
  usageCount: number | null;
  lastUsedAt: string | null;

  /**
   * true bila template ini baru dibuat lewat halaman Kelola Template
   * dan BELUM tersimpan ke mana pun.
   *
   * Perlu dibedakan dari dua keadaan lain: template yang punya aturan
   * (aktif) dan yang tidak punya sama sekali. Template baru boleh jadi
   * sudah diberi kata kunci, tetapi aturannya belum ada di router —
   * jadi ia belum aktif, dan menandainya "tanpa pemicu" pun keliru.
   */
  baru?: boolean;
};

export type RingkasanTemplate = {
  total: number;
  punyaPemicu: number;
  tanpaPemicu: number;
  perKategori: Record<KategoriTemplate, { total: number; punyaPemicu: number }>;
};

export type TemplatesResponse = {
  /** Dari mana isinya dibaca. Ditampilkan apa adanya di halaman. */
  sumber: "berkas" | "supabase";
  ringkasan: RingkasanTemplate | null;
  items: TemplateItem[];
  error?: string;
};

/** Hasil uji terhadap aturan yang SUDAH tersimpan. */
export type HasilUji = {
  mode: "tersimpan";
  cocok: boolean;
  /** Kode template yang menang; belum tentu yang sedang diedit. */
  code: string | null;
  why: string | null;
  /** Alasan tidak cocok, dalam bahasa yang bisa dibaca CS. */
  sebab: string | null;
};

/**
 * Hasil uji terhadap kata kunci yang BELUM tersimpan (form tambah).
 *
 * Tiga hal dilaporkan terpisah karena tindakannya berbeda:
 * pengaman router membatalkan apa pun frasanya; frasa tidak menangkap;
 * atau frasa menangkap tetapi kalah dari template lain.
 */
export type HasilUjiDraft = {
  mode: "draf";
  dicegatPengaman: string | null;
  cocokDraf: boolean;
  direbutOleh: string | null;
  pola: string | null;
};
