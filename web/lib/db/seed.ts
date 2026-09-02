/* ===========================================================
   Seed data — isi awal "database" mode demo (Step 6b).

   Semuanya dipindahkan apa adanya dari data mock halaman lama
   (dashboard.js, pesanan.js, broadcast.js, settings.js) supaya
   tampilan demo persis seperti versi HTML. Yang berubah hanya
   BENTUKNYA: kini mengikuti kolom supabase/schema.sql, bukan
   bentuk bebas per halaman.

   Perubahan bentuk yang disengaja:
   - `side: 'in' | 'out'`  ->  `role: 'user' | 'assistant'`
     (schema.sql: messages jsonb [{role, content, timestamp}])
   - HTML mentah (`<br>`)  ->  teks biasa dengan baris baru.
     Alasan: React merender teks, bukan innerHTML — sekaligus
     menghilangkan jalur XSS yang ada di dashboard.js lama.
   - Waktu tampilan ('06/24 14:06') -> ISO 8601 + offset WIB.
     Format tampilannya dihitung di lib/format.ts.
   =========================================================== */

import type {
  AiFlagRow,
  BroadcastTask,
  Cancel,
  Conversation,
  EscalationRow,
  ProfileRow,
  Refund,
  Review,
  SettingsRow,
} from "./types";

/** Tanggal acuan seluruh data demo (sama dengan "24 Juni 2026" di HTML lama). */
export const DEMO_TODAY = "2026-06-24";

const wib = (hhmm: string, day: string = DEMO_TODAY) => `${day}T${hhmm}:00+07:00`;

/* =============== profiles =============== */
export const SEED_PROFILES: ProfileRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    username: "Infarm.sales",
    role: "admin",
    created_at: wib("08:00", "2026-01-05"),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    username: "CSINFARM2",
    role: "cs",
    created_at: wib("08:00", "2026-02-11"),
  },
];

/** Pengguna yang dianggap sedang login selama demo (belum ada Supabase Auth). */
export const DEMO_USER = SEED_PROFILES[0];

