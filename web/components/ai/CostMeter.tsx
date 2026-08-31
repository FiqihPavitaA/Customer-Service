"use client";

import {
  formatIdr,
  formatTokens,
  formatUsd,
  USD_TO_IDR,
  type CostBreakdown,
} from "@/lib/pricing";

/* ===========================================================
   Panel pengukur token & biaya.
   Tidak ada di ai.html versi lama — ditambahkan khusus untuk demo
   ini: satu balasan berapa rupiah, seberapa besar cache
   menghematnya, dan berapa banyak pertanyaan yang berhasil
   dicegat lapisan template sehingga biayanya nol.
   =========================================================== */

function Row({
  label,
  value,
  hint,
  strong,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tone?: "green" | "muted";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-text-2">
        {label}
        {hint && <span className="ml-1 text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={[
          "font-mono tabular-nums",
          strong ? "text-base font-bold" : "",
          tone === "green" ? "text-green-dark" : tone === "muted" ? "text-muted" : "text-text",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export type SessionTotals = {
  messages: number;
  aiMessages: number;
  templateMessages: number;
  usd: number;
  usdWithoutCache: number;
};

export const EMPTY_SESSION: SessionTotals = {
  messages: 0,
  aiMessages: 0,
  templateMessages: 0,
  usd: 0,
  usdWithoutCache: 0,
};

export type LastResult =
  | { source: "template"; code: string }
  | { source: "ai"; cost: CostBreakdown; model: string }
  | null;

export default function CostMeter({
  last,
  session,
  onReset,
}: {
  last: LastResult;
  session: SessionTotals;
  onReset: () => void;
}) {
  const rataAi =
    session.aiMessages > 0 ? session.usd / session.aiMessages : 0;
  // Perkiraan yang dihemat lapisan template: tiap pertanyaan yang
  // dicegat = satu panggilan AI yang tidak jadi dibayar.
  const hematTemplate = session.templateMessages * rataAi;
  const deflection =
    session.messages > 0
      ? Math.round((session.templateMessages / session.messages) * 100)
      : 0;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="m-0 mb-3 text-base font-bold">📊 Pengukur Token &amp; Biaya</h3>

      {/* ---------- Hasil terakhir ---------- */}
      {last === null && (
        <p className="m-0 text-text-2">
          Angka biaya muncul setelah balasan pertama. Yang diukur: token
          masuk/keluar, token yang dilayani cache, dan perkiraan rupiah per
          balasan.
        </p>
      )}

      {last?.source === "template" && (
        <div className="rounded-xl bg-green-mint p-4">
          <div className="mb-1 text-sm font-bold text-green-dark">
            ⚡ Ditangani template — Rp 0
          </div>
          <p className="m-0 text-[0.9rem] text-text-2">
            Balasan diambil langsung dari <code>faq-cs.md</code> kode{" "}
            <b>[{last.code}]</b>. Claude tidak dipanggil sama sekali, jadi tidak
            ada token yang terpakai.
          </p>
        </div>
      )}

      {last?.source === "ai" && (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-text-2">🤖 Ditangani Claude</span>
            <code className="rounded bg-green-soft px-2 py-0.5 text-xs">
              {last.model}
            </code>
          </div>

          <div className="border-b border-line pb-2 text-[0.92rem]">
            <Row
              label="Token masuk (dibayar penuh)"
              value={formatTokens(last.cost.inputTokens)}
            />
            <Row
              label="Ditulis ke cache"
              hint="×1,25"
              value={formatTokens(last.cost.cacheWriteTokens)}
            />
            <Row
              label="Dibaca dari cache"
              hint="×0,1"
              value={formatTokens(last.cost.cacheReadTokens)}
            />
            <Row
              label="Token keluar (balasan)"
              value={formatTokens(last.cost.outputTokens)}
            />
          </div>

          <div className="border-b border-line py-2 text-[0.92rem]">
            <Row
              label="Biaya balasan ini"
              value={`${formatIdr(last.cost.idr)}  ·  ${formatUsd(last.cost.usd)}`}
              strong
            />
            <Row
              label="Seandainya tanpa cache"
              value={formatIdr(last.cost.idrWithoutCache)}
            />
            {last.cost.cacheReadTokens > 0 ? (
              <Row
                label="Hemat berkat cache"
                tone="green"
                value={`${formatIdr(last.cost.savedIdr)}  (${Math.round(
                  (last.cost.savedUsd / last.cost.usdWithoutCache) * 100,
                )}%)`}
              />
            ) : (
              <Row label="Hemat berkat cache" tone="muted" value="belum kena cache" />
            )}
          </div>

          {last.cost.cacheReadTokens === 0 && (
            <p className="mt-2 mb-0 rounded-xl bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">
              Belum ada token yang dilayani cache. Wajar pada balasan pertama:
              permintaan itulah yang <em>menulis</em> cache, dan menulis
              dihargai 1,25× — jadi balasan pertama justru lebih mahal. Modal itu
              kembali mulai balasan kedua, selama jaraknya masih dalam 5 menit.
            </p>
          )}

          {!last.cost.knownModel && (
            <p className="mt-2 mb-0 rounded-xl bg-[#fee2e2] px-3 py-2 text-xs text-[#b91c1c]">
              Model ini tidak ada di tabel harga, jadi angka di atas memakai
              tarif <code>claude-sonnet-4-6</code> — perkiraan kasar saja.
            </p>
          )}
        </>
      )}

      {/* ---------- Akumulasi sesi ---------- */}
      {session.messages > 0 && (
        <div className="mt-3 border-t border-line pt-2 text-[0.92rem]">
          <Row
            label={`Total ${session.messages} pertanyaan sesi ini`}
            value={formatIdr(session.usd * USD_TO_IDR)}
            strong
          />
          <Row
            label="Dicegat template (Rp 0)"
            tone="green"
            value={`${session.templateMessages} · ${deflection}%`}
          />
          <Row label="Diteruskan ke Claude" value={String(session.aiMessages)} />
          {session.aiMessages > 0 && (
            <Row
              label="Rata-rata per panggilan AI"
              value={formatIdr(rataAi * USD_TO_IDR)}
            />
          )}
          {session.templateMessages > 0 && session.aiMessages > 0 && (
            <Row
              label="Perkiraan hemat dari template"
              tone="green"
              value={formatIdr(hematTemplate * USD_TO_IDR)}
            />
          )}

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
            <span>Kurs asumsi: Rp {formatTokens(USD_TO_IDR)} per USD</span>
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded-lg border border-line bg-white px-2 py-1 font-semibold text-text-2"
            >
              Nolkan hitungan sesi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
