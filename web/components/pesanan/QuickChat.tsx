"use client";

/* ===========================================================
   Quick Chat — port dari quickchat.js + quickchat.css.
   Widget chat cepat ke pembeli dari halaman Pesanan, tanpa
   pindah ke halaman Chat.

   Perilaku dipertahankan: bisa diperkecil dengan mengklik
   kepalanya, riwayat per nomor pesanan bertahan selama halaman
   terbuka, Enter mengirim & Shift+Enter baris baru.

   Riwayat (dulu objek global QC_THREADS) kini dipegang halaman
   Pesanan dan dikirim lewat prop. Alasannya: widget ini dipasang
   ulang setiap ganti pembeli, jadi kalau riwayatnya disimpan di
   dalam sini, percakapan sebelumnya akan hilang saat kembali ke
   pembeli yang sama.
   =========================================================== */

import { useEffect, useRef, useState } from "react";
import { inisial } from "@/lib/format";

export type QuickChatTarget = {
  id: string;
  name: string;
  shop: string;
  context: string;
  initialMessage: string;
};

export type QcMessage = { side: "in" | "out"; time: string; text: string };

export default function QuickChat({
  target,
  messages,
  onSend,
  onClose,
}: {
  target: QuickChatTarget;
  messages: QcMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [minimized, setMinimized] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages.length, minimized]);

  const kirim = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="fixed right-5 bottom-5 z-50 flex w-[min(360px,92vw)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgb(15_23_42/0.22)] max-mobile:right-3 max-mobile:bottom-16 max-mobile:left-3 max-mobile:w-auto">
      {/* Kepala — klik untuk perkecil/perbesar */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setMinimized((m) => !m)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setMinimized((m) => !m);
        }}
        className="flex cursor-pointer items-center gap-2.5 bg-green px-3 py-2.5 text-white"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-[0.78rem] font-bold">
          {inisial(target.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.88rem] font-bold">{target.name}</div>
          <div className="truncate text-[0.72rem] opacity-90">{target.shop}</div>
        </div>
        <button
          type="button"
          title={minimized ? "Perbesar" : "Perkecil"}
          aria-label={minimized ? "Perbesar" : "Perkecil"}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized((m) => !m);
          }}
          className="cursor-pointer rounded-lg border-none bg-transparent px-1.5 text-white"
        >
          {minimized ? "▢" : "━"}
        </button>
        <button
          type="button"
          title="Tutup"
          aria-label="Tutup"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="cursor-pointer rounded-lg border-none bg-transparent px-1.5 text-white"
        >
          ✕
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-col">
          <div className="border-b border-line bg-green-soft px-3 py-2 text-[0.76rem] text-text-2">
            {target.context}
          </div>

          <div
            ref={streamRef}
            className="flex h-64 flex-col gap-2 overflow-y-auto bg-page p-3"
          >
            {messages.length === 0 && (
              <div className="py-5 text-center text-[0.76rem] text-muted">
                Belum ada pesan.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.side === "out" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.84rem] whitespace-pre-line ${
                    m.side === "out"
                      ? "bg-green text-white"
                      : "border border-line bg-white text-text"
                  }`}
                >
                  {m.text}
                </div>
                <span className="mt-0.5 text-[0.68rem] text-muted">{m.time}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-line p-2.5">
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
              rows={2}
              placeholder="Tulis balasan untuk pembeli…"
              aria-label="Tulis balasan"
              className="w-full resize-none rounded-xl border border-line bg-green-soft px-3 py-2 text-[0.86rem] outline-none focus:bg-white"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="ml-auto text-[0.7rem] text-muted">{draft.length}/600</span>
              <button
                type="button"
                onClick={kirim}
                className="cursor-pointer rounded-xl border-none bg-green px-4 py-1.5 text-[0.84rem] font-bold text-white transition hover:bg-green-hover"
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
