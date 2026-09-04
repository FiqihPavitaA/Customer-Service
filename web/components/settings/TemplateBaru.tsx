"use client";

/* ===========================================================
   Form "Tambah Template Baru".

   Sengaja halaman penuh, bukan panel sempit di sebelah kanan
   seperti form edit. Alasannya beda kebutuhan: mengedit berarti
   mengubah satu-dua hal pada sesuatu yang sudah ada; membuat baru
   berarti mengisi semuanya dari nol, dan orang yang tidak menulis
   kode butuh dituntun, bukan disodori kotak-kotak kosong.

   Urutan langkahnya juga disengaja:
     1. Isi jawaban  — hal yang benar-benar dipikirkan tim CS
     2. Kode & kategori — penamaan, gampang setelah isinya jelas
     3. Kata kunci + uji coba — bagian yang menentukan apakah
        template ini akan pernah terpakai sama sekali

   Langkah 3 ditaruh terakhir dan diberi kotak uji, karena inilah
   yang paling sering salah: template dibuat rapi lalu tidak pernah
   terkirim karena kata kuncinya tidak menangkap apa pun. Sekarang
   ada 109 template dalam keadaan itu.
   =========================================================== */

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import {
  KATEGORI_LABEL,
  KATEGORI_URUT,
  type HasilUjiDraft,
  type KategoriTemplate,
  type TemplateItem,
} from "@/lib/db/templateTypes";
import { tambahTemplate } from "@/lib/db/templateStore";

/* ---------------- Pemeriksaan isi ---------------- */

/**
 * Pola yang menandakan template mengarahkan pelanggan ke luar
 * marketplace. claude-core.md melarangnya, dan template semacam ini
 * bisa membuat toko kena sanksi platform.
 *
 * Sengaja PERINGATAN, bukan larangan: angka panjang juga muncul di
 * template yang sah (nomor pesanan contoh, jumlah isi polybag), jadi
 * memblokirnya akan salah lebih sering daripada benar. Yang penting
 * penulisnya sadar sebelum menyimpan.
 */
const POLA_LUAR_MARKETPLACE: { pola: RegExp; sebut: string }[] = [
  { pola: /\bwa\.me\b|\bwhatsapp\b|\bwa\b\s*:?\s*0\d{8,}/i, sebut: "tautan/nomor WhatsApp" },
  { pola: /\brekening\b|\btransfer\b|\bbca\b|\bmandiri\b|\bbri\b/i, sebut: "rekening bank" },
  { pola: /\b0\d{9,}\b/, sebut: "nomor telepon" },
  { pola: /\b(instagram|ig|telegram|line|shopee\.co\.id|tokopedia)\b/i, sebut: "kanal di luar chat" },
];

/** Placeholder belum didukung router — akan terkirim mentah-mentah. */
const POLA_PLACEHOLDER = /\{[a-z_][a-z0-9_]*\}/gi;

type Periksa = { berat: "galat" | "peringatan"; pesan: string };

function periksaIsi(body: string): Periksa[] {
  const hasil: Periksa[] = [];
  const isi = body.trim();

  if (!isi) {
    hasil.push({ berat: "galat", pesan: "Isi jawaban belum ditulis." });
    return hasil;
  }

  const ph = isi.match(POLA_PLACEHOLDER);
  if (ph) {
    hasil.push({
      berat: "galat",
      pesan: `Isi memuat ${ph.join(", ")}. Router belum bisa mengganti placeholder — pelanggan akan menerima tulisan itu apa adanya. Tulis nilainya langsung, atau tunggu fitur placeholder dibuat.`,
    });
  }

  for (const { pola, sebut } of POLA_LUAR_MARKETPLACE) {
    if (pola.test(isi)) {
      hasil.push({
        berat: "peringatan",
        pesan: `Isi tampaknya memuat ${sebut}. Aturan Infarm melarang mengarahkan pelanggan ke luar marketplace — pastikan ini memang perlu.`,
      });
    }
  }

  if (isi.length > 900) {
    hasil.push({
      berat: "peringatan",
      pesan: `Panjangnya ${isi.length} karakter. Balasan CS yang baik 2–5 kalimat pendek; yang terlalu panjang jarang dibaca pelanggan.`,
    });
  }

  return hasil;
}

