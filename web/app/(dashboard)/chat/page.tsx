import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Chat"
      legacyFile="dashboard.html"
      step="Step 14"
      note="Inbox percakapan multi-marketplace — halaman paling kompleks (realtime, pencarian massal, modal integrasi toko), sengaja dikerjakan paling akhir."
    />
  );
}
