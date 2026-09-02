/* ===========================================================
   Angka agregat halaman Statistik & Beranda (Step 6b).

   BUKAN tabel Supabase. Nanti seluruh isi berkas ini dihitung
   dari `conversations` + `escalations` (COUNT/GROUP BY per
   rentang waktu), bukan disimpan sebagai baris. Selama mode
   demo nilainya dipindahkan apa adanya dari statistik.js dan
   beranda.html supaya angka yang didemokan tidak berubah.

   Yang harus diganti saat Supabase menyala:
   - RANGE_DATA[*].actions  -> count(*) group by action
   - RANGE_DATA[*].kpi.sesi -> count(*) conversations
   - HOME_REALTIME.handover -> count(*) escalations where open
   Sisanya (konversi, pendapatan, penilaian) butuh data pesanan
   dari API marketplace, bukan dari tabel kita.
   =========================================================== */

import type { ActionCode } from "./types";

export type RangeKey = "today" | "7d" | "30d";

export type RangeData = {
  kpi: {
    sesi: string;
    auto: string;
    resp: string;
    ho: string;
    konv: string;
    rev: string;
  };
  /** Perubahan vs periode sebelumnya, urutan sama dengan kartu KPI. */
  trend: string[];
  actions: Record<ActionCode, number>;
  bars: { d: string; ai: number; ho: number }[];
  funnel: { l: string; n: number }[];
};

/** Warna 4 klasifikasi aksi (claude.md), dipakai donat & legenda. */
export const ACTION_COLORS: Record<ActionCode, string> = {
  AUTO_REPLY: "#16a34a",
  ASK_INFORMATION: "#f59e0b",
  CHECK_ORDER_SYSTEM: "#3b82f6",
  HANDOVER_TO_CS: "#ef4444",
};

export const ACTION_ORDER: ActionCode[] = [
  "AUTO_REPLY",
  "ASK_INFORMATION",
  "CHECK_ORDER_SYSTEM",
  "HANDOVER_TO_CS",
];

export const RANGE_DATA: Record<RangeKey, RangeData> = {
  today: {
    kpi: { sesi: "128", auto: "76,6%", resp: "1m 04d", ho: "5,5%", konv: "9,4%", rev: "Rp 1,9 jt" },
    trend: ["+12%", "+1,2%", "-9s", "-0,8%", "+2,1%", "+0,4 jt"],
    actions: { AUTO_REPLY: 98, ASK_INFORMATION: 16, CHECK_ORDER_SYSTEM: 7, HANDOVER_TO_CS: 7 },
    bars: [
      { d: "08:00", ai: 14, ho: 1 },
      { d: "10:00", ai: 22, ho: 2 },
      { d: "12:00", ai: 26, ho: 1 },
      { d: "14:00", ai: 19, ho: 1 },
      { d: "16:00", ai: 11, ho: 1 },
      { d: "18:00", ai: 6, ho: 1 },
    ],
    funnel: [
      { l: "Chat Masuk", n: 128 },
      { l: "Konsultasi Produk", n: 86 },
      { l: "Minat / Keranjang", n: 41 },
      { l: "Checkout", n: 18 },
      { l: "Dibayar", n: 12 },
    ],
  },
  "7d": {
    kpi: { sesi: "892", auto: "75,8%", resp: "1m 12d", ho: "4,9%", konv: "8,7%", rev: "Rp 12,4 jt" },
    trend: ["+14,2%", "+2,1%", "-11s", "-1,4%", "+1,8%", "+2,3 jt"],
    actions: { AUTO_REPLY: 676, ASK_INFORMATION: 118, CHECK_ORDER_SYSTEM: 54, HANDOVER_TO_CS: 44 },
    bars: [
      { d: "06-18", ai: 88, ho: 6 },
      { d: "06-19", ai: 102, ho: 5 },
      { d: "06-20", ai: 121, ho: 7 },
      { d: "06-21", ai: 79, ho: 4 },
      { d: "06-22", ai: 134, ho: 8 },
      { d: "06-23", ai: 118, ho: 9 },
      { d: "06-24", ai: 96, ho: 5 },
    ],
    funnel: [
      { l: "Chat Masuk", n: 892 },
      { l: "Konsultasi Produk", n: 604 },
      { l: "Minat / Keranjang", n: 287 },
      { l: "Checkout", n: 118 },
      { l: "Dibayar", n: 78 },
    ],
  },
  "30d": {
    kpi: { sesi: "3.840", auto: "74,2%", resp: "1m 22d", ho: "5,8%", konv: "8,1%", rev: "Rp 52,6 jt" },
    trend: ["+9,6%", "+0,8%", "-6s", "-0,5%", "+1,1%", "+6,8 jt"],
    actions: { AUTO_REPLY: 2850, ASK_INFORMATION: 520, CHECK_ORDER_SYSTEM: 248, HANDOVER_TO_CS: 222 },
    bars: [
      { d: "Mgg 1", ai: 720, ho: 44 },
      { d: "Mgg 2", ai: 845, ho: 52 },
      { d: "Mgg 3", ai: 910, ho: 61 },
      { d: "Mgg 4", ai: 880, ho: 58 },
    ],
    funnel: [
      { l: "Chat Masuk", n: 3840 },
      { l: "Konsultasi Produk", n: 2510 },
      { l: "Minat / Keranjang", n: 1180 },
      { l: "Checkout", n: 470 },
      { l: "Dibayar", n: 312 },
    ],
  },
};

