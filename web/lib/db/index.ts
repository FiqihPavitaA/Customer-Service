/* ===========================================================
   Titik masuk lapisan data.

   MODE DITENTUKAN OTOMATIS, bukan diketik tangan:

     NEXT_PUBLIC_SUPABASE_URL & _ANON_KEY terisi -> "supabase"
     belum terisi                                -> "memory"

   Kenapa otomatis: kalau modenya berupa konstanta yang harus
   diubah manual, cepat atau lambat akan ada keadaan di mana
   konstantanya bilang "supabase" sementara .env.local kosong —
   dan gejalanya adalah halaman kosong tanpa pesan galat, yang
   sulit ditebak sebabnya. Dengan cara ini keduanya tidak mungkin
   berbeda.

   Menyalakan Supabase karena itu = mengisi dua baris di
   web/.env.local, lalu jalankan ulang dev server. Tidak ada kode
   yang perlu disentuh.

   ----------------------------------------------------------
   CARA KERJANYA (sejak Step 7)
   ----------------------------------------------------------
   store.ts adalah satu-satunya jalur data, dan ia write-through:
   membaca dari Supabase saat login, mengirim tiap perubahan ke
   database, dan menyegarkan lewat Realtime bila admin lain ikut
   mengubah. Rencana lama — modul lib/db/supabase.ts terpisah
   berisi fungsi bernama sama — ditinggalkan karena dua
   implementasi dari API yang sama pasti menyimpang diam-diam.

   Yang TIDAK ikut ke Supabase, dan alasannya:
     useReviews / useRefunds / useCancels / decideCancels
       -> milik Shopee & TikTok Shop Order/Review API
     useBroadcast / addBroadcastTask
       -> milik Chat Broadcast API tiap marketplace
     lib/db/analytics.ts
       -> hasil agregasi, bukan tabel
   Keempatnya tetap dari seed.ts walau Supabase menyala. Menyalin
   data milik marketplace ke tabel kita berarti menyimpan angka
   yang bisa basi kapan saja tanpa kita tahu.
   =========================================================== */

import { isSupabaseConfigured } from "@/lib/supabase/client";

export const DB_MODE: "memory" | "supabase" = isSupabaseConfigured()
  ? "supabase"
  : "memory";

/** Ditampilkan di UI supaya penonton demo tahu datanya belum nyata. */
export const DB_MODE_LABEL =
  DB_MODE === "supabase"
    ? "Tersambung Supabase"
    : "Mode demo — data contoh, belum tersambung Supabase";

export * from "./types";
export * from "./store";
export {
  DEMO_TODAY,
  DEMO_USER,
  SEED_PROFILES,
} from "./seed";
