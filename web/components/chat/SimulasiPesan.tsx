"use client";

/* ===========================================================
   Tombol peragaan: berpura-pura ada pesan masuk dari pelanggan.

   Hanya tampil di luar produksi — endpoint-nya sendiri menjawab
   404 di produksi, jadi tombol ini tidak pernah bisa jadi pintu
   belakang yang tertinggal.

   KENAPA KALIMATNYA DISEDIAKAN, BUKAN DIKETIK BEBAS

   Kotak teks kosong di layar demo adalah undangan untuk mengarang
   kalimat, dan kalimat yang meleset dari Gerbang 0 di sistem
   sungguhan berbiaya. Endpoint-nya memang menolak kalimat semacam
   itu, tapi menolak di depan penonton tetap terasa seperti gagal.
   Empat kalimat di bawah sudah diuji lewat routeToCategory() dan
   semuanya berhenti di Gerbang 0.

   Kolom bebas tetap disediakan — untuk penonton yang menantang
   "coba kalimat saya". Penolakannya justru bagian yang bagus:
   sistem yang tahu kapan ia tidak tahu lebih meyakinkan daripada
   sistem yang selalu punya jawaban.
   =========================================================== */

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { headerBerSesi } from "@/lib/supabase/header";

/** Sudah diverifikasi berhenti di Gerbang 0 — biaya Rp 0. */
const CONTOH = [
  { nama: "sari.wulandari", teks: "kak barangnya rusak pas sampe, mau refund" },
  { nama: "agus.pratama", teks: "kak saya mau retur barangnya" },
  { nama: "rina.kusuma", teks: "botolnya bocor semua, minta ganti dong" },
  { nama: "dewi.anggraini", teks: "saya mau komplain, ini salah kirim" },
];

type Hasil = {
  ok?: boolean;
  ditolak?: boolean;
  alasan?: string;
  nama?: string;
  kode?: string | null;
  handover?: { eskalasiBaru: boolean } | null;
  error?: string;
};

export default function SimulasiPesan() {
  const [buka, setBuka] = useState(false);
  const [teks, setTeks] = useState("");
  const [nama, setNama] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const toast = useToast();

  if (process.env.NODE_ENV === "production") return null;

  const kirim = async (isi: string, dari: string) => {
    if (sibuk || !isi.trim()) return;
    setSibuk(true);
    setHasil(null);
    try {
      const r = await fetch("/api/simulasi", {
        method: "POST",
        headers: await headerBerSesi(),
        body: JSON.stringify({ teks: isi, nama: dari || undefined }),
      });
      const d = (await r.json()) as Hasil;
      setHasil(d);

      if (d.ditolak) toast("Kalimat ini akan dilempar ke Claude — dihentikan");
      else if (d.error) toast(d.error);
      else if (d.handover?.eskalasiBaru) toast("Pesan masuk → langsung ke antrean Perlu CS 🔔");
      else toast("Pesan masuk, dijawab template");
    } catch (e) {
      setHasil({ error: (e as Error).message });
      toast("Gagal menghubungi simulasi");
    } finally {
      setSibuk(false);
    }
  };

  if (!buka) {
    return (
      <div className="border-b border-line-soft px-2 py-2">
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="w-full cursor-pointer rounded-xl border border-dashed border-green/50 bg-green-soft px-3 py-2 text-[0.78rem] font-bold text-green-dark transition hover:bg-green-mint"
        >
          📨 Simulasi pesan masuk
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-line-soft px-2 py-2">
      <div className="rounded-xl border border-dashed border-green/50 bg-green-soft p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <b className="text-[0.78rem] text-green-dark">📨 Simulasi pesan masuk</b>
          <button
            type="button"
            onClick={() => {
              setBuka(false);
              setHasil(null);
            }}
            className="cursor-pointer border-none bg-transparent text-[0.72rem] text-muted"
          >
            ✕ Tutup
          </button>
        </div>

        <p className="mt-0 mb-2 text-[0.7rem] leading-relaxed text-text-2">
          Menjalankan router dan pencatatan handover yang sungguhan. Yang
          dipalsukan hanya asal pesannya. <b>Tidak pernah memanggil Claude</b> —
          kalimat yang tidak tertangkap akan ditolak, bukan diteruskan.
        </p>

        <div className="flex flex-col gap-1.5">
          {CONTOH.map((c) => (
            <button
              key={c.teks}
              type="button"
              disabled={sibuk}
              onClick={() => kirim(c.teks, c.nama)}
              className="cursor-pointer rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-[0.74rem] text-text transition hover:border-green disabled:opacity-50"
            >
              <span className="text-muted">{c.nama}:</span> {c.teks}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="nama"
            aria-label="Nama pelanggan"
            className="w-24 shrink-0 rounded-lg border border-line px-2 py-1.5 text-[0.74rem] outline-none"
          />
          <input
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void kirim(teks, nama);
            }}
            placeholder="atau ketik kalimat sendiri…"
            aria-label="Pesan pelanggan"
            className="w-full rounded-lg border border-line px-2 py-1.5 text-[0.74rem] outline-none"
          />
        </div>

        {hasil && (
          <div
            className={`mt-2 rounded-lg px-2.5 py-2 text-[0.72rem] leading-relaxed ${
              hasil.ditolak || hasil.error
                ? "bg-[#fffbeb] text-[#92400e]"
                : "bg-white text-text-2"
            }`}
          >
            {hasil.error && <b>{hasil.error}</b>}
            {hasil.ditolak && (
              <>
                <b>Dihentikan.</b> {hasil.alasan}
              </>
            )}
            {hasil.ok && (
              <>
                <b>{hasil.nama}</b> masuk
                {hasil.kode && (
                  <>
                    {" "}
                    · ditangani <b>[{hasil.kode}]</b>
                  </>
                )}
                {hasil.handover?.eskalasiBaru && <> · masuk antrean Perlu CS</>}
                <div className="mt-0.5 text-muted">Biaya Rp 0 — Claude tidak dipanggil</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
