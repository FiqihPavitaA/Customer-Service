/* ===========================================================
   Lapisan 1 — pencocokan template sebelum memanggil AI.

   Sejak router KB dibuat (2 Sep 2026), seluruh aturan pencocokan
   pindah ke knowledge-base/router.js supaya hanya ada SATU
   pencocok. Berkas ini tinggal jembatan bertipe untuk kode
   Next.js — perilakunya tidak berubah sedikit pun.

   Alasan router ditaruh di berkas .js terpisah, bukan di sini:
   backend/server.js (Express) memakai pencocok yang sama. Kalau
   aturannya ditulis di TypeScript dalam web/lib, dua lingkungan
   itu akan punya dua salinan aturan yang bisa berbeda diam-diam.
   =========================================================== */

import { join } from "node:path";
import {
  matchTemplate as routerMatch,
  getTemplateLibrary as routerLibrary,
  getPustakaBerkas as routerPustakaBerkas,
  getAsalKode as routerAsal,
  getRules as routerRules,
  getSumberAktif as routerSumber,
  jelaskanTidakCocok as routerJelaskan,
  periksaSatpam as routerSatpam,
  ujiDraf as routerUjiDraf,
  buatPolaDariFrasa as routerBuatPola,
  jumlahAturan,
  setKbDir,
} from "@/content/knowledge-base/router.js";
import type {
  AturanSerial,
  HasilUjiDraf,
} from "@/content/knowledge-base/router.js";
import type { Action } from "./knowledge";

/**
 * Router memakai import.meta.url untuk menebak letak berkas KB.
 * Setelah di-bundle Turbopack, nilai itu menunjuk ke chunk hasil
 * build, bukan ke content/knowledge-base — jadi direktorinya
 * ditetapkan eksplisit di sini, sekali saat modul dimuat.
 */
setKbDir(join(process.cwd(), "content", "knowledge-base"));

/**
 * Gerbang 0 — apakah pesan ini wajib langsung ke CS manusia?
 *
 * Diteruskan lewat berkas ini, bukan diimpor langsung dari
 * router.js, supaya setKbDir() di atas dijamin sudah berjalan dan
 * hanya ada satu jembatan bertipe ke router.
 */
export const periksaSatpam = routerSatpam;

export type TemplateMatch = {
  code: string;
  action: Action;
  reply: string;
  /** Alasan aturan ini dianggap aman — ditampilkan untuk audit. */
  why: string;
};

/**
 * Cocokkan pesan pelanggan dengan template.
 * @returns template yang cocok, atau null bila harus diserahkan ke AI.
 */
export function matchTemplate(message: string): TemplateMatch | null {
  return routerMatch(message) as TemplateMatch | null;
}

/**
 * Peta { KODE → isi balasan } dari sumber yang sedang berlaku —
 * tabel `templates` bila sudah dipasang, berkas .md bila belum.
 */
export function getTemplateLibrary(): Map<string, string> {
  return routerLibrary();
}

/**
 * Peta { KODE → isi balasan } dari BERKAS saja.
 *
 * Bedanya dengan getTemplateLibrary() baru terasa setelah tabel
 * dipakai: yang di atas ikut berpindah sumber, yang ini tidak.
 * Dipakai /api/templates sebagai cadangan yang harus tetap berupa
 * cadangan, bukan cermin dari sumber yang sedang diuji.
 */
export function getPustakaBerkas(): Map<string, string> {
  return routerPustakaBerkas();
}

/**
 * Sumber yang sedang dipakai Lapis 1: "berkas" atau "supabase".
 * Ditampilkan di halaman Kelola Template dan /api/health.
 */
export function sumberTemplate(): "berkas" | "supabase" {
  return routerSumber() as "berkas" | "supabase";
}

/**
 * Susun pola pemicu dari frasa biasa yang diketik tim CS.
 *
 * Diteruskan dari router, bukan ditulis ulang, karena di sinilah
 * seluruh karakter khusus di-escape. Salinan kedua yang lupa
 * meng-escape akan mengubah "12.12" jadi pola liar, dan itu bukan
 * kesalahan yang terlihat sampai ada yang mengetiknya.
 */
export function buatPolaDariFrasa(frasa: string[]): string | null {
  return routerBuatPola(frasa) as string | null;
}

/** Peta { KODE -> nama berkas asalnya }. */
export function getAsalKode(): Map<string, string> {
  return routerAsal();
}

/**
 * Ke-43 aturan pemicu dalam bentuk yang bisa dikirim sebagai JSON.
 * Dipakai halaman Kelola Template untuk menunjukkan kata kunci tiap
 * template — dan template mana yang belum punya pemicu sama sekali.
 */
export function getRules(): AturanSerial[] {
  return routerRules();
}

/**
 * Kenapa sebuah pesan tidak tertangkap template — untuk kotak
 * "Uji coba". Sengaja diambil dari router, bukan ditulis ulang di
 * sisi Next.js: pengaman dan penjelasannya harus tetap satu tempat.
 */
export function jelaskanTidakCocok(pesan: string): string | null {
  return routerJelaskan(pesan);
}

/**
 * Uji kata kunci yang BELUM tersimpan sebagai aturan — dipakai form
 * "Tambah Template". Tanpa ini tim CS harus menyimpan dulu baru tahu
 * apakah kata kuncinya menangkap, yaitu menebak.
 */
export function ujiDraf(pesan: string, frasa: string[]): HasilUjiDraf {
  return routerUjiDraf(pesan, frasa);
}

export type { AturanSerial, HasilUjiDraf };

export function templateStats() {
  return { rules: jumlahAturan(), templates: routerLibrary().size };
}