/* =============== conversations =============== */
export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "c0000000-0000-4000-8000-000000000001",
    platform: "shopee",
    customer_id: "diky",
    customer_name: "dikymarzuki",
    shop_name: "infarmofficialshop · Shopee",
    order_id: "584590031216740091",
    tracking_no: "JX1234567890",
    action: "AUTO_REPLY",
    unread: false,
    messages: [
      {
        role: "assistant",
        content:
          "Halo kak, untuk pesanan yang sudah dibayar:\n- Checkout sebelum pukul 10:00 dikirim di hari yang sama.\n- Checkout setelah pukul 10:00 dikirim di hari kerja selanjutnya.\n\nHarap ditunggu balasan minfarm ya 🙏",
        timestamp: wib("14:06"),
      },
      {
        role: "assistant",
        content: "Halo kak, apa ada yang bisa mimin bantu? 😊🙏",
        timestamp: wib("14:06"),
      },
    ],
    ai_suggestion:
      "Bisa, Kak. Untuk POC Buah Infarm, dosis resminya 2 ml per 1 liter air, diberikan seminggu sekali saat tanaman memasuki fase berbunga atau berbuah. Hindari menambah dosis agar tanaman tidak kelebihan nutrisi ya, Kak.",
    handover_summary: null,
    handover_detail: {
      Platform: "Shopee",
      Kategori: "Konsultasi Produk",
      "Inti Masalah": "Tanya dosis POC Buah",
      Urgensi: "Normal",
    },
    created_at: wib("14:06"),
    updated_at: wib("14:06"),
    last_message_at: wib("14:06"),
    chat_count: 61,
    product_query: "POC Buah",
    order_status: null,
    order_courier: null,
  },
  {
    id: "c0000000-0000-4000-8000-000000000002",
    platform: "shopee",
    customer_id: "rahma",
    customer_name: "rahmawati_id",
    shop_name: "infarmofficialshop · Shopee",
    order_id: "240611AB12",
    tracking_no: "JNE998877",
    action: "AUTO_REPLY",
    unread: false,
    messages: [
      {
        role: "assistant",
        content: "Halo Kak, ada yang bisa minfarm bantu? 😊",
        timestamp: wib("14:01"),
      },
      {
        role: "user",
        content: "Dosis POC Buah buat tomat berapa ya kak?",
        timestamp: wib("14:02"),
      },
    ],
    ai_suggestion:
      "Untuk tomat, POC Buah Infarm dipakai 2 ml per 1 liter air ya, Kak, disiram seminggu sekali saat fase berbunga dan berbuah. Jangan dilebihkan dosisnya supaya tanaman tidak kelebihan nutrisi.",
    handover_summary: null,
    handover_detail: {
      Platform: "Shopee",
      Kategori: "Konsultasi Produk",
      "Inti Masalah": "Dosis POC Buah untuk tomat",
      Urgensi: "Normal",
    },
    created_at: wib("14:01"),
    updated_at: wib("14:02"),
    last_message_at: wib("14:02"),
    chat_count: 12,
    product_query: "tomat",
    order_status: null,
    order_courier: null,
  },
  {
    id: "c0000000-0000-4000-8000-000000000003",
    platform: "shopee",
    customer_id: "budi",
    customer_name: "budi.santoso",
    shop_name: "infarm · Shopee",
    order_id: "240617XXXX",
    tracking_no: "JNT112233445",
    action: "HANDOVER_TO_CS",
    unread: true,
    messages: [
      {
        role: "user",
        content: "Min, paket saya belum sampai padahal sudah 7 hari 😡",
        timestamp: wib("13:57"),
      },
      {
        role: "user",
        content: "No pesanan 240617XXXX. Tolong dicek dong",
        timestamp: wib("13:58"),
      },
    ],
    ai_suggestion:
      "Maaf atas kendalanya, Kak 🙏 Karena ini berkaitan dengan pesanan yang belum diterima, kasusnya perlu diperiksa langsung oleh tim CS kami. Saya bantu teruskan beserta ringkasan informasinya ya, Kak.",
    handover_summary:
      "Pelanggan melaporkan pesanan 240617XXXX belum diterima setelah 7 hari. Resi belum ada pembaruan sejak 2 hari lalu. Perlu pengecekan status ke kurir.",
    handover_detail: {
      Platform: "Shopee",
      Kategori: "Komplain Pengiriman",
      "Inti Masalah": "Paket belum sampai > 7 hari",
      Urgensi: "Tinggi",
    },
    created_at: wib("13:57"),
    updated_at: wib("13:58"),
    last_message_at: wib("13:58"),
    chat_count: 4,
    product_query: "Furadan",
    order_status: "Dalam pengiriman",
    order_courier: "belum update 2 hari",
  },
  {
    id: "c0000000-0000-4000-8000-000000000004",
    platform: "tiktok",
    customer_id: "nadia",
    customer_name: "nadia.afifah",
    shop_name: "Infarm Official · TikTok Shop",
    order_id: "240609TT88",
    tracking_no: "SPX556677",
    action: "ASK_INFORMATION",
    unread: true,
    messages: [
      {
        role: "user",
        content: "Kak daun cabai saya menguning, kenapa ya? Apa harus beli pupuk?",
        timestamp: wib("13:51"),
      },
    ],
    ai_suggestion:
      "Boleh kirim foto tanamannya, Kak? Yang keseluruhan dan bagian bawah daunnya sekalian. Sekalian info juga produk serta dosis yang terakhir dipakai dan frekuensi penyiramannya, supaya penyebab daun menguning bisa diperiksa lebih tepat.",
    handover_summary: null,
    handover_detail: {
      Platform: "TikTok Shop",
      Kategori: "Konsultasi Tanaman",
      "Inti Masalah": "Daun cabai menguning, data belum lengkap",
      Urgensi: "Normal",
    },
    created_at: wib("13:51"),
    updated_at: wib("13:51"),
    last_message_at: wib("13:51"),
    chat_count: 8,
    product_query: "cabai",
    order_status: null,
    order_courier: null,
  },
  {
    id: "c0000000-0000-4000-8000-000000000005",
    platform: "tiktok",
    customer_id: "yoga",
    customer_name: "yoga.pratama",
    shop_name: "Infarm Jakarta · TikTok Shop",
    order_id: "240620YYYY",
    tracking_no: "JNE220620X",
    action: "CHECK_ORDER_SYSTEM",
    unread: false,
    messages: [
      {
        role: "user",
        content: "Kak resi pesanan saya sudah update belum ya? Order 240620YYYY",
        timestamp: wib("13:40"),
      },
    ],
    ai_suggestion:
      "Saya cek dulu status pesanannya ya, Kak. Sebentar… (sistem akan mengambil data resi untuk order 240620YYYY sebelum membalas).",
    handover_summary: null,
    handover_detail: {
      Platform: "TikTok Shop",
      Kategori: "Status Pesanan",
      "Inti Masalah": "Minta update resi",
      Urgensi: "Normal",
    },
    created_at: wib("13:40"),
    updated_at: wib("13:40"),
    last_message_at: wib("13:40"),
    chat_count: 3,
    product_query: "melon",
    order_status: "Menunggu data sistem",
    order_courier: "—",
  },
  {
    id: "c0000000-0000-4000-8000-000000000006",
    platform: "shopee",
    customer_id: "sari",
    customer_name: "sari.lestari",
    shop_name: "infarmofficialshop · Shopee",
    order_id: "240605SP01",
    tracking_no: "SPX889900",
    action: "AUTO_REPLY",
    unread: false,
    messages: [
      {
        role: "user",
        content: "Benih melon ini cocok ditanam di pot gak kak?",
        timestamp: wib("13:22"),
      },
    ],
    ai_suggestion:
      "Cocok, Kak. Benih melon Infarm bisa ditanam di pot/planter bag ukuran minimal 25–40 liter supaya akarnya leluasa, ditempatkan di lokasi yang kena sinar matahari penuh. Pastikan media tanamnya subur dan drainase lancar ya, Kak.",
    handover_summary: null,
    handover_detail: {
      Platform: "Shopee",
      Kategori: "Konsultasi Produk",
      "Inti Masalah": "Tanya tanam melon di pot",
      Urgensi: "Normal",
    },
    created_at: wib("13:22"),
    updated_at: wib("13:22"),
    last_message_at: wib("13:22"),
    chat_count: 19,
    product_query: "melon",
    order_status: null,
    order_courier: null,
  },
];

