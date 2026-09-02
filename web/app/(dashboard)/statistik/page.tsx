import type { Metadata } from "next";
import Statistik from "@/components/statistik/Statistik";

export const metadata: Metadata = { title: "Statistik" };

export default function Page() {
  return <Statistik />;
}
