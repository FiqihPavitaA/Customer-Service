"use client";

/* ===========================================================
   Modal "Integrasikan Toko Baru" — port dari #integrateModal
   di dashboard.html + logikanya di dashboard.js (Step 14).

   Perilaku dipertahankan: memilih platform mengganti webhook
   URL, tombol Salin menyalin ke clipboard, submit menampilkan
   layar sukses lalu menambahkan toko ke daftar, ESC & klik
   latar menutup modal.
   =========================================================== */

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

export type PlatformName = "Shopee" | "TikTok Shop" | "Lazada";

const WEBHOOKS: Record<PlatformName, string> = {
  Shopee: "https://cs.infarm.id/api/webhook/shopee",
  "TikTok Shop": "https://cs.infarm.id/api/webhook/tiktok",
  Lazada: "https://cs.infarm.id/api/webhook/lazada",
};

const LOGO: Record<PlatformName, { cls: string; char: string }> = {
  Shopee: { cls: "bg-shp", char: "S" },
  "TikTok Shop": { cls: "bg-tt", char: "T" },
  Lazada: { cls: "bg-lz", char: "L" },
};

const labelCls = "mb-1.5 block text-[0.84rem] font-semibold text-text-2";
const inputCls =
  "w-full rounded-[10px] border border-line bg-green-soft px-3 py-2.5 text-[0.9rem] focus:bg-white focus:outline-2 focus:outline-green";

export default function IntegrateModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (shop: { name: string; platform: PlatformName }) => void;
}) {
  const toast = useToast();
  const [platform, setPlatform] = useState<PlatformName>("Shopee");
  const [shopName, setShopName] = useState("");
  const [sukses, setSukses] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nama = shopName.trim();
    if (!nama) return;
    onAdd({ name: nama, platform });
    setSukses(`Toko "${nama}" (${platform}) berhasil dihubungkan!`);
  };

  return (
    <div
      className="fixed inset-0 z-70 grid place-items-center overflow-y-auto bg-[rgb(15_23_42/0.45)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Integrasikan toko baru"
        className="w-[min(560px,92vw)] rounded-3xl bg-white p-6 shadow-card max-mini:p-4"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="m-0 text-[1.1rem] font-bold">Integrasikan Toko Baru</h3>
          <button
            type="button"
            onClick={onClose}
            title="Tutup"
            aria-label="Tutup"
            className="cursor-pointer rounded-lg border-none bg-transparent text-[1rem]"
          >
            ✕
          </button>
        </div>

        {sukses ? (
          <div className="py-6 text-center">
            <div className="text-4xl" aria-hidden>
              ✅
            </div>
            <p className="mt-3 mb-5 text-[0.95rem]">{sukses}</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                toast("Toko baru ditambahkan ke daftar");
              }}
              className="cursor-pointer rounded-xl border-none bg-green px-6 py-3 font-bold text-white transition hover:bg-green-hover"
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            <p className="mt-0 mb-4 text-[0.86rem] leading-relaxed text-muted">
              Hubungkan akun marketplace agar pesan chat &amp; notifikasi pesanan masuk
              otomatis ke console ini. Kredensial diambil dari halaman developer
              masing-masing platform.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <span className={labelCls}>Platform</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(WEBHOOKS) as PlatformName[]).map((p) => (
                    <label
                      key={p}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[0.86rem] font-semibold transition ${
                        platform === p
                          ? "border-green bg-green-mint text-green-dark"
                          : "border-line bg-white text-text-2"
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        className="sr-only"
                        checked={platform === p}
                        onChange={() => setPlatform(p)}
                      />
                      <span
                        className={`grid h-5.5 w-5.5 place-items-center rounded-md text-[0.7rem] font-extrabold text-white ${LOGO[p].cls}`}
                        aria-hidden
                      >
                        {LOGO[p].char}
                      </span>
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="shopName">
                  Nama Toko
                </label>
                <input
                  id="shopName"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="contoh: Infarm Bandung"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 max-mini:grid-cols-1">
                <div>
                  <label className={labelCls} htmlFor="appId">
                    App ID / Partner ID
                  </label>
                  <input id="appId" required placeholder="1029384756" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="appSecret">
                    App Secret / Key
                  </label>
                  <input
                    id="appSecret"
                    required
                    type="password"
                    placeholder="••••••••••••"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="webhookUrl">
                  Webhook URL (otomatis)
                </label>
                <div className="flex gap-2">
                  <input
                    id="webhookUrl"
                    readOnly
                    value={WEBHOOKS[platform]}
                    className={`${inputCls} font-mono text-[0.82rem]`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(WEBHOOKS[platform]);
                      toast("Webhook URL disalin");
                    }}
                    className="shrink-0 cursor-pointer rounded-xl border border-line bg-white px-3.5 font-bold text-text-2 transition hover:bg-green-soft"
                  >
                    Salin
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[0.86rem] text-text-2">
                <input type="checkbox" defaultChecked className="accent-green" />
                Aktifkan balasan otomatis AI (sesuai claude.md)
              </label>

              <div className="mt-2 flex justify-end gap-2.5 max-mini:flex-col-reverse">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-xl border border-line bg-white px-5 py-2.5 font-bold text-text-2 transition hover:bg-green-soft"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl border-none bg-green px-5 py-2.5 font-bold text-white transition hover:bg-green-hover"
                >
                  Hubungkan Toko
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