/* =============== escalations =============== */
/* Satu baris, berasal dari percakapan budi.santoso yang
   ber-action HANDOVER_TO_CS. Belum pernah tampil di HTML lama
   (halamannya memang belum ada), tetapi tabelnya sudah
   dirancang di schema.sql dan dipakai kartu "Perlu Handover"
   di Beranda. */
export const SEED_ESCALATIONS: EscalationRow[] = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    conversation_id: "c0000000-0000-4000-8000-000000000003",
    reason: "Paket belum sampai > 7 hari, resi tidak update",
    status: "open",
    assigned_to: "Infarm.sales",
    created_at: wib("13:58"),
  },
];

/* =============== settings =============== */
/* Nilai default settings.js lama (localStorage 'infarm_cs_settings'). */
export const SEED_SETTINGS: SettingsRow = {
  id: 1,
  ai_enabled: true,
  ai_model: "claude-sonnet-4-6",
  confidence: 80,
  escalation_keywords: [
    "refund",
    "retur",
    "pembatalan",
    "barang rusak",
    "tidak sampai",
    "komplain",
    "bicara CS",
  ],
  updated_at: wib("09:00"),
  updated_by: DEMO_USER.id,
};

/* =============== ai_flags =============== */
export const SEED_AI_FLAGS: AiFlagRow[] = [
  {
    id: "f0000000-0000-4000-8000-000000000001",
    code: "FLG-0001",
    customer_message: "POC Buah boleh dicampur sama pestisida gak kak?",
    ai_answer: "Boleh saja Kak, dicampur dalam satu tangki tidak masalah.",
    ai_action: "AUTO_REPLY",
    correct_answer:
      "Sebaiknya tidak dicampur, Kak. Catatan resmi POC Buah: hindari pencampuran dengan pestisida.",
    category: "produk",
    reporter_id: SEED_PROFILES[1].id,
    reporter_name: "CSINFARM2",
    note: "Bertentangan dengan catatan di products.json",
    status: "menunggu",
    reject_reason: null,
    created_at: wib("11:20"),
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "f0000000-0000-4000-8000-000000000002",
    code: "FLG-0002",
    customer_message: "Ongkir ke Papua berapa kak?",
    ai_answer: "Ongkir ke Papua Rp 45.000 flat, Kak.",
    ai_action: "AUTO_REPLY",
    correct_answer:
      "Ongkir mengikuti perhitungan marketplace saat checkout, Kak — tidak ada tarif flat.",
    category: "kebijakan",
    reporter_id: SEED_PROFILES[1].id,
    reporter_name: "CSINFARM2",
    note: "AI mengarang angka; tidak ada di Knowledge Base",
    status: "disetujui",
    reject_reason: null,
    created_at: wib("10:05", "2026-06-23"),
    reviewed_at: wib("15:30", "2026-06-23"),
    reviewed_by: DEMO_USER.id,
  },
];

