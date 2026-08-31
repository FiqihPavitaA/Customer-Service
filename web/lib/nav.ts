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

/** Menu utama (bagian atas rail). */
export const RAIL_MAIN: RailItem[] = [
  { href: "/beranda", icon: "🏠", title: "Beranda" },
  { href: "/chat", icon: "💬", title: "Chat", badge: true },
  { href: "/pesanan", icon: "📦", title: "Pesanan" },
  { href: "/ai", icon: "🤖", title: "AI Chatbot" },
  { href: "/broadcast", icon: "📣", title: "Broadcast" },
  { href: "/statistik", icon: "📈", title: "Statistik" },
];

/** Menu bawah (setelah spacer). */
export const RAIL_FOOT: RailItem[] = [
  { href: "/settings", icon: "⚙️", title: "Pengaturan" },
  { href: "/", icon: "👤", title: "Akun" },
];

/** Pemetaan halaman lama → route baru (dipakai juga di dokumentasi migrasi). */
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
