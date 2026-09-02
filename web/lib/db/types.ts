/* ===========================================================
   Tipe data — sepadan dengan supabase/schema.sql
   Dibuat pada Step 6b (mode demo, lihat MIGRATION.md Fase 3).

   ATURAN BERKAS INI:
   1. Tipe `*Row` = salinan persis satu tabel di schema.sql.
      Nama kolom, tipe, dan nilai boleh-null-nya tidak boleh
      menyimpang — begitu Supabase dinyalakan, baris yang
      kembali dari `supabase.from(...)` langsung cocok.
   2. Tipe `*Extra` = field yang dipakai UI lama tetapi BELUM
      ada di schema.sql. Sengaja dipisah supaya terlihat jelas
      apa yang masih perlu kolom/tabel baru atau API pesanan
      marketplace, bukan tersamar jadi seolah sudah ada di DB.
   =========================================================== */

/** Empat klasifikasi tindakan (claude.md). Sama dengan CHECK di schema.sql. */
export type ActionCode =
  | "AUTO_REPLY"
  | "ASK_INFORMATION"
  | "HANDOVER_TO_CS"
  | "CHECK_ORDER_SYSTEM";

export type Platform = "shopee" | "tiktok" | "lazada";

/** Satu pesan di dalam kolom `conversations.messages` (jsonb). */
export type ChatMessage = {
  /** 'user' = pelanggan, 'assistant' = balasan toko/AI. */
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

/* ---------------- public.profiles ---------------- */
export type ProfileRow = {
  id: string;
  username: string;
  role: "cs" | "admin";
  created_at: string;
};

/* ---------------- public.conversations ---------------- */
export type ConversationRow = {
  id: string;
  platform: Platform | null;
  customer_id: string | null;
  order_id: string | null;
  messages: ChatMessage[];
  action: ActionCode | null;
  handover_summary: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  shop_name: string | null;
  unread: boolean;
  tracking_no: string | null;
  ai_suggestion: string | null;
  handover_detail: Record<string, string> | null;
  last_message_at: string;
};

/**
 * Dipakai dashboard.html lama, belum ada di schema.sql.
 * `order_*` memang tidak seharusnya jadi kolom: sumbernya API
 * pesanan marketplace (Fase 3 roadmap), bukan tabel kita.
 */
export type ConversationExtra = {
  chat_count: number;
  product_query: string;
  order_status: string | null;
  order_courier: string | null;
};

export type Conversation = ConversationRow & ConversationExtra;

/* ---------------- public.escalations ---------------- */
export type EscalationRow = {
  id: string;
  conversation_id: string | null;
  reason: string | null;
  status: "open" | "resolved";
  assigned_to: string | null;
  created_at: string;
};

/* ---------------- public.settings ---------------- */
export type SettingsRow = {
  id: 1;
  ai_enabled: boolean;
  ai_model: string;
  confidence: number;
  escalation_keywords: string[];
  updated_at: string;
  updated_by: string | null;
};

/* ---------------- public.ai_flags ---------------- */
export type AiFlagRow = {
  id: string;
  code: string | null;
  customer_message: string;
  ai_answer: string;
  ai_action: ActionCode | null;
  correct_answer: string | null;
  category: "produk" | "kebijakan" | "dosis" | "harga" | "lainnya";
  reporter_id: string | null;
  reporter_name: string | null;
  note: string | null;
  status: "menunggu" | "disetujui" | "ditolak";
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

/* ===========================================================
   Di bawah ini BUKAN tabel Supabase.
   Sumber sebenarnya adalah API marketplace (pesanan, ulasan,
   broadcast) atau hasil agregasi (statistik). Selama mode demo
   isinya tetap dari seed; strukturnya dibuat menyerupai bentuk
   respons API supaya penggantinya nanti tidak mengubah UI.
   =========================================================== */

/** Ulasan produk — Shopee/TikTok Review API. */
export type Review = {
  order: string;
  buyer: string;
  prod: string;
  sku: string;
  emoji: string;
  rating: { all: number; produk: number; penjual: number; kirim: number };
  content: string;
  date: string;
  status: "wait" | "done";
};

/** Pengajuan pengembalian dana — Order/Return API. */
export type Refund = {
  order: string;
  buyer: string;
  prod: string;
  jenis: string;
  nominal: string;
  status: "dana" | "batal";
  pill: "refund" | "cancel";
  label: string;
};

/** Permintaan pembatalan — Order/Cancellation API. */
export type Cancel = {
  order: string;
  buyer: string;
  prod: string;
  alasan: string;
  nominal: string;
  status: "menunggu" | "proses" | "batal";
  /** Diisi saat CS menolak pembatalan ('Pesanan Dilanjutkan'). */
  note?: string | null;
};

/** Tugas broadcast per marketplace — Chat Broadcast API. */
export type BroadcastTask = {
  name: string;
  status: "done" | "sending" | "draft";
  plan: number;
  ok: number;
  fail: number;
  by: string;
  at: string;
};

/** Satu SKU dari products.json (katalog produk Infarm). */
export type Product = {
  sku: string;
  nama_produk: string;
  kategori: string;
  product_ids_shopee?: (string | number)[];
};
