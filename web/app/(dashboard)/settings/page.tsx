import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Pengaturan" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Pengaturan"
      legacyFile="settings.html"
      step="Step 8"
      note="Pengaturan AI. Menjadi halaman pertama yang membaca dan menulis data nyata ke tabel settings di Supabase."
    />
  );
}
