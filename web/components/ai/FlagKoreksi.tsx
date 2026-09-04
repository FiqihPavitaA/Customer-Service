"use client";

/* ===========================================================
   Flag Koreksi Jawaban AI — port dari ai-flag.js + flag.css.

   Tetap sub-tab di dalam /ai, bukan halaman sendiri, persis
   seperti versi lama. Rail navigasi tidak punya ikon untuk ini
   (claude.md hanya menyebut 🏠💬📦🤖📣📈⚙️👤), jadi menaruhnya
   di route terpisah justru membuatnya tidak bisa dijangkau.

   BEDA PENTING DARI VERSI LAMA
   flag-store.js menyimpan seluruh flag di localStorage. Akibatnya
   daftar flag tiap admin berbeda, dan hasil review satu orang
   tidak pernah terlihat oleh yang lain — laporan yang sudah
   diputuskan tetap tampak "menunggu" di layar rekannya. Sekarang
   datanya lewat lib/db/store.ts, yang begitu Supabase menyala
   menulis ke tabel ai_flags dan menyegarkan lewat Realtime.

   Peran juga tidak lagi datang dari tombol localStorage, melainkan
   dari kolom profiles.role — kolom yang sama yang dipakai RLS
   is_admin(). Tombol pengganti peran hanya muncul di mode demo,
   supaya perbedaan tampilan Admin vs CS tetap bisa diperagakan.
   =========================================================== */

import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Pill, TableWrap, Td, Th } from "@/components/ui/Bits";
import { useAuth } from "@/lib/auth";
import { DB_MODE, decideFlag, useAiFlags, type AiFlagRow } from "@/lib/db";

/* ---------------- Peta label ---------------- */

const KATEGORI: Record<AiFlagRow["category"], string> = {
  produk: "Produk",
  kebijakan: "Kebijakan",
  dosis: "Dosis",
  harga: "Harga",
  lainnya: "Lainnya",
};

const STATUS: Record<AiFlagRow["status"], { label: string; pill: string }> = {
  menunggu: { label: "Menunggu Review", pill: "wait" },
  disetujui: { label: "Disetujui", pill: "done" },
  ditolak: { label: "Ditolak", pill: "cancel" },
};

const FILTER: { key: "all" | AiFlagRow["status"]; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "menunggu", label: "Menunggu" },
  { key: "disetujui", label: "Disetujui" },
  { key: "ditolak", label: "Ditolak" },
];

/** Tanggal gaya Indonesia; sepadan dengan fmtDate() di flag-store.js. */
function fmtTanggal(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ---------------- Potongan tampilan ---------------- */

function CatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-lg bg-green-mint px-2.5 py-0.5 text-[0.7rem] font-bold whitespace-nowrap text-green-dark">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-line bg-white p-5.5 shadow-card max-mini:p-4">
      {title && <h3 className="mt-0 mb-3.5 text-base font-bold">{title}</h3>}
      {children}
    </div>
  );
}

const KOTAK = {
  neutral: "bg-green-soft border-line-soft text-text",
  wrong: "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]",
  correct: "bg-green-mint border-[#bbf7d0] text-[#14532d]",
} as const;

const KOTAK_LABEL = {
  neutral: "text-text-2",
  wrong: "text-[#b91c1c]",
  correct: "text-green-dark",
} as const;

