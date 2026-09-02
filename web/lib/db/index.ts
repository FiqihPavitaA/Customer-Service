/* ===========================================================
   Titik tukar sumber data — satu-satunya berkas yang berubah
   saat Supabase dinyalakan (Step 6b -> Step 6/7 penuh).

   MODE SEKARANG: "memory"
   Data berasal dari lib/db/seed.ts dan hidup di memori browser
   (lib/db/store.ts). Dipilih atas permintaan pemilik proyek:
   demo dulu, koneksi database setelah disetujui.

   ----------------------------------------------------------
   CARA MENUKAR KE SUPABASE NANTI
   ----------------------------------------------------------
   1. Jalankan supabase/schema.sql di project Supabase.
   2. Isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY
      di web/.env.local (barisnya sudah ada, tinggal dibuka).
   3. npm i @supabase/supabase-js
   4. Buat lib/db/supabase.ts dengan fungsi bernama sama seperti
      yang diekspor store.ts, lalu ganti baris re-export di bawah.

   Pemetaan fungsi -> panggilan Supabase (sudah disiapkan):

     useConversations()      select * from conversations
                             order by last_message_at desc
     useUnreadCount()        select count(*) where unread
     markRead(id)            update conversations set unread=false
     appendMessage(id, txt)  update conversations
                             set messages = messages || $1
     setAiSuggestion(...)    update conversations
                             set ai_suggestion, action
     useSettings()           select * from settings where id = 1
     saveSettings(patch)     update settings set ... where id = 1
     useAiFlags()            select * from ai_flags order by created_at desc

   Yang TIDAK bisa ditukar ke Supabase karena bukan data kita:
     useReviews / useRefunds / useCancels / decideCancels
       -> Shopee & TikTok Shop Order/Review API
     useBroadcast / addBroadcastTask
       -> Chat Broadcast API tiap marketplace
     lib/db/analytics.ts
       -> hasil agregasi conversations + data pesanan
   =========================================================== */

export const DB_MODE = "memory" as const;

/** Ditampilkan di UI supaya penonton demo tahu datanya belum nyata. */
export const DB_MODE_LABEL = "Mode demo — data contoh, belum tersambung Supabase";

export * from "./types";
export * from "./store";
export {
  DEMO_TODAY,
  DEMO_USER,
  SEED_PROFILES,
} from "./seed";
