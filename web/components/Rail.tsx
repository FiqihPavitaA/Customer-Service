"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RAIL_FOOT, RAIL_MAIN, type RailItem } from "@/lib/nav";

/* ===========================================================
   Rail ikon — pengganti <nav class="rail"> + rail.js.
   Desktop: kolom kiri selebar 64px.
   ≤760px : bilah navigasi horizontal yang bisa digeser
            (claude.md → "Rail navigasi → bottom nav di mobile").

   TODO Fase 3: angka badge masih dummy (sama seperti rail.js),
   diganti query realtime Supabase saat halaman Chat dimigrasi.
   =========================================================== */

const UNREAD_DUMMY = 2;

function formatUnread(n: number) {
  return n > 99 ? "99+" : String(n);
}

function RailLink({
  item,
  active,
  unread,
}: {
  item: RailItem;
  active: boolean;
  unread: number;
}) {
  return (
    <Link
      href={item.href}
      title={item.title}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      className={[
        "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl no-underline transition",
        active
          ? "bg-white opacity-100 shadow-[0_8px_18px_rgb(0_0_0/0.12)]"
          : "text-white opacity-85 hover:bg-white/15 hover:opacity-100",
      ].join(" ")}
    >
      {item.badge && unread > 0 && (
        <span className="absolute top-0.5 right-0 rounded-lg bg-[#ef4444] px-1 py-px text-[0.55rem] font-bold text-white">
          {formatUnread(unread)}
        </span>
      )}
      <span aria-hidden>{item.icon}</span>
    </Link>
  );
}

export default function Rail() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex w-16 shrink-0 flex-col items-center gap-1.5 bg-green py-3.5 max-mobile:w-full max-mobile:flex-row max-mobile:justify-start max-mobile:gap-1 max-mobile:overflow-x-auto max-mobile:px-2 max-mobile:py-1.5"
    >
      {RAIL_MAIN.map((item) => (
        <RailLink
          key={item.href}
          item={item}
          active={isActive(item.href)}
          unread={UNREAD_DUMMY}
        />
      ))}

      <div className="flex-1 max-mobile:hidden" />

      {RAIL_FOOT.map((item) => (
        <RailLink
          key={item.href}
          item={item}
          active={isActive(item.href)}
          unread={UNREAD_DUMMY}
        />
      ))}
    </nav>
  );
}
