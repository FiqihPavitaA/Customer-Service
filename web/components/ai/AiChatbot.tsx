"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { actionTagClass } from "./actionTag";
import CostMeter, { type SessionTotals } from "./CostMeter";
import { computeCost, type CostBreakdown, type Usage } from "@/lib/pricing";

/* ===========================================================
   Halaman AI Chatbot — port sub-tab "Coba Balasan AI" di ai.html.

   Beda penting dari ai.js versi lama: TIDAK ADA mockClassify.
   Versi lama diam-diam mengarang balasan contoh saat backend
   mati, lengkap dengan label ACTION. Untuk demo yang tujuannya
   mengukur token, itu berbahaya — jawaban palsu berbiaya nol
   bisa terbaca seolah hasil Claude. Sekarang galatnya
   ditampilkan apa adanya.
   =========================================================== */

const SAMPLES = [
  "Dosis POC Buah buat tomat berapa ya kak?",
  "Paket saya belum sampai, sudah 7 hari",
  "Daun cabai saya menguning kenapa ya?",
  "Resi pesanan 240620 sudah update belum?",
];

const STATS = [
  { ico: "📈", pct: "15%", label: "Tingkatkan Tingkat Konversi Pesanan" },
  { ico: "💬", pct: "75%", label: "Tingkat Resolusi Konsultasi Pra Jual & Purna Jual" },
  { ico: "🧑‍🌾", pct: "30%", label: "Menghemat Tenaga Kerja CS" },
];

type Health = {
  ok: boolean;
  model: string;
  claudeConfigured: boolean;
  systemPromptChars: number;
  kbFiles: Record<string, number>;
  missingKbFiles: string[];
};

type ChatOk = { action: string; reply: string; model: string; usage: Usage };

const EMPTY_SESSION: SessionTotals = {
  messages: 0,
  usd: 0,
  usdWithoutCache: 0,
  inputTokens: 0,
  outputTokens: 0,
};

