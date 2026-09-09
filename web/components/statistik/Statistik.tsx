"use client";

/* ===========================================================
   Halaman Statistik — port dari statistik.html + statistik.js.
   Step 9 (dikerjakan bersama Step 6b mode demo).

   Perilaku dipertahankan: tab rentang (Hari Ini / 7 Hari /
   30 Hari) mengganti seluruh angka; donat, bar, funnel, dan
   dua bar horizontal dihitung dari dataset yang sama.
   Sumber angka: lib/db/analytics.ts (dulu const DATA di
   statistik.js).
   =========================================================== */

import { useMemo, useState } from "react";
import { Card, CardHead } from "@/components/ui/Card";
import {
  DateTabs,
  DemoNotice,
  GhostButton,
  MarketplaceLogo,
  PageHead,
  ScopeSelect,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/Bits";
import { useToast } from "@/components/Toast";
import {
  ACTION_COLORS,
  ACTION_ORDER,
  awalRentang,
  HANDOVER_REASONS,
  hitungTindakan,
  MARKETPLACE_STATS,
  persenHandover,
  RANGE_DATA,
  TOP_PRODUCTS,
  totalTindakan,
  type RangeKey,
} from "@/lib/db/analytics";
import { DB_MODE, useConversations } from "@/lib/db";
import type { ActionCode } from "@/lib/db/types";
import { angka, persen } from "@/lib/format";

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
];

/* ---------------- KPI ---------------- */

type Kpi = {
  ico: string;
  num: string;
  label: string;
  trend: string;
  up: boolean;
  /** true = dihitung dari tabel; tren pembanding sengaja dikosongkan. */
  nyata?: boolean;
};

/**
 * KENAPA KARTU NYATA TIDAK PUNYA TREN
 *
 * Panah "▲ +12% vs periode lalu" itu tetapan di RANGE_DATA[*].trend.
 * Menempelkannya pada angka yang baru dihitung sungguhan berarti
 * mengarang perbandingan yang tidak pernah dilakukan — dan justru
 * itulah bagian yang paling dipercaya orang saat membaca dasbor.
 * Membandingkan dengan periode sebelumnya butuh menyimpan hitungan
 * lama; sampai itu ada, kartunya menyebut sumbernya saja.
 */
function kpiCards(
  range: RangeKey,
  sebaran: Record<ActionCode, number>,
  nyata: boolean,
): Kpi[] {
  const d = RANGE_DATA[range];
  const t = d.trend;
  const total = totalTindakan(sebaran);

  return [
    nyata
      ? { ico: "💬", num: angka(total), label: "Total Sesi Percakapan", trend: "dari tabel conversations", up: true, nyata: true }
      : { ico: "💬", num: d.kpi.sesi, label: "Total Sesi Percakapan", trend: `▲ ${t[0]} vs periode lalu`, up: true },
    { ico: "⚡", num: d.kpi.auto, label: "Tingkat Auto-Reply", trend: `▲ ${t[1]}`, up: true },
    { ico: "⏱️", num: d.kpi.resp, label: "Rata-rata Waktu Respons", trend: `▼ ${t[2]} (lebih cepat)`, up: false },
    nyata
      ? { ico: "🙋", num: persenHandover(sebaran), label: "Tingkat Handover ke CS", trend: "dari tabel conversations", up: true, nyata: true }
      : { ico: "🙋", num: d.kpi.ho, label: "Tingkat Handover ke CS", trend: `▼ ${t[3]} (lebih sedikit)`, up: false },
    { ico: "🛒", num: d.kpi.konv, label: "Konversi Chat → Order", trend: `▲ ${t[4]}`, up: true },
    { ico: "💰", num: d.kpi.rev, label: "Estimasi Pendapatan dari Chat", trend: `▲ ${t[5]}`, up: true },
  ];
}