/* ===========================================================
   Di bawah ini bukan tabel Supabase — lihat catatan di types.ts
   =========================================================== */

/* =============== Penilaian / ulasan (pesanan.js) =============== */
export const SEED_REVIEWS: Review[] = [
  {
    order: "2693131542572727",
    buyer: "*********939",
    prod: "INFARM - Furadan 3GR Ukuran 1 Kg",
    sku: "NT-FURADAN-1KG",
    emoji: "🧪",
    rating: { all: 2, produk: 2, penjual: 2, kirim: 2 },
    content:
      "Kemudahan penggunaan: Aman untuk tanaman. Efektivitas: Bagus untuk berkebun.",
    date: "2026-06-14 12:41",
    status: "wait",
  },
  {
    order: "2776474846239407",
    buyer: "Ardy L",
    prod: "INFARM - Pupuk Magnesium Sulfat 1 Kg",
    sku: "NT-MAGNESIUM-1KG",
    emoji: "🌿",
    rating: { all: 1, produk: 1, penjual: 1, kirim: 1 },
    content:
      "Barang original saya sudah coba dan sudah saya aplikasikan ke padi semoga bermanfaat. Kemudahan Penggunaan: Mudah dipakai.",
    date: "2026-06-13 09:18",
    status: "wait",
  },
  {
    order: "2810455120098341",
    buyer: "sari****ti",
    prod: "INFARM - POC Buah 250 ml",
    sku: "POC-BUAH-250",
    emoji: "🍅",
    rating: { all: 5, produk: 5, penjual: 5, kirim: 5 },
    content:
      "Cabe saya jadi lebat banget, terima kasih Infarm! Pengiriman cepat dan packing rapi.",
    date: "2026-06-12 16:05",
    status: "done",
  },
  {
    order: "2854120947712030",
    buyer: "budi*****no",
    prod: "INFARM - Benih Cabai Keriting Micha",
    sku: "BCA-CMK-MICHA",
    emoji: "🌶️",
    rating: { all: 3, produk: 3, penjual: 4, kirim: 2 },
    content:
      "Benih tumbuh sebagian, mungkin karena cuaca. Pelayanan penjual ramah.",
    date: "2026-06-11 10:42",
    status: "wait",
  },
  {
    order: "2899741203355618",
    buyer: "nadia***fh",
    prod: "INFARM - Polybag 30x30 isi 30 pcs",
    sku: "30BAG-POLYH-3030",
    emoji: "🪴",
    rating: { all: 2, produk: 2, penjual: 3, kirim: 2 },
    content: "Polybag agak tipis dari ekspektasi, tapi masih bisa dipakai.",
    date: "2026-06-10 14:20",
    status: "wait",
  },
];

