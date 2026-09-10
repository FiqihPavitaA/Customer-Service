-- ===========================================================
-- Data peragaan alur handover — untuk demo ke tim CS
-- ===========================================================
-- Jalankan PAGI HARI SEBELUM DEMO di SQL Editor Supabase.
--
-- Kenapa pagi hari, bukan jauh-jauh hari: lama menunggu dihitung
-- dari `now()` saat baris ini dibuat. Kalau dijalankan seminggu
-- lalu, badge-nya berbunyi "7 hari" — bukan angka yang menunjukkan
-- gunanya sebuah antrean.
--
-- Aman diulang (on conflict do update), dan ada perintah
-- pembersihan di bagian akhir.
--
-- ⚠️ SEMUA KALIMAT PELANGGAN DI SINI SUDAH DIVERIFIKASI GRATIS
--
-- Tiap kalimat sudah diuji lewat routeToCategory() dan berhenti di
-- Gerbang 0 dengan kode [DITERUSKAN CS] — Claude tidak dipanggil,
-- biayanya Rp 0. JANGAN mengarang kalimat lain saat demo: kalimat
-- yang tidak tertangkap Gerbang 0 langsung diteruskan ke Sonnet
-- dan memotong saldo sungguhan. Contoh yang MELESET dan terlihat
-- meyakinkan: "Min, paket saya belum sampai padahal sudah 7 hari"
-- — tidak ada satu pun kata pemicu di dalamnya.

-- -----------------------------------------------------------
-- 1. Empat percakapan
-- -----------------------------------------------------------

insert into public.conversations
  (id, platform, customer_id, customer_name, shop_name, order_id,
   tracking_no, action, unread, messages, handover_summary,
   handover_detail, ai_paused_until, created_at, updated_at, last_message_at)
