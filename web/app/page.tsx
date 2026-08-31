import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Masuk" };

/* ===========================================================
   Halaman depan (pengganti index.html).
   Formulir login sesungguhnya dibuat di Step 7 memakai Supabase
   Auth — login hardcode lama sengaja TIDAK dipindahkan ke sini.
   Untuk sementara halaman ini hanya pintu masuk ke console.
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
            Migrasi sedang berjalan
          </p>
          <h2 className="m-0 mb-5 text-4xl leading-tight font-bold max-mini:text-3xl">
            Versi Next.js dari console CS
          </h2>
          <p className="mt-0 mb-8 max-w-xl leading-relaxed text-text-2">
            Kerangka layout sudah berdiri. Halaman-halaman di dalamnya masih
            dipindahkan satu per satu dari versi HTML lama. Login dengan
            Supabase Auth dipasang di Step 7 — sampai saat itu console bisa
            dibuka langsung tanpa autentikasi.
          </p>

          <Link
            href="/beranda"
            className="inline-block rounded-2xl bg-green px-6 py-4 font-bold text-white no-underline transition hover:bg-green-hover"
          >
            Buka Console →
          </Link>
        </div>
      </div>
    </div>
  );
}
