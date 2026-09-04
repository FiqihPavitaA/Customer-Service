"use client";

/* ===========================================================
   Halaman Beranda — port dari beranda.html (Step 10).

   beranda.html tidak punya berkas JS sendiri; satu-satunya
   skripnya adalah grafik tren di bagian bawah. Datanya kini
   ada di lib/db/analytics.ts (HOME_*), kecuali dua angka yang
   sekarang dihitung dari data nyata store:
   - "Perlu Handover ke CS"  -> jumlah escalations berstatus open
   - "Membutuhkan balasan"   -> jumlah conversations unread
   Keduanya sengaja diambil dari store supaya begitu Supabase
   menyala, kartu ini langsung hidup tanpa diubah lagi.
   =========================================================== */

import Link from "next/link";
import { useState } from "react";
import { Card, CardHead, CardLink } from "@/components/ui/Card";
import { DateTabs, DemoNotice } from "@/components/ui/Bits";
import { useToast } from "@/components/Toast";
import {
  HOME_ACCOUNT,
  HOME_PLATFORMS,
  HOME_RATING,
  HOME_REALTIME,
  HOME_SUMMARY,
  HOME_TREND,
} from "@/lib/db/analytics";
import { selectEscalations, useConversations, useDb } from "@/lib/db";
import { angka } from "@/lib/format";

const PERIODS = [
  { value: "kemarin" as const, label: "Kemarin" },
  { value: "7d" as const, label: "7 Hari Terakhir" },
];

/* ---------------- Integrasi toko ---------------- */

const PF_BG: Record<string, string> = {
  lz: "bg-lz",
  shp: "bg-shp",
  tt: "bg-tt",
  fb: "bg-[#1877f2] font-extrabold",
  off: "bg-[#e2e8f0]",
};

