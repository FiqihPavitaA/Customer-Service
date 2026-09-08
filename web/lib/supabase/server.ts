/* ===========================================================
   Klien Supabase untuk sisi SERVER (route handler).

   Terpisah dari client.ts karena dua alasan yang keduanya penting:

   1. client.ts menyalakan persistSession & autoRefreshToken, yang
      bersandar pada localStorage. Di server benda itu tidak ada,
      dan satu instance yang dipakai bersama antar permintaan bisa
      membocorkan sesi satu pengguna ke permintaan pengguna lain.

   2. Kunci yang dipakai tetap ANON, bukan service_role. Route
      handler di sini hanya memanggil satu fungsi — cari_template()
      — yang dibuat `security definer` dan hanya bisa membaca teks
      template. service_role akan menembus SELURUH aturan RLS untuk
      keuntungan yang tidak dibutuhkan sama sekali.
   =========================================================== */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** @returns null bila kredensial belum diisi (mode demo). */
export function getSupabaseServer(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  client ??= createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Klien yang bertindak SEBAGAI pengguna yang sedang login.
 *
 * Kenapa tokennya harus dikirim manual dari peramban: sesi console
 * disimpan di localStorage, bukan cookie (lihat client.ts), jadi
 * route handler tidak pernah melihatnya sendiri. Tanpa ini, setiap
 * penulisan ke tabel `templates` berjalan sebagai anon dan ditolak
 * kebijakan `templates_write ... using (public.is_admin())`.
 *
 * DUA HAL YANG MEMBUAT INI AMAN, dan keduanya perlu
 *
 *   1. Instansnya BARU setiap permintaan, tidak pernah dipakai
 *      bersama. Satu instans bersama yang membawa Authorization
 *      berarti token seorang pengguna ikut terbawa ke permintaan
 *      pengguna berikutnya — kebocoran sesi yang sulit terlihat
 *      karena hasilnya tetap "berhasil".
 *
 *   2. Kuncinya tetap ANON, bukan service_role. Token hanya
 *      MENAMBAH identitas; RLS tetap berlaku penuh. Jadi pengguna
 *      dengan peran `cs` yang memaksa memanggil endpoint ini tetap
 *      ditolak database, bukan hanya oleh tombol yang disembunyikan
 *      di layar.
 *
 * @param token access_token dari sesi Supabase di peramban.
 * @returns null bila kredensial belum diisi atau token kosong.
 */
export function getSupabaseSebagai(token: string | null): SupabaseClient | null {
  if (!URL || !ANON || !token) return null;
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Ambil access_token dari header Authorization sebuah permintaan.
 * @returns token, atau null bila header tidak ada / bukan Bearer.
 */
export function tokenDariHeader(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const cocok = /^Bearer\s+(.+)$/i.exec(h.trim());
  return cocok ? cocok[1].trim() : null;
}
