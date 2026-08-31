import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Beranda" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Beranda"
      legacyFile="beranda.html"
      step="Step 10"
      note="Kartu ringkasan dan pintasan. Dimigrasi setelah Statistik karena isinya sebagian besar kartu statis."
    />
  );
}
