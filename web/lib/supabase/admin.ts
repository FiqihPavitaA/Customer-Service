import "server-only";

/* ===========================================================
   Klien Supabase dengan service_role — MENEMBUS SELURUH RLS.

   Ini satu-satunya berkas di proyek yang membaca
   SUPABASE_SERVICE_ROLE_KEY, dan kehadirannya adalah pengecualian
   yang disetujui pemilik proyek pada 12 Okt 2026, bukan pola baru.

   UNTUK APA, DAN UNTUK APA TIDAK

   Dipakai   marketplace_shops — berisi token toko, dan memang tidak
             punya policy RLS sama sekali (lihat migrasinya). Tanpa
             service_role, tidak ada cara menulis ke tabel itu.
             orders — ditulis sinkronisasi di server, bukan peramban.

   TIDAK     untuk apa pun yang sudah bisa dilakukan sesi pengguna
   dipakai   lewat RLS. Kalau sebuah route handler "butuh" klien ini
             untuk membaca conversations atau templates, yang salah
             adalah policy-nya, bukan kliennya. Memakai service_role
             sebagai jalan pintas berarti satu bug di route handler
             mana pun menjadi kebocoran seluruh database.

   KENAPA SATU INSTANS BERSAMA DI SINI AMAN, PADAHAL DI server.ts TIDAK

   getSupabaseSebagai() di server.ts membuat instans BARU per
   permintaan karena ia membawa Authorization milik seorang pengguna;
   instans bersama berarti token seseorang terbawa ke permintaan
   orang lain. Klien ini tidak membawa identitas pengguna mana pun —
   ia selalu service_role — jadi tidak ada yang bisa tercampur.

   YANG TIDAK PERNAH DILAKUKAN BERKAS INI

   Mencetak kuncinya, sebagian atau seluruhnya, ke log atau ke pesan
   galat. Galat di bawah hanya menyebut NAMA variabel yang kosong.
   =========================================================== */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let klien: SupabaseClient | null = null;

/** Env belum lengkap. Pesannya hanya menyebut nama variabel. */
export class GalatKonfigurasiAdmin extends Error {
  readonly kurang: readonly string[];

  constructor(kurang: readonly string[]) {
    super(`Belum disetel: ${kurang.join(", ")}`);
    this.name = "GalatKonfigurasiAdmin";
    this.kurang = kurang;
  }
}

/**
 * Klien service_role. Melempar GalatKonfigurasiAdmin bila env kosong,
 * supaya route handler bisa menjawab 503 yang menyebut nama variabel
 * — bukan 500 kosong yang memaksa orang membuka log Vercel.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (klien) return klien;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const kunci = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  const kurang: string[] = [];
  if (!url) kurang.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!kunci) kurang.push("SUPABASE_SERVICE_ROLE_KEY");
  if (kurang.length > 0) throw new GalatKonfigurasiAdmin(kurang);

  klien = createClient(url, kunci, {
    auth: {
      /* Tidak ada sesi pengguna untuk disimpan atau disegarkan. Kedua
         nilai ini juga mencegah klien mencoba membaca localStorage,
         yang memang tidak ada di server. */
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return klien;
}
