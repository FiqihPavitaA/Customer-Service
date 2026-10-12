"use client";

/* ===========================================================
   Bagian "Toko Terhubung" di Pengaturan → Integrasi Marketplace.

   Membaca /api/shopee/toko (bukan tabelnya langsung — tabel itu
   berisi token dan memang tertutup untuk peramban). Tombol
   "Hubungkan Toko Shopee" adalah tautan biasa ke /api/shopee/auth-url
   yang mengarahkan ke halaman persetujuan Shopee; sesudah disetujui,
   /shopee/callback mengembalikan ke /settings?shopee=ok|gagal.

   Pesan hasilnya dibaca dari window.location di dalam effect, bukan
   lewat useSearchParams — yang terakhir menuntut batas Suspense di
   halaman induk hanya untuk satu parameter sekali baca.
   =========================================================== */

import { useEffect, useState } from "react";
import { headerBerSesi } from "@/lib/supabase/header";
import { stempel } from "@/lib/format";

type Toko = {
  id: string;
  platform: string;
  external_shop_id: string;
  shop_name: string | null;
  region: string | null;
  is_active: boolean;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  authorization_expires_at: string | null;
  updated_at: string;
};

type Hasil = { shopee: "ok" | "gagal"; toko?: string; sebab?: string; catatan?: string } | null;

const LABEL_SEBAB: Record<string, string> = {
  parameter_kurang: "Shopee kembali tanpa code atau shop_id.",
  invalid_code: "Kode otorisasi sudah kedaluwarsa atau sudah dipakai. Coba hubungkan lagi.",
  error_auth: "Kode otorisasi ditolak Shopee. Coba hubungkan lagi.",
  error_sign: "Tanda tangan ditolak — periksa partner key dan host.",
  konfigurasi: "Variabel lingkungan Shopee belum lengkap di server.",
  database: "Token diterima Shopee tetapi gagal disimpan. Lihat log server.",
};

export default function TokoTerhubung() {
  const [daftar, setDaftar] = useState<Toko[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<Hasil>(null);

  useEffect(() => {
    let batal = false;
    void (async () => {
      /* Pesan hasil otorisasi dibaca dulu, di dalam IIFE yang sama
         dengan pengambilan data — supaya tidak ada setState sinkron di
         badan effect (eslint react-hooks/set-state-in-effect). */
      try {
        const q = new URLSearchParams(window.location.search);
        const s = q.get("shopee");
        if (s === "ok" || s === "gagal") {
          setHasil({
            shopee: s,
            toko: q.get("toko") ?? undefined,
            sebab: q.get("sebab") ?? undefined,
            catatan: q.get("catatan") ?? undefined,
          });
          /* Bersihkan URL supaya refresh tidak menampilkan pesan lama. */
          window.history.replaceState(null, "", "/settings");
        }
      } catch {
        /* window tidak tersedia — biarkan tanpa pesan. */
      }

      try {
        const res = await fetch("/api/shopee/toko", { headers: await headerBerSesi(), cache: "no-store" });
        const data = await res.json();
        if (batal) return;
        if (!res.ok) {
          setGalat(data?.error ?? `HTTP ${res.status}`);
          return;
        }
        setDaftar(data.toko as Toko[]);
      } catch (err) {
        if (!batal) setGalat((err as Error).message);
      }
    })();
    return () => {
      batal = true;
    };
  }, [hasil]);

  return (
    <div className="mb-5 rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/0.04)] max-mini:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[0.95rem] font-bold">Toko Terhubung</div>
        <a
          href="/api/shopee/auth-url"
          className="rounded-[9px] bg-green px-3.5 py-1.5 text-[0.84rem] font-bold text-white no-underline transition hover:bg-green-hover"
        >
          Hubungkan Toko Shopee
        </a>
      </div>

      {hasil?.shopee === "ok" && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-line bg-green-soft px-3.5 py-2.5 text-[0.86rem] text-green-dark"
        >
          Toko <b>{hasil.toko}</b> berhasil dihubungkan.
          {hasil.catatan === "nama_toko_belum" && " Nama tokonya belum terbaca; akan terisi saat sinkronisasi."}
        </p>
      )}
      {hasil?.shopee === "gagal" && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[0.86rem] text-[#b91c1c]"
        >
          Gagal menghubungkan: {LABEL_SEBAB[hasil.sebab ?? ""] ?? `kode galat ${hasil.sebab}`}
        </p>
      )}

      {galat && (
        <p className="m-0 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[0.86rem] text-[#b91c1c]">
          Daftar toko tidak terbaca: {galat}
        </p>
      )}

      {!galat && daftar === null && <p className="m-0 text-[0.86rem] text-muted">Memuat…</p>}

      {daftar && daftar.length === 0 && (
        <p className="m-0 text-[0.86rem] text-muted">
          Belum ada toko yang terhubung lewat API. Tekan &quot;Hubungkan Toko Shopee&quot;,
          lalu masuk dengan akun penjual toko yang ingin dihubungkan.
        </p>
      )}

      {daftar && daftar.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {daftar.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-3.5">
              <div className="min-w-0">
                <div className="truncate font-bold">
                  {t.shop_name ?? `Toko ${t.external_shop_id}`}
                  <span className="ml-2 rounded bg-green-mint px-1.5 py-0.5 text-[0.66rem] font-extrabold uppercase text-green-dark">
                    {t.platform}
                    {t.region ? ` · ${t.region}` : ""}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[0.72rem] text-muted">shop_id {t.external_shop_id}</div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.76rem]">
                  <dt className="text-muted">Access token</dt>
                  <dd className="m-0">{t.access_token_expires_at ? `sampai ${stempel(t.access_token_expires_at)}` : "—"}</dd>
                  <dt className="text-muted">Refresh token</dt>
                  <dd className="m-0">{t.refresh_token_expires_at ? `sampai ${stempel(t.refresh_token_expires_at)}` : "—"}</dd>
                  <dt className="text-muted">Otorisasi toko</dt>
                  <dd className="m-0">{t.authorization_expires_at ? `sampai ${stempel(t.authorization_expires_at)}` : "—"}</dd>
                </dl>
              </div>
              <span
                className={`shrink-0 text-[0.82rem] font-bold ${t.is_active ? "text-green-dark" : "text-[#d97706]"}`}
              >
                ● {t.is_active ? "Aktif" : "Perlu otorisasi ulang"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
