import type { Metadata } from "next";
import Settings from "@/components/settings/Settings";

export const metadata: Metadata = { title: "Pengaturan" };

export default function Page() {
  return <Settings />;
}
