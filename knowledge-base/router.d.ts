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

/* -----------------------------------------------------------
   Sumber luar — pustaka & aturan dari tabel Supabase
   ----------------------------------------------------------- */

/** Satu baris keluaran fungsi public.pustaka_router(). */
export type BarisPustakaRouter = {
  code: string;
  body: string;
  action?: ActionCode;
  category_slug?: Kategori;
  /** null bila template ini belum punya aturan pemicu. */
  priority?: number | null;
  when_patterns?: string[] | null;
  also_pattern?: string | null;
  unless_patterns?: string[] | null;
  flags?: string | null;
  why?: string | null;
};

export type HasilSumberLuar = {
  templates: number;
  aturan: number;
  /** Aturan yang dibuang karena polanya tidak sah, beserta sebabnya. */
  ditolak: string[];
};

/**
 * Pasang pustaka & aturan dari tabel, menggantikan berkas .md.
 * Daftar kosong berarti kembali ke berkas.
 */
export function setSumberLuar(baris: BarisPustakaRouter[]): HasilSumberLuar;

/** Kembali membaca berkas .md. */
export function bersihkanSumberLuar(): HasilSumberLuar;

/** Sumber yang sedang dipakai Lapis 1. */
export function getSumberAktif(): "berkas" | "supabase";

/** Pustaka dari BERKAS saja, mengabaikan sumber luar. */
export function getPustakaBerkas(): Map<string, string>;

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

/** Hasil pemeriksaan Gerbang 0. */
export type HasilSatpam = {
  /** refund_retur | barang_bermasalah | sengketa | keamanan | tanaman_rusak | minta_manusia | luar_marketplace */
  kategori: string;
  /** Butir claude-core.md yang menjadi dasar penahanan. */
  why: string;
  /** Potongan teks yang memicu — ditampilkan ke CS agar sebabnya jelas. */
  cocok: string;
};

/**
 * Pesan dicegat Gerbang 0 dan wajib ditangani CS manusia.
 * `teks` adalah balasan penerimaan singkat, bukan jawaban.
 */
export type KeputusanHandover = {
  jenis: "handover";
  kode: string;
  teks: string;
  action: "HANDOVER_TO_CS";
  kategori: KategoriAtauKabur;
  berkas: string[];
  alasan: string;
  satpam: HasilSatpam;
};

export type Keputusan = KeputusanTemplate | KeputusanAi | KeputusanHandover;

/**
 * Gerbang 0 — apakah pesan ini wajib langsung ke CS manusia?
 * @returns null bila aman dilanjutkan ke gerbang berikutnya.
 */
/**
 * Kalimat handover baku, dengan tiga lapis cadangan.
 *
 * Diekspor sejak 10 Sep 2026 untuk Gerbang -0.5 di /api/chat:
 * pesan berlampiran dialihkan ke CS dan harus memakai kalimat yang
 * SAMA dengan Gerbang 0. Menyalin kalimatnya berarti dua teks yang
 * harus dijaga tetap sepadan, dan yang satu pasti tertinggal.
 */
export function teksHandover(): string;

export function periksaSatpam(pesanPelanggan: string): HasilSatpam | null;

export function getKategoriSatpam(): { kategori: string; why: string }[];

/** Satu baris keluaran public.satpam_router(). */
export type BarisSatpamRouter = {
  kategori: string;
  priority: number | null;
  when_patterns: string[] | null;
  also_pattern: string | null;
  unless_patterns: string[] | null;
  flags: string | null;
  why: string | null;
};

export type HasilSatpamLuar = {
  /** Aturan Gerbang 0 yang berhasil disusun dari tabel. */
  aturan: number;
  /** Aturan yang dibuang karena polanya tidak sah, beserta sebabnya. */
  ditolak: string[];
};

/**
 * Pasang aturan Gerbang 0 dari tabel, menggantikan daftar di kode.
 *
 * Daftar kosong — atau daftar yang SELURUH polanya tidak sah —
 * berarti kembali ke daftar di kode secara utuh. Gerbang 0 tidak
 * pernah berjalan tanpa aturan sama sekali.
 */
export function setSatpamLuar(baris: BarisSatpamRouter[]): HasilSatpamLuar;

/** Kembali memakai daftar SATPAM di kode. */
export function bersihkanSatpamLuar(): HasilSatpamLuar;

/** Sumber yang sedang dipakai Gerbang 0. */
export function getSumberSatpam(): "kode" | "supabase";

/** Berapa aturan Gerbang 0 yang sedang berlaku. */
export function jumlahSatpam(): number;

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