function Integrasi() {
  return (
    <Card>
      <CardHead title="Integrasi Toko">
        <CardLink href="/chat">Kelola ›</CardLink>
      </CardHead>
      <div className="grid grid-cols-6 gap-3 max-tablet:grid-cols-3 max-mini:grid-cols-2">
        {HOME_PLATFORMS.map((p) => (
          <Link
            key={p.name}
            href="/chat"
            className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-text no-underline transition hover:-translate-y-0.5 hover:bg-green-soft ${
              p.count === 0 ? "opacity-55" : ""
            }`}
          >
            {p.count > 0 && (
              <span className="absolute top-2 right-[22px] rounded-[10px] bg-green px-1.5 py-px text-[0.66rem] font-extrabold text-white">
                {p.count}
              </span>
            )}
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl text-[1.5rem] text-white ${PF_BG[p.cls]}`}
              aria-hidden
            >
              {p.icon}
            </span>
            <span className="text-[0.85rem] font-semibold">{p.name}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Kartu akun ---------------- */

function Akun() {
  const toast = useToast();
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold">{HOME_ACCOUNT.user}</div>
          <div className="mt-1 text-[0.8rem] text-muted">
            Sisa Kuota Balasan AI: <b className="text-text">{HOME_ACCOUNT.kuota}</b>
          </div>
          <div className="mt-1 text-[0.8rem] text-muted">
            Berlaku s.d. {HOME_ACCOUNT.berlaku}{" "}
            <span className="rounded-lg bg-[#fef3c7] px-1.5 py-px text-[0.68rem] font-bold text-[#92400e]">
              {HOME_ACCOUNT.sisaHari}
            </span>
          </div>
        </div>
        <span className="rounded-xl bg-gradient-to-br from-green to-green-dark px-3 py-1.5 text-[0.78rem] font-extrabold tracking-wider text-white">
          {HOME_ACCOUNT.tier}
        </span>
      </div>

      <button
        type="button"
        onClick={() => toast("Halaman langganan belum tersedia di demo")}
        className="my-3.5 mb-4.5 cursor-pointer rounded-xl border border-green bg-green-soft p-2.75 font-bold text-green-dark transition hover:bg-green-mint"
      >
        Beli / Tingkatkan Segera
      </button>

      <div className="mb-2.5 text-[0.78rem] font-bold tracking-wider text-muted uppercase">
        Navigasi Cepat
      </div>
      <div className="flex flex-col gap-2">
        {[
          { href: "/chat", label: "⚡ Balasan Cepat" },
          { href: "/pesanan", label: "📌 Follow Up Pesan" },
          { href: "/broadcast", label: "📣 Pesan Broadcast" },
        ].map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="rounded-[10px] border border-line px-3 py-2.5 text-[0.86rem] font-semibold text-text-2 no-underline transition hover:border-green hover:bg-green-mint hover:text-green-dark"
          >
            {q.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Data real time ---------------- */

function RealTime() {
  const conversations = useConversations();
  const escalations = useDb(selectEscalations);

  const unread = conversations.filter((c) => c.unread).length;
  const open = escalations.filter((e) => e.status === "open").length;

  const items = [
    {
      label: "Membutuhkan balasan",
      value: angka(HOME_REALTIME.perluBalasan + unread),
      tone: "text-[#dc2626]",
      live: true,
    },
    { label: "Menunggu Diproses", value: angka(HOME_REALTIME.menungguProses), tone: "" },
    {
      label: "Perlu Handover ke CS",
      value: angka(HOME_REALTIME.perluHandover + open),
      tone: "text-[#d97706]",
      live: true,
    },
    { label: "Waktu respons rata-rata", value: HOME_REALTIME.responRata, tone: "", small: true },
  ];

  return (
    <Card>
      <CardHead title="Data Real Time">
        <span className="text-[0.78rem] text-muted">
          Waktu Diperbarui: {HOME_REALTIME.diperbarui} ⟳
        </span>
      </CardHead>
      <div className="grid grid-cols-4 gap-4.5 max-tablet:grid-cols-2 max-mini:grid-cols-1">
        {items.map((it) => (
          <div key={it.label} className="border-l-[3px] border-green-mint pl-2">
            <div className="mb-2 text-[0.84rem] text-text-2">
              {it.label} <span className="text-muted">ⓘ</span>
              {it.live && (
                <span
                  className="ml-1 text-[0.66rem] font-bold text-green-dark"
                  title="Sebagian angka ini sudah dihitung dari data store, bukan angka tetap"
                >
                  live
                </span>
              )}
            </div>
            <div
              className={`font-extrabold ${it.small ? "text-[1.25rem]" : "text-[1.9rem]"} ${it.tone}`}
            >
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Ringkasan data pesan ---------------- */

function Ringkasan() {
  const [period, setPeriod] = useState<"kemarin" | "7d">("kemarin");
  const f = HOME_SUMMARY.funnel;

  return (
    <Card>
      <CardHead title="Ringkasan Data Pesan">
        <div className="flex flex-wrap items-center gap-2">
          <DateTabs value={period} options={PERIODS} onChange={setPeriod} />
          <span className="rounded-[9px] border border-line px-3 py-1.5 text-[0.8rem] text-muted">
            2026-06-23 — 2026-06-23
          </span>
        </div>
      </CardHead>

      <div className="grid grid-cols-[280px_1fr] items-start gap-6 max-tablet:grid-cols-1">
        {/* Funnel klasifikasi */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="flex w-full flex-col gap-1 px-2.5 py-4 text-center text-white"
            style={{
              background: "#34d399",
              clipPath: "polygon(0 0, 100% 0, 88% 100%, 12% 100%)",
            }}
          >
            <span className="text-[0.82rem] opacity-95">Sesi Percakapan Masuk</span>
            <span className="text-[1.5rem] font-extrabold">{angka(f.masuk)}</span>
          </div>
          <div className="flex items-center gap-2 text-[0.78rem] text-muted">
            <span>Dijawab Otomatis AI</span>
            <b className="text-green-dark">{f.autoPct}</b>
          </div>
          <div
            className="flex w-[88%] flex-col gap-1 px-2.5 py-4 text-center text-white"
            style={{
              background: "#16a34a",
              clipPath: "polygon(12% 0, 88% 0, 76% 100%, 24% 100%)",
            }}
          >
            <span className="text-[0.82rem] opacity-95">Diselesaikan AI</span>
            <span className="text-[1.5rem] font-extrabold">{angka(f.selesaiAi)}</span>
          </div>
          <div className="flex items-center gap-2 text-[0.78rem] text-muted">
            <span>Dialihkan ke CS</span>
            <b className="text-[#dc2626]">{f.handoverPct}</b>
          </div>
          <div
            className="flex w-[76%] flex-col gap-1 px-2.5 py-4 text-center text-white"
            style={{
              background: "#15803d",
              clipPath: "polygon(24% 0, 76% 0, 64% 100%, 36% 100%)",
            }}
          >
            <span className="text-[0.82rem] opacity-95">Handover ke CS</span>
            <span className="text-[1.5rem] font-extrabold">{angka(f.handover)}</span>
          </div>
        </div>

        {/* Enam kartu metrik */}
        <div className="grid grid-cols-3 gap-3.5 max-tablet:grid-cols-2 max-mini:grid-cols-1">
          {HOME_SUMMARY.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-line-soft bg-green-soft p-3.5"
            >
              <div className="flex items-center justify-between text-[0.78rem] font-semibold text-text-2">
                <span>{m.label}</span>
                <span className={m.up ? "text-green-dark" : "text-[#dc2626]"}>
                  {m.trend}
                </span>
              </div>
              <div className="mt-1.5 mb-1 text-[1.6rem] font-extrabold">{m.num}</div>
              <div className="text-[0.74rem] text-muted">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Data penilaian ---------------- */

function MiniFunnel({
  a,
  b,
  labelA,
  labelB,
  conv,
  convLabel,
}: {
  a: number;
  b: number;
  labelA: string;
  labelB: string;
  conv: string;
  convLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-full rounded p-3 text-center text-white"
        style={{
          background: "#34d399",
          clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)",
        }}
      >
        <span className="block text-[0.78rem]">{labelA}</span>
        <b className="text-[1.2rem]">{angka(a)}</b>
      </div>
      <div
        className="w-4/5 rounded p-3 text-center text-white"
        style={{
          background: "#16a34a",
          clipPath: "polygon(0 0, 100% 0, 82% 100%, 18% 100%)",
        }}
      >
        <span className="block text-[0.78rem]">{labelB}</span>
        <b className="text-[1.2rem]">{angka(b)}</b>
      </div>
      <div className="mt-1.5 text-[0.8rem] text-muted">
        {convLabel} <b className="text-green-dark">{conv}</b>
      </div>
    </div>
  );
}

function Penilaian() {
  const [period, setPeriod] = useState<"kemarin" | "7d">("kemarin");
  const r = HOME_RATING;

  return (
    <Card>
      <CardHead title="Data Penilaian">
        <DateTabs value={period} options={PERIODS} onChange={setPeriod} />
      </CardHead>

      <div className="grid grid-cols-3 gap-4.5 max-tablet:grid-cols-1">
        <div className="rounded-2xl border border-line-soft p-4.5">
          <div className="mb-4 flex items-center justify-between text-[0.9rem] font-bold">
            Kepuasan Pelanggan
            <CardLink href="/statistik">Lihat Lainnya ›</CardLink>
          </div>
          <div className="flex items-center gap-5">
            <div
              className="grid h-[120px] w-[120px] shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--color-green) 0 ${r.positif}%, #ef4444 ${r.positif}% 100%)`,
              }}
              role="img"
              aria-label={`Ulasan positif ${r.positif} persen`}
            >
              <div className="h-[74px] w-[74px] rounded-full bg-white" />
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              <li className="flex items-center gap-2 text-[0.84rem] text-text-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green" />
                Ulasan Positif
                <b className="ml-auto text-text">
                  {r.positif.toFixed(2).replace(".", ",")}%
                </b>
              </li>
              <li className="flex items-center gap-2 text-[0.84rem] text-text-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                Ulasan Negatif
                <b className="ml-auto text-text">
                  {r.negatif.toFixed(2).replace(".", ",")}%
                </b>
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-line-soft p-4.5">
          <div className="mb-4 text-[0.9rem] font-bold">Pengingat Penilaian Positif</div>
          <MiniFunnel
            a={r.pengingat.dikirim}
            b={r.pengingat.masuk}
            labelA="Pengingat Dikirim"
            labelB="Penilaian Positif Masuk"
            conv={r.pengingat.pct}
            convLabel="Berhasil"
          />
        </div>

        <div className="rounded-2xl border border-line-soft p-4.5">
          <div className="mb-4 text-[0.9rem] font-bold">Pemulihan Penilaian Negatif</div>
          <MiniFunnel
            a={r.pemulihan.dikirim}
            b={r.pemulihan.berhasil}
            labelA="Follow-up Dikirim"
            labelB="Berhasil Dipulihkan"
            conv={r.pemulihan.pct}
            convLabel="Pemulihan"
          />
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Tren data pesan ---------------- */

function Tren() {
  const [period, setPeriod] = useState<"kemarin" | "7d">("7d");
  const max = Math.max(...HOME_TREND.map((t) => t.a));

  return (
    <Card>
      <CardHead title="Tren Data Pesan">
        <DateTabs value={period} options={PERIODS} onChange={setPeriod} />
      </CardHead>

      <div className="mb-3.5 flex flex-wrap gap-5 text-[0.82rem] text-text-2">
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-green" /> Pembeli
          Konsultasi
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#34d399]" /> Sesi
          Diselesaikan AI
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#f59e0b]" /> %
          Auto-Reply
        </span>
      </div>

      <div className="flex h-[220px] items-end gap-5.5 border-b border-line px-2.5 max-mini:gap-2.5">
        {HOME_TREND.map((t) => (
          <div key={t.d} className="flex h-full flex-1 items-end justify-center gap-1.25">
            <div
              className="w-5.5 rounded-t-md bg-green transition-[height] duration-400 max-mini:w-3.5"
              style={{ height: `${((t.a / max) * 100).toFixed(0)}%` }}
              title={`Konsultasi: ${t.a}`}
            />
            <div
              className="w-5.5 rounded-t-md bg-[#34d399] transition-[height] duration-400 max-mini:w-3.5"
              style={{ height: `${((t.b / max) * 100).toFixed(0)}%` }}
              title={`Sesi AI: ${t.b}`}
            />
            <div
              className="w-5.5 rounded-t-md bg-[#f59e0b] transition-[height] duration-400 max-mini:w-3.5"
              style={{ height: `${t.p}%` }}
              title={`Auto-Reply: ${t.p}%`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-5.5 px-2.5 pt-2 max-mini:gap-2.5">
        {HOME_TREND.map((t) => (
          <span key={t.d} className="flex-1 text-center text-[0.74rem] text-muted">
            {t.d}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Halaman ---------------- */

export default function Beranda() {
  return (
    <div className="flex flex-col gap-4.5 p-5 px-6 pb-10 max-mini:gap-3.5 max-mini:p-3.5 max-mini:pb-7.5">
      <DemoNotice
        sumber="contoh"
        detail="Kartu bertanda 'live' dihitung dari data percakapan yang nyata; sisanya masih angka contoh dari lib/db/analytics.ts."
      />

      <div className="grid grid-cols-[1fr_320px] gap-4.5 max-tablet:grid-cols-1">
        <Integrasi />
        <Akun />
      </div>

      <RealTime />
      <Ringkasan />
      <Penilaian />
      <Tren />
    </div>
  );
}
