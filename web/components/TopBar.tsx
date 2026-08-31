"use client";

import Image from "next/image";
import { useState } from "react";
import { useToast } from "./Toast";

/* ===========================================================
   TopBar — pengganti <header class="topbar"> di HTML lama.
   Pencarian masih lokal (belum menyaring data apa pun); akan
   disambungkan ke data Supabase saat halaman Chat dimigrasi.
   =========================================================== */

const SEARCH_SCOPES = [
  { value: "nama", label: "Nama Pembeli" },
  { value: "pesanan", label: "Nomor Pesanan" },
  { value: "resi", label: "Nomor Resi" },
  { value: "chat", label: "Isi Chat" },
  { value: "produk", label: "Nama Produk" },
];

function IconButton({
  title,
  children,
  badge,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="relative h-9 w-9 cursor-pointer rounded-xl border-none bg-transparent text-[1.05rem] transition hover:bg-green-mint"
    >
      {badge ? (
        <span className="absolute top-0.5 right-0.5 rounded-lg bg-[#ef4444] px-1 py-px text-[0.6rem] font-bold text-white">
          {badge}
        </span>
      ) : null}
      <span aria-hidden>{children}</span>
    </button>
  );
}

export default function TopBar() {
  const toast = useToast();
  const [scope, setScope] = useState("nama");
  const [query, setQuery] = useState("");

  const scopeLabel =
    SEARCH_SCOPES.find((s) => s.value === scope)?.label ?? "Nama Pembeli";

  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-line bg-white px-4.5 shadow-bar max-mobile:h-auto max-mobile:min-h-14 max-mobile:flex-wrap max-mobile:gap-y-2">
      <div className="flex items-center gap-3">
        <Image
          src="/logo-infarm.png"
          alt="Infarm.ID"
          width={40}
          height={40}
          className="block h-10 w-10 object-contain"
          priority
        />
        <span className="font-semibold text-muted max-mobile:hidden">
          Customer Service Console
        </span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center gap-2 max-mobile:order-3 max-mobile:basis-full max-mobile:justify-start">
        <label className="sr-only" htmlFor="searchScope">
          Cari berdasarkan
        </label>
        <select
          id="searchScope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          title="Cari berdasarkan"
          className="rounded-xl border border-line bg-green-soft px-2.5 py-2 font-semibold text-text-2"
        >
          {SEARCH_SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="flex w-[min(440px,38vw)] items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 max-mobile:w-full">
          <span className="opacity-50" aria-hidden>
            🔍
          </span>
          <label className="sr-only" htmlFor="topSearch">
            Kata kunci pencarian
          </label>
          <input
            id="topSearch"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Cari ${scopeLabel.toLowerCase()}…`}
            className="w-full border-none text-[0.92rem] outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="cursor-pointer rounded-xl border border-line bg-white px-2.5 py-1.5 font-semibold text-text-2"
        >
          ID ▾
        </button>
        <IconButton
          title="Toko terhubung"
          onClick={() => toast("Modal integrasi toko dimigrasi di Step 14")}
        >
          🛍️
        </IconButton>
        <IconButton title="Notifikasi" badge={3}>
          🔔
        </IconButton>
      </div>
    </header>
  );
}