export const HANDOVER_REASONS = [
  { l: "Refund / retur / batal", v: 38 },
  { l: "Barang rusak / tidak sampai", v: 27 },
  { l: "Komplain / pelanggan marah", v: 14 },
  { l: "Minta bicara CS manusia", v: 12 },
  { l: "Info tidak ditemukan di KB", v: 9 },
];

export const TOP_PRODUCTS = [
  { l: "POC Buah Infarm", v: 142 },
  { l: "Benih Cabai Keriting", v: 118 },
  { l: "Paket Hidroponik 12 Lubang", v: 96 },
  { l: "Pupuk Magnesium Sulfat", v: 74 },
  { l: "Polybag 30x30", v: 61 },
];

export const MARKETPLACE_STATS = [
  { name: "Shopee", logo: "shp", c: "S", sesi: 512, auto: "77,1%", ho: "4,2%", konv: "9,1%", rev: "Rp 7,8 jt" },
  { name: "TikTok Shop", logo: "tt", c: "T", sesi: 268, auto: "73,9%", ho: "5,6%", konv: "8,3%", rev: "Rp 3,4 jt" },
  { name: "Lazada", logo: "lz", c: "L", sesi: 112, auto: "72,4%", ho: "6,1%", konv: "7,2%", rev: "Rp 1,2 jt" },
];

/* =============== Beranda =============== */

/** Kartu "Data Real Time" (beranda.html). */
export const HOME_REALTIME = {
  perluBalasan: 48,
  menungguProses: 98,
  perluHandover: 7,
  responRata: "1 menit 12 detik",
  diperbarui: "2026-06-24 15:43 (UTC+7)",
};

/** Toko yang terhubung — jumlah = badge di kartu Integrasi Toko. */
export const HOME_PLATFORMS = [
  { name: "Lazada", icon: "🛍️", cls: "lz", count: 1 },
  { name: "Shopee", icon: "🛒", cls: "shp", count: 15 },
  { name: "TikTok", icon: "🎵", cls: "tt", count: 3 },
  { name: "Tokopedia", icon: "🛒", cls: "off", count: 0 },
  { name: "Blibli", icon: "🌐", cls: "off", count: 0 },
  { name: "Facebook", icon: "f", cls: "fb", count: 0 },
];

/** Kartu akun/kuota di kanan atas Beranda. */
export const HOME_ACCOUNT = {
  user: "Infarm.sales",
  kuota: "29.000",
  berlaku: "2026-06-25",
  sisaHari: "1 hari",
  tier: "VIP1",
};

/** Funnel klasifikasi + 6 kartu metrik "Ringkasan Data Pesan". */
export const HOME_SUMMARY = {
  funnel: {
    masuk: 635,
    autoPct: "75,75%",
    selesaiAi: 481,
    handoverPct: "4,9%",
    handover: 31,
  },
  metrics: [
    { label: "AUTO_REPLY", trend: "▲ 14,17%", up: true, num: "481", sub: "Dijawab otomatis dari Knowledge Base" },
    { label: "ASK_INFORMATION", trend: "▲ 8,40%", up: true, num: "86", sub: "Minta info tambahan ke pelanggan" },
    { label: "CHECK_ORDER_SYSTEM", trend: "▲ 6,20%", up: true, num: "37", sub: "Cek status pesanan ke sistem" },
    { label: "HANDOVER_TO_CS", trend: "▼ 4,90%", up: false, num: "31", sub: "Dialihkan ke CS manusia" },
    { label: "Persentase Auto-Reply", trend: "▲ 10,66%", up: true, num: "75,75%", sub: "Sesi tuntas tanpa CS manusia" },
    { label: "Jumlah Pembeli Dilayani", trend: "▲ 17,16%", up: true, num: "580", sub: "Pelanggan unik 1 hari" },
  ],
};

/** Kartu "Data Penilaian" di Beranda. */
export const HOME_RATING = {
  positif: 98.72,
  negatif: 1.28,
  pengingat: { dikirim: 120, masuk: 96, pct: "80%" },
  pemulihan: { dikirim: 15, berhasil: 9, pct: "60%" },
};

/** Grafik "Tren Data Pesan" 7 hari di Beranda. */
export const HOME_TREND = [
  { d: "06-18", a: 410, b: 320, p: 74 },
  { d: "06-19", a: 480, b: 372, p: 76 },
  { d: "06-20", a: 520, b: 405, p: 77 },
  { d: "06-21", a: 390, b: 300, p: 73 },
  { d: "06-22", a: 560, b: 441, p: 78 },
  { d: "06-23", a: 635, b: 481, p: 75 },
  { d: "06-24", a: 470, b: 360, p: 76 },
];
