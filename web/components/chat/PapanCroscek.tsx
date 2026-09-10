"use client";

/* ===========================================================
   Papan croscek — jendela kecil yang bisa digeser.

   ALURNYA DI DUNIA NYATA

   Tim gudang mengirim daftar nomor pesanan yang perlu diperiksa
   ulang, biasanya begini:

       #584590031216740091
       #240611AB12
       #240617XXXX

   CS menempelkannya lewat klik 2× di kotak pencarian, lalu harus
   menelusuri satu per satu sambil membalas chat lain di layar yang
   sama. Yang dia butuhkan bukan daftar percakapan yang tersaring,
   melainkan daftar TUGAS: nomor mana yang sudah, nomor mana yang
   belum.

   KENAPA MENGAPUNG DAN BISA DIGESER, BUKAN PANEL TETAP

   Panel tetap akan memakan lebar permanen dari empat panel yang
   sudah padat. Papan ini hanya hidup selama ada tugas croscek —
   beberapa menit sampai beberapa jam — lalu ditutup. Dan karena
   isi layar di bawahnya berpindah-pindah tergantung percakapan
   mana yang dibuka, posisinya harus bisa dipindah CS sendiri; kami
   tidak bisa menebak sudut mana yang sedang tidak dipakai.

   NOMOR YANG TIDAK KETEMU TETAP DITAMPILKAN

   Justru itu yang paling perlu dilihat: entah salah ketik, entah
   pesanannya memang belum pernah masuk chat. Daftar percakapan
   yang tersaring menyembunyikannya — papan ini tidak.
   =========================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hitungCroscek,
  kunciCroscek,
  susunCroscek,
  type CalonCroscek,
} from "@/lib/cocok";
import {
  bukaPapan,
  geserPapan,
  kosongkanCroscek,
  tandaiCroscek,
  useCroscek,
} from "@/lib/croscek";

const LEBAR = 320;
/** Sisa piksel yang wajib tetap terlihat saat papan digeser ke tepi. */
const SISA_TERLIHAT = 80;