/* =============== Pengembalian dana (pesanan.js) =============== */
export const SEED_REFUNDS: Refund[] = [
  {
    order: "2901338475610284",
    buyer: "sari.lestari",
    prod: "INFARM - Furadan 3GR 1 Kg",
    jenis: "Barang Rusak / Bocor",
    nominal: "Rp 78.000",
    status: "dana",
    pill: "refund",
    label: "Pengembalian Dana",
  },
  {
    order: "2912047781200934",
    buyer: "budi.santoso",
    prod: "INFARM - Paket Hidroponik 12 Lubang",
    jenis: "Barang Tidak Sampai",
    nominal: "Rp 165.000",
    status: "dana",
    pill: "refund",
    label: "Pengembalian Dana",
  },
  {
    order: "2920551984773310",
    buyer: "nadia.afifah",
    prod: "INFARM - POC Buah 250 ml",
    jenis: "Salah Kirim",
    nominal: "Rp 32.000",
    status: "batal",
    pill: "cancel",
    label: "Sudah Dibatalkan",
  },
];

/* =============== Pesanan dibatalkan (pesanan.js) =============== */
export const SEED_CANCELS: Cancel[] = [
  { order: "2933110298471552", buyer: "yoga.pratama", prod: "INFARM - Benih Melon Sunmelo", alasan: "Pembeli berubah pikiran", nominal: "Rp 24.000", status: "menunggu" },
  { order: "2940872215098633", buyer: "rahmawati_id", prod: "INFARM - Planter Bag 50 Liter", alasan: "Salah pilih varian", nominal: "Rp 45.000", status: "menunggu" },
  { order: "2951200938471002", buyer: "dikymarzuki", prod: "INFARM - Sekop Taman Besi", alasan: "Ingin ganti alamat kirim", nominal: "Rp 19.000", status: "menunggu" },
  { order: "2962887120554390", buyer: "tatajuhata", prod: "INFARM - POC Buah 250 ml", alasan: "Pengiriman terlalu lama", nominal: "Rp 32.000", status: "menunggu" },
  { order: "2974102938120017", buyer: "gzvb7sql1h", prod: "INFARM - Paket Hidroponik 12 Lubang", alasan: "Pembeli minta batal", nominal: "Rp 165.000", status: "menunggu" },
  { order: "2988120394857201", buyer: "feraa.16", prod: "INFARM - Polybag 35x35 isi 30", alasan: "Stok kosong di gudang", nominal: "Rp 28.000", status: "menunggu" },
  { order: "2901338475610284", buyer: "sari.lestari", prod: "INFARM - Furadan 3GR 1 Kg", alasan: "Sudah dikirim ulang", nominal: "Rp 78.000", status: "proses" },
  { order: "2911200948571123", buyer: "wulandari88", prod: "INFARM - Benih Cabai Micha", alasan: "Pembeli berubah pikiran", nominal: "Rp 16.000", status: "batal" },
];

/** Hitungan chip halaman Pesanan (gaya dashboard marketplace). */
export const SEED_CANCEL_COUNT = { all: 91, menunggu: 6, proses: 12, batal: 79 };

/* =============== Broadcast (broadcast.js) =============== */
export const SEED_BROADCAST: Record<string, BroadcastTask[]> = {
  shopee: [
    { name: "tanpa ringbrinjal", status: "done", plan: 16, ok: 0, fail: 16, by: "Infarm.sales", at: "2026-03-16 13:46" },
    { name: "akar", status: "done", plan: 9, ok: 0, fail: 9, by: "Infarm.sales", at: "2026-03-16 11:18" },
    { name: "Voucher chat", status: "done", plan: 121, ok: 121, fail: 0, by: "Infarm.sales", at: "2026-02-26 13:45" },
    { name: "voucher chat", status: "done", plan: 35, ok: 2, fail: 33, by: "CSINFARM2", at: "2026-02-25 10:02" },
  ],
  lazada: [
    { name: "promo benih cabai", status: "sending", plan: 48, ok: 30, fail: 0, by: "Infarm.sales", at: "2026-06-22 09:10" },
    { name: "reminder keranjang", status: "done", plan: 60, ok: 57, fail: 3, by: "Infarm.sales", at: "2026-06-18 15:30" },
  ],
  tiktok: [
    { name: "flash sale pupuk", status: "done", plan: 90, ok: 88, fail: 2, by: "CSINFARM2", at: "2026-06-20 19:45" },
    { name: "follow up melon", status: "draft", plan: 0, ok: 0, fail: 0, by: "Infarm.sales", at: "2026-06-24 08:05" },
  ],
};
