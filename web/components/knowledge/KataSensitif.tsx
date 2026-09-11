"use client";

/* ===========================================================
   Knowledge Base → Kata Sensitif

   Halaman tempat admin mengubah Gerbang 0: kata apa yang membuat
   sebuah pesan langsung dialihkan ke CS manusia, tanpa pernah
   dijawab mesin dan tanpa memanggil Claude.

   KENAPA TOMBOL "UJI DULU" LEBIH MENONJOL DARIPADA "SIMPAN"

   Menambah kata di sini terasa seperti pekerjaan kecil, dan di
   situlah bahayanya. Kata yang kurang berarti satu pesan lolos ke
   Claude — berbiaya, tetapi terlihat. Kata yang terlalu umum
   ("kirim", "produk", "beli") mencegat ratusan pertanyaan yang
   selama ini dijawab gratis, semuanya mendarat di meja CS, dan
   tidak ada satu pun galat yang muncul. Yang terlihat hanyalah
   antrean yang penuh, beberapa hari kemudian.

   Karena itu urutan di layar dibalik dari kebiasaan: kotak uji
   berada DI ATAS tombol simpan, dan hasilnya menyebut angka —
   "akan mencegat 34 dari 210 contoh pertanyaan" — karena angka
   itulah yang membuat orang berhenti sejenak, bukan kalimat
   peringatan.

   KENAPA CS TETAP BISA MELIHAT HALAMAN INI

   Menulis dibatasi admin (RLS `satpam_rules_write`), tetapi CS
   tetap boleh membaca. Tim CS yang menerima limpahan chat adalah
   orang pertama yang tahu kata apa yang bolong; menyembunyikan
   halamannya membuat mereka melapor tanpa bisa menunjuk.
   =========================================================== */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { headerBerSesi } from "@/lib/supabase/header";

type Kategori = { slug: string; label: string; alasan: string; urutan: number };

type Aturan = {
  id: string;
  kategori: string;
  priority: number;
  frasa: string[] | null;
  when_patterns: string[];
  also_pattern: string | null;
  why: string;
  is_bawaan: boolean;
  is_active: boolean;
  sunting: { boleh: boolean; sebab: string | null };
};

type Sumber = {
  sumber: "kode" | "supabase";
  aturan: number;
  ditolak: string[];
  alasan: string | null;
};

type HasilUji = {
  frasa: string[];
  dibuang: { teks: string; sebab: string }[];
  pola: string | null;
  ujiKalimat: { kalimat: string; kenaPolaBaru: boolean; sudahTercegat: string | null } | null;
  tumpang: { frasa: string; kategori: string }[];
  cakupan: { kena: number; total: number; contoh: string[]; perluDitinjau: boolean };
  cakupanGagal: string | null;
};

/** Pisah masukan admin jadi frasa: koma ATAU baris baru. */
const pecahFrasa = (teks: string) =>
  teks
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

