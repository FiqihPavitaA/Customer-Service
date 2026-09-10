/* ===========================================================
   Peta navigasi rail — satu sumber kebenaran untuk semua halaman.
   Ikon sengaja tetap emoji agar identik dengan rail HTML lama
   (claude.md → STANDAR RESPONSIVITAS: 🏠💬📦🤖📣📈⚙️👤).
   =========================================================== */

export type RailItem = {
  href: string;
  icon: string;
  title: string;
  /** Tampilkan badge jumlah chat belum dibaca (hanya menu Chat). */
  badge?: boolean;
};

/* Dua kelompok rail ini membawa arti, bukan sekadar tata letak:
   atas = yang dikerjakan tiap hari, bawah = yang diatur sesekali.

   Knowledge Base pindah ke atas pada 10 Sep 2026. Sebelumnya ia
   berada di dalam Pengaturan — tiga klik, di balik ikon ⚙️ yang
   duduk bersebelahan dengan 👤 Akun, yaitu tempat yang mengatakan
   "ini bukan untukmu" kepada tim CS.

   Yang berubah bukan halamannya, melainkan kategorinya. Saat KB
   masih berupa beberapa berkas yang jarang disentuh, ia memang
   konfigurasi. Sejak Tahap C meminta tim CS menulis 315 contoh
   pertanyaan, ia menjadi pekerjaan harian — dan navigasinya
   tertinggal.

   Yang TIDAK ikut pindah: pengelolaan berkas KB dan Mode KB. Dua
   itu memang konfigurasi, dan tetap di Pengaturan. */
export const RAIL_MAIN: RailItem[] = [
  { href: "/beranda", icon: "🏠", title: "Beranda" },
  { href: "/chat", icon: "💬", title: "Chat", badge: true },
  { href: "/pesanan", icon: "📦", title: "Pesanan" },
  { href: "/knowledge", icon: "📚", title: "Knowledge Base" },
  { href: "/ai", icon: "🤖", title: "AI Chatbot" },
  { href: "/broadcast", icon: "📣", title: "Broadcast" },
  { href: "/statistik", icon: "📈", title: "Statistik" },
];

/** Menu bawah (setelah spacer). */
export const RAIL_FOOT: RailItem[] = [
  { href: "/settings", icon: "⚙️", title: "Pengaturan" },
  { href: "/", icon: "👤", title: "Akun" },
];

/**
 * Pemetaan halaman lama → route baru (dipakai di dokumentasi migrasi).
 *
 * `/knowledge` sengaja TIDAK ada di sini, dan itu bukan kelalaian:
 * halaman itu tidak punya padanan di versi HTML lama. Menambahkannya
 * dengan menunjuk settings.html akan salah — orang yang menelusuri
 * migrasi akan mengira ada berkas lama yang belum dipindahkan.
 */
export const LEGACY_MAP: Record<string, string> = {
  "/beranda": "beranda.html",
  "/chat": "dashboard.html",
  "/pesanan": "pesanan.html",
  "/ai": "ai.html",
  "/broadcast": "broadcast.html",
  "/statistik": "statistik.html",
  "/settings": "settings.html",
  "/": "index.html",
};
