"use client";

/* ===========================================================
   Perkakas peragaan di sisi CS.

   Hanya tampil pada deployment yang menyalakan NEXT_PUBLIC_SIMULASI
   — dan endpoint-nya dijaga saklar yang SAMA, jadi tombol ini tidak
   pernah bisa jadi pintu belakang yang tertinggal. Lihat
   lib/simulasi.ts untuk alasan saklarnya bukan NODE_ENV lagi.

   KENAPA PANEL "SIMULASI PESAN MASUK" DIHAPUS (11 Sep 2026)

   Dulu ada panel di sini yang menyuntikkan pesan pelanggan buatan
   lewat empat kalimat contoh. Sejak layar pembeli (/simulasi) bisa
   dibuka langsung dari sini, panel itu jadi cara kedua untuk
   melakukan hal yang sama — dengan kalimat yang sudah ditentukan,
   sementara layar pembeli membiarkan orang mengetik sendiri dan
   melihat balasannya sampai ke layar pelanggan.

   Dua pintu ke satu perilaku berarti dua tempat yang harus ikut
   berubah setiap kali alur pesan masuk berubah, dan yang jarang
   dipakai adalah yang diam-diam basi. Endpoint POST /api/simulasi
   tetap ada — layar pembeli memanggilnya sendiri.
   =========================================================== */

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { headerBerSesi } from "@/lib/supabase/header";
import { SIMULASI_HIDUP } from "@/lib/simulasi";

export default function SimulasiPesan({ jumlahSimulasi }: { jumlahSimulasi: number }) {
  const [sibuk, setSibuk] = useState(false);
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
    try {
      const r = await fetch("/api/simulasi", {
        method: "DELETE",
        headers: await headerBerSesi(),
      });
      const d = (await r.json()) as { dihapus?: number; error?: string; catatan?: string };
      if (d.error) toast(d.error);
      else toast(`${d.dihapus} chat simulasi dihapus 🧹`);
    } catch (e) {
      toast("Gagal menghapus: " + (e as Error).message);
    } finally {
      setSibuk(false);
      setKonfirmasi(false);
    }
  };

  /* Tombol bersih-bersih sengaja hanya muncul kalau memang ADA yang
     bisa dihapus: tombol hapus yang selalu terlihat mengundang klik
     iseng, dan angkanya adalah satu-satunya hal yang membuat orang
     berhenti sejenak. */
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

  /* Jalan ke layar pembeli — halaman /simulasi.
     Sampai 10 Sep 2026 TIDAK ADA satu pun tautan ke halaman itu di
     seluruh aplikasi; satu-satunya cara membukanya adalah mengetik
     URL-nya sendiri. Di localhost itu masih mungkin; di URL Vercel
     yang dibagikan ke tim CS, halaman tanpa tautan sama saja dengan
     halaman yang tidak ada.

     target="_blank" disengaja, bukan kebiasaan. Seluruh alasan
     halaman itu dibuat terpisah adalah supaya pembeli dan CS berada
     di dua layar yang berbeda secara fisik — menggantikan isi tab
     yang sama justru menghapus hal yang sedang diperagakan. */
  return (
    <div className="flex flex-col gap-1.5 border-b border-line-soft px-2 py-2">
      <Link
        href="/simulasi"
        target="_blank"
        rel="noreferrer noopener"
        className="w-full cursor-pointer rounded-xl border border-dashed border-green/50 bg-green-soft px-3 py-2 text-center text-[0.78rem] font-bold text-green-dark no-underline transition hover:bg-green-mint"
      >
        🛍️ Simulasi ↗
      </Link>
      {tombolBersih}
    </div>
  );
}