export default function PapanCroscek({
  nomor,
  calon,
  onPilih,
}: {
  /** Nomor yang ditempel, apa adanya dan berurutan. */
  nomor: string[];
  calon: CalonCroscek[];
  onPilih: (conversationId: string) => void;
}) {
  const { buka, posisi, sudah } = useCroscek();
  const [seret, setSeret] = useState<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const sudahSet = useMemo(() => new Set(sudah), [sudah]);
  const baris = useMemo(
    () => susunCroscek(nomor, calon, sudahSet),
    [nomor, calon, sudahSet],
  );
  const hitung = hitungCroscek(baris);

  /* Jaga papan tetap di dalam layar. Dipanggil saat digeser DAN
     saat jendela peramban diubah ukurannya — tanpa yang kedua,
     papan yang ditaruh di kanan bawah lalu jendelanya dikecilkan
     akan berada di luar layar, tanpa cara mengembalikannya. */
  const jepit = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - SISA_TERLIHAT;
    const maxY = window.innerHeight - SISA_TERLIHAT;
    return {
      x: Math.min(Math.max(x, -(LEBAR - SISA_TERLIHAT)), maxX),
      y: Math.min(Math.max(y, 0), maxY),
    };
  }, []);

  useEffect(() => {
    if (!buka) return;
    const atur = () => geserPapan(jepit(posisi.x, posisi.y));
    window.addEventListener("resize", atur);
    return () => window.removeEventListener("resize", atur);
  }, [buka, posisi.x, posisi.y, jepit]);

  useEffect(() => {
    if (!seret) return;
    const gerak = (e: PointerEvent) => {
      geserPapan(jepit(e.clientX - seret.dx, e.clientY - seret.dy));
    };
    const lepas = () => setSeret(null);
    // Dipasang di window, bukan di elemen papannya: kalau kursor
    // bergerak lebih cepat daripada render, ia keluar dari kotak
    // dan papannya berhenti mengikuti di tengah jalan.
    window.addEventListener("pointermove", gerak);
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);
    return () => {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", lepas);
      window.removeEventListener("pointercancel", lepas);
    };
  }, [seret, jepit]);

  if (!buka || nomor.length === 0) return null;

  const mulaiSeret = (e: React.PointerEvent) => {
    const kotak = ref.current?.getBoundingClientRect();
    if (!kotak) return;
    setSeret({ dx: e.clientX - kotak.left, dy: e.clientY - kotak.top });
  };

  const selesai = hitung.sudah === hitung.total;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Papan croscek nomor pesanan"
      style={{ left: posisi.x, top: posisi.y, width: LEBAR }}
      className="fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgb(15_23_42/0.18)]"
    >
      {/* Kepala = pegangan geser. touch-none mencegah peramban
          menggulir halaman saat papan diseret dengan jari. */}
      <div
        onPointerDown={mulaiSeret}
        className={`flex touch-none items-center gap-2 border-b border-line px-3 py-2.5 select-none ${
          seret ? "cursor-grabbing bg-green-mint" : "cursor-grab bg-green-soft"
        }`}
      >
        <span aria-hidden className="text-[0.9rem]">
          📋
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.82rem] leading-tight font-bold text-green-dark">
            Croscek Pesanan
          </div>
          <div className="mt-0.5 text-[0.68rem] text-muted">
            {hitung.sudah} dari {hitung.total} selesai
            {hitung.hilang > 0 && ` · ${hitung.hilang} tidak ketemu`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => bukaPapan(false)}
          title="Tutup papan"
          aria-label="Tutup papan croscek"
          className="shrink-0 cursor-pointer rounded-lg border-none bg-transparent px-1 text-[0.9rem] text-muted"
        >
          ✕
        </button>
      </div>

      {/* Bilah kemajuan — satu-satunya hal yang bisa dibaca sekilas
          tanpa membaca daftarnya. */}
      <div className="h-1 shrink-0 bg-line-soft">
        <div
          className={`h-full transition-all ${selesai ? "bg-green" : "bg-[#f59e0b]"}`}
          style={{ width: `${hitung.total ? (hitung.sudah / hitung.total) * 100 : 0}%` }}
        />
      </div>

      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {baris.map((b, i) => {
          const kunci = kunciCroscek(b.nomor);
          return (
            <li
              key={`${kunci}-${i}`}
              className={`flex items-start gap-2 border-b border-b-line-soft px-3 py-2 last:border-b-0 ${
                b.sudah ? "bg-green-soft" : "bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={b.sudah}
                onChange={() => tandaiCroscek(kunci)}
                aria-label={`Tandai ${b.nomor} sudah dicek`}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#16a34a]"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`font-mono text-[0.76rem] break-all ${
                    b.sudah ? "text-muted line-through" : "font-semibold"
                  }`}
                >
                  {b.nomor}
                </div>
                {b.conversationId ? (
                  <button
                    type="button"
                    onClick={() => onPilih(b.conversationId!)}
                    className="mt-0.5 cursor-pointer border-none bg-transparent p-0 text-left text-[0.72rem] text-green-dark underline-offset-2 hover:underline"
                  >
                    {b.nama} →
                  </button>
                ) : (
                  /* Dibedakan tegas dari yang ketemu. Nomor yang
                     tidak ada percakapannya menuntut tindakan lain
                     sama sekali — konfirmasi ulang ke gudang, bukan
                     membaca chat. */
                  <div className="mt-0.5 text-[0.72rem] text-[#b91c1c]">
                    tidak ada percakapan
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={kosongkanCroscek}
          disabled={hitung.sudah === 0}
          className="cursor-pointer rounded-lg border border-line bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-muted transition hover:border-[#b91c1c] hover:text-[#b91c1c] disabled:opacity-40"
        >
          Hapus semua tanda
        </button>
        {selesai && (
          <span className="text-[0.72rem] font-bold text-green-dark">Semua selesai 🎉</span>
        )}
      </div>
    </div>
  );
}
