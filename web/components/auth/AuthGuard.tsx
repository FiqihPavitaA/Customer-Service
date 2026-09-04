"use client";

/* ===========================================================
   Penjaga halaman console (Step 7).

   Tugasnya dua:
     1. Mengalihkan ke halaman depan bila belum login.
     2. Menarik data dari Supabase begitu sesi sah, lalu berlangganan
        Realtime supaya perubahan admin lain ikut terlihat.

   INI BUKAN PENGAMAN. Pengalihan di sini hanya kenyamanan — siapa
   pun bisa mematikannya lewat devtools. Yang benar-benar menjaga
   data adalah RLS di Supabase: setiap kebijakan berbunyi
   `to authenticated`, jadi tanpa sesi yang sah query balik kosong
   walau halamannya berhasil dibuka paksa.
   =========================================================== */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { hydrateFromSupabase, subscribeRealtime } from "@/lib/db";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, isDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isDemo || status !== "out") return;
    router.replace("/");
  }, [isDemo, status, router]);

  useEffect(() => {
    if (isDemo || status !== "in") return;
    void hydrateFromSupabase();
    return subscribeRealtime();
  }, [isDemo, status]);

  if (isDemo) return <>{children}</>;

  if (status !== "in") {
    return (
      <div className="grid h-dvh place-items-center text-muted">
        <p className="m-0 text-[0.9rem]">
          {status === "loading" ? "Memeriksa sesi…" : "Mengalihkan ke halaman masuk…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
