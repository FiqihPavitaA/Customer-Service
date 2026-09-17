"use client";

/* ===========================================================
   Contoh pertanyaan pelanggan — Tahap C.

   INILAH pekerjaan yang paling menentukan ketepatan Gerbang 2, dan
   satu-satunya yang tidak bisa dikerjakan developer. Yang tahu
   bagaimana pelanggan sungguhan menulis adalah orang yang membalas
   chat setiap hari.

   TIGA KEPUTUSAN TAMPILAN, MASING-MASING ADA SEBABNYA

   1. Umpan balik muncul SAAT MENGETIK, bukan setelah menyimpan.
      Contoh yang ditulis terlalu rapi adalah kegagalan yang paling
      sering terjadi dan paling sulit disadari — tidak ada yang
      terasa salah saat menulis "Bagaimana cara penggunaan produk
      ini?". Peringatannya harus datang sebelum jarinya berpindah.

   2. Contoh yang BELUM punya vektor ditandai jelas.
      Menyimpan contoh tidak membuatnya langsung berpengaruh; vektornya
      dibangun terpisah karena berbayar. Tanpa penanda ini tim CS akan
      mengira pekerjaannya sudah bekerja padahal belum.

   3. Contoh dari bootstrap dibedakan dari yang ditulis CS.
      36 contoh bawaan diturunkan dari kasus uji dan gayanya terlalu
      rapi. Itu kerangka sementara, bukan data sungguhan — dan yang
      paling berguna dilakukan tim CS adalah menggantinya.
   =========================================================== */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  CONTOH_MINIMUM,
  bergayaChat,
  periksaContoh,
  periksaKumpulan,
  type CatatanMutu,
} from "@/lib/mutuContoh";
import { headerBerSesi } from "@/lib/supabase/header";

export type ContohItem = {
  id: string;
  teks: string;
  sumber: "cs" | "bootstrap" | "chat";
  bervektor: boolean;
  model: string | null;
};

const header = headerBerSesi;

/** Jangkar gulir spanduk bangun vektor di atas daftar template. */
export const ID_BANGUN_VEKTOR = "bangun-vektor";

/**
 * Dikirim sesudah vektor dibangun.
 *
 * Spanduk dan panel contoh tinggal di dua komponen yang tidak saling
 * kenal. Tanpa peristiwa ini, lencana "belum bervektor" di panel yang
 * sedang terbuka tetap menempel sesudah Admin membangunnya — dan orang
 * yang melihatnya akan mengira tombolnya gagal, lalu menekannya lagi.
 */
export const PERISTIWA_VEKTOR_DIBANGUN = "infarm:vektor-dibangun";

/** Gulir ke spanduk bangun vektor. */
export function kePanelBangunVektor() {
  document
    .getElementById(ID_BANGUN_VEKTOR)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function pesanGalat(r: Response): Promise<string> {
  try {
    const d = (await r.json()) as { error?: string };
    return d.error ?? `Server menjawab ${r.status}.`;
  } catch {
    return `Server menjawab ${r.status}.`;
  }
}

/* ---------------- Potongan kecil ---------------- */

function Catatan({ c }: { c: CatatanMutu }) {
  const gaya =
    c.berat === "galat"
      ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
      : c.berat === "peringatan"
        ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
        : "border-line bg-green-soft text-text-2";
  const ikon = c.berat === "galat" ? "⛔" : c.berat === "peringatan" ? "⚠️" : "💡";
  return (
    <p className={`mt-1.5 mb-0 rounded-[10px] border px-3 py-2 text-[0.78rem] leading-relaxed ${gaya}`}>
      {ikon} {c.pesan}
    </p>
  );
}

/** Lencana yang menerangkan keadaan satu contoh, bukan sekadar menghias. */
function Lencana({ item }: { item: ContohItem }) {
  const daftar: { teks: string; judul: string; gaya: string }[] = [];

  if (!item.bervektor) {
    daftar.push({
      teks: "belum bervektor",
      judul:
        "Sudah tersimpan, tetapi belum ikut menentukan apa pun. " +
        "Admin membangun vektornya lewat spanduk ⚡ di atas daftar template.",
      gaya: "bg-[#fef3c7] text-[#92400e]",
    });
  }
  if (item.sumber === "bootstrap") {
    daftar.push({
      teks: "bawaan",
      judul:
        "Diturunkan dari kasus uji, bukan dari chat sungguhan. " +
        "Gayanya terlalu rapi — paling berguna kalau diganti.",
      gaya: "bg-green-soft text-text-2",
    });
  }
  if (!bergayaChat(item.teks)) {
    daftar.push({
      teks: "terlalu rapi",
      judul:
        "Tidak mengandung ciri chat pelanggan (singkatan atau sapaan). " +
        "Contoh seperti ini gagal justru pada kalimat yang paling sering datang.",
      gaya: "bg-[#fef3c7] text-[#92400e]",
    });
  }

  if (!daftar.length) return null;
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
      {daftar.map((d) => (
        <span
          key={d.teks}
          title={d.judul}
          className={`cursor-help rounded px-1.5 py-0.5 text-[0.68rem] font-semibold ${d.gaya}`}
        >
          {d.teks}
        </span>
      ))}
    </span>
  );
}

