"use client";

/* ===========================================================
   Pengaturan → Knowledge Base → Template Jawaban.

   Tata letak split-view (opsi 3): daftar ringkas di kiri, detail
   dan formnya di kanan. Dipilih karena pekerjaan nyata tim CS
   bukan "membaca-baca 152 template", melainkan "ada yang salah di
   satu template, cari dan perbaiki". Split-view membuat mencari,
   membaca, dan memperbaiki terjadi tanpa berpindah layar — dan
   tanpa modal yang membuat posisi di daftar hilang tiap kali.

   Di ≤980px kolom kanan berubah jadi overlay layar penuh dengan
   tombol tutup, mengikuti aturan responsivitas #2 di
   docs/tech-stack.md: panel yang disembunyikan harus tetap bisa
   dibuka.

   YANG PALING PENTING DI HALAMAN INI
   109 dari 152 template TIDAK punya aturan pemicu — ada teksnya,
   tapi tidak pernah bisa terkirim otomatis. Tanpa penanda itu,
   tim CS akan mengira semuanya sudah bekerja. Karena itu status
   pemicu tampil di setiap baris, dan ada penyaring khusus untuk
   melihat daftar yang belum punya pemicu.
   =========================================================== */

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import {
  KATEGORI_LABEL,
  KATEGORI_URUT,
  type HasilUji,
  type KategoriTemplate,
  type TemplateItem,
} from "@/lib/db/templateTypes";
import {
  hapusTemplate,
  muatTemplates,
  simpanTemplate,
  tambahTemplate,
  useTemplates,
} from "@/lib/db/templateStore";

type SaringStatus = "semua" | "aktif" | "tanpa";

const KOSONG: TemplateItem = {
  code: "",
  kategori: "umum",
  berkas: "faq-umum.md",
  body: "",
  action: "AUTO_REPLY",
  urutanAturan: null,
  kataKunci: [],
  kataKunciUtuh: true,
  polaAsli: [],
  also: null,
  unless: [],
  why: null,
  usageCount: null,
  lastUsedAt: null,
};

/* ---------------- Potongan kecil ---------------- */

