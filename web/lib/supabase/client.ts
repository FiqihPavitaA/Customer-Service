/* ===========================================================
   Klien Supabase untuk browser (Step 7).

   SATU aturan yang menentukan seluruh perilaku berkas ini:
   selama NEXT_PUBLIC_SUPABASE_URL & _ANON_KEY belum diisi,
   getSupabase() mengembalikan null dan aplikasi tetap berjalan
   di mode demo seperti sebelumnya. Tidak ada layar error, tidak
   ada halaman kosong.

   Alasannya praktis: skema database baru akan dijalankan pemilik
   proyek, dan sampai itu terjadi console harus tetap bisa
   didemokan. Jadi "menyalakan Supabase" cukup dengan mengisi dua
   baris di .env.local — tidak ada kode yang perlu diubah.

   Kenapa anon key aman ditaruh di browser: yang menjaga data
   bukan kerahasiaan key ini, melainkan aturan RLS di
   supabase/schema.sql. service_role key TIDAK BOLEH dipakai di
   sisi klien — kunci itu menembus seluruh RLS.
   =========================================================== */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Apakah kredensial Supabase sudah diisi?
 * Dipakai untuk memilih antara mode demo dan mode nyata.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

/**
 * Ref proyek dari URL, mis. "abcdefghij" pada
 * https://abcdefghij.supabase.co — untuk panel diagnosa.
 *
 * Gunanya satu dan penting: memastikan aplikasi bicara dengan
 * proyek yang SAMA dengan yang dibuka di dashboard Supabase.
 * Kalau berbeda, semua gejalanya menyerupai masalah izin — data
 * ada di layar SQL Editor, tetapi tidak pernah ada di aplikasi.
 */
export function projectRef(): string | null {
  const cocok = /^https?:\/\/([^.]+)\./.exec(URL ?? "");
  return cocok ? cocok[1] : null;
}

let client: SupabaseClient | null = null;

/**
 * Klien Supabase bersama — satu instance untuk seluruh aplikasi.
 *
 * Sengaja satu instance: tiap createClient() membuat langganan
 * Realtime dan penyimpan sesi sendiri, jadi memanggilnya berulang
 * membuat beberapa koneksi WebSocket ke project yang sama.
 *
 * @returns null bila kredensial belum diisi (mode demo).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(URL!, ANON!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Sesi disimpan di localStorage peramban, bukan cookie, jadi
      // route handler di server TIDAK ikut melihat sesi ini. Itu
      // disengaja: /api/chat memakai kunci Anthropic milik server
      // dan memang tidak perlu tahu siapa yang login.
      detectSessionInUrl: false,
    },
  });
  return client;
}
