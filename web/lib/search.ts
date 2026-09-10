"use client";

/* ===========================================================
   Pencarian topbar — state bersama antara <TopBar> dan halaman
   Chat (Step 14).

   Di dashboard.js lama keduanya berada dalam satu berkas, jadi
   variabel `searchField` / `searchSingle` / `searchTerms` cukup
   ditaruh di lingkup modul. Di React keduanya komponen terpisah
   (TopBar di layout, Chat di halaman), jadi state-nya diangkat
   ke store kecil ini — pola yang sama dengan lib/db/store.ts.

   Lingkup pencarian mengikuti dropdown yang sudah ada:
   nama pembeli · nomor pesanan · nomor resi · isi chat · produk.
   =========================================================== */

import { useSyncExternalStore } from "react";

export type SearchScope = "semua" | "nama" | "pesanan" | "resi" | "chat" | "produk";

export const SCOPE_LABEL: Record<SearchScope, string> = {
  semua: "Semua",
  nama: "Nama Pembeli",
  pesanan: "Nomor Pesanan",
  resi: "Nomor Resi",
  chat: "Isi Chat",
  produk: "Nama Produk",
};

/**
 * Lingkup yang mendukung pencarian massal (tempel banyak nomor).
 *
 * "semua" ikut, dan itu perbaikan atas regresi yang dibuat saat
 * lingkup bawaan diubah menjadi "semua": klik 2× di kotak pencarian
 * mendadak tidak melakukan apa-apa, karena fiturnya hanya menyala
 * pada dua lingkup lama. Justru pada lingkup bawaan itulah tim
 * gudang menempelkan daftar nomor pesanannya.
 */
export const MASS_SCOPES: SearchScope[] = ["semua", "pesanan", "resi"];

type SearchState = {
  scope: SearchScope;
  /** Kata kunci ketikan biasa. */
  single: string;
  /** Hasil pencarian massal; bila terisi, `single` diabaikan. */
  terms: string[];
};

/**
 * Lingkup awal "semua", BUKAN "nama".
 *
 * Sebelum ini pencarian terkunci pada satu bidang: dropdown
 * berbunyi "Nama Pembeli", lalu CS menempelkan nomor pesanan dan
 * hasilnya kosong. Tidak ada galat, tidak ada petunjuk — layarnya
 * hanya mengatakan "tidak ada percakapan yang cocok", yang terbaca
 * sebagai "pesanan itu tidak ada di sini" padahal ada.
 *
 * Kegagalan seperti itu mahal justru karena tampak seperti jawaban.
 * Lingkup sempit tetap disediakan untuk yang sengaja mempersempit,
 * tetapi bukan lagi keadaan awal yang harus ditebak orang.
 */
let state: SearchState = { scope: "semua", single: "", terms: [] };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = () => state;

export function useSearch(): SearchState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setScope(scope: SearchScope) {
  state = { scope, single: state.single, terms: [] };
  emit();
}

export function setSingle(single: string) {
  state = { ...state, single, terms: [] };
  emit();
}

/** Pasang hasil pencarian massal (maksimal 50 nomor, tanpa duplikat). */
export function setTerms(raw: string) {
  const terms = [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 50);
  state = { ...state, terms, single: "" };
  emit();
  return terms;
}

export function clearSearch() {
  state = { ...state, single: "", terms: [] };
  emit();
}
