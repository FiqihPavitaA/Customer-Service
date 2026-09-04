"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./Toast";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/db";
import {
  MASS_SCOPES,
  SCOPE_LABEL,
  setScope,
  setSingle,
  setTerms,
  useSearch,
  type SearchScope,
} from "@/lib/search";

/* ===========================================================
   TopBar — pengganti <header class="topbar"> di HTML lama.

   Step 14: pencarian tidak lagi berhenti di kotaknya sendiri.
   Nilainya masuk ke lib/search.ts dan dipakai halaman Chat untuk
   menyaring daftar percakapan — persis perilaku dashboard.js,
   termasuk klik-dua-kali pada lingkup "Nomor Pesanan"/"Nomor
   Resi" yang membuka Pencarian Massal.
   =========================================================== */

const SCOPES: SearchScope[] = ["nama", "pesanan", "resi", "chat", "produk"];

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

/* ---------------- Modal pencarian massal ---------------- */

function MassModal({
  scope,
  onClose,
}: {
  scope: SearchScope;
  onClose: () => void;
}) {
  const toast = useToast();
  const [raw, setRaw] = useState("");
  const isPesanan = scope === "pesanan";

  const cari = () => {
    const terms = setTerms(raw);
    if (!terms.length) {
      toast("Tempel minimal satu nomor dulu, Kak");
      return;
    }
    toast(`${terms.length} ${isPesanan ? "no. pesanan" : "resi"} dicari`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-70 grid place-items-center bg-[rgb(15_23_42/0.45)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian massal"
        className="w-[min(520px,92vw)] rounded-3xl bg-white p-6 shadow-card max-mini:p-4"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="m-0 text-[1.1rem] font-bold">
            Pencarian Massal — {isPesanan ? "Nomor Pesanan" : "Nomor Resi"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Tutup"
            aria-label="Tutup"
            className="cursor-pointer rounded-lg border-none bg-transparent text-[1rem]"
          >
            ✕
          </button>
        </div>
        <p className="mt-0 mb-4 text-[0.86rem] leading-relaxed text-muted">
          Tempel beberapa {isPesanan ? "nomor pesanan" : "nomor resi"} — satu per baris
          atau dipisah koma — untuk mencari banyak sekaligus (maks. 50).
        </p>
        <textarea
          autoFocus
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"contoh:\n584590031216740091\n240617XXXX\n240620YYYY"}
          className="w-full resize-y rounded-xl border border-line bg-green-soft p-3 font-mono text-[0.86rem] outline-none focus:bg-white"
        />
        <div className="mt-4 flex justify-end gap-2.5 max-mini:flex-col-reverse">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-line bg-white px-5 py-2.5 font-bold text-text-2 transition hover:bg-green-soft"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={cari}
            className="cursor-pointer rounded-xl border-none bg-green px-5 py-2.5 font-bold text-white transition hover:bg-green-hover"
          >
            Cari Massal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Identitas pengguna ----------------
   Sengaja menampilkan PERAN, bukan hanya nama: sebagian aksi
   (menyimpan Pengaturan, memutuskan Flag Koreksi) hanya diizinkan
   RLS untuk peran 'admin'. Kalau perannya tidak terlihat, tombol
   yang gagal menyimpan akan terasa seperti bug, bukan seperti izin
   yang memang tidak dimiliki. */

function UserChip() {
  const { profile, isDemo, signOut } = useAuth();
  const router = useRouter();

  if (isDemo) return null;

  const keluar = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div className="flex items-center gap-1.5 max-mobile:order-4">
      <span
        title={profile ? `Masuk sebagai ${profile.username}` : undefined}
        className="max-w-[10rem] truncate rounded-xl border border-line bg-green-soft px-2.5 py-1.5 text-[0.82rem] font-semibold text-green-dark"
      >
        {profile ? profile.username : "…"}
        {profile?.role === "admin" && (
          <span className="ml-1 font-normal text-muted">· admin</span>
        )}
      </span>
      <button
        type="button"
        onClick={keluar}
        title="Keluar"
        aria-label="Keluar"
        className="h-9 w-9 cursor-pointer rounded-xl border-none bg-transparent text-[1.05rem] transition hover:bg-green-mint"
      >
        <span aria-hidden>⏻</span>
      </button>
    </div>
  );
}

/* ---------------- TopBar ---------------- */

export default function TopBar() {
  const toast = useToast();
  const search = useSearch();
  const unread = useUnreadCount();
  const [massOpen, setMassOpen] = useState(false);

  const isMass = MASS_SCOPES.includes(search.scope);
  const placeholder = search.terms.length
    ? `${search.terms.length} nomor dicari — ketik untuk mengganti`
    : isMass
      ? `Cari ${SCOPE_LABEL[search.scope].toLowerCase()} — klik 2× untuk pencarian massal…`
      : `Cari ${SCOPE_LABEL[search.scope].toLowerCase()}…`;

  return (
    <>
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
            value={search.scope}
            onChange={(e) => setScope(e.target.value as SearchScope)}
            title="Cari berdasarkan"
            className="rounded-xl border border-line bg-green-soft px-2.5 py-2 font-semibold text-text-2"
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
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
              value={search.single}
              onChange={(e) => setSingle(e.target.value)}
              onDoubleClick={() => {
                if (isMass) setMassOpen(true);
              }}
              placeholder={placeholder}
              className="w-full border-none text-[0.92rem] outline-none"
            />
            {isMass && (
              <button
                type="button"
                onClick={() => setMassOpen(true)}
                title="Pencarian massal"
                aria-label="Pencarian massal"
                className="shrink-0 cursor-pointer rounded-lg border border-line bg-green-soft px-1.5 py-0.5 text-[0.72rem] font-bold text-green-dark"
              >
                ⁝⁝
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <UserChip />
          <button
            type="button"
            className="cursor-pointer rounded-xl border border-line bg-white px-2.5 py-1.5 font-semibold text-text-2"
          >
            ID ▾
          </button>
          <IconButton
            title="Toko terhubung"
            onClick={() => toast("Buka daftar toko dari halaman Chat")}
          >
            🛍️
          </IconButton>
          <IconButton title="Notifikasi" badge={unread || undefined}>
            🔔
          </IconButton>
        </div>
      </header>

      {massOpen && <MassModal scope={search.scope} onClose={() => setMassOpen(false)} />}
    </>
  );
}
