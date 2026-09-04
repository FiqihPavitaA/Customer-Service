"use client";

/* ===========================================================
   Store daftar template untuk halaman Kelola Template.

   Dipisah dari store.ts karena sumbernya berbeda. store.ts
   berangkat dari seed di memori; berkas ini berangkat dari
   /api/templates, yang membaca berkas .md yang SAMA dengan yang
   dipakai pencocok template dan system prompt.

   ----------------------------------------------------------
   BATASAN YANG DISENGAJA — DIBERITAHUKAN, BUKAN DISEMBUNYIKAN
   ----------------------------------------------------------
   Perubahan yang disimpan di sini hidup di memori satu tab saja.
   Berkas .md TIDAK ikut berubah, dan muat ulang halaman
   mengembalikan semuanya seperti semula.

   Ini bukan kelalaian, melainkan keadaan sementara: sumber data
   yang dituju adalah tabel `templates` + `template_rules` di
   Supabase (sudah dirancang di supabase/schema-kb.sql), dan pada
   4 Sep 2026 project Supabase belum bisa dibuat karena gangguan
   sistem di sisi Supabase.

   Menulis balik ke berkas .md sengaja TIDAK dipilih sebagai jalan
   pintas: berkas ada di repo, jadi setiap perubahan tetap butuh
   commit dan deploy — yaitu tetap butuh developer, yang justru
   masalah yang ingin dihapus halaman ini.

   Yang harus dikerjakan saat Supabase menyala:
     hydrate       -> select * from templates join template_rules
     simpanTemplate-> update templates ... (trigger mencatat versi)
     tambahTemplate-> insert into templates
     hapusTemplate -> update templates set is_active = false
                      (BUKAN delete — routing_log merujuk kodenya)
   =========================================================== */

import { useCallback, useSyncExternalStore } from "react";
import type {
  RingkasanTemplate,
  TemplateItem,
  TemplatesResponse,
} from "./templateTypes";

type Status = "idle" | "memuat" | "siap" | "gagal";

type State = {
  status: Status;
  items: TemplateItem[];
  ringkasan: RingkasanTemplate | null;
  error: string | null;
  /** Berapa perubahan yang belum tersimpan ke mana pun. */
  perubahanLokal: number;
};

let state: State = {
  status: "idle",
  items: [],
  ringkasan: null,
  error: null,
  perubahanLokal: 0,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTemplateStore<T>(selector: (s: State) => T): T {
  const get = useCallback(() => selector(state), [selector]);
  return useSyncExternalStore(subscribe, get, get);
}

const pilihSemua = (s: State) => s;

export function useTemplates() {
  return useTemplateStore(pilihSemua);
}

let sedangMuat: Promise<void> | null = null;

/** Ambil daftar template dari server. Aman dipanggil berulang. */
export function muatTemplates(): Promise<void> {
  if (sedangMuat) return sedangMuat;
  if (state.status === "siap") return Promise.resolve();

  setState({ status: "memuat", error: null });

  sedangMuat = fetch("/api/templates")
    .then((r) => r.json() as Promise<TemplatesResponse>)
    .then((d) => {
      if (d.error) {
        setState({ status: "gagal", error: d.error });
        return;
      }
      setState({
        status: "siap",
        items: d.items,
        ringkasan: d.ringkasan,
        error: null,
      });
    })
    .catch((e: Error) => {
      setState({ status: "gagal", error: e.message });
    })
    .finally(() => {
      sedangMuat = null;
    });

  return sedangMuat;
}

/** Hitung ulang ringkasan setelah daftar berubah. */
function hitungRingkasan(items: TemplateItem[]): RingkasanTemplate {
  const perKategori = {
    interaksi: { total: 0, punyaPemicu: 0 },
    "cara-pakai": { total: 0, punyaPemicu: 0 },
    produk: { total: 0, punyaPemicu: 0 },
    umum: { total: 0, punyaPemicu: 0 },
  } as RingkasanTemplate["perKategori"];

  for (const i of items) {
    perKategori[i.kategori].total++;
    if (i.urutanAturan !== null) perKategori[i.kategori].punyaPemicu++;
  }

  const punyaPemicu = items.filter((i) => i.urutanAturan !== null).length;
  return {
    total: items.length,
    punyaPemicu,
    tanpaPemicu: items.length - punyaPemicu,
    perKategori,
  };
}

/** Simpan perubahan satu template (sementara: memori saja). */
export function simpanTemplate(code: string, patch: Partial<TemplateItem>) {
  const items = state.items.map((i) => (i.code === code ? { ...i, ...patch } : i));
  setState({
    items,
    ringkasan: hitungRingkasan(items),
    perubahanLokal: state.perubahanLokal + 1,
  });
}

/** Tambah template baru. @returns pesan galat, atau null bila berhasil. */
export function tambahTemplate(item: TemplateItem): string | null {
  const kode = item.code.trim().toUpperCase();
  if (!kode) return "Kode template belum diisi.";
  if (state.items.some((i) => i.code === kode)) {
    return `Kode [${kode}] sudah dipakai template lain.`;
  }
  if (!item.body.trim()) return "Isi jawaban belum diisi.";

  const items = [{ ...item, code: kode }, ...state.items];
  setState({
    items,
    ringkasan: hitungRingkasan(items),
    perubahanLokal: state.perubahanLokal + 1,
  });
  return null;
}

/**
 * Hapus template.
 *
 * Di Supabase nanti ini menjadi `is_active = false`, bukan DELETE:
 * routing_log menyimpan kode template yang pernah menjawab, dan
 * menghapus barisnya membuat riwayat biaya kehilangan artinya.
 */
export function hapusTemplate(code: string) {
  const items = state.items.filter((i) => i.code !== code);
  setState({
    items,
    ringkasan: hitungRingkasan(items),
    perubahanLokal: state.perubahanLokal + 1,
  });
}
