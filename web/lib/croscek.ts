"use client";

/* ===========================================================
   Keadaan papan croscek: tanda "sudah dicek", posisi jendela,
   dan apakah papannya terbuka.

   BERTAHAN SETELAH REFRESH, DAN ITU BUKAN KENYAMANAN

   Daftar dari tim gudang bisa berisi 50 nomor. Memeriksanya satu
   per satu memakan waktu, diselingi membalas chat lain, kadang
   diselingi memuat ulang halaman. Kalau tandanya hilang setiap
   halaman dimuat ulang, papan ini justru menambah pekerjaan:
   CS harus mengingat sendiri sudah sampai mana.

   Disimpan di localStorage, bukan di Supabase. Ini catatan kerja
   satu orang untuk satu sesi, bukan data yang perlu dilihat tim —
   dan menaruhnya di database berarti membuat tabel, kebijakan RLS,
   serta pertanyaan "punya siapa" untuk sesuatu yang umurnya
   beberapa jam.

   Setiap akses dibungkus try/catch. localStorage bisa melempar,
   bukan hanya kosong: jendela penyamaran, setelan yang memblokir
   penyimpanan situs, atau kuota penuh. Papan yang gagal memuat
   posisinya harus tetap terbuka di posisi bawaan, bukan
   menjatuhkan seluruh halaman Chat.
   =========================================================== */

import { useSyncExternalStore } from "react";

const KUNCI = "infarm_croscek_v1";

export type PosisiPapan = { x: number; y: number };

type Keadaan = {
  buka: boolean;
  posisi: PosisiPapan;
  /**
   * Nomor yang sedang dikerjakan, apa adanya seperti ditempel.
   *
   * PAPAN MEMILIKI DAFTARNYA SENDIRI, TIDAK MENUMPANG search.terms.
   *
   * Awalnya papan membaca daftar dari lib/search.ts. Akibatnya
   * setelah halaman dimuat ulang, tanda centang tetap tersimpan
   * tetapi daftarnya lenyap — papan menganggap dirinya terbuka lalu
   * menyembunyikan diri karena tidak punya baris. Progres beberapa
   * jam masih ada di localStorage, tanpa satu pun cara melihatnya.
   *
   * Keduanya memang beda umur: search.terms adalah penyaring
   * sesaat, daftar ini adalah tugas yang berlangsung berjam-jam.
   * Menyatukannya berarti yang berumur panjang ikut mati bersama
   * yang berumur pendek.
   */
  nomor: string[];
  /** Kunci ternormalkan dari nomor yang sudah dicek. */
  sudah: string[];
};

const AWAL: Keadaan = { buka: false, posisi: { x: 24, y: 96 }, nomor: [], sudah: [] };

function muat(): Keadaan {
  if (typeof window === "undefined") return AWAL;
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return AWAL;
    const d = JSON.parse(mentah) as Partial<Keadaan>;
    return {
      buka: Boolean(d.buka),
      posisi:
        d.posisi && typeof d.posisi.x === "number" && typeof d.posisi.y === "number"
          ? d.posisi
          : AWAL.posisi,
      nomor: Array.isArray(d.nomor) ? d.nomor.filter((s) => typeof s === "string") : [],
      sudah: Array.isArray(d.sudah) ? d.sudah.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return AWAL;
  }
}

let state: Keadaan = muat();
const listeners = new Set<() => void>();

function simpan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(state));
  } catch {
    // Penyimpanan penuh atau diblokir. Papannya tetap jalan untuk
    // sesi ini; yang hilang hanya kemampuan mengingat setelah
    // halaman dimuat ulang.
  }
}

function ubah(next: Keadaan) {
  state = next;
  simpan();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = () => state;
/* Dipakai React saat hidrasi. Mengembalikan nilai bawaan — BUKAN
   isi localStorage — supaya render server dan render pertama klien
   sama persis. Tanpa ini, papan yang tersimpan terbuka akan memicu
   ketidakcocokan hidrasi. */
const getServerSnapshot = () => AWAL;

export function useCroscek(): Keadaan {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function bukaPapan(buka: boolean) {
  ubah({ ...state, buka });
}

/**
 * Mulai tugas croscek baru dengan daftar nomor yang baru ditempel.
 *
 * TANDA LAMA DIPANGKAS, TIDAK DIBIARKAN MENUMPUK.
 *
 * Yang dipertahankan hanya tanda untuk nomor yang MASIH ada di
 * daftar baru. Dua alasan: localStorage tidak tumbuh selamanya,
 * dan nomor yang kebetulan muncul lagi berbulan-bulan kemudian
 * tidak tiba-tiba tampil "sudah dicek" karena pernah dicek pada
 * tugas yang sama sekali berbeda.
 *
 * @param nomor daftar apa adanya; urutannya dipertahankan karena
 *        CS membandingkannya baris demi baris dengan pesan gudang.
 * @param kunci kunci ternormalkan dari daftar itu, dihitung
 *        pemanggil (lib/cocok.ts) supaya berkas ini tetap tanpa
 *        impor dan bisa dijalankan Node.
 */
export function mulaiCroscek(nomor: string[], kunci: string[]) {
  const masih = new Set(kunci);
  ubah({
    ...state,
    nomor,
    sudah: state.sudah.filter((s) => masih.has(s)),
    buka: true,
  });
}

/** Tutup papan DAN buang daftarnya — tugasnya dianggap selesai. */
export function selesaikanCroscek() {
  ubah({ ...state, nomor: [], sudah: [], buka: false });
}

export function geserPapan(posisi: PosisiPapan) {
  ubah({ ...state, posisi });
}

/** Tandai / batalkan tanda satu nomor. `kunci` sudah ternormalkan. */
export function tandaiCroscek(kunci: string) {
  const ada = state.sudah.includes(kunci);
  ubah({
    ...state,
    sudah: ada ? state.sudah.filter((s) => s !== kunci) : [...state.sudah, kunci],
  });
}

/** Hapus seluruh tanda, tanpa menutup papan. */
export function kosongkanCroscek() {
  ubah({ ...state, sudah: [] });
}
