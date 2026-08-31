"use client";

import { useToast } from "./Toast";

/* ===========================================================
   Kerangka halaman yang belum dimigrasi.
   Sengaja dibuat jujur: menyebut halaman HTML asalnya dan step
   migrasi yang akan mengisinya, supaya tidak ada halaman kosong
   yang menyesatkan saat rail diklik.
   =========================================================== */

export default function PlaceholderPage({
  title,
  legacyFile,
  step,
  note,
}: {
  title: string;
  legacyFile: string;
  step: string;
  note: string;
}) {
  const toast = useToast();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-3xl bg-white p-8 shadow-card">
        <p className="m-0 mb-4 text-[0.82rem] font-bold tracking-[0.08em] text-green uppercase">
          Belum dimigrasi
        </p>
        <h1 className="m-0 mb-3 text-3xl leading-tight font-bold">{title}</h1>
        <p className="mt-0 mb-6 leading-relaxed text-text-2">{note}</p>

        <dl className="grid gap-3 rounded-2xl bg-green-soft p-5 text-[0.95rem]">
          <div className="flex gap-2">
            <dt className="font-semibold text-text-2">Halaman asal:</dt>
            <dd className="m-0">
              <code className="rounded bg-white px-1.5 py-0.5">
                {legacyFile}
              </code>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-text-2">Dikerjakan pada:</dt>
            <dd className="m-0">{step}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => toast("Kerangka layout & toast sudah aktif ✅")}
          className="mt-6 cursor-pointer rounded-2xl border-none bg-green px-5 py-3 font-bold text-white transition hover:bg-green-hover"
        >
          Uji toast
        </button>
      </div>
    </div>
  );
}
