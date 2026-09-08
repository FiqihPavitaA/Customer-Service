"use client";

/* ===========================================================
   Store daftar template untuk halaman Kelola Template.

   Dipisah dari store.ts karena sumbernya berbeda. store.ts
   berangkat dari seed di memori; berkas ini berangkat dari
   /api/templates.

   ----------------------------------------------------------
   RIWAYAT YANG PERLU DIINGAT, KARENA MENJELASKAN BENTUKNYA
   ----------------------------------------------------------
   Sampai 8 September 2026 seluruh fungsi di bawah hanya mengubah
   array di memori satu tab. Menekan "Simpan" terasa berhasil —
   template muncul di daftar, muncul toast — tetapi tidak ada yang
   tertulis ke mana pun, dan muat ulang halaman mengembalikan
   semuanya. Halaman ini memberi tahu keadaannya lewat lencana biru
   dan banner "belum tersimpan ke mana pun", tetapi kedua tanda itu
   ternyata terlalu mudah terlewat.

   Sekarang ketiga fungsinya benar-benar menulis ke tabel
   `templates` di Supabase, dan yang gagal dilaporkan sebagai galat
   — bukan sebagai keberhasilan yang menghilang belakangan.

   ----------------------------------------------------------
   KENAPA TOKEN DIKIRIM MANUAL
   ----------------------------------------------------------
   Sesi Supabase disimpan di localStorage, bukan cookie, jadi route
   handler tidak melihatnya sendiri. Tanpa header Authorization,
   penulisan berjalan sebagai anon dan ditolak kebijakan
   `templates_write ... using (public.is_admin())`.

   Yang menolak tetap database. Kalau suatu hari token itu tidak
   ikut terkirim, akibatnya adalah galat 401 yang terbaca — bukan
   penulisan diam-diam oleh orang yang tidak berhak.
   =========================================================== */

import { useCallback, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase/client";
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
  /** Dari mana daftar ini dibaca; ditampilkan apa adanya di halaman. */
  sumber: "berkas" | "supabase";
  /** Catatan non-fatal dari server (mis. tabel tidak terbaca). */
  peringatan: string | null;
  /** true selama satu penulisan sedang berjalan. */
  menyimpan: boolean;
};

let state: State = {
  status: "idle",
  items: [],
  ringkasan: null,
  error: null,
  sumber: "berkas",
  peringatan: null,
  menyimpan: false,
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

/* ===========================================================
   Header
   =========================================================== */

/**
 * Header permintaan, lengkap dengan token bila ada sesi.
 *
 * Sengaja TIDAK melempar saat sesi tidak ada: membaca daftar
 * template harus tetap bisa dilakukan (jatuh ke berkas .md), dan
 * yang menolak penulisan sebaiknya database dengan pesannya sendiri
 * — bukan tebakan di sisi peramban tentang siapa yang berhak.
 */
async function header(): Promise<HeadersInit> {
  const dasar: Record<string, string> = { "Content-Type": "application/json" };
  const sb = getSupabase();
  if (!sb) return dasar;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) dasar.Authorization = `Bearer ${token}`;
  } catch {
    // Sesi tidak terbaca — biarkan tanpa token; server akan menjawab 401.
  }
  return dasar;
}

/** Ambil pesan galat dari jawaban server, apa pun bentuknya. */
async function pesanGalat(r: Response): Promise<string> {
  try {
    const d = (await r.json()) as { error?: string; peringatan?: string };
    return d.error ?? d.peringatan ?? `Server menjawab ${r.status}.`;
  } catch {
    return `Server menjawab ${r.status}.`;
  }
}

/* ===========================================================
   Membaca
   =========================================================== */

let sedangMuat: Promise<void> | null = null;

