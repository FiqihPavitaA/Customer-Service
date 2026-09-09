-- ===========================================================
-- Jeda AI setelah handover ke CS
-- ===========================================================
-- Dijalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- MASALAH YANG DISELESAIKAN
--
-- Sebelum ini, `/api/chat` memutuskan HANDOVER_TO_CS lalu membuang
-- keputusannya: tidak ada baris yang ditulis, jadi tidak ada CS yang
-- tahu, dan AI tetap akan menjawab pesan berikutnya di percakapan
-- yang sama. Untuk kasus refund dan komplain itu justru yang paling
-- dilarang `claude-core.md`.
--
-- SATU KOLOM, BUKAN BOOLEAN
--
-- Godaannya adalah `ai_paused boolean` — lalu butuh aturan kedua
-- tentang siapa yang mematikannya, dan penjadwal yang menjalankannya.
-- Satu stempel waktu tidak butuh keduanya: jeda berakhir sendiri
-- karena waktu berjalan. Tidak ada cron, tidak ada pekerjaan latar,
-- tidak ada keadaan yang bisa tersangkut menyala selamanya.
--
--   ai_paused_until > now()   -> sedang ditangani manusia, AI diam
--   null / sudah lewat        -> AI boleh menjawab
--
-- SIAPA YANG MEMAJUKAN JAMNYA
--
-- Handover menaruhnya di +24 jam. Balasan CS memajukannya lagi 24
-- jam dari saat balasan itu. Pesan PELANGGAN sengaja tidak — kalau
-- pelanggan bisa menahan AI hanya dengan mengetik, satu orang yang
-- rajin menulis bisa mematikan AI di percakapannya selamanya.

alter table public.conversations
  add column if not exists ai_paused_until timestamptz;

comment on column public.conversations.ai_paused_until is
  'Selama > now(), /api/chat menolak menjawab percakapan ini karena '
  'sedang ditangani CS manusia. Diisi saat handover (+24 jam) dan '
  'dimajukan setiap balasan CS. Null = tidak pernah dialihkan.';

-- Indeks parsial: yang dicari selalu "masih dijeda", dan baris yang
-- ai_paused_until-nya null adalah mayoritas — tidak perlu diindeks.
create index if not exists conversations_ai_paused_idx
  on public.conversations (ai_paused_until)
  where ai_paused_until is not null;

-- ===========================================================
-- Catatan: kolom `messages` TIDAK berubah
-- ===========================================================
-- Nilai role bertambah satu — 'cs' untuk balasan manusia, di
-- samping 'user' dan 'assistant' — tetapi `messages` bertipe jsonb
-- tanpa CHECK, jadi tidak ada perubahan skema yang diperlukan.
-- Yang berubah hanya kontrak di web/lib/db/types.ts.
--
-- Kenapa nilai ketiga ini perlu: sebelumnya balasan CS ditulis
-- sebagai 'assistant', persis sama dengan balasan AI. Akibatnya
-- tidak ada satu pun cara mengetahui apakah sebuah percakapan sudah
-- disentuh manusia — dan aturan "eskalasi selesai saat CS membalas"
-- mustahil dijalankan.
