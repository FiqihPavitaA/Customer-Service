import type { Metadata } from "next";
import Chat from "@/components/chat/Chat";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return <Chat />;
}
