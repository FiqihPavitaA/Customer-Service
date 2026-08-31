import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "AI Chatbot" };

export default function Page() {
  return (
    <PlaceholderPage
      title="AI Chatbot"
      legacyFile="ai.html"
      step="Step 13"
      note="Panel uji coba AI. Menyambung ke /api/chat yang dibangun di Step 4."
    />
  );
}
