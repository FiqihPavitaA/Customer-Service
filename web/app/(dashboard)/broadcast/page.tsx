import type { Metadata } from "next";
import Broadcast from "@/components/broadcast/Broadcast";

export const metadata: Metadata = { title: "Broadcast" };

export default function Page() {
  return <Broadcast />;
}
