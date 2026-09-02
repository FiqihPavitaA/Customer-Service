"use client";

/* ===========================================================
   Potongan UI kecil yang dipakai lebih dari satu halaman.
   Semuanya sepadan dengan kelas CSS lama yang namanya disebut
   di komentar masing-masing.
   =========================================================== */

import { DB_MODE_LABEL } from "@/lib/db";

/* ---------- .date-tabs / .dt (beranda.css, statistik.css) ---------- */
export function DateTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={[
            "cursor-pointer rounded-[9px] border px-3.5 py-1.5 text-[0.84rem] font-semibold transition",
            o.value === value
              ? "border-green bg-green-mint text-green-dark"
              : "border-line bg-white text-muted hover:bg-green-soft",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- .btn-ghost.sm ---------- */
export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-[9px] border border-line bg-white px-3.5 py-1.5 text-[0.84rem] font-bold text-text-2 transition hover:bg-green-soft ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- .scope-select (dashboard.css) ---------- */
export function ScopeSelect({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value?: string;
  onChange?: (v: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="rounded-[9px] border border-line bg-green-soft px-2.5 py-1.5 text-[0.84rem] font-semibold text-text-2"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/* ---------- .table-wrap (wajib bisa digeser — claude.md §3) ---------- */
export function TableWrap({
  children,
  minWidth = 560,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-line">
      <table
        className="w-full border-collapse text-[0.88rem]"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-line bg-green-soft px-4 py-3 text-left font-bold text-text-2 whitespace-nowrap">
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`border-b border-line-soft px-4 py-3 align-top ${className}`}>
      {children}
    </td>
  );
}

/* ---------- .mp-logo (logo marketplace kecil) ---------- */
const LOGO_BG: Record<string, string> = {
  shp: "bg-shp",
  tt: "bg-tt",
  lz: "bg-lz",
};

export function MarketplaceLogo({ logo, char }: { logo: string; char: string }) {
  return (
    <span
      className={`grid h-5.5 w-5.5 place-items-center rounded-md text-[0.7rem] font-extrabold text-white ${LOGO_BG[logo] ?? "bg-muted"}`}
      aria-hidden
    >
      {char}
    </span>
  );
}

/* ---------- .pill (pesanan.css) ---------- */
const PILL: Record<string, string> = {
  wait: "bg-[#fef3c7] text-[#92400e]",
  done: "bg-green-mint text-green-dark",
  cancel: "bg-[#fee2e2] text-[#b91c1c]",
  refund: "bg-[#dbeafe] text-[#1e40af]",
  cont: "bg-[#e0e7ff] text-[#3730a3]",
};

export function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-[0.76rem] font-bold whitespace-nowrap ${PILL[kind] ?? PILL.wait}`}
    >
      {children}
    </span>
  );
}

/* ---------- Penanda mode demo ----------
   Ditampilkan di tiap halaman selama DB_MODE = 'memory' supaya
   penonton demo tidak mengira angkanya sudah data produksi. */
export function DemoNotice({ detail }: { detail?: string }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-green/40 bg-green-soft px-3.5 py-2 text-[0.78rem] text-text-2">
      <span aria-hidden>🧪</span>
      <b className="font-semibold text-green-dark">{DB_MODE_LABEL}.</b>
      {detail && <span className="text-muted">{detail}</span>}
    </p>
  );
}

/* ---------- Judul halaman ---------- */
export function PageHead({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="m-0 text-[1.4rem] font-bold max-mini:text-[1.2rem]">{title}</h1>
      {children && (
        <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      )}
    </div>
  );
}
