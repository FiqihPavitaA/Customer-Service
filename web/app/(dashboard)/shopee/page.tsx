import type { Metadata } from "next";
import UjiKoneksi from "@/components/shopee/UjiKoneksi";

export const metadata: Metadata = { title: "Uji Koneksi Shopee" };

/* Sengaja tidak ada di rail: ini alat diagnosa, dibuka dengan
   mengetik /shopee. Tetap di dalam grup (dashboard) supaya ikut
   terjaga AuthGuard — endpoint di baliknya memakai kredensial
   Shopee milik server. */
export default function Page() {
  return <UjiKoneksi />;
}
