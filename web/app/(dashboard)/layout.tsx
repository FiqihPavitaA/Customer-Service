import Rail from "@/components/Rail";
import TopBar from "@/components/TopBar";
import { ToastProvider } from "@/components/Toast";

/* ===========================================================
   Shell console — pengganti <div class="app"> yang selama ini
   disalin ulang di tiap file HTML. Sekarang cukup satu tempat:
   semua halaman di dalam grup (dashboard) memakainya otomatis.

   Struktur mengikuti dashboard.css lama:
   .app (kolom, 100vh, overflow hidden)
     └ .topbar (56px)
     └ .workspace (baris) → .rail + isi halaman
   Di ≤760px .workspace berubah jadi kolom & rail turun ke bawah.
   =========================================================== */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar />
        <div className="relative flex min-h-0 flex-1 max-mobile:flex-col">
          <Rail />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto max-mobile:order-1">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