function StatusDot({ item }: { item: TemplateItem }) {
  const aktif = item.urutanAturan !== null;
  return (
    <span
      title={aktif ? "Punya pemicu — bisa terkirim otomatis" : "Belum punya pemicu"}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${aktif ? "bg-green" : "bg-[#f59e0b]"}`}
      aria-hidden
    />
  );
}

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-green-mint px-2.5 py-1 text-[0.78rem] font-semibold text-green-dark">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Hapus kata kunci"
          className="cursor-pointer border-none bg-transparent p-0 leading-none text-green-dark opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[0.82rem] font-semibold text-text-2">
      {children}
    </span>
  );
}

/* ---------------- Kotak uji coba ---------------- */

function UjiCoba({ kodeIni }: { kodeIni: string }) {
  const [pesan, setPesan] = useState("");
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const uji = async () => {
    const p = pesan.trim();
    if (!p) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/templates/uji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan: p }),
      });
      setHasil((await r.json()) as HasilUji);
    } catch {
      setHasil({
        cocok: false,
        code: null,
        why: null,
        sebab: "Tidak bisa menghubungi server.",
      });
    } finally {
      setSibuk(false);
    }
  };

  /* Tiga keadaan, bukan dua. "Cocok tapi ke template LAIN" adalah
     jebakan paling sering: kata kuncinya benar, tapi ada aturan lain
     yang urutannya lebih dulu dan menang. Tanpa dibedakan, CS akan
     mengira kata kuncinya salah dan menambah kata kunci lagi — yang
     justru memperburuk. */
  const lain = hasil?.cocok && hasil.code !== kodeIni;

  return (
    <div className="rounded-xl border border-line bg-green-soft p-3.5">
      <Label>Uji coba — ketik pesan pelanggan</Label>
      <div className="flex gap-2 max-mini:flex-col">
        <input
          type="text"
          value={pesan}
          onChange={(e) => setPesan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void uji();
          }}
          placeholder="mis. dosis npk berapa kak?"
          className="flex-1 rounded-xl border border-line bg-white px-3 py-2 outline-none"
        />
        <button
          type="button"
          onClick={() => void uji()}
          disabled={sibuk || !pesan.trim()}
          className="cursor-pointer rounded-xl border-none bg-green px-4 py-2 font-bold text-white transition hover:bg-green-hover disabled:opacity-50"
        >
          {sibuk ? "…" : "Uji"}
        </button>
      </div>

      {hasil && (
        <div className="mt-2.5 text-[0.85rem] leading-relaxed">
          {hasil.cocok && !lain && (
            <p className="m-0 text-green-dark">
              ✅ <b>Cocok</b> — template ini yang akan menjawab.
            </p>
          )}
          {lain && (
            <p className="m-0 text-[#92400e]">
              ⚠️ Cocok, tapi yang menjawab adalah <b>[{hasil.code}]</b>, bukan
              template ini. Aturan itu dinilai lebih dulu — perbaiki kata kunci di
              sana, atau buat kata kunci di sini lebih khusus.
            </p>
          )}
          {!hasil.cocok && (
            <p className="m-0 text-text-2">
              ❌ <b>Belum tertangkap.</b> {hasil.sebab}
            </p>
          )}
        </div>
      )}

      <p className="mt-2 mb-0 text-[0.75rem] text-muted">
        Memakai pencocok yang sama dengan chat sungguhan. Tidak memanggil AI —
        gratis, berapa kali pun ditekan.
      </p>
    </div>
  );
}

/* ---------------- Panel detail / form ---------------- */

function Detail({
  item,
  baru,
  onTutup,
}: {
  item: TemplateItem;
  baru: boolean;
  onTutup: () => void;
}) {
  const toast = useToast();
  const { isAdmin, isDemo } = useAuth();
  const bolehUbah = isDemo || isAdmin;

  const [code, setCode] = useState(item.code);
  const [kategori, setKategori] = useState<KategoriTemplate>(item.kategori);
  const [body, setBody] = useState(item.body);
  const [kata, setKata] = useState<string[]>(item.kataKunci);
  const [kataBaru, setKataBaru] = useState("");

  const berubah =
    code !== item.code ||
    kategori !== item.kategori ||
    body !== item.body ||
    kata.join("|") !== item.kataKunci.join("|");

  const tambahKata = () => {
    const k = kataBaru.trim().toLowerCase();
    if (!k) return;
    if (kata.includes(k)) {
      toast("Kata kunci itu sudah ada");
      return;
    }
    setKata([...kata, k]);
    setKataBaru("");
  };

  const simpan = () => {
    if (baru) {
      const galat = tambahTemplate({
        ...KOSONG,
        code,
        kategori,
        body,
        kataKunci: kata,
        berkas: `faq-${kategori}.md`,
      });
      if (galat) {
        toast(galat);
        return;
      }
      toast(`Template [${code.toUpperCase()}] ditambahkan`);
    } else {
      simpanTemplate(item.code, { code, kategori, body, kataKunci: kata });
      toast(`[${item.code}] disimpan`);
    }
    onTutup();
  };

  const hapus = () => {
    hapusTemplate(item.code);
    toast(`[${item.code}] dihapus dari daftar`);
    onTutup();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Kepala ---- */}
      <div className="flex items-start justify-between gap-3 border-b border-line px-4.5 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-[1.05rem] font-bold">
            {baru ? "Template baru" : `[${item.code}]`}
          </div>
          {!baru && (
            <div className="mt-0.5 text-[0.78rem] text-muted">
              {item.urutanAturan !== null
                ? `Aturan pemicu ke-${item.urutanAturan} · ${item.berkas}`
                : `Belum punya pemicu · ${item.berkas}`}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup detail"
          className="shrink-0 cursor-pointer rounded-lg border-none bg-transparent text-[1rem] text-muted hover:text-text"
        >
          ✕
        </button>
      </div>

      {/* ---- Isi ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4.5 py-4">
        {!bolehUbah && (
          <div className="mb-4 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[0.84rem] text-[#92400e]">
            🔒 Peran <b>CS Agent</b> hanya bisa melihat. Perubahan template khusus
            Admin — sebagian besar template berisi dosis, dan satu salah ketik
            terkirim ke semua pelanggan sekaligus.
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3.5 max-mini:grid-cols-1">
          <div>
            <Label>Kode</Label>
            <input
              type="text"
              value={code}
              disabled={!bolehUbah}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PAKAI POC"
              className="w-full rounded-xl border border-line bg-green-soft px-3 py-2 font-mono text-[0.88rem] outline-none focus:bg-white disabled:opacity-60"
            />
          </div>
          <div>
            <Label>Kategori</Label>
            <select
              value={kategori}
              disabled={!bolehUbah}
              onChange={(e) => setKategori(e.target.value as KategoriTemplate)}
              className="w-full rounded-xl border border-line bg-green-soft px-3 py-2 outline-none disabled:opacity-60"
            >
              {KATEGORI_URUT.map((k) => (
                <option key={k} value={k}>
                  {KATEGORI_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---- Kata kunci ---- */}
        <div className="mb-4">
          <Label>Kata kunci pemicu</Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {/* Tiga keadaan, bukan dua. Sebagian pemicu terlalu rumit
                untuk diringkas jadi frasa — 8 dari 43 pada 4 Sep 2026,
                termasuk [PAKAI POC]. Menampilkan "belum ada" untuk
                template itu akan BERBOHONG: pemicunya ada, hanya tidak
                bisa ditampilkan. */}
            {kata.length === 0 && item.urutanAturan === null && (
              <span className="text-[0.84rem] text-muted">
                Belum ada — template ini tidak akan pernah terkirim otomatis.
              </span>
            )}
            {kata.length === 0 && item.urutanAturan !== null && (
              <span className="text-[0.84rem] text-[#92400e]">
                Pemicunya ada (aturan ke-{item.urutanAturan}), tetapi terlalu
                rumit untuk ditampilkan sebagai frasa. Lihat pola teknisnya di
                bawah.
              </span>
            )}
            {kata.map((k) => (
              <Chip
                key={k}
                onRemove={bolehUbah ? () => setKata(kata.filter((x) => x !== k)) : undefined}
              >
                {k}
              </Chip>
            ))}
          </div>
          {bolehUbah && (
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
                placeholder="ketik frasa lalu Enter — mis. dosis npk"
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
          )}
          <p className="mt-1.5 mb-0 text-[0.75rem] leading-relaxed text-muted">
            Tulis frasa biasa, bukan pola teknis. Sistem yang menyusunnya jadi
            pemicu.
            {!item.kataKunciUtuh && kata.length > 0 && (
              <>
                {" "}
                <b className="text-[#92400e]">
                  Daftar di atas belum lengkap — sebagian pemicu terlalu rumit
                  untuk diringkas jadi frasa.
                </b>
              </>
            )}
          </p>

          {/* Pola aslinya selalu bisa dilihat, supaya tidak ada bagian
              pemicu yang tersembunyi dari orang yang ingin memeriksanya. */}
          {item.polaAsli.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[0.78rem] font-semibold text-green-dark">
                Lihat pola teknis ({item.polaAsli.length})
              </summary>
              <ul className="mt-1.5 mb-0 list-none space-y-1 p-0">
                {item.polaAsli.map((p) => (
                  <li
                    key={p}
                    className="overflow-x-auto rounded-lg bg-green-soft px-2.5 py-1.5 font-mono text-[0.72rem] whitespace-pre text-text-2"
                  >
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 mb-0 text-[0.72rem] text-muted">
                Hanya untuk dibaca. Mengubah pola teknis butuh developer —
                pola yang salah tulis bisa menggantung server.
              </p>
            </details>
          )}
        </div>

        {item.unless.length > 0 && (
          <div className="mb-4 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[0.82rem] text-[#92400e]">
            <b>Pengecualian:</b> template ini sengaja <i>tidak</i> dipakai bila
            pesan mengandung pola{" "}
            <code className="font-mono">{item.unless.join(", ")}</code>.
          </div>
        )}

        {/* ---- Isi jawaban ---- */}
        <div className="mb-4">
          <Label>Isi jawaban</Label>
          <textarea
            rows={10}
            value={body}
            disabled={!bolehUbah}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Halo kak, …"
            className="w-full resize-y rounded-xl border border-line bg-green-soft px-3 py-2.5 leading-relaxed outline-none focus:bg-white disabled:opacity-60"
          />
          <p className="mt-1.5 mb-0 text-[0.75rem] text-muted">
            {body.length} karakter · dikirim apa adanya ke pelanggan, termasuk
            baris kosong dan emoji.
          </p>
        </div>

        {item.why && (
          <div className="mb-4 rounded-xl border border-line bg-green-soft px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-text-2">
            <b>Kenapa aman dijawab tanpa AI:</b> {item.why}
          </div>
        )}

        <div className="mb-4">
          <UjiCoba kodeIni={item.code} />
        </div>

        {/* ---- Statistik: ditunda ---- */}
        <div className="rounded-xl border border-dashed border-line bg-white px-3.5 py-3 text-[0.82rem] leading-relaxed text-muted">
          <b className="text-text-2">Statistik pemakaian — belum tersedia.</b>{" "}
          Berapa kali template ini menjawab dan kapan terakhir dipakai baru bisa
          dihitung setelah <code>/api/chat</code> menulis ke tabel{" "}
          <code>routing_log</code>. Ditunda atas keputusan pemilik proyek; angkanya
          sengaja tidak ditampilkan sebagai &ldquo;0&rdquo; supaya tidak terbaca
          seolah template ini tidak pernah terpakai.
        </div>
      </div>

      {/* ---- Kaki ---- */}
      {bolehUbah && (
        <div className="flex items-center gap-2.5 border-t border-line px-4.5 py-3 max-mini:flex-col-reverse max-mini:items-stretch">
          {!baru && (
            <button
              type="button"
              onClick={hapus}
              className="cursor-pointer rounded-xl border border-[#fecaca] bg-white px-4 py-2.5 font-bold text-[#b91c1c] hover:bg-[#fee2e2]"
            >
              Hapus
            </button>
          )}
          <div className="flex-1 max-mini:hidden" />
          <button
            type="button"
            onClick={onTutup}
            className="cursor-pointer rounded-xl border border-line bg-white px-4 py-2.5 font-bold text-text-2 hover:bg-green-soft"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={!berubah && !baru}
            className="cursor-pointer rounded-xl border-none bg-green px-5 py-2.5 font-bold text-white transition hover:bg-green-hover disabled:opacity-50"
          >
            {baru ? "Tambahkan" : "Simpan Perubahan"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Halaman ---------------- */

export default function TemplateManager() {
  const { status, items, ringkasan, error, perubahanLokal } = useTemplates();

  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState<KategoriTemplate | "semua">("semua");
  const [saring, setSaring] = useState<SaringStatus>("semua");
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [baru, setBaru] = useState(false);

  useEffect(() => {
    void muatTemplates();
  }, []);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return items.filter((i) => {
      if (kategori !== "semua" && i.kategori !== kategori) return false;
      if (saring === "aktif" && i.urutanAturan === null) return false;
      if (saring === "tanpa" && i.urutanAturan !== null) return false;
      if (!q) return true;
      // Cari juga di isi & kata kunci, bukan hanya kode: pertanyaan
      // paling umum adalah "tadi ada template soal ongkir, kodenya apa?"
      return (
        i.code.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q) ||
        i.kataKunci.some((k) => k.includes(q))
      );
    });
  }, [items, cari, kategori, saring]);

  const item = dipilih ? (items.find((i) => i.code === dipilih) ?? null) : null;
  const panelTerbuka = baru || item !== null;

  if (status === "memuat" || status === "idle") {
    return <p className="m-0 py-8 text-center text-muted">Memuat template…</p>;
  }

  if (status === "gagal") {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[0.9rem] text-[#b91c1c]">
        Gagal memuat daftar template: {error}
      </div>
    );
  }

  return (
    <div>
      {/* ---- Pemberitahuan sumber data ---- */}
      <div className="mb-4 rounded-xl border border-dashed border-green/40 bg-green-soft px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-text-2">
        <b className="text-green-dark">Sumber: berkas .md (sementara).</b>{" "}
        Perubahan di halaman ini hidup di memori tab ini saja — berkasnya tidak
        ikut berubah dan muat ulang mengembalikan semuanya. Tujuannya tabel{" "}
        <code>templates</code> di Supabase, yang belum bisa dibuat karena gangguan
        di sisi Supabase.
        {perubahanLokal > 0 && (
          <>
            {" "}
            <b className="text-[#b91c1c]">
              {perubahanLokal} perubahan belum tersimpan ke mana pun.
            </b>
          </>
        )}
      </div>

      {/* ---- Baris pencarian ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari kode, isi jawaban, atau kata kunci…"
          className="min-w-55 flex-1 rounded-xl border border-line bg-white px-3.5 py-2 outline-none"
        />
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value as KategoriTemplate | "semua")}
          aria-label="Saring kategori"
          className="rounded-xl border border-line bg-green-soft px-3 py-2 font-semibold text-text-2"
        >
          <option value="semua">Semua kategori</option>
          {KATEGORI_URUT.map((k) => (
            <option key={k} value={k}>
              {KATEGORI_LABEL[k]} ({ringkasan?.perKategori[k].total ?? 0})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setBaru(true);
            setDipilih(null);
          }}
          className="cursor-pointer rounded-xl border-none bg-green px-4 py-2 font-bold text-white transition hover:bg-green-hover"
        >
          + Template
        </button>
      </div>

      {/* ---- Chip status ---- */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["semua", `Semua (${ringkasan?.total ?? 0})`],
            ["aktif", `Aktif (${ringkasan?.punyaPemicu ?? 0})`],
            ["tanpa", `⚠ Tanpa pemicu (${ringkasan?.tanpaPemicu ?? 0})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSaring(key)}
            aria-pressed={saring === key}
            className={[
              "cursor-pointer rounded-[9px] border px-3.5 py-1.5 text-[0.84rem] font-semibold transition",
              saring === key
                ? "border-green bg-green-mint text-green-dark"
                : "border-line bg-white text-muted hover:bg-green-soft",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {saring === "tanpa" && (
        <p className="mt-0 mb-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-[#92400e]">
          Template di bawah ini <b>ada teksnya tapi tidak punya kata kunci
          pemicu</b>, jadi tidak pernah terkirim otomatis — pertanyaannya
          diteruskan ke AI dan berbayar. Menambahkan kata kunci di sini langsung
          menurunkan biaya chat.
        </p>
      )}

      {/* ---- Split view ---- */}
      <div className="flex h-142 min-h-0 gap-4 max-tablet:h-auto">
        {/* Daftar */}
        <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto max-tablet:max-h-142">
            {hasil.length === 0 ? (
              <p className="m-0 px-4 py-10 text-center text-muted">
                Tidak ada template yang cocok dengan penyaring ini.
              </p>
            ) : (
              hasil.map((i) => (
                <button
                  key={i.code}
                  type="button"
                  onClick={() => {
                    setDipilih(i.code);
                    setBaru(false);
                  }}
                  className={[
                    "block w-full cursor-pointer border-0 border-b border-line-soft px-4 py-3 text-left transition",
                    dipilih === i.code ? "bg-green-mint" : "bg-transparent hover:bg-green-soft",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot item={i} />
                    <span className="truncate font-mono text-[0.85rem] font-bold">
                      [{i.code}]
                    </span>
                    <span className="ml-auto shrink-0 rounded-md bg-green-soft px-2 py-0.5 text-[0.7rem] font-semibold text-muted">
                      {KATEGORI_LABEL[i.kategori]}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[0.82rem] leading-relaxed text-text-2">
                    {i.body.replace(/\s+/g, " ").slice(0, 140)}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-line px-4 py-2 text-[0.78rem] text-muted">
            Menampilkan {hasil.length} dari {items.length} template
          </div>
        </div>

        {/* Detail — kolom di desktop, overlay di ≤980px */}
        {panelTerbuka && (
          <div
            className={[
              "w-[46%] min-w-100 overflow-hidden rounded-2xl border border-line bg-white",
              "max-tablet:fixed max-tablet:inset-0 max-tablet:z-70 max-tablet:w-full",
              "max-tablet:min-w-0 max-tablet:rounded-none",
            ].join(" ")}
          >
            <Detail
              key={baru ? "__baru__" : (item?.code ?? "")}
              item={baru ? KOSONG : item!}
              baru={baru}
              onTutup={() => {
                setBaru(false);
                setDipilih(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