/** Ambil daftar template dari server. Aman dipanggil berulang. */
export function muatTemplates(paksa = false): Promise<void> {
  if (sedangMuat) return sedangMuat;
  if (state.status === "siap" && !paksa) return Promise.resolve();

  setState({ status: "memuat", error: null });

  sedangMuat = header()
    .then((h) => fetch("/api/templates", { headers: h, cache: "no-store" }))
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
        sumber: d.sumber,
        peringatan: d.peringatan ?? null,
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

/* ===========================================================
   Menulis
   =========================================================== */

/**
 * Simpan perubahan satu template.
 *
 * @returns pesan galat, atau null bila berhasil.
 */
export async function simpanTemplate(
  code: string,
  patch: Partial<TemplateItem>,
): Promise<string | null> {
  setState({ menyimpan: true });
  try {
    const r = await fetch("/api/templates", {
      method: "PATCH",
      headers: await header(),
      body: JSON.stringify({
        code,
        body: patch.body,
        action: patch.action,
        kategori: patch.kategori,
        catatan: patch.catatan,
        // undefined = jangan disentuh; [] = cabut pemicunya. Dua hal
        // yang berbeda, jadi jangan diratakan jadi satu di sini.
        kataKunci: patch.kataKunci,
        aktif: patch.nonaktif === undefined ? undefined : !patch.nonaktif,
      }),
    });

    if (r.status === 207) {
      // Isinya tersimpan, kata kuncinya tidak. Segarkan daftar supaya
      // yang benar-benar tersimpan terlihat, lalu teruskan
      // peringatannya — penyuntingnya perlu tahu bagian mana yang
      // masih harus diulang.
      const d = (await r.json()) as { peringatan?: string };
      await muatTemplates(true);
      return d.peringatan ?? "Sebagian tersimpan.";
    }
    if (!r.ok) return await pesanGalat(r);

    // Daftar diambil ulang, bukan ditambal di memori. Menambal
    // membuat layar menampilkan hasil yang DIHARAPKAN, sedangkan
    // yang perlu dilihat penyunting adalah yang benar-benar
    // tersimpan — termasuk kolom yang diubah trigger di database.
    await muatTemplates(true);
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    setState({ menyimpan: false });
  }
}

/**
 * Tambah template baru.
 *
 * @returns pesan galat, atau null bila berhasil. Peringatan
 *          separuh-berhasil (template masuk tetapi kata kuncinya
 *          gagal) ikut dikembalikan sebagai teks, karena
 *          penyuntingnya perlu tahu tanpa mengira harus mengulang.
 */
export async function tambahTemplate(item: TemplateItem): Promise<string | null> {
  const kode = item.code.trim().toUpperCase();
  if (!kode) return "Kode template belum diisi.";
  if (state.items.some((i) => i.code === kode)) {
    return `Kode [${kode}] sudah dipakai template lain.`;
  }
  if (!item.body.trim()) return "Isi jawaban belum diisi.";

  setState({ menyimpan: true });
  try {
    const r = await fetch("/api/templates", {
      method: "POST",
      headers: await header(),
      body: JSON.stringify({
        code: kode,
        kategori: item.kategori,
        body: item.body,
        action: item.action,
        kataKunci: item.kataKunci,
        catatan: item.catatan ?? null,
      }),
    });

    if (r.status === 207) {
      // Templatenya tersimpan, aturannya tidak. Daftar tetap
      // disegarkan supaya template yang sudah ada tidak terlihat
      // hilang, lalu peringatannya diteruskan apa adanya.
      const d = (await r.json()) as { peringatan?: string };
      await muatTemplates(true);
      return d.peringatan ?? "Sebagian tersimpan.";
    }
    if (!r.ok) return await pesanGalat(r);

    await muatTemplates(true);
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    setState({ menyimpan: false });
  }
}

/**
 * Matikan template.
 *
 * Di database ini `is_active = false`, BUKAN DELETE: routing_log
 * menyimpan kode template yang pernah menjawab, dan menghapus
 * barisnya membuat riwayat biaya kehilangan artinya. Riwayat
 * penyuntingan dosis di template_revisions pun ikut terhapus lewat
 * ON DELETE CASCADE — justru saat paling dibutuhkan, yaitu setelah
 * sebuah template ditarik.
 *
 * @returns pesan galat, atau null bila berhasil.
 */
export async function hapusTemplate(code: string): Promise<string | null> {
  setState({ menyimpan: true });
  try {
    const r = await fetch(`/api/templates?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: await header(),
    });
    if (!r.ok) return await pesanGalat(r);
    await muatTemplates(true);
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    setState({ menyimpan: false });
  }
}
