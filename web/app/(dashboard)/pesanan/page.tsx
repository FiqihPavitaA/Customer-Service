import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Pesanan" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Pesanan"
      legacyFile="pesanan.html"
      step="Step 12"
      note="Tiga sub-tab plus aksi massal: checklist, approve, dan reject."
    />
  );
}
