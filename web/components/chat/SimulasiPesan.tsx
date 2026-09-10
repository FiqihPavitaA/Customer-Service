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
import { SIMULASI_HIDUP } from "@/lib/simulasi";

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

export default function SimulasiPesan({ jumlahSimulasi }: { jumlahSimulasi: number }) {
  const [buka, setBuka] = useState(false);
  const [teks, setTeks] = useState("");
  const [nama, setNama] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  /* Konfirmasi dua langkah, bukan window.confirm().
     Ini penghapusan permanen, jadi tidak boleh terjadi karena satu
     klik yang meleset. Dialog bawaan peramban ditolak karena mudah
     ditekan reflek dan tidak bisa menyebutkan angka yang akan
     terhapus — padahal angkanya justru yang menahan orang. */
  const [konfirmasi, setKonfirmasi] = useState(false);
  const toast = useToast();

  if (!SIMULASI_HIDUP) return null;

  const bersihkan = async () => {
    if (sibuk) return;
    setSibuk(true);
    setHasil(null);
    try {
      const r = await fetch("/api/simulasi", {
        method: "DELETE",
        headers: await headerBerSesi(),
      });
      const d = (await r.json()) as { dihapus?: number; error?: string; catatan?: string };
      if (d.error) {
        toast(d.error);
        setHasil({ error: d.error });
      } else {
        toast(`${d.dihapus} chat simulasi dihapus 🧹`);
        if (d.catatan) setHasil({ error: d.catatan });
      }
    } catch (e) {
      toast("Gagal menghapus: " + (e as Error).message);
    } finally {
      setSibuk(false);
      setKonfirmasi(false);
    }
  };

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

  /* Tombol bersih-bersih dipakai di dua keadaan panel (terbuka dan
     tertutup), jadi disusun sekali di sini. Sengaja hanya muncul
     kalau memang ADA yang bisa dihapus: tombol hapus yang selalu
     terlihat mengundang klik iseng, dan angkanya adalah satu-satunya
     hal yang membuat orang berhenti sejenak. */
  const tombolBersih =
    jumlahSimulasi === 0 ? null : konfirmasi ? (
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={sibuk}
          onClick={() => void bersihkan()}
          className="flex-1 cursor-pointer rounded-lg border border-[#b91c1c] bg-[#fee2e2] px-2.5 py-1.5 text-[0.74rem] font-bold text-[#b91c1c] disabled:opacity-50"
        >
          {sibuk ? "Menghapus…" : `Ya, hapus ${jumlahSimulasi} chat`}
        </button>
        <button
          type="button"
          onClick={() => setKonfirmasi(false)}
          className="cursor-pointer rounded-lg border border-line bg-white px-2.5 py-1.5 text-[0.74rem] font-bold text-text-2"
        >
          Batal
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setKonfirmasi(true)}
        className="w-full cursor-pointer rounded-lg border border-line bg-white px-2.5 py-1.5 text-[0.74rem] font-semibold text-muted transition hover:border-[#b91c1c] hover:text-[#b91c1c]"
      >
        🧹 Hapus {jumlahSimulasi} chat simulasi
      </button>
    );

  if (!buka) {
    return (
      <div className="flex flex-col gap-1.5 border-b border-line-soft px-2 py-2">
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="w-full cursor-pointer rounded-xl border border-dashed border-green/50 bg-green-soft px-3 py-2 text-[0.78rem] font-bold text-green-dark transition hover:bg-green-mint"
        >
          📨 Simulasi pesan masuk
        </button>
        {tombolBersih}
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

        {tombolBersih && <div className="mt-2">{tombolBersih}</div>}

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
