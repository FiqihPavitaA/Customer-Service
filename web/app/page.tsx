import Image from "next/image";
import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Masuk" };

/* ===========================================================
   Halaman depan (pengganti index.html).

   Tetap komponen server supaya metadata & gambar tetap dirender
   di server; isinya yang butuh keadaan sesi diserahkan ke
   <LoginForm>, dan formulir itu sendiri yang memutuskan tampil
   sebagai login sungguhan atau pintu masuk mode demo.
   =========================================================== */

export default function Home() {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#eafaf0_0%,#ffffff_60%)]">
      <div className="mx-auto max-w-3xl px-6 py-16 max-mini:px-4">
        <div className="mb-8 flex items-center gap-4">
          <Image
            src="/logo-infarm.png"
            alt="Infarm.ID"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <div>
            <h1 className="m-0 text-base font-bold">Infarm Customer Service</h1>
            <p className="mt-1 mb-0 text-[0.95rem] text-muted">
              Console AI Customer Service — Infarm.id
            </p>
          </div>
        </div>

        <div className="rounded-[32px] bg-white/90 p-10 shadow-card max-mini:p-6">
          <p className="m-0 mb-4 text-[0.82rem] font-bold tracking-[0.08em] text-green uppercase">
            Console Customer Service
          </p>
          <h2 className="m-0 mb-5 text-4xl leading-tight font-bold max-mini:text-3xl">
            Masuk ke console
          </h2>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
