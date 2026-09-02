import type { Metadata } from "next";
import Pesanan from "@/components/pesanan/Pesanan";

export const metadata: Metadata = { title: "Pesanan" };

export default function Page() {
  return <Pesanan />;
}
