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
   Tidak ada di ai.html versi lama — ditambahkan khusus untuk
   demo ini, karena pertanyaannya memang "satu balasan AI itu
   berapa rupiah, dan seberapa besar cache menghematnya".
   =========================================================== */

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-text-2">
        {label}
        {hint && <span className="ml-1 text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={
          strong
            ? "font-mono text-base font-bold tabular-nums"
            : "font-mono tabular-nums text-text"
        }
      >
        {value}
      </span>
    </div>
  );
}

export type SessionTotals = {
  messages: number;
  usd: number;
  usdWithoutCache: number;
  inputTokens: number;
  outputTokens: number;
};

export default function CostMeter({
  cost,
  model,
  session,
  onReset,
}: {
  cost: CostBreakdown | null;
  model: string | null;
  session: SessionTotals;
  onReset: () => void;
}) {
  const cacheHit = cost !== null && cost.cacheReadTokens > 0;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold">📊 Pengukur Token &amp; Biaya</h3>
        {model && (
          <code className="rounded bg-green-soft px-2 py-0.5 text-xs">{model}</code>
        )}
      </div>

      {!cost ? (
        <p className="m-0 text-text-2">
          Angka biaya muncul setelah balasan AI pertama. Yang diukur: token
          masuk/keluar, token yang dilayani cache, dan perkiraan rupiah per
          balasan.
        </p>
      ) : (
        <>
          {/* --- Rincian token --- */}
          <div className="border-b border-line pb-2 text-[0.92rem]">
            <Row
              label="Token masuk (dibayar penuh)"
              value={formatTokens(cost.inputTokens)}
            />
            <Row
              label="Ditulis ke cache"
              hint="×1,25"
              value={formatTokens(cost.cacheWriteTokens)}
            />
            <Row
              label="Dibaca dari cache"
              hint="×0,1"
              value={formatTokens(cost.cacheReadTokens)}
            />
            <Row
              label="Token keluar (balasan)"
              value={formatTokens(cost.outputTokens)}
            />
          </div>

          {/* --- Biaya balasan ini --- */}
          <div className="border-b border-line py-2 text-[0.92rem]">
            <Row
              label="Biaya balasan ini"
              value={`${formatIdr(cost.idr)}  ·  ${formatUsd(cost.usd)}`}
              strong
            />
            <Row
              label="Seandainya tanpa cache"
              value={formatIdr(cost.idrWithoutCache)}
            />
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="text-text-2">Hemat berkat cache</span>
              <span
                className={[
                  "font-mono font-bold tabular-nums",
                  cacheHit ? "text-green-dark" : "text-muted",
                ].join(" ")}
              >
                {cacheHit
                  ? `${formatIdr(cost.savedIdr)}  (${Math.round(
                      (cost.savedUsd / cost.usdWithoutCache) * 100,
                    )}%)`
                  : "belum kena cache"}
              </span>
            </div>
          </div>

          {/* --- Akumulasi sesi --- */}
          <div className="py-2 text-[0.92rem]">
            <Row
              label={`Total ${session.messages} balasan sesi ini`}
              value={formatIdr(session.usd * USD_TO_IDR)}
              strong
            />
            <Row
              label="Rata-rata per balasan"
              value={formatIdr(
                (session.usd / Math.max(session.messages, 1)) * USD_TO_IDR,
              )}
            />
            <Row
              label="Tanpa cache, sesi ini jadi"
              value={formatIdr(session.usdWithoutCache * USD_TO_IDR)}
            />
          </div>

          {!cacheHit && (
            <p className="mt-2 mb-0 rounded-xl bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">
              Belum ada token yang dilayani cache. Wajar pada balasan pertama:
              permintaan itulah yang <em>menulis</em> cache, dan menulis
              dihargai 1,25× — jadi balasan pertama justru sedikit lebih mahal.
              Modal itu kembali mulai balasan kedua, selama jaraknya masih
              dalam beberapa menit.
            </p>
          )}

          {!cost.knownModel && (
            <p className="mt-2 mb-0 rounded-xl bg-[#fee2e2] px-3 py-2 text-xs text-[#b91c1c]">
              Model ini tidak ada di tabel harga, jadi angka di atas memakai
              tarif <code>claude-sonnet-4-6</code> — anggap sebagai perkiraan
              kasar saja.
            </p>
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
        </>
      )}
    </section>
  );
}