/* ---------------- Potongan tampilan ---------------- */

function Langkah({
  no,
  judul,
  desc,
  children,
}: {
  no: number;
  judul: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-line bg-white p-5.5 shadow-card max-mini:p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green text-[0.85rem] font-bold text-white">
          {no}
        </span>
        <div>
          <h3 className="m-0 text-[1rem] font-bold">{judul}</h3>
          <p className="mt-0.5 mb-0 text-[0.82rem] leading-relaxed text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[0.82rem] font-semibold text-text-2">
      {children}
    </span>
  );
}

function Catatan({ p }: { p: Periksa }) {
  const galat = p.berat === "galat";
  return (
    <p
      className={[
        "m-0 mt-2 rounded-[10px] border px-3.5 py-2 text-[0.82rem] leading-relaxed",
        galat
          ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
          : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
      ].join(" ")}
    >
      {galat ? "⛔ " : "⚠️ "}
      {p.pesan}
    </p>
  );
}

/* ---------------- Halaman ---------------- */

export default function TemplateBaru({
  kodeTerpakai,
  onSelesai,
  onBatal,
}: {
  /** Semua kode yang sudah ada — untuk memeriksa duplikat. */
  kodeTerpakai: string[];
  onSelesai: (code: string) => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const { isAdmin, isDemo } = useAuth();
  const bolehSimpan = isDemo || isAdmin;

  const [body, setBody] = useState("");
  const [code, setCode] = useState("");
  const [kategori, setKategori] = useState<KategoriTemplate>("umum");
  const [kata, setKata] = useState<string[]>([]);
  const [kataBaru, setKataBaru] = useState("");

  const [pesanUji, setPesanUji] = useState("");
  const [hasil, setHasil] = useState<HasilUjiDraft | null>(null);
  const [sibuk, setSibuk] = useState(false);

  /* ---- Pemeriksaan ---- */
  const kodeRapi = code.trim().toUpperCase();
  const catatanIsi = periksaIsi(body);

  const galatKode: string | null = !kodeRapi
    ? "Kode belum diisi."
    : kodeTerpakai.includes(kodeRapi)
      ? `Kode [${kodeRapi}] sudah dipakai template lain.`
      : !/^[A-Z0-9 ._-]+$/.test(kodeRapi)
        ? "Kode hanya boleh huruf, angka, spasi, titik, garis bawah, dan strip."
        : null;

  const adaGalat = Boolean(galatKode) || catatanIsi.some((c) => c.berat === "galat");
  const siap = !adaGalat && bolehSimpan;

  /* ---- Kata kunci ---- */
  const tambahKata = () => {
    const k = kataBaru.trim().toLowerCase();
    if (!k) return;
    if (kata.includes(k)) {
      toast("Kata kunci itu sudah ada");
      return;
    }
    setKata([...kata, k]);
    setKataBaru("");
    setHasil(null);
  };

  /* ---- Uji coba draf ---- */
  const uji = async () => {
    const p = pesanUji.trim();
    if (!p) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/templates/uji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan: p, kataKunci: kata }),
      });
      setHasil((await r.json()) as HasilUjiDraft);
    } catch {
      toast("Tidak bisa menghubungi server");
    } finally {
      setSibuk(false);
    }
  };

  /* ---- Simpan ---- */
  const simpan = () => {
    const item: TemplateItem = {
      code: kodeRapi,
      kategori,
      berkas: `faq-${kategori}.md`,
      body: body.trim(),
      action: "AUTO_REPLY",
      urutanAturan: null,
      kataKunci: kata,
      kataKunciUtuh: true,
      polaAsli: [],
      also: null,
      unless: [],
      why: null,
      usageCount: null,
      lastUsedAt: null,
      baru: true,
    };
    const galat = tambahTemplate(item);
    if (galat) {
      toast(galat);
      return;
    }
    toast(`Template [${kodeRapi}] ditambahkan`);
    onSelesai(kodeRapi);
  };

  return (
    <div className="max-w-[900px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.2rem] font-bold">Tambah Template Baru</h2>
          <p className="mt-1 mb-0 text-[0.85rem] text-muted">
            Balasan baku yang dikirim otomatis saat pesan pelanggan cocok.
          </p>
        </div>
        <button
          type="button"
          onClick={onBatal}
          className="shrink-0 cursor-pointer rounded-xl border border-line bg-white px-3.5 py-2 font-semibold text-text-2 hover:bg-green-soft"
        >
          ← Kembali ke daftar
        </button>
      </div>

      {!bolehSimpan && (
        <p className="mt-0 mb-4 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[0.84rem] text-[#92400e]">
          🔒 Peran <b>CS Agent</b> boleh menyusun draf di sini, tetapi tombol
          simpan hanya aktif untuk Admin. Sebagian besar template berisi dosis,
          dan satu salah ketik terkirim ke semua pelanggan sekaligus.
        </p>
      )}

      {/* ---------- 1. Isi jawaban ---------- */}
      <Langkah
        no={1}
        judul="Apa jawabannya?"
        desc="Tulis persis seperti yang ingin diterima pelanggan — termasuk sapaan, baris kosong, dan emoji."
      >
        <textarea
          rows={9}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Halo kak, …\n\nTerima kasih ya 🙏"}
          className="w-full resize-y rounded-xl border border-line bg-green-soft px-3.5 py-3 leading-relaxed outline-none focus:bg-white"
        />
        <p className="mt-1.5 mb-0 text-[0.75rem] text-muted">
          {body.trim().length} karakter · dikirim apa adanya, tanpa diubah AI.
        </p>
        {catatanIsi.map((c) => (
          <Catatan key={c.pesan} p={c} />
        ))}

        {body.trim() && (
          <div className="mt-3.5">
            <Label>Pratinjau — yang dilihat pelanggan</Label>
            <div className="max-w-[440px] rounded-2xl rounded-tl-md bg-green-mint px-4 py-3 text-[0.9rem] leading-relaxed whitespace-pre-wrap text-text">
              {body.trim()}
            </div>
          </div>
        )}
      </Langkah>

      {/* ---------- 2. Kode & kategori ---------- */}
      <Langkah
        no={2}
        judul="Beri nama dan kelompokkan"
        desc="Kode dipakai untuk mencari template ini nanti. Kategori menentukan berkas mana yang dibaca AI saat pertanyaannya tidak tertangkap template."
      >
        <div className="grid grid-cols-2 gap-3.5 max-mini:grid-cols-1">
          <div>
            <Label>Kode</Label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="mis. PAKAI PUPUK KANDANG"
              className="w-full rounded-xl border border-line bg-green-soft px-3 py-2 font-mono text-[0.88rem] outline-none focus:bg-white"
            />
          </div>
          <div>
            <Label>Kategori</Label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value as KategoriTemplate)}
              className="w-full rounded-xl border border-line bg-green-soft px-3 py-2 outline-none"
            >
              {KATEGORI_URUT.map((k) => (
                <option key={k} value={k}>
                  {KATEGORI_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {galatKode && code.trim() !== "" && (
          <Catatan p={{ berat: "galat", pesan: galatKode }} />
        )}
      </Langkah>

      {/* ---------- 3. Kata kunci + uji ---------- */}
      <Langkah
        no={3}
        judul="Kapan template ini dipakai?"
        desc="Tulis frasa yang biasa dipakai pelanggan, bukan pola teknis. Lalu uji dengan contoh pesan sungguhan."
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          {kata.length === 0 && (
            <span className="text-[0.84rem] text-muted">
              Belum ada kata kunci.
            </span>
          )}
          {kata.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-lg bg-green-mint px-2.5 py-1 text-[0.78rem] font-semibold text-green-dark"
            >
              {k}
              <button
                type="button"
                onClick={() => {
                  setKata(kata.filter((x) => x !== k));
                  setHasil(null);
                }}
                aria-label={`Hapus kata kunci ${k}`}
                className="cursor-pointer border-none bg-transparent p-0 leading-none text-green-dark opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2 max-mini:flex-col">
          <input
            type="text"
            value={kataBaru}
            onChange={(e) => setKataBaru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tambahKata();
              }
            }}
            placeholder="ketik frasa lalu Enter — mis. pupuk kandang"
            className="flex-1 rounded-xl border border-line bg-green-soft px-3 py-2 outline-none focus:bg-white"
          />
          <button
            type="button"
            onClick={tambahKata}
            className="cursor-pointer rounded-xl border border-line bg-white px-4 py-2 font-bold text-text-2 hover:bg-green-soft"
          >
            Tambah
          </button>
        </div>

        {kata.length === 0 && (
          <Catatan
            p={{
              berat: "peringatan",
              pesan:
                "Tanpa kata kunci, template ini tersimpan tetapi TIDAK akan pernah terkirim otomatis — pertanyaannya tetap diteruskan ke AI dan berbayar. Boleh disimpan dulu, tapi ingat untuk melengkapinya.",
            }}
          />
        )}

        {/* ---- Uji coba ---- */}
        <div className="mt-4 rounded-xl border border-line bg-green-soft p-3.5">
          <Label>Uji coba — tulis contoh pesan pelanggan</Label>
          <div className="flex gap-2 max-mini:flex-col">
            <input
              type="text"
              value={pesanUji}
              onChange={(e) => setPesanUji(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void uji();
              }}
              placeholder="mis. cara pakai pupuk kandang gimana kak?"
              className="flex-1 rounded-xl border border-line bg-white px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={() => void uji()}
              disabled={sibuk || !pesanUji.trim()}
              className="cursor-pointer rounded-xl border-none bg-green px-4 py-2 font-bold text-white transition hover:bg-green-hover disabled:opacity-50"
            >
              {sibuk ? "…" : "Uji"}
            </button>
          </div>

          {hasil && (
            <div className="mt-2.5 text-[0.85rem] leading-relaxed">
              {/* Urutannya penting: pengaman dulu, karena kalau pesan
                  dicegat pengaman, kata kunci apa pun tidak berpengaruh
                  dan mengubah frasa hanya membuang waktu. */}
              {hasil.dicegatPengaman ? (
                <p className="m-0 text-[#92400e]">
                  ⚠️ <b>Pesan ini tidak akan pernah dijawab template.</b>{" "}
                  {hasil.dicegatPengaman}
                </p>
              ) : hasil.direbutOleh ? (
                <p className="m-0 text-[#92400e]">
                  ⚠️ Pesan ini sudah dijawab template{" "}
                  <b>[{hasil.direbutOleh}]</b> yang dinilai lebih dulu
                  {hasil.cocokDraf
                    ? " — kata kunci Anda juga cocok, tapi kalah urutan."
                    : "."}{" "}
                  Pakai contoh pesan lain, atau perbaiki template itu daripada
                  membuat yang baru.
                </p>
              ) : hasil.cocokDraf ? (
                <p className="m-0 text-green-dark">
                  ✅ <b>Tertangkap</b> — template baru ini yang akan menjawab.
                </p>
              ) : (
                <p className="m-0 text-text-2">
                  ❌ <b>Belum tertangkap.</b> Tambahkan frasa yang benar-benar
                  ada di pesan itu.
                </p>
              )}
            </div>
          )}

          <p className="mt-2 mb-0 text-[0.75rem] leading-relaxed text-muted">
            Memakai pencocok yang sama dengan chat sungguhan. Tidak memanggil AI
            — gratis, berapa kali pun ditekan.
          </p>
        </div>
      </Langkah>

      {/* ---------- Simpan ---------- */}
      <div className="sticky bottom-0 flex items-center gap-2.5 rounded-2xl border border-line bg-white px-4.5 py-3 shadow-card max-mini:flex-col-reverse max-mini:items-stretch">
        <span className="text-[0.82rem] text-muted max-mini:text-center">
          {adaGalat
            ? "Masih ada yang perlu diperbaiki di atas."
            : "Siap disimpan."}
        </span>
        <div className="flex-1 max-mini:hidden" />
        <button
          type="button"
          onClick={onBatal}
          className="cursor-pointer rounded-xl border border-line bg-white px-4 py-2.5 font-bold text-text-2 hover:bg-green-soft"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={!siap}
          className="cursor-pointer rounded-xl border-none bg-green px-5 py-2.5 font-bold text-white transition hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Simpan Template
        </button>
      </div>
    </div>
  );
}
