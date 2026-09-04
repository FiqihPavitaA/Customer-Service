/* ===========================================================
   Deklarasi tipe untuk router.js.

   Implementasinya sengaja tetap JavaScript polos supaya bisa
   dipakai apa adanya oleh backend Express (Node) maupun Next.js
   tanpa langkah kompilasi. Berkas ini hanya memberi TypeScript
   bentuk API-nya — tidak ada logika di sini.

   Ikut disalin ke web/content/knowledge-base/ oleh
   `npm run sync-kb`, bersebelahan dengan router.js.
   =========================================================== */

export type Kategori = "interaksi" | "cara-pakai" | "produk" | "umum";
export type KategoriAtauKabur = Kategori | "unclear";

export type ActionCode =
  | "AUTO_REPLY"
  | "ASK_INFORMATION"
  | "HANDOVER_TO_CS"
  | "CHECK_ORDER_SYSTEM";

export const CATEGORY_FILES: Record<Kategori, string>;
export const CATEGORIES: Kategori[];
export const ALL_FAQ_FILES: string[];

export function setKbDir(dir: string): void;
export function getKbDir(): string;

export function getTemplateLibrary(): Map<string, string>;
export function getAsalKode(): Map<string, string>;
export function jumlahAturan(): number;

export type TemplateHit = {
  code: string;
  action: ActionCode;
  reply: string;
  why: string;
};

export function matchTemplate(pesan: string): TemplateHit | null;

export type SkorKategori = Record<Kategori, number>;

export function skorKategori(pesan: string): SkorKategori;

export function tentukanKategori(pesan: string): {
  kategori: KategoriAtauKabur;
  skor: SkorKategori;
  alasan: string;
};

/** Pesan tertangani template — jangan panggil Claude. */
export type KeputusanTemplate = {
  jenis: "template";
  kode: string;
  teks: string;
  action: ActionCode;
  kategori: KategoriAtauKabur;
  berkas: string[];
  alasan: string;
};

/** Pesan perlu Claude; `berkas` adalah FAQ yang ikut dikirim. */
export type KeputusanAi = {
  jenis: "ai";
  kategori: KategoriAtauKabur;
  berkas: string[];
  skor: SkorKategori;
  alasan: string;
};

export type Keputusan = KeputusanTemplate | KeputusanAi;

export function routeToCategory(pesanPelanggan: string): Keputusan;

export function bacaBerkasFaq(daftarBerkas: string[]): {
  teks: string;
  rincian: { berkas: string; karakter: number }[];
};

export function totalKarakterFaq(): number;

export function logRouting(
  keputusan: Keputusan,
  prefix?: string,
): { terkirim: number; total: number; hemat: number };

/** Satu aturan pencocokan, polanya dalam bentuk teks (bukan RegExp). */
export type AturanSerial = {
  /** Nomor urut penilaian; kecil = dinilai lebih dulu. Urutan = logika. */
  urutan: number;
  code: string;
  action: ActionCode;
  /** Cukup salah satu cocok (ATAU). */
  when: string[];
  /** Wajib ikut cocok (DAN); null bila tidak ada. */
  also: string | null;
  /** Bila salah satu cocok, aturan dibatalkan. */
  unless: string[];
  why: string;
};

export function getRules(): AturanSerial[];

/**
 * Kenapa sebuah pesan tidak tertangkap template.
 * @returns kalimat penjelasan, atau null bila pesannya justru cocok.
 */
export function jelaskanTidakCocok(pesan: string): string | null;

/**
 * Susun pola pemicu dari frasa biasa yang diketik tim CS.
 * Semua karakter khusus di-escape, jadi frasa tidak bisa jadi pola liar.
 * @returns sumber regex, atau null bila tidak ada frasa.
 */
export function buatPolaDariFrasa(frasa: string[]): string | null;

/** Hasil menguji kata kunci yang belum tersimpan sebagai aturan. */
export type HasilUjiDraf = {
  /** Terisi bila pengaman router membatalkan pencocokan, apa pun frasanya. */
  dicegatPengaman: string | null;
  /** Frasa yang diketik menangkap pesan ini. */
  cocokDraf: boolean;
  /** Kode template TERSIMPAN yang menang lebih dulu, bila ada. */
  direbutOleh: string | null;
  pola: string | null;
};

export function ujiDraf(pesan: string, frasa: string[]): HasilUjiDraf;