function KpiGrid({
  range,
  sebaran,
  nyata,
}: {
  range: RangeKey;
  sebaran: Record<ActionCode, number>;
  nyata: boolean;
}) {
  return (
    <div className="grid grid-cols-6 gap-3.5 max-wide:grid-cols-3 max-tablet:grid-cols-2 max-mini:grid-cols-2">
      {kpiCards(range, sebaran, nyata).map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-line bg-white p-4.5 shadow-[0_8px_24px_rgb(15_23_42/0.04)]"
        >
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-green-mint text-[1.15rem]">
            <span aria-hidden>{k.ico}</span>
          </div>
          <div className="text-[1.7rem] leading-tight font-extrabold">{k.num}</div>
          <div className="mt-1 text-[0.78rem] leading-snug text-muted">{k.label}</div>
          <div
            className={`mt-2 text-[0.74rem] font-bold ${
              k.nyata ? "text-muted" : k.up ? "text-green-dark" : "text-[#dc2626]"
            }`}
          >
            {k.nyata && <span aria-hidden>· </span>}
            {k.trend}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Donat klasifikasi ---------------- */

function Donut({ sebaran }: { sebaran: Record<ActionCode, number> }) {
  const a = sebaran;
  const total = ACTION_ORDER.reduce((sum, k) => sum + a[k], 0);

  /* Tabel yang masih kosong bukan keadaan mustahil — justru itu
     keadaan awal begitu Supabase menyala. Tanpa penjagaan ini,
     start dan end tiap irisan jadi NaN, dan conic-gradient dengan
     NaN tidak menggambar apa-apa: lingkarannya hilang tanpa satu
     pun pesan yang menjelaskan kenapa. */
  if (total === 0) {
    return (
      <div className="grid place-items-center py-10 text-center">
        <div className="text-3xl opacity-40" aria-hidden>
          🍩
        </div>
        <p className="mt-2 mb-0 text-[0.84rem] text-muted">
          Belum ada percakapan berklasifikasi pada rentang ini.
        </p>
      </div>
    );
  }

  // conic-gradient dibangun sama seperti renderDonut() di statistik.js.
  // Batas tiap irisan dihitung dari jumlah kumulatif sampai indeks itu
  // (bukan menumpuk variabel di luar map — React 19 melarangnya).
  const segments = ACTION_ORDER.map((k, i) => {
    const sebelum = ACTION_ORDER.slice(0, i).reduce((s, key) => s + a[key], 0);
    const start = (sebelum / total) * 100;
    const end = ((sebelum + a[k]) / total) * 100;
    return `${ACTION_COLORS[k]} ${start}% ${end}%`;
  });

  return (
    <div className="flex flex-wrap items-center gap-7 max-mobile:flex-col max-mobile:items-start max-mobile:gap-4">
      <div
        className="grid h-[150px] w-[150px] shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${segments.join(",")})` }}
        role="img"
        aria-label={`Distribusi klasifikasi aksi, total ${angka(total)} sesi`}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
          <div>
            <span className="block text-[1.5rem] font-extrabold">{angka(total)}</span>
            <small className="text-[0.68rem] text-muted">total sesi</small>
          </div>
        </div>
      </div>

      <ul className="m-0 flex min-w-[200px] flex-1 list-none flex-col gap-3 p-0">
        {ACTION_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2.5 text-[0.86rem] text-text-2">
            <span
              className="h-2.75 w-2.75 shrink-0 rounded-[3px]"
              style={{ background: ACTION_COLORS[k] }}
              aria-hidden
            />
            <span className="flex-1">{k}</span>
            <b className="text-text">{angka(a[k])}</b>
            <span className="w-12 text-right text-muted">{persen(a[k], total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Tren volume ---------------- */

function TrendBars({ range }: { range: RangeKey }) {
  const bars = RANGE_DATA[range].bars;
  const max = Math.max(...bars.map((b) => b.ai));

  return (
    <>
      <div className="flex h-[180px] items-end gap-4 border-b border-line px-1.5">
        {bars.map((b) => (
          <div
            key={b.d}
            className="flex h-full flex-1 items-end justify-center gap-1"
          >
            <div
              className="w-4 rounded-t-[5px] bg-green transition-[height] duration-400"
              style={{ height: `${((b.ai / max) * 100).toFixed(0)}%` }}
              title={`AI selesai: ${b.ai}`}
            />
            <div
              className="w-4 rounded-t-[5px] bg-[#ef4444] transition-[height] duration-400"
              style={{ height: `${((b.ho / max) * 100).toFixed(0)}%` }}
              title={`Handover: ${b.ho}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-4 px-1.5 pt-2">
        {bars.map((b) => (
          <span key={b.d} className="flex-1 text-center text-[0.72rem] text-muted">
            {b.d}
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------------- Funnel penjualan ---------------- */

/* Warna & potongan tiap langkah mengikuti .sf-step:nth-child()
   di statistik.css. Di ≤760px potongan dilepas dan langkahnya
   ditumpuk (aturan @media 700px versi lama). */
const FUNNEL_BG = ["#34d399", "#16a34a", "#15803d", "#166534", "#14532d"];

function SalesFunnel({ range }: { range: RangeKey }) {
  const f = RANGE_DATA[range].funnel;
  const top = f[0].n;

  return (
    <div className="flex flex-wrap items-stretch max-mobile:flex-col">
      {f.map((s, i) => (
        <div
          key={s.l}
          className="relative min-w-[150px] flex-1 px-3 py-4.5 text-center text-white max-mobile:min-w-0 max-mobile:rounded-xl max-mobile:[clip-path:none]"
          style={{
            background: FUNNEL_BG[i],
            clipPath:
              i === 0
                ? "polygon(0 0,100% 0,92% 100%,0 100%)"
                : i === f.length - 1
                  ? "polygon(0 0,100% 0,100% 100%,8% 100%)"
                  : "polygon(0 0,100% 0,92% 100%,8% 100%)",
          }}
        >
          <div className="text-[0.82rem] opacity-95">{s.l}</div>
          <div className="mt-1 text-[1.6rem] font-extrabold">{angka(s.n)}</div>
          <div className="mt-1 text-[0.74rem] opacity-90">
            {i === 0 ? "100%" : `${persen(s.n, top)}% dari chat`}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Bar horizontal ---------------- */

function HBars({
  data,
  alt = false,
}: {
  data: { l: string; v: number }[];
  alt?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="flex flex-col gap-3.5">
      {data.map((d) => (
        <div
          key={d.l}
          className="grid grid-cols-[160px_1fr_46px] items-center gap-3 max-mobile:grid-cols-[96px_1fr_38px] max-mobile:gap-2"
        >
          <span className="text-[0.84rem] text-text-2 max-mobile:text-[0.76rem]">
            {d.l}
          </span>
          <div className="h-3.5 overflow-hidden rounded-lg bg-green-mint">
            <div
              className={`h-full rounded-lg transition-[width] duration-400 ${alt ? "bg-[#f59e0b]" : "bg-green"}`}
              style={{ width: `${((d.v / max) * 100).toFixed(0)}%` }}
            />
          </div>
          <span className="text-right text-[0.82rem] font-bold">{d.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Halaman ---------------- */

export default function Statistik() {
  const [range, setRange] = useState<RangeKey>("7d");
  const toast = useToast();
  const conversations = useConversations();
  const nyata = DB_MODE !== "memory";

  /* Dua dari enam kartu KPI dan seluruh donat sekarang dihitung
     dari tabel `conversations`. Empat kartu sisanya — auto-reply,
     waktu respons, konversi, pendapatan — tetap contoh: dua yang
     pertama butuh selisih waktu antar pesan yang belum dihitung,
     dua terakhir butuh data pesanan marketplace yang belum ada
     sambungannya sama sekali. */
  const sebaran = useMemo(
    () =>
      nyata
        ? hitungTindakan(conversations, awalRentang(range))
        : RANGE_DATA[range].actions,
    [nyata, conversations, range],
  );

  return (
    <div className="flex flex-col gap-4.5 bg-page p-5 px-6 pb-10 max-mobile:p-3.5 max-mobile:pb-8">
      <PageHead title="Analisa Layanan Pelanggan & Konversi Penjualan">
        <DateTabs value={range} options={RANGES} onChange={setRange} />
        <ScopeSelect
          label="Filter marketplace"
          options={["Semua Marketplace", "Shopee", "TikTok Shop", "Lazada"]}
        />
        <GhostButton onClick={() => toast("Menyiapkan ekspor data…")}>
          Ekspor
        </GhostButton>
      </PageHead>

      <DemoNotice
        sumber="contoh"
        detail={
          nyata
            ? "Total sesi, tingkat handover, dan donat klasifikasi dihitung dari tabel conversations. Empat KPI lain, grafik batang, corong, produk, dan marketplace masih angka contoh dari lib/db/analytics.ts."
            : "Seluruh angka di halaman ini dari lib/db/analytics.ts, belum dihitung dari tabel conversations."
        }
      />

      <KpiGrid range={range} sebaran={sebaran} nyata={nyata} />

      <div className="grid grid-cols-2 gap-4.5 max-tablet:grid-cols-1">
        <Card>
          <CardHead title="Distribusi Klasifikasi Aksi" note="sesuai claude.md" />
          <Donut sebaran={sebaran} />
        </Card>

        <Card>
          <CardHead title="Tren Volume Percakapan">
            <div className="flex gap-4 text-[0.8rem] text-text-2">
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-green" />
                AI selesai
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#ef4444]" />
                Handover CS
              </span>
            </div>
          </CardHead>
          <TrendBars range={range} />
        </Card>
      </div>

      <Card>
        <CardHead
          title="Funnel Konversi Penjualan dari Chat"
          note="mendukung penjualan tanpa memaksa (claude.md)"
        />
        <SalesFunnel range={range} />
      </Card>

      <div className="grid grid-cols-2 gap-4.5 max-tablet:grid-cols-1">
        <Card>
          <CardHead title="Alasan Handover ke CS Manusia" />
          <HBars data={HANDOVER_REASONS} alt />
        </Card>
        <Card>
          <CardHead title="Produk Paling Sering Ditanyakan" />
          <HBars data={TOP_PRODUCTS} />
        </Card>
      </div>

      <Card>
        <CardHead title="Performa per Marketplace" />
        <TableWrap>
          <thead>
            <tr>
              <Th>Marketplace</Th>
              <Th>Sesi</Th>
              <Th>Auto-Reply</Th>
              <Th>Handover CS</Th>
              <Th>Konversi</Th>
              <Th>Pendapatan</Th>
            </tr>
          </thead>
          <tbody>
            {MARKETPLACE_STATS.map((m) => (
              <tr key={m.name}>
                <Td>
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <MarketplaceLogo logo={m.logo} char={m.c} />
                    {m.name}
                  </span>
                </Td>
                <Td>{angka(m.sesi)}</Td>
                <Td>{m.auto}</Td>
                <Td>{m.ho}</Td>
                <Td>{m.konv}</Td>
                <Td>{m.rev}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
