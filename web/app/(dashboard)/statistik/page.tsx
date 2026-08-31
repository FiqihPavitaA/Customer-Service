import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Statistik" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Statistik"
      legacyFile="statistik.html"
      step="Step 9"
      note="Halaman pertama yang dimigrasi: banyak tampilan grafik, sedikit state — dipakai sebagai pemanasan."
    />
  );
}
