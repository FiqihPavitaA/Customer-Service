"use client";

/* ===========================================================
   Halaman Chat — port dari dashboard.html + dashboard.js.
   Step 14, halaman paling kompleks (dikerjakan terakhir sesuai
   urutan risiko di MIGRATION.md Fase 4).

   Empat panel seperti versi lama:
     Toko Terhubung · Daftar Percakapan · Jendela Chat · Info
   Di layar sempit panel tersier & sekunder disembunyikan dan
   dibuka lewat tombol 🏪 / ☰ / ℹ️ sebagai overlay penuh
   (claude.md → STANDAR RESPONSIVITAS poin 2).

   Perilaku yang dipertahankan dari dashboard.js:
   - Filter tab Semua / Belum dibaca / Perlu CS + pencarian panel.
   - Pencarian topbar berlingkup (nama, pesanan, resi, isi chat,
     produk) termasuk hasil pencarian massal — kini lewat
     lib/search.ts karena TopBar ada di layout terpisah.
   - Membuka percakapan menandainya sudah dibaca (badge rail ikut
     turun karena keduanya membaca store yang sama).
   - Panel AI Assist: Gunakan / Edit dulu / Alihkan ke CS, dan
     tombol ✨ memanggil /api/chat sungguhan.
   - Tab kanan Pesanan / Rincian Produk / Voucher, dengan katalog
     produk mengikuti konteks percakapan aktif.

   Perubahan yang disengaja: isi pesan dirender sebagai teks
   (whitespace-pre-line), bukan innerHTML seperti dashboard.js —
   menutup jalur XSS dari isi chat pelanggan.
   =========================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { actionTagClass } from "@/components/ai/actionTag";
import { DemoNotice } from "@/components/ui/Bits";
import IntegrateModal, { type PlatformName } from "./IntegrateModal";
import {
  appendMessage,
  markRead,
  setAiSuggestion,
  useConversations,
} from "@/lib/db";
import type { ActionCode, Conversation } from "@/lib/db/types";
import { catalogStatusText, searchProducts, useCatalog } from "@/lib/catalog";
import { inisial, jam, stempel, tanggalPanjang } from "@/lib/format";
import { useSearch, type SearchScope } from "@/lib/search";

/* ---------------- Peta klasifikasi (ACTIONS di dashboard.js) --------------- */

const ACTION_META: Record<ActionCode, { tag: string; conf: string }> = {
  AUTO_REPLY: { tag: "AUTO", conf: "Sumber: Knowledge Base · keyakinan tinggi" },
  ASK_INFORMATION: { tag: "TANYA", conf: "Butuh info tambahan sebelum menjawab" },
  HANDOVER_TO_CS: { tag: "CS", conf: "Perlu ditangani CS manusia" },
  CHECK_ORDER_SYSTEM: { tag: "ORDER", conf: "Perlu cek data sistem pesanan" },
};

/* ---------------- Daftar toko ---------------- */

type Shop = { name: string; logo: string; char: string; status: "online" | "away" | "offline" };

const SHOPS_AWAL: Shop[] = [
  { name: "infarmofficialshop", logo: "bg-shp", char: "S", status: "online" },
  { name: "infarm", logo: "bg-shp", char: "S", status: "online" },
  { name: "Infarm Official", logo: "bg-tt", char: "T", status: "online" },
  { name: "Infarm Yogyakarta", logo: "bg-shp", char: "S", status: "online" },
  { name: "Infarm Tangerang", logo: "bg-shp", char: "S", status: "away" },
  { name: "Infarm Jakarta", logo: "bg-tt", char: "T", status: "online" },
  { name: "Infarm Semarang", logo: "bg-shp", char: "S", status: "away" },
  { name: "Infarm Bali", logo: "bg-tt", char: "T", status: "online" },
  { name: "Infarm Surabaya", logo: "bg-lz", char: "L", status: "offline" },
];

const STATUS_DOT: Record<Shop["status"], string> = {
  online: "bg-green",
  away: "bg-[#f59e0b]",
  offline: "bg-[#cbd5e1]",
};

/* ---------------- Penyaringan daftar percakapan --------------- */

