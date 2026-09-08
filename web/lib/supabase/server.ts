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
