"use client";

/* ===========================================================
   Penanda keadaan AI di header — sebelah kotak pencarian.

   KENAPA PENANDA YANG BISA DIKLIK, BUKAN SAKELAR TELANJANG

   Permintaannya "tombol switcher supaya mudah dipantau menyala atau
   tidaknya", dan dua bagian permintaan itu menarik ke arah yang
   berbeda. Sakelar yang berpindah sekali klik memang paling cepat
   dipakai — tetapi ia duduk tepat di sebelah kotak pencarian, dan
   satu klik meleset berakibat mahal ke DUA arah:

     tidak sengaja mati  - pelanggan tidak dijawab semalaman, dan
                           tidak ada galat yang muncul
     tidak sengaja nyala - AI menyela CS sepanjang hari kerja

   Karena itu yang di header adalah PENANDA: selalu terlihat, dan
   menyebut bukan hanya nyala/mati melainkan KENAPA dan SAMPAI
   KAPAN. Mengubahnya butuh satu klik lagi di dalam panel. Pola dua
   langkah yang sama sudah dipakai tombol hapus chat simulasi, dengan
   alasan yang sama persis.

   KENAPA JAMNYA DIHITUNG ULANG DI PERAMBAN, BUKAN DIAMBIL BERKALA

   Keadaan AI berubah karena WAKTU BERJALAN, bukan karena ada yang
   menyimpan sesuatu. Pukul 16.00 penandanya harus berubah sendiri
   walau tidak ada seorang pun menyentuh apa pun.

   Mengambil ulang dari server tiap menit akan menjawabnya, tetapi
   dengan satu permintaan per menit per tab yang terbuka — padahal
   jawabannya bisa dihitung dari data yang sudah ada di tangan.
   putusanAI() adalah fungsi murni yang sama dengan yang dipakai
   /api/chat, jadi peramban dan server tidak mungkin berselisih.
   Yang diambil berkala hanyalah PENGATURANNYA, dan itu jarang.
   =========================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { headerBerSesi } from "@/lib/supabase/header";
import {
  putusanAI,
  teksKeadaanAI,
  type PengaturanJadwal,
} from "@/lib/jadwalAi";

/** Seberapa sering pengaturannya diambil ulang dari server. */
const AMBIL_ULANG_MS = 5 * 60_000;

/** Seberapa sering keputusannya dihitung ulang dari jam peramban. */
const HITUNG_ULANG_MS = 30_000;

const WARNA = {
  nyala: "border-green bg-green-soft text-green-dark",
  mati: "border-[#f59e0b] bg-[#fffbeb] text-[#92400e]",
  /* Bukan hijau, bukan merah: keadaannya memang TIDAK diketahui. */
  buta: "border-line bg-white text-muted",
} as const;