export default function KataSensitif() {
  const { isAdmin, isDemo } = useAuth();
  const bolehUbah = isDemo || isAdmin;
  const toast = useToast();

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [aturan, setAturan] = useState<Aturan[]>([]);
  const [sumber, setSumber] = useState<Sumber | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  // --- form tambah ---
  const [pilihKategori, setPilihKategori] = useState("");
  const [teksFrasa, setTeksFrasa] = useState("");
  const [kalimatUji, setKalimatUji] = useState("");
  const [hasilUji, setHasilUji] = useState<HasilUji | null>(null);
  const [sibuk, setSibuk] = useState(false);
  /* Galat simpan ditahan di layar, TIDAK dilepas ke toast saja.
     Toast hilang sendiri setelah beberapa detik, dan galat yang
     paling sering muncul di sini justru yang paling panjang dan
     paling perlu dibaca pelan-pelan: penolakan RLS yang menyebutkan
     perintah SQL untuk memperbaikinya. Kehilangan kalimat itu
     membuat kegagalan simpan tidak bisa dibedakan dari keberhasilan
     — yang sudah benar-benar terjadi pada 11 Sep 2026. */
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);

  /* Mengambil dan MENERAPKAN sengaja dipisah.

     Dua alasan. Pertama, effect pembuka tidak boleh memanggil
     setState secara serentak — itu memicu render berantai, dan
     eslint menolaknya. Kedua, memisahkannya membuat pemilihan
     kategori tidak perlu jadi dependensi: terapkan() memakai bentuk
     fungsional, jadi ia tidak pernah membaca pilihan yang sedang
     berlaku dan tidak akan menimpanya. */
  const ambil = async () => {
    const r = await fetch("/api/satpam", { headers: await headerBerSesi() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    return d;
  };

  const terapkan = useCallback((d: {
    kategori?: Kategori[];
    items?: Aturan[];
    sumber?: Sumber;
  }) => {
    setKategori(d.kategori ?? []);
    setAturan(d.items ?? []);
    setSumber(d.sumber ?? null);
    // Hanya mengisi bila admin belum memilih apa pun. Memuat ulang
    // daftar sesudah menyimpan tidak boleh melempar pilihannya
    // kembali ke kategori pertama.
    setPilihKategori((p) => p || d.kategori?.[0]?.slug || "");
  }, []);

  /** Muat ulang dari tombol / sesudah menyimpan. */
  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      terapkan(await ambil());
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  }, [terapkan]);

  useEffect(() => {
    // `batal` menjaga dua hal sekaligus: komponen yang sudah
    // dilepas (admin berpindah tab sebelum jawaban datang) dan
    // pemanggilan ganda dari StrictMode saat pengembangan.
    let batal = false;
    (async () => {
      try {
        const d = await ambil();
        if (!batal) terapkan(d);
      } catch (e) {
        if (!batal) setGalat((e as Error).message);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [terapkan]);

  /* --- Uji dulu, sebelum disimpan ------------------------------- */
  const uji = async () => {
    const frasa = pecahFrasa(teksFrasa);
    if (!frasa.length) {
      toast("Tulis dulu katanya");
      return;
    }
    setSibuk(true);
    try {
      const r = await fetch("/api/satpam/uji", {
        method: "POST",
        headers: await headerBerSesi(),
        body: JSON.stringify({ frasa, kalimat: kalimatUji || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setHasilUji(d);
    } catch (e) {
      toast("Gagal menguji: " + (e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  /* --- Simpan --------------------------------------------------- */
  const simpan = async () => {
    const frasa = pecahFrasa(teksFrasa);
    if (!frasa.length || !pilihKategori) return;
    setSibuk(true);
    setGalatSimpan(null);
    try {
      const r = await fetch("/api/satpam", {
        method: "POST",
        headers: await headerBerSesi(),
        body: JSON.stringify({ kategori: pilihKategori, frasa }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      toast(`${d.item.frasa.length} kata ditambahkan ke ${pilihKategori} ✅`);
      setTeksFrasa("");
      setHasilUji(null);
      await muat();
    } catch (e) {
      // Dua-duanya: toast untuk yang sedang melihat, dan panel yang
      // menetap untuk yang baru menyadarinya kemudian.
      const pesan = (e as Error).message;
      setGalatSimpan(pesan);
      toast("Gagal menyimpan — lihat keterangan di bawah tombol");
    } finally {
      setSibuk(false);
    }
  };

  const ubahAktif = async (a: Aturan) => {
    setSibuk(true);
    try {
      const r = await fetch("/api/satpam", {
        method: "PATCH",
        headers: await headerBerSesi(),
        body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setAturan((lama) =>
        lama.map((x) => (x.id === a.id ? { ...x, is_active: d.item.is_active } : x)),
      );
      toast(d.item.is_active ? "Aturan dinyalakan" : "Aturan dimatikan");
    } catch (e) {
      toast("Gagal: " + (e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const frasaSekarang = pecahFrasa(teksFrasa);

  if (memuat) {
    return <p className="text-[0.85rem] text-muted">Memuat kata sensitif…</p>;
  }

  if (galat) {
    return (
      <div className="rounded-xl border border-[#f59e0b] bg-[#fffbeb] p-4">
        <b className="text-[0.9rem] text-[#92400e]">Daftar kata belum bisa dibaca</b>
        <p className="mt-1 mb-0 text-[0.82rem] leading-relaxed text-[#92400e]">{galat}</p>
        <button
          type="button"
          onClick={() => void muat()}
          className="mt-2 cursor-pointer rounded-lg border border-line bg-white px-3 py-1.5 text-[0.78rem] font-semibold"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Sumber yang sedang dipakai router ---------- */}
      {/* Ditaruh paling atas dan bukan di pojok bawah: kalau router
          masih memakai daftar di kode, SELURUH isi halaman ini
          belum berpengaruh pada satu pun pelanggan. Itu hal pertama
          yang perlu diketahui, bukan catatan kaki. */}
      {sumber && sumber.sumber === "kode" && (
        <div className="rounded-xl border border-[#f59e0b] bg-[#fffbeb] p-3">
          <b className="text-[0.85rem] text-[#92400e]">
            ⚠️ Router masih memakai daftar bawaan di kode
          </b>
          <p className="mt-1 mb-0 text-[0.8rem] leading-relaxed text-[#92400e]">
            Perubahan di halaman ini <b>belum berpengaruh</b> pada balasan
            pelanggan. {sumber.alasan ? `Sebabnya: ${sumber.alasan}.` : ""} Pengaman
            bawaan tetap berjalan penuh ({sumber.aturan} aturan), jadi tidak ada
            pesan berbahaya yang lolos karena ini.
          </p>
        </div>
      )}
      {sumber && sumber.sumber === "supabase" && sumber.ditolak.length > 0 && (
        <div className="rounded-xl border border-[#b91c1c] bg-[#fee2e2] p-3">
          <b className="text-[0.85rem] text-[#b91c1c]">
            {sumber.ditolak.length} aturan dibuang router
          </b>
          <ul className="mt-1 mb-0 pl-4 text-[0.78rem] leading-relaxed text-[#b91c1c]">
            {sumber.ditolak.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Form tambah ---------- */}
      <div className="rounded-xl border border-line bg-white p-4">
        <b className="text-[0.95rem]">Tambah kata sensitif</b>
        <p className="mt-1 mb-3 text-[0.8rem] leading-relaxed text-muted">
          Pesan yang memuat kata ini langsung dialihkan ke CS manusia — tanpa
          dijawab AI, tanpa biaya. Tulis kata biasa, bukan kode; pisahkan dengan
          koma atau baris baru.
        </p>

        {!bolehUbah && (
          <div className="mb-3 rounded-lg bg-[#f4fbf6] px-3 py-2 text-[0.78rem] leading-relaxed text-text-2">
            🔒 Hanya Admin yang bisa menyimpan perubahan. Kamu tetap bisa
            melihat daftarnya dan mengujinya — kalau menemukan kata yang bolong,
            sampaikan ke Admin.
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[0.78rem] font-semibold text-text-2">
            Kategori
            <select
              value={pilihKategori}
              onChange={(e) => setPilihKategori(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-soft px-2.5 py-2 text-[0.82rem] outline-none"
            >
              {kategori.map((k) => (
                <option key={k.slug} value={k.slug}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[0.78rem] font-semibold text-text-2">
            Kata / frasa
            <textarea
              value={teksFrasa}
              onChange={(e) => {
                setTeksFrasa(e.target.value);
                setHasilUji(null);
              }}
              rows={3}
              placeholder="penjual, seller, toko"
              className="mt-1 w-full resize-y rounded-lg border border-line bg-soft px-2.5 py-2 text-[0.82rem] outline-none"
            />
          </label>

          <label className="text-[0.78rem] font-semibold text-text-2">
            Kalimat uji (opsional)
            <input
              value={kalimatUji}
              onChange={(e) => setKalimatUji(e.target.value)}
              placeholder="kak saya mau chat penjual nya"
              className="mt-1 w-full rounded-lg border border-line bg-soft px-2.5 py-2 text-[0.82rem] outline-none"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {/* Uji lebih menonjol daripada Simpan. Lihat catatan di
              kepala berkas: yang berbahaya di halaman ini bukan kata
              yang kurang, melainkan kata yang terlalu lebar. */}
          <button
            type="button"
            disabled={sibuk || !frasaSekarang.length}
            onClick={() => void uji()}
            className="cursor-pointer rounded-lg border border-green bg-green-soft px-4 py-2 text-[0.82rem] font-bold text-green-dark disabled:opacity-50"
          >
            {sibuk ? "Menguji…" : "🔎 Uji dulu"}
          </button>
          <button
            type="button"
            disabled={sibuk || !bolehUbah || !frasaSekarang.length}
            onClick={() => void simpan()}
            title={bolehUbah ? undefined : "Hanya Admin yang bisa menyimpan"}
            className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-[0.82rem] font-semibold text-text-2 disabled:opacity-50"
          >
            Simpan
          </button>
        </div>

        {galatSimpan && (
          <div className="mt-3 rounded-lg border border-[#b91c1c] bg-[#fee2e2] px-3 py-2">
            <b className="text-[0.82rem] text-[#b91c1c]">Tidak tersimpan</b>
            <p className="mt-1 mb-0 text-[0.78rem] leading-relaxed text-[#b91c1c]">
              {galatSimpan}
            </p>
            <button
              type="button"
              onClick={() => setGalatSimpan(null)}
              className="mt-2 cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-[0.72rem] font-semibold text-text-2"
            >
              Tutup
            </button>
          </div>
        )}

        {hasilUji && <PanelHasilUji hasil={hasilUji} />}
      </div>

      {/* ---------- Daftar per kategori ---------- */}
      {kategori.map((k) => {
        const milikKategori = aturan.filter((a) => a.kategori === k.slug);
        return (
          <div key={k.slug} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-[0.95rem]">{k.label}</b>
              <span className="text-[0.74rem] text-muted">
                {milikKategori.length} aturan
              </span>
            </div>
            <p className="mt-1 mb-3 text-[0.76rem] leading-relaxed text-muted">{k.alasan}</p>

            <div className="flex flex-col gap-2">
              {milikKategori.length === 0 && (
                <p className="m-0 text-[0.78rem] text-muted">Belum ada aturan.</p>
              )}
              {milikKategori.map((a) => (
                <BarisAturan
                  key={a.id}
                  aturan={a}
                  bolehUbah={bolehUbah}
                  sibuk={sibuk}
                  onToggle={() => void ubahAktif(a)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===========================================================
   Satu baris aturan
   =========================================================== */

function BarisAturan({
  aturan,
  bolehUbah,
  sibuk,
  onToggle,
}: {
  aturan: Aturan;
  bolehUbah: boolean;
  sibuk: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        aturan.is_active ? "border-line bg-soft" : "border-line bg-white opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Tiga keadaan, bukan dua. Aturan berpola tangan tetap
              DITAMPILKAN — menyembunyikannya akan membuat halaman
              berbohong tentang apa yang sebenarnya menjaga Gerbang 0,
              dan menandainya "belum punya kata" sama salahnya. */}
          {aturan.frasa ? (
            <div className="flex flex-wrap gap-1">
              {aturan.frasa.map((f) => (
                <span
                  key={f}
                  className="rounded-md bg-green-mint px-1.5 py-0.5 text-[0.74rem] text-green-dark"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <div>
              <code className="block overflow-x-auto text-[0.72rem] text-text-2">
                {aturan.when_patterns.join("  •  ")}
              </code>
              <span className="text-[0.7rem] text-muted">
                🔒 {aturan.sunting.sebab}
              </span>
            </div>
          )}

          {aturan.also_pattern && (
            <div className="mt-1 text-[0.7rem] text-muted">
              Hanya berlaku bila kalimatnya juga memuat sebab-akibat.
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {aturan.is_bawaan && (
            <span
              title="Salinan daftar bawaan di kode — inilah yang menahan refund dan keracunan."
              className="rounded-md bg-[#eef2ff] px-1.5 py-0.5 text-[0.68rem] text-[#3730a3]"
            >
              bawaan
            </span>
          )}
          <button
            type="button"
            disabled={sibuk || !bolehUbah}
            onClick={onToggle}
            title={bolehUbah ? undefined : "Hanya Admin yang bisa mengubah"}
            className="cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-[0.72rem] font-semibold disabled:opacity-50"
          >
            {aturan.is_active ? "Matikan" : "Nyalakan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   Hasil uji
   =========================================================== */

function PanelHasilUji({ hasil }: { hasil: HasilUji }) {
  const { cakupan, tumpang, dibuang, ujiKalimat } = hasil;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[#f4fbf6] p-3">
      {hasil.frasa.length > 0 && (
        <div className="text-[0.78rem] text-text-2">
          <b>{hasil.frasa.length} kata</b> akan dipakai: {hasil.frasa.join(", ")}
        </div>
      )}

      {dibuang.length > 0 && (
        <div className="rounded-md bg-[#fffbeb] px-2.5 py-2 text-[0.76rem] leading-relaxed text-[#92400e]">
          <b>{dibuang.length} dibuang:</b>
          <ul className="mt-1 mb-0 pl-4">
            {dibuang.map((d) => (
              <li key={d.teks}>
                <code>{d.teks}</code> — {d.sebab}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ujiKalimat && (
        <div className="text-[0.78rem] leading-relaxed text-text-2">
          Kalimat uji:{" "}
          {ujiKalimat.kenaPolaBaru ? (
            <b className="text-green-dark">tertangkap kata baru ✅</b>
          ) : (
            <b className="text-[#92400e]">tidak tertangkap kata baru</b>
          )}
          {ujiKalimat.sudahTercegat && (
            <>
              {" "}
              — tapi kalimat ini <b>sudah</b> dialihkan sejak dulu lewat kategori{" "}
              <code>{ujiKalimat.sudahTercegat}</code>, jadi menambah kata ini tidak
              mengubah apa pun untuknya.
            </>
          )}
        </div>
      )}

      {tumpang.length > 0 && (
        <div className="rounded-md bg-[#fffbeb] px-2.5 py-2 text-[0.76rem] leading-relaxed text-[#92400e]">
          <b>Sudah ditangkap kategori lain:</b>{" "}
          {tumpang.map((t) => `${t.frasa} → ${t.kategori}`).join(", ")}. Pesan tetap
          dialihkan, tapi yang dilaporkan ke CS tetap kategori lama.
        </div>
      )}

      {/* Pengaman terpenting. Angka dulu, kalimat belakangan —
          angkanya yang membuat orang berhenti. */}
      {cakupan.total > 0 && (
        <div
          className={`rounded-md px-2.5 py-2 text-[0.76rem] leading-relaxed ${
            cakupan.perluDitinjau
              ? "bg-[#fee2e2] text-[#b91c1c]"
              : "bg-white text-text-2"
          }`}
        >
          {cakupan.perluDitinjau ? <b>⚠️ Terlalu lebar. </b> : null}
          Akan mencegat <b>{cakupan.kena}</b> dari <b>{cakupan.total}</b> contoh
          pertanyaan yang selama ini dijawab otomatis.
          {cakupan.contoh.length > 0 && (
            <ul className="mt-1 mb-0 pl-4">
              {cakupan.contoh.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {cakupan.perluDitinjau && (
            <div className="mt-1">
              Pertanyaan seperti itu akan berpindah ke meja CS manusia. Pertimbangkan
              kata yang lebih spesifik.
            </div>
          )}
        </div>
      )}

      {hasil.cakupanGagal && (
        <div className="text-[0.74rem] text-muted">
          Cakupan tidak terukur: {hasil.cakupanGagal}
        </div>
      )}
    </div>
  );
}