values
  -- D1 — sudah lama menunggu. Badge MERAH, dan AI sedang dijeda.
  ('d0000000-0000-4000-8000-000000000001',
   'shopee', 'demo_sari', 'sari.wulandari', 'infarm · Shopee',
   '260909DEMO1', 'JX99887766', 'HANDOVER_TO_CS', true,
   jsonb_build_array(
     jsonb_build_object(
       'role', 'user',
       'content', 'kak barangnya rusak pas sampe, mau refund',
       'timestamp', to_char(now() - interval '28 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00')),
     jsonb_build_object(
       'role', 'assistant',
       'content', 'Halo kak, terima kasih infonya 🙏 Untuk hal ini kakak akan dibantu langsung oleh tim CS kami ya, mohon ditunggu sebentar.',
       'timestamp', to_char(now() - interval '27 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00'))
   ),
   'Dialihkan oleh Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS.' || chr(10) || chr(10) ||
     'Pesan pelanggan:' || chr(10) || '"kak barangnya rusak pas sampe, mau refund"',
   jsonb_build_object(
     'Dialihkan oleh', 'Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS',
     'Sudah dibalas otomatis', 'Ya'),
   now() + interval '23 hours',
   now() - interval '30 minutes', now() - interval '27 minutes', now() - interval '27 minutes'),

  -- D2 — baru masuk. Badge HIJAU. Dipakai memperagakan "CS membalas".
  ('d0000000-0000-4000-8000-000000000002',
   'tiktok', 'demo_agus', 'agus.pratama', 'Infarm Jakarta · TikTok Shop',
   '260909DEMO2', null, 'HANDOVER_TO_CS', true,
   jsonb_build_array(
     jsonb_build_object(
       'role', 'user',
       'content', 'kak saya mau retur barangnya',
       'timestamp', to_char(now() - interval '6 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00')),
     jsonb_build_object(
       'role', 'assistant',
       'content', 'Halo kak, terima kasih infonya 🙏 Untuk hal ini kakak akan dibantu langsung oleh tim CS kami ya, mohon ditunggu sebentar.',
       'timestamp', to_char(now() - interval '6 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00'))
   ),
   'Dialihkan oleh Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS.' || chr(10) || chr(10) ||
     'Pesan pelanggan:' || chr(10) || '"kak saya mau retur barangnya"',
   jsonb_build_object(
     'Dialihkan oleh', 'Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS',
     'Sudah dibalas otomatis', 'Ya'),
   now() + interval '24 hours',
   now() - interval '8 minutes', now() - interval '6 minutes', now() - interval '6 minutes'),

  -- D3 — BELUM dialihkan. Inilah yang ditekan ✨ saat demo, supaya
  -- penonton melihat barisnya LAHIR, bukan sudah ada sejak awal.
  ('d0000000-0000-4000-8000-000000000003',
   'shopee', 'demo_rina', 'rina.kusuma', 'Infarm Yogyakarta · Shopee',
   '260909DEMO3', null, null, true,
   jsonb_build_array(
     jsonb_build_object(
       'role', 'user',
       'content', 'botolnya bocor semua, minta ganti dong',
       'timestamp', to_char(now() - interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00'))
   ),
   null, null, null,
   now() - interval '2 minutes', now() - interval '2 minutes', now() - interval '2 minutes'),

  -- D4 — pertanyaan biasa. Pembanding: TIDAK masuk antrean, dan
  -- membalasnya tidak mematikan AI. Ini bagian yang paling sering
  -- disalahpahami, jadi sebaiknya ikut diperagakan.
  ('d0000000-0000-4000-8000-000000000004',
   'lazada', 'demo_dewi', 'dewi.anggraini', 'Infarm Surabaya · Lazada',
   null, null, 'AUTO_REPLY', false,
   jsonb_build_array(
     jsonb_build_object(
       'role', 'user',
       'content', 'mau tanya dosis NPK berapa ya',
       'timestamp', to_char(now() - interval '15 minutes', 'YYYY-MM-DD"T"HH24:MI:SSOF:00'))
   ),
   null, null, null,
   now() - interval '15 minutes', now() - interval '15 minutes', now() - interval '15 minutes')

on conflict (id) do update set
  messages         = excluded.messages,
  action           = excluded.action,
  unread           = excluded.unread,
  handover_summary = excluded.handover_summary,
  handover_detail  = excluded.handover_detail,
  ai_paused_until  = excluded.ai_paused_until,
  created_at       = excluded.created_at,
  updated_at       = excluded.updated_at,
  last_message_at  = excluded.last_message_at;

-- -----------------------------------------------------------
-- 2. Dua eskalasi terbuka
-- -----------------------------------------------------------
-- Selisih waktunya disengaja: 27 menit membuat badge D1 MERAH
-- (ambang genting 10 menit), 6 menit membuat D2 tetap hijau.
-- Tanpa dua warna di layar yang sama, "memerah lewat 10 menit"
-- cuma klaim lisan.

insert into public.escalations (id, conversation_id, reason, status, created_at)
values
  ('e0000000-0000-4000-8000-0000000000d1',
   'd0000000-0000-4000-8000-000000000001',
   'Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS',
   'open', now() - interval '27 minutes'),
  ('e0000000-0000-4000-8000-0000000000d2',
   'd0000000-0000-4000-8000-000000000002',
   'Gerbang 0 (kata kunci pengaman) — DITERUSKAN CS',
   'open', now() - interval '6 minutes')
on conflict (id) do update set
  status     = excluded.status,
  created_at = excluded.created_at;

-- -----------------------------------------------------------
-- 3. Periksa hasilnya
-- -----------------------------------------------------------

select
  c.customer_name,
  c.action,
  e.status                                              as eskalasi,
  round(extract(epoch from (now() - e.created_at)) / 60) as menunggu_menit,
  case when c.ai_paused_until > now() then 'ya' else 'tidak' end as ai_dijeda
from public.conversations c
left join public.escalations e
  on e.conversation_id = c.id and e.status = 'open'
where c.id::text like 'd0000000%'
order by c.customer_name;

-- Harapannya:
--   agus.pratama    HANDOVER_TO_CS  open   ~6    ya
--   dewi.anggraini  AUTO_REPLY      (null) (null) tidak
--   rina.kusuma     (null)          (null) (null) tidak
--   sari.wulandari  HANDOVER_TO_CS  open   ~27   ya
--
-- Keempatnya sengaja ditaruh di TOKO YANG BERBEDA:
--
--   sari.wulandari   infarm              Shopee
--   agus.pratama     Infarm Jakarta      TikTok Shop
--   rina.kusuma      Infarm Yogyakarta   Shopee
--   dewi.anggraini   Infarm Surabaya     Lazada
--
-- Kalau semuanya di satu toko, mengklik toko di panel kiri console
-- tidak mengubah apa pun yang terlihat — dan penyaringan yang
-- bekerja jadi tidak bisa dibedakan dari penyaringan yang rusak.
-- Nama tokonya harus persis sama dengan DAFTAR_TOKO di
-- web/lib/toko.ts; nama di luar daftar itu tidak akan pernah muncul
-- di panel mana pun.

-- -----------------------------------------------------------
-- 4. PEMBERSIHAN — jalankan SETELAH demo selesai
-- -----------------------------------------------------------
-- Hapus tanda komentar di bawah lalu jalankan. Eskalasinya ikut
-- terhapus sendiri lewat `on delete cascade`.
--
-- delete from public.conversations where id::text like 'd0000000%';