/** Nilai yang dicari sesuai lingkup dropdown (fieldValue di dashboard.js). */
function fieldValue(c: Conversation, scope: SearchScope) {
  switch (scope) {
    case "pesanan":
      return c.order_id ?? "";
    case "resi":
      return c.tracking_no ?? "";
    case "chat":
      return c.messages.map((m) => m.content).join(" ");
    case "produk":
      return c.product_query;
    default:
      return c.customer_name ?? "";
  }
}

/** Kutipan pesan terakhir untuk baris daftar (dulu field `snippet`). */
function snippet(c: Conversation) {
  const last = c.messages[c.messages.length - 1];
  return last ? last.content.replace(/\s+/g, " ") : "";
}

/* ---------------- Panel: daftar toko ---------------- */

function ShopsPanel({
  shops,
  active,
  onPick,
  onIntegrate,
  onClose,
}: {
  shops: Shop[];
  active: string;
  onPick: (name: string) => void;
  onIntegrate: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="m-2 cursor-pointer rounded-xl border border-line bg-white px-3 py-2 font-bold text-text-2"
        >
          ✕ Tutup
        </button>
      )}
      <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
        <span className="text-[0.9rem] font-bold">Toko Terhubung</span>
      </div>
      <div className="px-3.5 pt-3 pb-1.5 text-[0.72rem] font-bold tracking-wider text-muted uppercase">
        Marketplace Terhubung
      </div>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {shops.map((s) => (
          <li key={s.name}>
            <button
              type="button"
              onClick={() => onPick(s.name)}
              className={`flex w-full cursor-pointer items-center gap-2.5 border-none px-3.5 py-2.5 text-left transition ${
                s.name === active ? "bg-green-mint" : "bg-transparent hover:bg-green-soft"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[0.7rem] font-extrabold text-white ${s.logo}`}
                aria-hidden
              >
                {s.char}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.86rem] font-semibold">
                {s.name}
              </span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`}
                title={s.status}
              />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onIntegrate}
        className="m-3 cursor-pointer rounded-xl border border-green bg-green-soft px-3 py-2.5 font-bold text-green-dark transition hover:bg-green-mint"
      >
        ＋ Integrasikan Toko Baru
      </button>
    </div>
  );
}

/* ---------------- Panel: daftar percakapan ---------------- */

type FilterKey = "all" | "unread" | "cs";

function ConversationsPanel({
  rows,
  activeId,
  filter,
  setFilter,
  query,
  setQuery,
  counts,
  onPick,
  onClose,
}: {
  rows: Conversation[];
  activeId: string;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  query: string;
  setQuery: (q: string) => void;
  counts: { unread: number; cs: number };
  onPick: (id: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col border-r border-line bg-white">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="m-2 cursor-pointer rounded-xl border border-line bg-white px-3 py-2 font-bold text-text-2"
        >
          ✕ Tutup
        </button>
      )}

      <div className="flex gap-1 border-b border-line px-2 pt-2">
        {(
          [
            { key: "all", label: "Semua", n: 0, warn: false },
            { key: "unread", label: "Belum dibaca", n: counts.unread, warn: false },
            { key: "cs", label: "Perlu CS", n: counts.cs, warn: true },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            aria-pressed={filter === t.key}
            className={[
              "-mb-px flex cursor-pointer items-center gap-1.5 border-x-0 border-t-0 border-b-2 bg-transparent px-2.5 py-2 text-[0.82rem] font-bold whitespace-nowrap transition",
              filter === t.key
                ? "border-green text-green-dark"
                : "border-transparent text-muted hover:text-text-2",
            ].join(" ")}
          >
            {t.label}
            {t.n > 0 && (
              <span
                className={`rounded-lg px-1.5 py-px text-[0.68rem] font-bold ${
                  t.warn ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-green-mint text-green-dark"
                }`}
              >
                {t.n}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span aria-hidden className="opacity-50">
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari percakapan…"
          aria-label="Cari percakapan"
          className="w-full border-none text-[0.88rem] outline-none"
        />
      </div>

      {/* Penanda mode demo — di kepala daftar, bukan melayang di atas
          composer (versi melayang menutupi tombol Kirim). */}
      <div className="border-b border-line-soft px-2 py-2">
        <DemoNotice detail="Balasan tersimpan selama sesi ini." />
      </div>

      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {rows.length === 0 && (
          <li className="px-4 py-8 text-center text-[0.84rem] text-muted">
            Tidak ada percakapan yang cocok.
          </li>
        )}
        {rows.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className={`flex w-full cursor-pointer items-start gap-2.5 border-none border-b border-b-line-soft px-3.5 py-3 text-left transition ${
                c.id === activeId
                  ? "bg-green-mint"
                  : c.unread
                    ? "bg-green-soft hover:bg-green-mint"
                    : "bg-white hover:bg-green-soft"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green text-[0.78rem] font-bold text-white">
                {inisial(c.customer_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[0.88rem] ${c.unread ? "font-extrabold" : "font-semibold"}`}
                  >
                    {c.customer_name}
                  </span>
                  <span className="shrink-0 text-[0.72rem] text-muted">
                    {jam(c.last_message_at)}
                  </span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[0.78rem] text-muted">{snippet(c)}</span>
                  {c.action && (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.6rem] font-extrabold ${actionTagClass(c.action)}`}
                    >
                      {ACTION_META[c.action].tag}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Panel kanan: info pelanggan ---------------- */

type InfoTab = "pesanan" | "produk" | "voucher";

function InfoPanel({
  c,
  onClose,
}: {
  c: Conversation;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<InfoTab>("pesanan");
  /* Kata kunci awal mengikuti konteks percakapan. Saat percakapan
     berganti, komponen ini dipasang ulang lewat prop `key` di
     pemanggilnya — jadi tidak perlu menyalin state lewat effect. */
  const [q, setQ] = useState(c.product_query);
  const catalog = useCatalog();

  const matches = useMemo(
    () => searchProducts(catalog.products, q, 20),
    [catalog.products, q],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-line bg-white">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="m-2 cursor-pointer rounded-xl border border-line bg-white px-3 py-2 font-bold text-text-2"
        >
          ✕ Tutup
        </button>
      )}

      <div className="flex items-center gap-3 border-b border-line p-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green text-[0.95rem] font-bold text-white">
          {inisial(c.customer_name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold">{c.customer_name}</div>
          <div className="mt-0.5 truncate text-[0.78rem] text-muted">
            {(c.shop_name ?? "").split(" · ")[0]}{" "}
            <span className="rounded bg-green-mint px-1 text-[0.66rem] font-bold text-green-dark">
              ID
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line px-2 pt-2">
        {(
          [
            { key: "pesanan", label: "Pesanan" },
            { key: "produk", label: "Rincian Produk" },
            { key: "voucher", label: "Voucher" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={[
              "-mb-px cursor-pointer border-x-0 border-t-0 border-b-2 bg-transparent px-2.5 py-2 text-[0.8rem] font-bold whitespace-nowrap transition",
              tab === t.key
                ? "border-green text-green-dark"
                : "border-transparent text-muted hover:text-text-2",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 p-3.5">
        {tab === "pesanan" &&
          (c.order_status ? (
            <div className="rounded-2xl border border-line p-3.5">
              <div className="mb-2 font-bold">Pesanan #{c.order_id}</div>
              <div className="flex justify-between py-1 text-[0.82rem]">
                <span className="text-muted">Status</span>
                <b>{c.order_status}</b>
              </div>
              <div className="flex justify-between py-1 text-[0.82rem]">
                <span className="text-muted">Kurir</span>
                <b>{c.order_courier}</b>
              </div>
              <div className="flex justify-between py-1 text-[0.82rem]">
                <span className="text-muted">Resi</span>
                <b className="font-mono">{c.tracking_no}</b>
              </div>
            </div>
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <div className="text-3xl opacity-40" aria-hidden>
                📦
              </div>
              <p className="mt-2 mb-0 text-[0.84rem] text-muted">
                Tidak Ada Pesanan dalam 1 Bulan Terakhir
              </p>
            </div>
          ))}

        {tab === "produk" && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-green-soft px-3 py-2">
              <span aria-hidden className="opacity-50">
                🔍
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk / SKU…"
                aria-label="Cari produk"
                className="w-full border-none bg-transparent text-[0.86rem] outline-none"
              />
            </div>
            <div className="mt-2 text-[0.74rem] text-muted">
              Menampilkan <b className="text-text">{matches.length}</b> hasil ·{" "}
              {catalogStatusText(catalog)}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {matches.length === 0 && (
                <div className="py-6 text-center text-[0.82rem] text-muted">
                  Produk tidak ditemukan. Coba kata kunci lain.
                </div>
              )}
              {matches.map((p) => (
                <div
                  key={p.sku}
                  className="flex items-start gap-2.5 rounded-xl border border-line p-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-green-mint">
                    🌱
                  </span>
                  <div className="min-w-0">
                    <div className="text-[0.82rem] font-semibold">{p.nama_produk}</div>
                    <div className="mt-0.5 text-[0.72rem] text-muted">
                      {p.sku} · {p.kategori}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "voucher" && (
          <div className="grid place-items-center py-10 text-center">
            <div className="text-3xl opacity-40" aria-hidden>
              🎟️
            </div>
            <p className="mt-2 mb-0 text-[0.84rem] text-muted">
              Belum ada voucher aktif untuk pelanggan ini.
            </p>
          </div>
        )}
      </div>

      {/* Ringkasan handover internal — format dari claude.md */}
      <div className="border-t border-line p-3.5">
        <div className="mb-2 text-[0.82rem] font-bold">📝 Ringkasan Internal CS</div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.8rem]">
          {Object.entries(c.handover_detail ?? {}).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="text-muted">{k}</span>
              <b className="text-right">{v}</b>
            </li>
          ))}
          {c.action && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted">Tindakan AI</span>
              <b
                className={`rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold ${actionTagClass(c.action)}`}
              >
                {c.action}
              </b>
            </li>
          )}
        </ul>
        {c.handover_summary && (
          <p className="mt-2.5 mb-0 rounded-xl bg-green-soft p-2.5 text-[0.78rem] leading-relaxed text-text-2">
            {c.handover_summary}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Halaman ---------------- */

export default function Chat() {
  const conversations = useConversations();
  const search = useSearch();
  const toast = useToast();

  const [activeId, setActiveId] = useState<string>(conversations[0]?.id ?? "");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [panelQuery, setPanelQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [shops, setShops] = useState<Shop[]>(SHOPS_AWAL);
  const [activeShop, setActiveShop] = useState(SHOPS_AWAL[0].name);
  const [modal, setModal] = useState(false);
  const [overlay, setOverlay] = useState<null | "shops" | "conv" | "info">(null);
  const [meminta, setMeminta] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  const active =
    conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;

  // Membuka percakapan = menandainya sudah dibaca (dashboard.js).
  useEffect(() => {
    if (active) markRead(active.id);
  }, [active]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [active?.id, active?.messages.length]);

  const rows = useMemo(() => {
    const q = panelQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && !c.unread) return false;
      if (filter === "cs" && c.action !== "HANDOVER_TO_CS") return false;

      if (q) {
        const nama = (c.customer_name ?? "").toLowerCase();
        if (!nama.includes(q) && !snippet(c).toLowerCase().includes(q)) return false;
      }

      // Pencarian topbar (lingkup + massal), sama seperti dashboard.js
      const v = fieldValue(c, search.scope).toLowerCase();
      if (search.terms.length) {
        if (!search.terms.some((t) => v.includes(t))) return false;
      } else if (search.single.trim()) {
        if (!v.includes(search.single.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [conversations, filter, panelQuery, search]);

  const counts = {
    unread: conversations.filter((c) => c.unread).length,
    cs: conversations.filter((c) => c.action === "HANDOVER_TO_CS").length,
  };

  const pick = (id: string) => {
    setActiveId(id);
    setOverlay(null);
  };

  const kirim = () => {
    const text = draft.trim();
    if (!active) return;
    if (!text) {
      toast("Tulis pesan dulu, Kak");
      return;
    }
    appendMessage(active.id, text);
    setDraft("");
    toast("Pesan terkirim");
  };

  /** Tombol ✨ — memanggil /api/chat sungguhan (askClaude di dashboard.js). */
  const mintaSaran = async () => {
    if (!active || meminta) return;
    const lastIn = [...active.messages].reverse().find((m) => m.role === "user");
    const message = (lastIn?.content ?? snippet(active)).trim();
    if (!message) {
      toast("Belum ada pesan pelanggan untuk dianalisa");
      return;
    }

    setMeminta(true);
    toast("Meminta saran ke AI…");
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [] }),
      });
      if (!resp.ok) throw new Error(String(resp.status));
      const data = (await resp.json()) as {
        action: ActionCode;
        reply: string;
        source?: string;
      };
      setAiSuggestion(active.id, data.reply, data.action);
      setDraft(data.reply);
      toast(
        data.source === "template"
          ? "Balasan dari template (tanpa biaya AI) ✨"
          : "Saran dari Claude siap ✨",
      );
    } catch {
      // Sama seperti versi lama: tanpa API key, pakai saran contoh.
      setDraft(active.ai_suggestion ?? "");
      toast("AI belum aktif — pakai saran contoh");
    } finally {
      setMeminta(false);
    }
  };

  if (!active) {
    return (
      <div className="grid h-full place-items-center p-6 text-muted">
        Belum ada percakapan.
      </div>
    );
  }

  const meta = ACTION_META[active.action ?? "AUTO_REPLY"];

  return (
    <div className="relative flex h-full min-h-0">
      {/* Panel 1 — toko (disembunyikan ≤980px) */}
      <aside className="w-56 shrink-0 max-tablet:hidden">
        <ShopsPanel
          shops={shops}
          active={activeShop}
          onPick={setActiveShop}
          onIntegrate={() => setModal(true)}
        />
      </aside>

      {/* Panel 2 — daftar percakapan (disembunyikan ≤760px) */}
      <section className="w-72 shrink-0 max-mobile:hidden">
        <ConversationsPanel
          rows={rows}
          activeId={active.id}
          filter={filter}
          setFilter={setFilter}
          query={panelQuery}
          setQuery={setPanelQuery}
          counts={counts}
          onPick={pick}
        />
      </section>

      {/* Panel 3 — jendela chat */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-page">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOverlay("shops")}
              title="Toko terhubung"
              className="hidden h-9 w-9 cursor-pointer rounded-xl border border-line bg-white max-tablet:block"
            >
              🏪
            </button>
            <button
              type="button"
              onClick={() => setOverlay("conv")}
              title="Daftar percakapan"
              className="hidden h-9 w-9 cursor-pointer rounded-xl border border-line bg-white max-mobile:block"
            >
              ☰
            </button>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green text-[0.82rem] font-bold text-white">
              {inisial(active.customer_name)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-bold">{active.customer_name}</div>
              <div className="truncate text-[0.78rem] text-muted">{active.shop_name}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-[0.78rem] text-muted">
            <span>⏱ <b className="text-text">{jam(active.last_message_at)}</b></span>
            <span>💬 <b className="text-text">{active.chat_count}</b> chat</span>
            <button
              type="button"
              onClick={() => setOverlay("info")}
              title="Info pelanggan"
              className="hidden h-9 w-9 cursor-pointer rounded-xl border border-line bg-white max-wide:block"
            >
              ℹ️
            </button>
          </div>
        </div>

        <div ref={streamRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 text-center">
            <span className="rounded-3xl bg-white px-3 py-1 text-[0.72rem] text-muted">
              {tanggalPanjang(active.created_at)}
            </span>
          </div>

          {active.messages.map((m, i) => (
            <div
              key={i}
              className={`mb-3 flex flex-col ${m.role === "assistant" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[min(560px,78%)] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed whitespace-pre-line ${
                  m.role === "assistant"
                    ? "bg-green text-white"
                    : "border border-line bg-white text-text"
                }`}
              >
                {m.content}
              </div>
              <span className="mt-1 text-[0.7rem] text-muted">{stempel(m.timestamp)}</span>
            </div>
          ))}
        </div>

        {/* AI Assist */}
        <div className="border-t border-line bg-white px-3.5 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-green-mint px-2 py-0.5 text-[0.74rem] font-bold text-green-dark">
              🤖 AI Assist
            </span>
            <span
              className={`rounded-md px-1.75 py-0.5 text-[0.62rem] font-extrabold ${actionTagClass(active.action ?? "AUTO_REPLY")}`}
            >
              {active.action}
            </span>
            <span className="text-[0.76rem] text-muted">{meta.conf}</span>
          </div>
          <p className="m-0 mb-2.5 rounded-xl bg-green-soft p-3 text-[0.86rem] leading-relaxed">
            {active.ai_suggestion}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(active.ai_suggestion ?? "");
                toast("Balasan AI dimasukkan ke kotak ketik");
              }}
              className="cursor-pointer rounded-[10px] border-none bg-green px-3.5 py-1.5 text-[0.82rem] font-bold text-white transition hover:bg-green-hover"
            >
              Gunakan balasan
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(active.ai_suggestion ?? "");
                toast("Silakan edit balasan sebelum dikirim");
              }}
              className="cursor-pointer rounded-[10px] border border-line bg-white px-3.5 py-1.5 text-[0.82rem] font-bold text-text-2 transition hover:bg-green-soft"
            >
              Edit dulu
            </button>
            <button
              type="button"
              onClick={() => toast("Percakapan dialihkan ke CS manusia + ringkasan terkirim")}
              className="cursor-pointer rounded-[10px] border border-[#fecaca] bg-white px-3.5 py-1.5 text-[0.82rem] font-bold text-[#b91c1c] transition hover:bg-[#fee2e2]"
            >
              Alihkan ke CS
            </button>
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-white p-3">
          <div className="mb-2 flex items-center gap-1">
            {["😊", "🖼️", "🎬", "🏷️"].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => toast("Alat ini belum tersedia di demo")}
                className="h-8 w-8 cursor-pointer rounded-lg border-none bg-transparent hover:bg-green-mint"
              >
                {i}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={mintaSaran}
              disabled={meminta}
              title="Minta saran AI"
              className="h-8 w-8 cursor-pointer rounded-lg border-none bg-transparent hover:bg-green-mint disabled:opacity-50"
            >
              ✨
            </button>
          </div>

          <textarea
            value={draft}
            maxLength={600}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                kirim();
              }
            }}
            rows={3}
            placeholder="Tulis balasan… (Enter kirim, Shift+Enter baris baru)"
            aria-label="Tulis balasan"
            className="w-full resize-y rounded-xl border border-line bg-green-soft p-3 text-[0.9rem] outline-none focus:bg-white"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toast("Terjemahan otomatis aktif saat backend terhubung")}
              className="cursor-pointer rounded-[9px] border border-line bg-white px-3 py-1.5 text-[0.8rem] font-semibold text-text-2"
            >
              🌐 Terjemahkan
            </button>
            <span className="ml-auto text-[0.74rem] text-muted">{draft.length}/600</span>
            <button
              type="button"
              onClick={kirim}
              className="cursor-pointer rounded-xl border-none bg-green px-5 py-2 font-bold text-white transition hover:bg-green-hover"
            >
              Kirim
            </button>
          </div>
        </div>
      </main>

      {/* Panel 4 — info pelanggan (disembunyikan ≤1180px) */}
      <aside className="w-72 shrink-0 max-wide:hidden">
        <InfoPanel key={active.id} c={active} />
      </aside>

      {/* Overlay panel untuk layar sempit */}
      {overlay && (
        <div className="absolute inset-0 z-40 bg-white">
          {overlay === "shops" && (
            <ShopsPanel
              shops={shops}
              active={activeShop}
              onPick={(n) => {
                setActiveShop(n);
                setOverlay(null);
              }}
              onIntegrate={() => {
                setOverlay(null);
                setModal(true);
              }}
              onClose={() => setOverlay(null)}
            />
          )}
          {overlay === "conv" && (
            <ConversationsPanel
              rows={rows}
              activeId={active.id}
              filter={filter}
              setFilter={setFilter}
              query={panelQuery}
              setQuery={setPanelQuery}
              counts={counts}
              onPick={pick}
              onClose={() => setOverlay(null)}
            />
          )}
          {overlay === "info" && (
            <InfoPanel key={active.id} c={active} onClose={() => setOverlay(null)} />
          )}
        </div>
      )}

      {modal && (
        <IntegrateModal
          onClose={() => setModal(false)}
          onAdd={({ name, platform }: { name: string; platform: PlatformName }) => {
            const logo =
              platform === "Shopee"
                ? { logo: "bg-shp", char: "S" }
                : platform === "TikTok Shop"
                  ? { logo: "bg-tt", char: "T" }
                  : { logo: "bg-lz", char: "L" };
            setShops((prev) => [...prev, { name, status: "online", ...logo }]);
          }}
        />
      )}
    </div>
  );
}