export default function AiChatbot() {
  const toast = useToast();

  const [tab, setTab] = useState<"chatbot" | "flag">("chatbot");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);

  const [aiOn, setAiOn] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState<ChatOk | null>(null);
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionTotals>(EMPTY_SESSION);

  // ---------- Status backend (port checkBackend di ai.js) ----------
  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("health"))))
      .then((d: Health) => setHealth(d))
      .catch(() => setHealthFailed(true));
  }, []);

  // ---------- Minta balasan AI ----------
  const askAI = useCallback(async () => {
    const msg = message.trim();
    if (!msg) {
      toast("Tulis pesan pelanggan dulu, Kak");
      return;
    }
    if (!aiOn) {
      toast("Aktifkan dulu Rekomendasi Balasan AI");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // history sengaja kosong: tiap pengujian berdiri sendiri supaya
        // angka token bisa dibandingkan antar percobaan.
        body: JSON.stringify({ message: msg, history: [] }),
      });
      const data = await r.json();

      if (!r.ok) {
        setResult(null);
        setCost(null);
        setError(data?.error ?? `Permintaan gagal (HTTP ${r.status}).`);
        toast("Gagal meminta balasan AI");
        return;
      }

      const ok = data as ChatOk;
      const breakdown = computeCost(ok.model, ok.usage ?? {});
      setResult(ok);
      setCost(breakdown);
      setSession((s) => ({
        messages: s.messages + 1,
        usd: s.usd + breakdown.usd,
        usdWithoutCache: s.usdWithoutCache + breakdown.usdWithoutCache,
        inputTokens: s.inputTokens + breakdown.totalInputTokens,
        outputTokens: s.outputTokens + breakdown.outputTokens,
      }));
      toast("Balasan dari Claude siap ✨");
    } catch (e) {
      setResult(null);
      setCost(null);
      setError(
        "Tidak bisa menghubungi /api/chat: " + (e as Error).message,
      );
      toast("Gagal menghubungi server");
    } finally {
      setBusy(false);
    }
  }, [aiOn, message, toast]);

  // ---------- Status ringkas di kanan atas ----------
  let statusText = "memeriksa…";
  let statusClass = "text-muted";
  if (healthFailed) {
    statusText = "server tidak merespons";
    statusClass = "text-[#b91c1c]";
  } else if (health) {
    if (health.claudeConfigured) {
      statusText = "Claude aktif ✅";
      statusClass = "text-green-dark";
    } else {
      statusText = "API key belum diset ⚠️";
      statusClass = "text-[#d97706]";
    }
  }

  return (
    <div className="p-5 max-mini:p-3">
      {/* ---------- Sub-tab ---------- */}
      <div className="mb-4 flex items-center gap-2 border-b border-line">
        {(
          [
            ["chatbot", "AI Chatbot"],
            ["flag", "Flag Koreksi"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2.5 font-semibold",
              tab === key
                ? "border-green text-green-dark"
                : "border-transparent text-muted",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        <span className={`ml-auto pr-1 text-xs font-semibold ${statusClass}`}>
          {statusText}
        </span>
      </div>

      {tab === "flag" ? (
        <div className="rounded-2xl border border-line bg-white p-8">
          <h2 className="mt-0 mb-2 text-xl font-bold">🚩 Flag Koreksi Jawaban AI</h2>
          <p className="m-0 text-text-2">
            Belum dimigrasi. Sub-tab ini menunggu tabel <code>ai_flags</code> di
            Supabase (Step 6) — versi lamanya menyimpan data di{" "}
            <code>localStorage</code>, sehingga daftar flag tiap admin berbeda
            dan hasil review tidak terlihat oleh siapa pun.
          </p>
        </div>
      ) : (
        <>
          {/* ---------- Kartu statistik ---------- */}
          <div className="mb-4 grid grid-cols-3 gap-3 max-tablet:grid-cols-1">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-line bg-white px-4.5 py-5 text-center"
              >
                <div className="text-2xl">{s.ico}</div>
                <div className="my-1 text-2xl font-extrabold text-green">{s.pct}</div>
                <div className="text-[0.86rem] text-text-2">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ---------- Judul ---------- */}
          <div className="mb-4 rounded-2xl bg-green-soft px-6 py-5">
            <h1 className="m-0 text-2xl font-bold">Layanan Pelanggan AI Cerdas</h1>
            <p className="mt-2 mb-0 text-text-2">
              Ditenagai <b>Claude</b> dengan system prompt <b>claude.md</b> —
              menjawab akurat, jujur, dan tahu kapan harus dialihkan ke CS
              manusia.
            </p>
            {health && (
              <p className="mt-3 mb-0 text-[0.86rem] text-muted">
                Knowledge base aktif: {Object.keys(health.kbFiles).length} berkas
                ·{" "}
                <span className="font-mono">
                  {health.systemPromptChars.toLocaleString("id-ID")}
                </span>{" "}
                karakter system prompt
                {health.missingKbFiles.length > 0 && (
                  <span className="text-[#b91c1c]">
                    {" "}
                    · gagal dibaca: {health.missingKbFiles.join(", ")}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* ---------- Coba Balasan AI + pengukur ---------- */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-4 max-tablet:grid-cols-1">
            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3">
                <h2 className="m-0 text-lg font-bold">🤖 Coba Balasan AI</h2>
                <p className="mt-1 mb-0 text-[0.9rem] text-muted">
                  Ketik pesan pelanggan → AI mengklasifikasikan tindakan &amp;
                  menyusun balasan sesuai <b>claude.md</b>.
                </p>
              </div>

              <label className="mb-2 flex items-center gap-2 text-[0.9rem] font-semibold text-text-2">
                <input
                  type="checkbox"
                  checked={aiOn}
                  onChange={(e) => {
                    setAiOn(e.target.checked);
                    toast(
                      e.target.checked
                        ? "Rekomendasi Balasan AI aktif"
                        : "Rekomendasi Balasan AI dimatikan",
                    );
                  }}
                />
                Rekomendasi Balasan AI
              </label>

              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") askAI();
                }}
                placeholder="Contoh: Dosis POC Buah buat tomat berapa ya kak?"
                className="w-full resize-y rounded-xl border border-line bg-green-soft p-3 outline-none focus:border-green"
              />

              <div className="my-2.5 flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMessage(s)}
                    className="cursor-pointer rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-xs text-text-2"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={askAI}
                disabled={busy}
                className="w-full cursor-pointer rounded-xl border-none bg-green px-6 py-3 font-bold text-white transition hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Memproses…" : "Minta Balasan AI ✨"}
              </button>
              <p className="mt-2 mb-0 text-center text-xs text-muted">
                Ctrl/Cmd + Enter untuk mengirim
              </p>

              {/* --- Galat --- */}
              {error && (
                <div className="mt-4 rounded-xl bg-[#fee2e2] px-4 py-3 text-[0.9rem] text-[#b91c1c]">
                  <b>Gagal.</b> {error}
                </div>
              )}

              {/* --- Hasil --- */}
              {result && !error && (
                <div className="mt-4 rounded-xl border border-line bg-green-soft p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[0.86rem] text-text-2">Tindakan AI:</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[0.6rem] font-extrabold ${actionTagClass(
                        result.action,
                      )}`}
                    >
                      {result.action}
                    </span>
                    <span className="text-xs text-muted">
                      Claude · {result.model}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">{result.reply}</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.reply);
                      toast("Balasan disalin");
                    }}
                    className="mt-3 cursor-pointer border-none bg-transparent p-0 text-[0.86rem] font-semibold text-green underline"
                  >
                    Salin balasan
                  </button>
                </div>
              )}

              {!result && !error && (
                <div className="mt-4 rounded-xl border border-dashed border-line py-8 text-center text-muted">
                  <div className="text-3xl">💬</div>
                  <p className="mt-2 mb-0">Balasan AI akan muncul di sini.</p>
                </div>
              )}
            </section>

            <CostMeter
              cost={cost}
              model={result?.model ?? health?.model ?? null}
              session={session}
              onReset={() => {
                setSession(EMPTY_SESSION);
                toast("Hitungan sesi dinolkan");
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
