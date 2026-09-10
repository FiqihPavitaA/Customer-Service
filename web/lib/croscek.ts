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
  /** Kunci ternormalkan dari nomor yang sudah dicek. */
  sudah: string[];
};

const AWAL: Keadaan = { buka: false, posisi: { x: 24, y: 96 }, sudah: [] };

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
