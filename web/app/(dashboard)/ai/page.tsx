import type { Metadata } from "next";
import AiChatbot from "@/components/ai/AiChatbot";

export const metadata: Metadata = { title: "AI Chatbot" };

export default function Page() {
  return <AiChatbot />;
}
