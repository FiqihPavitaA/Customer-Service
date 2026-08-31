import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Broadcast" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Broadcast"
      legacyFile="broadcast.html"
      step="Step 11"
      note="Formulir dan tabel pesan broadcast per marketplace."
    />
  );
}
