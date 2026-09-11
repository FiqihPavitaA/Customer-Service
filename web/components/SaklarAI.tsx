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
import { useBelumTerjawabCount } from "@/lib/db";
import { peringatanTunggakan } from "@/lib/tunggakan";
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

/** Nama hari menurut ISO: 1 = Senin. Dipendekkan jadi tiga huruf
    supaya tujuh tombolnya muat satu baris di panel selebar 320px. */
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const JAM_PILIHAN = Array.from({ length: 24 }, (_, j) => j);

const dua = (n: number) => String(n).padStart(2, "0");

type Draf = { mulai: number; selesai: number; hari: number[] };

const WARNA = {
  nyala: "border-green bg-green-soft text-green-dark",
  mati: "border-[#f59e0b] bg-[#fffbeb] text-[#92400e]",
  /* Bukan hijau, bukan merah: keadaannya memang TIDAK diketahui. */
  buta: "border-line bg-white text-muted",
} as const;

export default function SaklarAI() {
  const { isAdmin, isDemo } = useAuth();
  const bolehUbah = isDemo || isAdmin;
  /* Chat yang menunggu balasan. Dibaca dari store yang sama dengan
     daftar di halaman Chat, jadi angka di sini dan panjang daftar di
     sana tidak bisa berselisih. */
  const tunggakan = useBelumTerjawabCount();
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
  /* Draf penyuntingan jadwal; null berarti penyuntingnya tertutup.

     Sengaja TIDAK ada boolean "sedang menyunting" di sebelahnya.
     Dua keadaan yang harus selalu sepakat adalah dua keadaan yang
     suatu saat akan berselisih, dan yang tersisa sesudahnya adalah
     penyunting terbuka tanpa isi — atau isi yang tidak terlihat. */
  const [draf, setDraf] = useState<Draf | null>(null);
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
      if (kotak.current && !kotak.current.contains(e.target as Node)) {
        setBuka(false);
        // Draf ikut dibuang. Kalau tidak, panel yang dibuka lagi
        // besok menampilkan angka yang pernah diketik lalu
        // ditinggalkan — terbaca sebagai jadwal yang berlaku,
        // padahal tidak pernah tersimpan.
        setDraf(null);
      }
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
      setDraf(null);
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

  const sekarang = new Date();
  const keputusan = putusanAI(pengaturan, sekarang);
  const teks = teksKeadaanAI(keputusan);

  /* ---- Peringatan sebelum jam kerja habis ----

     Saklar jadwal menciptakan satu lubang yang tidak ada sebelumnya:
     pesan yang datang pukul 15.55 tidak dijawab AI (masih jam kerja)
     dan tidak dijawab orang (jamnya sudah habis). Kalau pelanggannya
     kemudian diam, pesan itu tidak pernah dijawab siapa pun.

     Yang dilakukan di sini bukan mengejar ketertinggalan melainkan
     mencegahnya terbentuk — dan karena itu ia harus muncul di
     PENANDANYA, bukan hanya di dalam panel. Peringatan yang baru
     terlihat sesudah diklik tidak memperingatkan siapa-siapa. */
  const peringatan = peringatanTunggakan(keputusan, tunggakan, sekarang);

  /* Gerbang di /api/chat tidak bisa membaca jadwal ini, jadi apa pun
     yang tertulis di penanda TIDAK berlaku bagi pelanggan.

     Penandanya sengaja dibuat abu-abu dengan tanda seru, bukan
     hijau atau merah. Menampilkan "🔴 AI mati" dengan yakin
     sementara pelanggan tetap dijawab adalah kegagalan terburuk
     yang bisa dilakukan layar ini — tim CS akan berhenti memeriksa
     sesuatu yang mereka kira sudah dimatikan. */
  const gerbangButa = gerbang?.sumber === "bawaan";

  /* filter(Boolean) bukan hiasan: ai_hari datang dari database, dan
     nilai di luar 1-7 akan menghasilkan undefined yang tercetak apa
     adanya sebagai kata "undefined" di tengah kalimat. */
  const hariTerpilih = pengaturan.ai_hari.map((h) => HARI[h - 1]).filter(Boolean);

  /* Ditulis sesudah penjagaan !pengaturan di atas, supaya draf
     selalu lahir dari jadwal yang SEDANG berlaku — bukan dari nol
     yang kebetulan berarti tengah malam. */
  const bukaPenyunting = () =>
    setDraf({
      mulai: pengaturan.ai_jam_mulai,
      selesai: pengaturan.ai_jam_selesai,
      hari: [...pengaturan.ai_hari],
    });

  const geserHari = (h: number) =>
    setDraf((d) =>
      !d
        ? d
        : {
            ...d,
            hari: d.hari.includes(h)
              ? d.hari.filter((x) => x !== h)
              : [...d.hari, h].sort((a, b) => a - b),
          },
    );

  /* Ditahan SEBELUM dikirim, bukan sesudah database menolak.

     Yang berwenang tetap server — dua batas yang sama juga ditulis
     sebagai CHECK constraint, dan itulah yang benar-benar menjaga
     tabelnya. Yang di sini hanya membuat salah ketik yang sudah
     pasti ditolak tidak perlu menempuh perjalanan pulang-pergi
     dulu, dan menjelaskan sebabnya dengan kalimat yang bisa dibaca
     orang. */
  const salahDraf = !draf
    ? null
    : draf.mulai === draf.selesai
      ? "Jam mulai dan selesai tidak boleh sama. Untuk mendiamkan AI sepanjang waktu, pakai saklar induk — bukan jadwal."
      : !draf.hari.length
        ? "Pilih minimal satu hari."
        : null;

  const simpanDraf = () => {
    if (!draf || salahDraf) return;
    void kirim({
      ai_jam_mulai: draf.mulai,
      ai_jam_selesai: draf.selesai,
      ai_hari: draf.hari,
      /* Menyunting jadwal berarti bermaksud memakainya. Menyimpan
         jam baru lalu mendapati AI tetap menjawab sepanjang hari
         adalah kebingungan yang tidak perlu ada.

         Supaya tidak diam-diam, tombolnya berbunyi "Simpan &
         nyalakan" ketika jadwalnya memang sedang mati. */
      ai_jadwal_aktif: true,
    });
  };

  return (
    <div ref={kotak} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setBuka((b) => !b);
          setDraf(null);
        }}
        aria-expanded={buka}
        title={bolehUbah ? "Klik untuk mengubah" : "Hanya Admin yang bisa mengubah"}
        className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[0.78rem] font-bold transition ${
          gerbangButa ? WARNA.buta : keputusan.boleh ? WARNA.nyala : WARNA.mati
        }`}
      >
        <span aria-hidden>
          {gerbangButa ? "⚠️" : peringatan ? "⏳" : keputusan.boleh ? "🟢" : "🔴"}
        </span>
        <span className="max-mini:hidden">
          {gerbangButa ? "AI · belum terpasang" : (peringatan ?? teks)}
        </span>
        <span className="mini:hidden">
          {gerbangButa
            ? "AI ⚠"
            : peringatan
              ? `${tunggakan} belum`
              : keputusan.boleh
                ? "AI"
                : "AI mati"}
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

          {/* Sengaja menyebut apa yang TIDAK akan terjadi.

              Dugaan paling wajar saat membaca "AI nyala 15 menit
              lagi" adalah bahwa AI akan menyapu tunggakannya. Ia
              tidak — dan tim yang mengira begitu akan pulang
              meninggalkan chat yang tidak pernah dijawab siapa pun.
              Kalimat ini yang menahannya. */}
          {peringatan && (
            <div className="mt-1.5 rounded-lg border border-[#f59e0b] bg-[#fffbeb] px-2.5 py-2">
              <b className="text-[0.78rem] text-[#92400e]">{peringatan}</b>
              <p className="mt-1 mb-0 text-[0.73rem] leading-relaxed text-[#92400e]">
                AI hanya menangani pesan <b>baru</b> sesudah menyala — yang
                menunggu sekarang tidak ikut dijawab. Buka tab{" "}
                <b>Menunggu balasan</b> di halaman Chat selagi masih sempat.
              </p>
            </div>
          )}

          {/* Tiga keadaan, bukan dua.

              Jadwal yang MENYALA tetapi tidak punya satu hari pun
              adalah jadwal yang tidak pernah berlaku: putusanAI()
              membuangnya dan AI menjawab kapan saja. Kalau kalimat
              di sini tetap berbunyi "AI diam 08.00-16.00", ia
              menyebutkan aturan yang sedang tidak dijalankan — dan
              orang yang membacanya akan mencari sebab di tempat
              yang salah. */}
          <p className="mt-1 mb-2 text-[0.76rem] leading-relaxed text-muted">
            {!pengaturan.ai_jadwal_aktif
              ? "Jadwal belum dinyalakan — AI menjawab kapan saja."
              : hariTerpilih.length
                ? `Jadwal: AI diam ${dua(pengaturan.ai_jam_mulai)}.00–${dua(
                    pengaturan.ai_jam_selesai,
                  )}.00 WIB pada ${hariTerpilih.join(", ")}.`
                : "Jadwal menyala tetapi belum ada hari yang dipilih, jadi tidak ada yang berlaku — AI menjawab kapan saja."}
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

              {/* ---- Menyunting jadwal, di panel ini juga ----

                  Semula penyuntingan jam hendak diletakkan di
                  Pengaturan, dengan alasan panel selebar 320px
                  terlalu sempit untuk sebuah borang. Pemilik proyek
                  memilih sebaliknya, dan alasannya lebih kuat: yang
                  mengubah jadwal adalah orang yang baru saja
                  MELIHAT jadwalnya di penanda ini. Menyuruhnya
                  pindah halaman untuk menyentuh angka yang sedang
                  ia baca cuma menambah satu langkah, dan satu
                  langkah itulah yang membuat orang menundanya.

                  Yang menyesuaikan diri karena itu bukan tempatnya,
                  melainkan bentuknya: dua pilihan jam dan tujuh
                  tombol hari sependek nama harinya — bukan borang
                  bertumpuk yang memaksa panel ini tumbuh ke bawah
                  layar. */}
              {!draf ? (
                <button
                  type="button"
                  disabled={sibuk}
                  onClick={bukaPenyunting}
                  className="mt-2 cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-[0.74rem] font-semibold text-text-2 disabled:opacity-50"
                >
                  Ubah jam &amp; hari
                </button>
              ) : (
                <div className="mt-2 rounded-lg border border-line bg-[#f4fbf6] p-2">
                  <b className="text-[0.72rem] tracking-wider text-muted uppercase">AI diam pada</b>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <select
                      aria-label="Jam mulai"
                      value={draf.mulai}
                      disabled={sibuk}
                      onChange={(e) => setDraf({ ...draf, mulai: Number(e.target.value) })}
                      className="cursor-pointer rounded-lg border border-line bg-white px-1.5 py-1 text-[0.76rem] font-semibold"
                    >
                      {JAM_PILIHAN.map((j) => (
                        <option key={j} value={j}>
                          {dua(j)}.00
                        </option>
                      ))}
                    </select>
                    <span className="text-[0.74rem] text-muted">sampai</span>
                    <select
                      aria-label="Jam selesai"
                      value={draf.selesai}
                      disabled={sibuk}
                      onChange={(e) => setDraf({ ...draf, selesai: Number(e.target.value) })}
                      className="cursor-pointer rounded-lg border border-line bg-white px-1.5 py-1 text-[0.76rem] font-semibold"
                    >
                      {JAM_PILIHAN.map((j) => (
                        <option key={j} value={j}>
                          {dua(j)}.00
                        </option>
                      ))}
                    </select>
                    <span className="text-[0.74rem] text-muted">WIB</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {HARI.map((nama, i) => {
                      const h = i + 1;
                      const dipilih = draf.hari.includes(h);
                      return (
                        <button
                          key={nama}
                          type="button"
                          disabled={sibuk}
                          aria-pressed={dipilih}
                          onClick={() => geserHari(h)}
                          className={`min-w-9 flex-1 cursor-pointer rounded-lg border px-1 py-1 text-[0.7rem] font-bold disabled:opacity-50 ${
                            dipilih
                              ? "border-green bg-green-soft text-green-dark"
                              : "border-line bg-white text-muted"
                          }`}
                        >
                          {nama}
                        </button>
                      );
                    })}
                  </div>

                  {salahDraf && (
                    <p className="mt-2 mb-0 text-[0.72rem] leading-relaxed text-[#92400e]">
                      {salahDraf}
                    </p>
                  )}

                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      disabled={sibuk || !!salahDraf}
                      onClick={simpanDraf}
                      className="flex-1 cursor-pointer rounded-lg border border-green bg-green-soft px-2 py-1.5 text-[0.74rem] font-bold text-green-dark disabled:opacity-50"
                    >
                      {pengaturan.ai_jadwal_aktif ? "Simpan" : "Simpan & nyalakan"}
                    </button>
                    <button
                      type="button"
                      disabled={sibuk}
                      onClick={() => setDraf(null)}
                      className="cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-[0.74rem] font-semibold text-text-2 disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
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