/* ---------------- Panel utama ---------------- */

export default function ContohPertanyaan({
  code,
  onBerubah,
  onKeBangunVektor,
}: {
  code: string;
  /** Dipanggil setelah daftar berubah, supaya hitungan di luar ikut segar. */
  onBerubah?: () => void;
  /** Membawa pengguna ke spanduk bangun vektor di atas daftar. */
  onKeBangunVektor?: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<ContohItem[]>([]);
  const [status, setStatus] = useState<"memuat" | "siap" | "gagal">("memuat");
  const [galat, setGalat] = useState<string | null>(null);
  const [draf, setDraf] = useState("");
  const [sibuk, setSibuk] = useState(false);

  /* Penghitung versi, bukan fungsi muat() yang dipanggil dari mana-mana.
     Efek yang memanggil fungsi ber-setState memicu render berantai —
     jadi pemuatan hidup DI DALAM efek, dan penambah/penghapus cukup
     menaikkan angka ini untuk memintanya berjalan lagi. */
  const [versi, setVersi] = useState(0);
  const segarkan = useCallback(() => setVersi((v) => v + 1), []);

  // Vektor dibangun dari spanduk → lencana di panel ini ikut segar.
  useEffect(() => {
    window.addEventListener(PERISTIWA_VEKTOR_DIBANGUN, segarkan);
    return () => window.removeEventListener(PERISTIWA_VEKTOR_DIBANGUN, segarkan);
  }, [segarkan]);

  useEffect(() => {
    let batal = false;

    void (async () => {
      // await lebih dulu: tidak ada setState yang berjalan sinkron
      // saat efek ini dijalankan.
      const h = await header();
      try {
        const r = await fetch(
          `/api/templates/contoh?code=${encodeURIComponent(code)}`,
          { headers: h, cache: "no-store" },
        );
        if (batal) return;
        if (!r.ok) {
          setGalat(await pesanGalat(r));
          setStatus("gagal");
          return;
        }
        const d = (await r.json()) as { items: ContohItem[] };
        if (batal) return;
        setItems(d.items);
        setGalat(null);
        setStatus("siap");
      } catch (e) {
        // Template lain dipilih sebelum jawaban datang — jawabannya
        // sudah tidak relevan, dan menulisnya ke layar justru salah.
        if (batal) return;
        setGalat((e as Error).message);
        setStatus("gagal");
      }
    })();

    return () => {
      batal = true;
    };
  }, [code, versi]);

  /* Umpan balik saat mengetik — inilah yang benar-benar menaikkan
     mutu data, bukan penolakan setelah tersimpan. */
  const catatanDraf = draf.trim() ? periksaContoh(draf) : [];
  const bolehSimpan = draf.trim().length > 0 && !catatanDraf.some((c) => c.berat === "galat");

  const kumpulan = periksaKumpulan(items.map((i) => i.teks));
  const belumBervektor = items.filter((i) => !i.bervektor).length;

  const tambah = async () => {
    if (!bolehSimpan || sibuk) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/templates/contoh", {
        method: "POST",
        headers: await header(),
        body: JSON.stringify({ code, teks: draf.trim() }),
      });
      if (!r.ok) {
        toast(await pesanGalat(r));
        return;
      }
      setDraf("");
      segarkan();
      onBerubah?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async (id: string) => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const r = await fetch(`/api/templates/contoh?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await header(),
      });
      if (!r.ok) {
        toast(await pesanGalat(r));
        return;
      }
      segarkan();
      onBerubah?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  /* ---------------- Tampilan ---------------- */

  if (status === "gagal") {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[0.82rem] text-[#b91c1c]">
        Contoh pertanyaan tidak bisa dimuat: {galat}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.82rem] font-semibold text-text-2">
          Contoh pertanyaan pelanggan
        </span>
        <span
          className={`font-mono text-[0.78rem] font-bold ${
            kumpulan.cukup ? "text-green-dark" : "text-[#92400e]"
          }`}
        >
          {items.length} / {CONTOH_MINIMUM}
          {kumpulan.cukup ? " ✓" : ""}
        </span>
      </div>

      <p className="mt-0 mb-3 text-[0.75rem] leading-relaxed text-muted">
        Tulis <b>persis seperti pelanggan mengetik</b> — termasuk singkatan,
        sapaan, dan salah ketik. Ini yang membuat template terpilih walau
        kalimatnya berbeda dari kata kuncinya. Kalimat yang ditulis rapi justru
        membuatnya gagal pada pesan yang paling sering datang.
      </p>

      {/* ---- Daftar ---- */}
      {status === "memuat" && (
        <p className="m-0 py-2 text-[0.82rem] text-muted">Memuat…</p>
      )}

      {status === "siap" && items.length === 0 && (
        <p className="m-0 mb-3 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
          Belum ada contoh. Template ini hanya bisa terkirim lewat kata kunci
          persis — pesan yang maksudnya sama tapi katanya beda tidak akan
          tertangkap.
        </p>
      )}

      {items.length > 0 && (
        <ul className="m-0 mb-3 list-none space-y-1.5 p-0">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-start justify-between gap-2 rounded-[10px] bg-green-soft px-3 py-2"
            >
              <span className="min-w-0 break-words text-[0.85rem] leading-relaxed">
                &ldquo;{i.teks}&rdquo;
                <Lencana item={i} />
              </span>
              <button
                type="button"
                onClick={() => void hapus(i.id)}
                disabled={sibuk}
                aria-label={`Hapus contoh "${i.teks}"`}
                className="shrink-0 cursor-pointer border-none bg-transparent p-1 leading-none text-muted hover:text-[#b91c1c] disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Catatan tingkat kumpulan ---- */}
      {status === "siap" &&
        kumpulan.catatan.map((c, n) => <Catatan key={n} c={c} />)}

      {belumBervektor > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2">
          <p className="m-0 min-w-0 flex-1 text-[0.78rem] leading-relaxed text-[#92400e]">
            ⚠️ {belumBervektor} contoh di template ini <b>belum berpengaruh</b>{" "}
            sampai vektornya dibangun lewat spanduk ⚡ di atas daftar template.
            Langkah itu memotong saldo, jadi sengaja dikumpulkan dan hanya
            dijalankan Admin.
          </p>
          {onKeBangunVektor && (
            <button
              type="button"
              onClick={onKeBangunVektor}
              className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-[#f0c36d] bg-white px-3 py-1.5 text-[0.76rem] font-bold text-[#8a5a00] hover:bg-[#fdf3d8]"
            >
              Lihat tombolnya ↑
            </button>
          )}
        </div>
      )}

      {/* ---- Tambah ---- */}
      <div className="mt-3 flex gap-2 max-mini:flex-col">
        <input
          type="text"
          value={draf}
          onChange={(e) => setDraf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void tambah();
          }}
          placeholder="mis. nem oilnya dipakenya gmn kak"
          className="flex-1 rounded-xl border border-line bg-green-soft px-3 py-2 outline-none focus:bg-white"
        />
        <button
          type="button"
          onClick={() => void tambah()}
          disabled={!bolehSimpan || sibuk}
          className="cursor-pointer rounded-xl border-none bg-green px-4 py-2 font-bold text-white transition hover:bg-green-hover disabled:opacity-50"
        >
          {sibuk ? "…" : "Tambah"}
        </button>
      </div>

      {catatanDraf.map((c, n) => (
        <Catatan key={n} c={c} />
      ))}
    </div>
  );
}

/* ===========================================================
   Bangun vektor — SATU-SATUNYA tombol berbayar di halaman ini
   =========================================================== */

type HasilBangun = {
  jalan: boolean;
  pesan: string;
  perkiraan: { contoh: number; token: number; idr: number; model: string };
  nyata?: { token: number; idr: number };
  tersimpan?: number;
  /** Contoh yang masih antre sesudah sekali jalan. */
  sisa?: number;
  gagal?: string[];
  /** Seluruh contoh yang belum bervektor — bukan hanya yang muat sekali tekan. */
  total?: number;
};

/**
 * Spanduk bangun vektor. Tetap dua langkah, dan langkah pertama tetap
 * tidak bisa dilewati — yang berubah hanya SIAPA yang menjalankannya.
 *
 * Langkah 1, menghitung antrean dan biayanya, kini berjalan sendiri
 * saat halaman dibuka dan setiap kali contoh ditambah atau dihapus.
 * Ia gratis: /api/pengenal/bangun tanpa `jalankan` tidak pernah
 * menyentuh Voyage. Dan justru angkanya yang paling perlu terlihat —
 * sampai 17 Sep 2026 angka itu baru muncul sesudah seseorang menggulir
 * ke dasar halaman lalu menekan "Hitung dulu", sehingga tim CS tidak
 * pernah tahu contoh yang mereka tulis belum berpengaruh.
 *
 * Langkah 2 tetap klik yang disengaja, dan tombolnya menyebut nominal
 * rupiahnya. Efek di bawah HANYA pernah mengirim badan kosong; tidak
 * ada jalur otomatis apa pun yang mengirim `jalankan: true`. Pemilik
 * proyek pernah kehilangan saldo karena panggilan berbayar berjalan
 * tanpa sepengetahuannya, dan aturan pertama CLAUDE.md lahir dari itu.
 */
export function BangunVektor({
  bolehJalan,
  pemicu,
}: {
  bolehJalan: boolean;
  /** Nilai apa pun yang berubah saat contoh ditambah atau dihapus. */
  pemicu: number;
}) {
  const toast = useToast();
  const [hitungan, setHitungan] = useState<HasilBangun | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  /** Hasil bangun terakhir: biaya nyata dan baris yang gagal ditulis. */
  const [terakhir, setTerakhir] = useState<HasilBangun | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [versi, setVersi] = useState(0);

  /* ---- Langkah 1: GRATIS, otomatis. Badan kosong = mode perkiraan. ---- */
  useEffect(() => {
    let batal = false;

    void (async () => {
      const h = await header();
      try {
        const r = await fetch("/api/pengenal/bangun", {
          method: "POST",
          headers: h,
          body: "{}",
          cache: "no-store",
        });
        const d = (await r.json()) as HasilBangun & { error?: string };
        if (batal) return;
        if (!r.ok) {
          setGalat(d.error ?? `Server menjawab ${r.status}.`);
          return;
        }
        setHitungan(d);
        setGalat(null);
      } catch (e) {
        if (!batal) setGalat((e as Error).message);
      }
    })();

    return () => {
      batal = true;
    };
  }, [pemicu, versi]);

  /* ---- Langkah 2: BERBAYAR. Hanya lewat klik. ---- */
  const bangun = async () => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/pengenal/bangun", {
        method: "POST",
        headers: await header(),
        body: JSON.stringify({ jalankan: true }),
      });
      const d = (await r.json()) as HasilBangun & { error?: string };
      if (!r.ok) {
        toast(d.error ?? `Server menjawab ${r.status}.`);
        return;
      }
      setTerakhir(d);
      toast(d.pesan);
      window.dispatchEvent(new Event(PERISTIWA_VEKTOR_DIBANGUN));
      setVersi((v) => v + 1);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const hasilTerakhir = terakhir && (
    <div className="mt-2 rounded-[10px] bg-white px-3 py-2 text-[0.78rem] leading-relaxed text-text-2">
      {terakhir.nyata && (
        <p className="m-0 font-mono text-[0.76rem] text-green-dark">
          terakhir dibangun: {terakhir.tersimpan ?? 0} contoh · Rp{" "}
          {terakhir.nyata.idr.toFixed(4)} · {terakhir.nyata.token} token
        </p>
      )}
      {terakhir.gagal && terakhir.gagal.length > 0 && (
        <ul className="mt-1.5 mb-0 list-disc pl-4 text-[0.76rem] text-[#b91c1c]">
          {terakhir.gagal.map((g, n) => (
            <li key={n}>{g}</li>
          ))}
        </ul>
      )}
    </div>
  );

  /* ---- Belum ada angka: sedang menghitung, atau gagal ---- */
  if (!hitungan) {
    return (
      <section
        id={ID_BANGUN_VEKTOR}
        className="mb-4 scroll-mt-4 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.8rem] text-muted"
      >
        {galat ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[#b91c1c]">
              Jumlah contoh yang belum aktif tidak bisa dihitung: {galat}
            </span>
            <button
              type="button"
              onClick={() => setVersi((v) => v + 1)}
              className="min-h-10 cursor-pointer rounded-lg border border-line bg-white px-3 py-1 font-semibold text-text-2"
            >
              Coba lagi
            </button>
          </span>
        ) : (
          "Menghitung contoh pertanyaan yang belum aktif…"
        )}
      </section>
    );
  }

  const { perkiraan } = hitungan;
  const total = hitungan.total ?? perkiraan.contoh;

  /* ---- Tidak ada antrean: cukup satu baris hijau ----
     Spanduk kuning yang selalu ada, termasuk saat tidak ada apa-apa,
     melatih orang mengabaikannya — lalu ia diabaikan juga pada hari
     ada 40 contoh yang menunggu. */
  if (total === 0) {
    return (
      <section
        id={ID_BANGUN_VEKTOR}
        className="mb-4 scroll-mt-4 rounded-xl border border-green/30 bg-green-soft px-3.5 py-2.5"
      >
        <p className="m-0 text-[0.8rem] leading-relaxed text-green-dark">
          ✓ <b>Semua contoh pertanyaan sudah aktif.</b> Contoh yang baru ditulis
          akan muncul di sini sebagai antrean.
        </p>
        {galat && (
          <p className="mt-1.5 mb-0 text-[0.76rem] text-[#b91c1c]">
            Hitungan terbaru gagal dimuat: {galat}
          </p>
        )}
        {hasilTerakhir}
      </section>
    );
  }

  /* ---- Ada antrean ---- */
  return (
    <section
      id={ID_BANGUN_VEKTOR}
      className="mb-4 scroll-mt-4 rounded-xl border border-[#f0c36d] bg-[#fdf3d8] p-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-[0.9rem] font-bold text-[#8a5a00]">
            ⚡ {total} contoh pertanyaan belum aktif
          </h4>
          <p className="mt-1 mb-0 text-[0.78rem] leading-relaxed text-[#8a5a00]">
            Sudah tersimpan, tetapi <b>belum ikut menentukan</b> template mana
            yang terpilih sampai vektornya dibangun.
          </p>
        </div>

        {bolehJalan && (
          <button
            type="button"
            onClick={() => void bangun()}
            disabled={sibuk}
            className="min-h-10 shrink-0 cursor-pointer rounded-xl border-none bg-green px-4 py-2 font-bold text-white hover:bg-green-hover disabled:opacity-50 max-mini:w-full"
          >
            {sibuk ? "Membangun…" : `Bangun sekarang — Rp ${perkiraan.idr.toFixed(4)}`}
          </button>
        )}
      </div>

      {bolehJalan ? (
        <p className="mt-2 mb-0 font-mono text-[0.74rem] text-[#8a5a00]">
          sekali tekan: {perkiraan.contoh} contoh · {perkiraan.token} token ·{" "}
          {perkiraan.model}
          {total > perkiraan.contoh &&
            ` · ${total - perkiraan.contoh} sisanya perlu tekan lagi (batas laju Voyage)`}
        </p>
      ) : (
        <p className="mt-2 mb-0 text-[0.78rem] leading-relaxed text-[#8a5a00]">
          🔒 Hanya <b>Admin</b> yang bisa membangunnya, karena langkah ini
          memotong saldo. Kabari Admin setelah selesai mengisi contoh — menulis
          contoh tetap boleh dilakukan seluruh tim CS.
        </p>
      )}

      {galat && (
        <p className="mt-2 mb-0 text-[0.76rem] text-[#b91c1c]">
          Hitungan terbaru gagal dimuat: {galat}
        </p>
      )}
      {hasilTerakhir}
    </section>
  );
}
