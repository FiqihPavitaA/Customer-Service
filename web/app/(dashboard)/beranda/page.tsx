import type { Metadata } from "next";
import Beranda from "@/components/beranda/Beranda";

export const metadata: Metadata = { title: "Beranda" };

export default function Page() {
  return <Beranda />;
}