function AnswerBox({
  kind,
  label,
  children,
}: {
  kind: keyof typeof KOTAK;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-3 rounded-xl border px-4 py-3.5 text-[0.9rem] leading-relaxed ${KOTAK[kind]}`}>
      <span
        className={`mb-1.5 block text-[0.74rem] font-bold tracking-[0.03em] uppercase ${KOTAK_LABEL[kind]}`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/* ---------------- Detail ---------------- */

function Detail({
  flag,
  onBack,
}: {
  flag: AiFlagRow;
  onBack: () => void;
}) {
  const toast = useToast();
  const { profile, isAdmin } = useAuth();
  const [bukaTolak, setBukaTolak] = useState(false);
  const [alasan, setAlasan] = useState("");

  const st = STATUS[flag.status];

  const setujui = () => {
    decideFlag(flag.id, "disetujui", profile?.id ?? null);
    toast("Flag disetujui — tersimpan sebagai draft revisi KB ✅");
  };

  const tolak = () => {
    decideFlag(flag.id, "ditolak", profile?.id ?? null, alasan);
    setBukaTolak(false);
    toast("Flag ditolak");
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3.5 cursor-pointer border-none bg-transparent p-0 text-[0.92rem] font-bold text-green-dark hover:underline"
      >
        ← Kembali ke daftar
      </button>

      <Card>
        <div className="mb-1.5 flex flex-wrap items-center gap-3">
          <span className="text-[1.1rem] font-extrabold">{flag.code ?? flag.id}</span>
          <Pill kind={st.pill}>{st.label}</Pill>
          <CatPill>{KATEGORI[flag.category]}</CatPill>
        </div>
        <div className="text-[0.82rem] text-muted">
          Dilaporkan oleh <b>{flag.reporter_name ?? "—"}</b> ·{" "}
          {fmtTanggal(flag.created_at)}
        </div>
      </Card>

      <Card title="Percakapan">
        <AnswerBox kind="neutral" label="Pesan Pelanggan">
          {flag.customer_message || "—"}
        </AnswerBox>
        <AnswerBox
          kind="wrong"
          label={`Jawaban AI yang Di-flag${flag.ai_action ? " · " + flag.ai_action : ""}`}
        >
          {flag.ai_answer || "—"}
        </AnswerBox>
        <AnswerBox kind="correct" label="Jawaban yang Seharusnya">
          {flag.correct_answer || "—"}
        </AnswerBox>
      </Card>

      <Card title="Info Laporan">
        <div className="grid grid-cols-2 gap-3.5 max-mobile:grid-cols-1">
          {[
            ["Kategori", KATEGORI[flag.category]],
            ["Nama CS Pelapor", flag.reporter_name ?? "—"],
            ["Tindakan AI Saat Itu", flag.ai_action ?? "—"],
            ["Status", st.label],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 text-[0.78rem] text-muted">{label}</div>
              <div className="font-semibold">{value}</div>
            </div>
          ))}
        </div>
        {flag.note && (
          <div className="mt-3.5">
            <AnswerBox kind="neutral" label="Catatan Tambahan">
              {flag.note}
            </AnswerBox>
          </div>
        )}
      </Card>

      <Card title="Log Waktu">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-3 text-[0.86rem] max-mobile:flex-wrap">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden />
            <span className="w-30 shrink-0 text-muted max-mobile:w-auto">Dibuat</span>
            <span className="font-semibold">
              {fmtTanggal(flag.created_at)} oleh {flag.reporter_name ?? "—"}
            </span>
          </div>
          <div className="flex items-baseline gap-3 text-[0.86rem] max-mobile:flex-wrap">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${flag.reviewed_at ? "bg-green" : "bg-[#cbd5e1]"}`}
              aria-hidden
            />
            <span className="w-30 shrink-0 text-muted max-mobile:w-auto">Direview</span>
            <span className="font-semibold">
              {flag.reviewed_at ? fmtTanggal(flag.reviewed_at) : "Belum direview"}
            </span>
          </div>
        </div>
      </Card>

      <Card title="Keputusan Review">
        {flag.status === "menunggu" ? (
          isAdmin ? (
            <>
              <div className="mt-2 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={setujui}
                  className="cursor-pointer rounded-[10px] border-none bg-green px-5 py-2.5 font-bold text-white transition hover:bg-green-hover max-mobile:min-w-35 max-mobile:flex-1"
                >
                  ✓ Setujui — Jadikan Draft Revisi KB
                </button>
                <button
                  type="button"
                  onClick={() => setBukaTolak(true)}
                  className="cursor-pointer rounded-[10px] border border-[#fecaca] bg-white px-5 py-2.5 font-bold text-[#b91c1c] transition hover:bg-[#fee2e2] max-mobile:min-w-35 max-mobile:flex-1"
                >
                  ✕ Tolak
                </button>
              </div>

              {bukaTolak && (
                <div className="mt-3">
                  <label
                    htmlFor="alasanTolak"
                    className="mb-1.5 block text-[0.84rem] font-semibold text-text-2"
                  >
                    Alasan Penolakan (opsional)
                  </label>
                  <textarea
                    id="alasanTolak"
                    rows={3}
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="mis. duplikat laporan, sudah diperbaiki sebelumnya, dsb."
                    className="w-full resize-y rounded-[10px] border border-line bg-green-soft px-3 py-2.5 outline-none focus:bg-white"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBukaTolak(false)}
                      className="cursor-pointer rounded-[9px] border border-line bg-white px-3.5 py-1.5 text-[0.84rem] font-bold text-text-2 hover:bg-green-soft"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={tolak}
                      className="cursor-pointer rounded-[10px] border border-[#fecaca] bg-white px-5 py-2 font-bold text-[#b91c1c] hover:bg-[#fee2e2]"
                    >
                      Konfirmasi Tolak
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[0.84rem] text-[#92400e]">
              🔒 Hanya Admin/Owner yang dapat menyetujui atau menolak flag ini.
              Status saat ini: <b>{st.label}</b>.
            </div>
          )
        ) : flag.status === "disetujui" ? (
          <>
            <p className="mt-0 mb-0">
              Disetujui pada {fmtTanggal(flag.reviewed_at)}.
            </p>
            <div className="mt-3.5 rounded-xl border border-dashed border-green bg-green-soft px-4 py-3.5">
              <div className="mb-1.5 font-bold text-green-dark">
                📄 Draft Revisi Knowledge Base
              </div>
              <div>
                <b>Kategori:</b> {KATEGORI[flag.category]}
              </div>
              <div className="mt-1.5">{flag.correct_answer}</div>
              <div className="mt-2 text-[0.78rem] leading-relaxed text-muted">
                Tersimpan sebagai draft revisi — <b>belum otomatis mengubah</b>{" "}
                berkas Knowledge Base asli (<code>products.json</code>, berkas FAQ,{" "}
                <code>claude-core.md</code>). Tim pengelola KB perlu
                menerapkannya sendiri.
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mt-0 mb-3">Ditolak pada {fmtTanggal(flag.reviewed_at)}.</p>
            {flag.reject_reason ? (
              <AnswerBox kind="neutral" label="Alasan Penolakan">
                {flag.reject_reason}
              </AnswerBox>
            ) : (
              <p className="m-0 text-[0.86rem] text-muted">
                Tidak ada alasan penolakan yang dicatat.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Daftar ---------------- */

export default function FlagKoreksi() {
  const semua = useAiFlags();
  const { profile, isAdmin, isDemo } = useAuth();

  const [filter, setFilter] = useState<"all" | AiFlagRow["status"]>("all");
  const [dibuka, setDibuka] = useState<string | null>(null);
  /* Hanya untuk demo: memperagakan tampilan peran 'cs' tanpa membuat
     akun kedua. Di mode Supabase, peran datang dari profiles.role. */
  const [peranDemo, setPeranDemo] = useState<"admin" | "cs">("admin");

  const sebagaiAdmin = isDemo ? peranDemo === "admin" : isAdmin;
  const namaSaya = profile?.username ?? "";

  /* Peran 'cs' hanya melihat laporannya sendiri — sama seperti
     flagScopedList() di ai-flag.js. Ini kenyamanan tampilan, bukan
     pengaman: RLS ai_flags_read mengizinkan semua CS membaca, supaya
     laporan yang sama tidak dilaporkan dua kali oleh orang berbeda. */
  const terlihat = useMemo(() => {
    if (sebagaiAdmin) return semua;
    return semua.filter(
      (f) => (f.reporter_name ?? "").toLowerCase() === namaSaya.toLowerCase(),
    );
  }, [semua, sebagaiAdmin, namaSaya]);

  const jumlah = useMemo(
    () => ({
      all: terlihat.length,
      menunggu: terlihat.filter((f) => f.status === "menunggu").length,
      disetujui: terlihat.filter((f) => f.status === "disetujui").length,
      ditolak: terlihat.filter((f) => f.status === "ditolak").length,
    }),
    [terlihat],
  );

  const baris = useMemo(
    () => terlihat.filter((f) => filter === "all" || f.status === filter),
    [terlihat, filter],
  );

  const flagDibuka = dibuka ? (semua.find((f) => f.id === dibuka) ?? null) : null;

  if (flagDibuka) {
    return <Detail flag={flagDibuka} onBack={() => setDibuka(null)} />;
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 text-[1.4rem] font-bold max-mini:text-[1.2rem]">
          🚩 Flag Koreksi Jawaban AI
        </h2>
        <p className="mt-1 mb-0 text-[0.88rem] text-muted">
          Laporan jawaban AI yang keliru, untuk direview sebelum jadi revisi
          Knowledge Base.
        </p>
      </div>

      {/* ---- Penukar peran: demo saja ---- */}
      {isDemo && (
        <div className="mb-4.5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <div className="flex gap-1.5">
            {(["admin", "cs"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPeranDemo(r)}
                className={[
                  "cursor-pointer rounded-[9px] border px-3.5 py-1.5 text-[0.84rem] font-bold",
                  peranDemo === r
                    ? "border-green bg-green-mint text-green-dark"
                    : "border-line bg-white text-text-2",
                ].join(" ")}
              >
                {r === "admin" ? "Admin/Owner" : "CS Agent"}
              </button>
            ))}
          </div>
          <p className="m-0 min-w-55 flex-1 text-[0.78rem] text-muted">
            Penukar peran ini <b>hanya ada di mode demo</b>. Setelah Supabase
            menyala, peran diambil dari kolom <code>profiles.role</code> —
            kolom yang sama yang dipakai aturan RLS.
          </p>
        </div>
      )}

      <div className="mb-3.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.82rem] text-text-2">
        {sebagaiAdmin ? (
          <>
            🛡️ <b>Peran Admin/Owner</b> — menampilkan seluruh flag dari semua CS.
            Buka detail untuk menyetujui atau menolak.
          </>
        ) : (
          <>
            🧑‍💼 <b>Peran CS Agent</b> — menampilkan flag yang dilaporkan oleh{" "}
            <b>{namaSaya || "Anda"}</b> saja. Persetujuan hanya dapat dilakukan
            Admin/Owner.
          </>
        )}
      </div>

      {/* ---- Penyaring status ---- */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {FILTER.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={[
              "cursor-pointer rounded-[9px] border px-3.5 py-1.5 text-[0.84rem] font-semibold transition",
              filter === f.key
                ? "border-green bg-green-mint text-green-dark"
                : "border-line bg-white text-muted hover:bg-green-soft",
            ].join(" ")}
          >
            {f.label} ({jumlah[f.key]})
          </button>
        ))}
      </div>

      {baris.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-muted">
          Tidak ada flag pada penyaring ini.
        </div>
      ) : (
        <>
          <TableWrap minWidth={760}>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Pesan Pelanggan</Th>
                <Th>Kategori</Th>
                <Th>Pelapor</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((f) => (
                <tr key={f.id}>
                  <Td className="whitespace-nowrap">{fmtTanggal(f.created_at)}</Td>
                  <Td className="max-w-65">
                    <div className="line-clamp-2 font-semibold text-text">
                      {f.customer_message || "—"}
                    </div>
                  </Td>
                  <Td>
                    <CatPill>{KATEGORI[f.category]}</CatPill>
                  </Td>
                  <Td>{f.reporter_name ?? "—"}</Td>
                  <Td>
                    <Pill kind={STATUS[f.status].pill}>{STATUS[f.status].label}</Pill>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setDibuka(f.id)}
                      className="cursor-pointer border-none bg-transparent p-0 font-semibold text-green-dark hover:underline"
                    >
                      Lihat Detail
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="mt-2.5 mb-0 text-[0.82rem] text-muted">
            Menampilkan {baris.length} laporan
            {DB_MODE === "memory" && " — data contoh, keputusan hilang saat halaman dimuat ulang"}
            .
          </p>
        </>
      )}
    </div>
  );
}