export default function SaklarAI() {
  const { isAdmin, isDemo } = useAuth();
  const bolehUbah = isDemo || isAdmin;
  const toast = useToast();

  const [pengaturan, setPengaturan] = useState<PengaturanJadwal | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  /* Apakah GERBANG di /api/chat benar-benar membaca jadwal ini.
     "bawaan" berarti ia tidak bisa membacanya dan memakai nilai
     bawaan — sehingga apa pun yang tertulis di penanda ini TIDAK
     berlaku bagi pelanggan. */
  const [gerbang, setGerbang] = useState<{ sumber: string; alasan: string | null } | null>(null);
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  /* Dinaikkan tiap HITUNG_ULANG_MS semata untuk memaksa render
     ulang. Keputusannya sendiri dihitung dari jam saat render, jadi
     nilainya tidak pernah dipakai — yang dibutuhkan cuma
     perubahannya. */
  const [, setDetak] = useState(0);
  const kotak = useRef<HTMLDivElement>(null);

  const ambil = useCallback(async () => {
    const r = await fetch("/api/jadwal", { headers: await headerBerSesi() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    return d as { pengaturan: PengaturanJadwal; gerbang?: { sumber: string; alasan: string | null } };
  }, []);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const d = await ambil();
        if (!batal) {
          setPengaturan(d.pengaturan);
          setGerbang(d.gerbang ?? null);
          setGalat(null);
        }
      } catch (e) {
        if (!batal) setGalat((e as Error).message);
      }
    };
    void muat();
    const jam1 = setInterval(() => void muat(), AMBIL_ULANG_MS);
    const jam2 = setInterval(() => setDetak((n) => n + 1), HITUNG_ULANG_MS);
    return () => {
      batal = true;
      clearInterval(jam1);
      clearInterval(jam2);
    };
  }, [ambil]);

  /* Menutup panel saat mengklik di luar. Tanpa ini, panel yang
     terbuka menutupi kotak pencarian tepat di sebelahnya — dan
     satu-satunya cara menutupnya jadi mengklik penandanya lagi,
     yang tidak ada tandanya di layar. */
  useEffect(() => {
    if (!buka) return;
    const keluar = (e: MouseEvent) => {
      if (kotak.current && !kotak.current.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("mousedown", keluar);
    return () => document.removeEventListener("mousedown", keluar);
  }, [buka]);

  const kirim = async (isi: Record<string, unknown>) => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/jadwal", {
        method: "PATCH",
        headers: await headerBerSesi(),
        body: JSON.stringify(isi),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setPengaturan(d.pengaturan as PengaturanJadwal);
      toast(d.teks as string);
      setBuka(false);
    } catch (e) {
      // Panjang dan perlu dibaca pelan-pelan (pesan penolakan RLS
      // memuat perintah SQL), jadi ditahan di panel, bukan toast.
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  // Sebelum pengaturannya sampai, TIDAK menebak. Menampilkan "AI
  // aktif" lalu berubah jadi "AI mati" sedetik kemudian lebih buruk
  // daripada menunggu sebentar: yang sempat terbaca justru
  // kebalikan dari keadaan sebenarnya.
  if (!pengaturan) {
    return (
      <div className="shrink-0 rounded-xl border border-line bg-white px-2.5 py-2 text-[0.78rem] text-muted max-mobile:hidden">
        {galat ? "AI · status tidak terbaca" : "AI · memuat…"}
      </div>
    );
  }

  const keputusan = putusanAI(pengaturan, new Date());
  const teks = teksKeadaanAI(keputusan);

  /* Gerbang di /api/chat tidak bisa membaca jadwal ini, jadi apa pun
     yang tertulis di penanda TIDAK berlaku bagi pelanggan.

     Penandanya sengaja dibuat abu-abu dengan tanda seru, bukan
     hijau atau merah. Menampilkan "🔴 AI mati" dengan yakin
     sementara pelanggan tetap dijawab adalah kegagalan terburuk
     yang bisa dilakukan layar ini — tim CS akan berhenti memeriksa
     sesuatu yang mereka kira sudah dimatikan. */
  const gerbangButa = gerbang?.sumber === "bawaan";

  return (
    <div ref={kotak} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        title={bolehUbah ? "Klik untuk mengubah" : "Hanya Admin yang bisa mengubah"}
        className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[0.78rem] font-bold transition ${
          gerbangButa ? WARNA.buta : keputusan.boleh ? WARNA.nyala : WARNA.mati
        }`}
      >
        <span aria-hidden>{gerbangButa ? "⚠️" : keputusan.boleh ? "🟢" : "🔴"}</span>
        <span className="max-mini:hidden">{gerbangButa ? "AI · belum terpasang" : teks}</span>
        <span className="mini:hidden">
          {gerbangButa ? "AI ⚠" : keputusan.boleh ? "AI" : "AI mati"}
        </span>
      </button>

      {buka && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-30 w-[min(320px,88vw)] rounded-xl border border-line bg-white p-3 shadow-bar">
          {gerbangButa && (
            <div className="mb-2 rounded-lg border border-[#b91c1c] bg-[#fee2e2] px-2.5 py-2">
              <b className="text-[0.8rem] text-[#b91c1c]">Saklar ini belum berlaku</b>
              <p className="mt-1 mb-0 text-[0.74rem] leading-relaxed text-[#b91c1c]">
                Yang menjawab pelanggan belum bisa membaca pengaturan ini, jadi
                AI <b>tetap menjawab</b> apa pun yang tertulis di sini.
                {gerbang?.alasan ? ` Sebabnya: ${gerbang.alasan}.` : ""} Jalankan
                supabase/jadwal-ai.sql di SQL Editor, lalu muat ulang halaman.
              </p>
            </div>
          )}

          <b className="text-[0.85rem]">{teks}</b>

          <p className="mt-1 mb-2 text-[0.76rem] leading-relaxed text-muted">
            {pengaturan.ai_jadwal_aktif
              ? `Jadwal: AI diam ${String(pengaturan.ai_jam_mulai).padStart(2, "0")}.00–${String(
                  pengaturan.ai_jam_selesai,
                ).padStart(2, "0")}.00 WIB pada hari yang dipilih.`
              : "Jadwal belum dinyalakan — AI menjawab kapan saja."}
          </p>

          {!bolehUbah && (
            <div className="rounded-lg bg-[#f4fbf6] px-2.5 py-2 text-[0.74rem] leading-relaxed text-text-2">
              🔒 Hanya Admin yang bisa mengubah. Kamu tetap melihat keadaannya
              di sini — kalau AI perlu dimatikan sekarang, sampaikan ke Admin.
            </div>
          )}

          {bolehUbah && (
            <div className="flex flex-col gap-1.5">
              {/* Override dua arah. Yang ditawarkan selalu KEBALIKAN
                  dari keadaan sekarang — menawarkan "matikan" saat
                  AI sudah mati hanya menambah satu keputusan yang
                  tidak perlu diambil siapa pun. */}
              {keputusan.boleh ? (
                <>
                  <b className="text-[0.72rem] tracking-wider text-muted uppercase">
                    Matikan sementara
                  </b>
                  <div className="flex gap-1.5">
                    {[1, 4, 8].map((j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={sibuk}
                        onClick={() => void kirim({ override_jam: j, override_nyala: false })}
                        className="flex-1 cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-[0.76rem] font-semibold disabled:opacity-50"
                      >
                        {j} jam
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <b className="text-[0.72rem] tracking-wider text-muted uppercase">
                    Nyalakan sementara
                  </b>
                  <div className="flex gap-1.5">
                    {[1, 4, 8].map((j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={sibuk}
                        onClick={() => void kirim({ override_jam: j, override_nyala: true })}
                        className="flex-1 cursor-pointer rounded-lg border border-green bg-green-soft px-2 py-1.5 text-[0.76rem] font-bold text-green-dark disabled:opacity-50"
                      >
                        {j} jam
                      </button>
                    ))}
                  </div>
                </>
              )}

              {keputusan.sebab === "override" && (
                <button
                  type="button"
                  disabled={sibuk}
                  onClick={() => void kirim({ override_jam: null })}
                  className="mt-1 cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-[0.74rem] font-semibold text-text-2 disabled:opacity-50"
                >
                  Batalkan, kembali ikut jadwal
                </button>
              )}

              <button
                type="button"
                disabled={sibuk}
                onClick={() => void kirim({ ai_jadwal_aktif: !pengaturan.ai_jadwal_aktif })}
                className="mt-2 cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-[0.74rem] font-semibold text-text-2 disabled:opacity-50"
              >
                {pengaturan.ai_jadwal_aktif ? "Matikan jadwal kerja" : "Nyalakan jadwal kerja"}
              </button>
            </div>
          )}

          {galat && (
            <p className="mt-2 mb-0 rounded-lg bg-[#fee2e2] px-2.5 py-2 text-[0.74rem] leading-relaxed text-[#b91c1c]">
              {galat}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
