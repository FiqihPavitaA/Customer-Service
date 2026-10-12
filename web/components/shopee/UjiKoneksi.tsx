"use client";

/* ===========================================================
   Halaman uji koneksi Shopee.

   INI ALAT DIAGNOSA, BUKAN FITUR. Ia menjawab satu pertanyaan saja:
   "apakah aplikasi kita benar-benar bisa bicara dengan Shopee?"

   Sengaja TIDAK ditautkan dari rail. Tim CS tidak punya urusan di
   sini, dan menaruhnya di navigasi hanya membuat mereka mengira
   nomor pesanan di bawah adalah data toko yang sesungguhnya.

   Yang ditampilkan hanya `order_sn` dan statusnya, karena itu
   memang seluruh isi balasan get_order_list. Tidak ada nama, tidak
   ada alamat, tidak ada nomor telepon — bukan karena disembunyikan,
   tetapi karena endpoint ini memang tidak mengirimkannya.
   =========================================================== */

import { useEffect, useState } from "react";
import { Card, CardHead } from "@/components/ui/Card";
import { GhostButton, PageHead, Td, TableWrap, Th } from "@/components/ui/Bits";
import { headerBerSesi } from "@/lib/supabase/header";

type Diagnostik = {
  host: string;
  jalur: string;
  partner_id: string;
  shop_id: string;
  panjang_partner_key: number;
  rentang_hari: number;
  http?: number;
  request_id?: string;
  lama_ms?: number;
};

type Hasil =
  | { ok: true; diagnostik: Diagnostik; pesanan: { order_sn: string; order_status: string | null }[] }
  | { ok: false; diagnostik: Diagnostik; galat: string; saran: string };

export default function UjiKoneksi() {
  const [hasil, setHasil] = useState<Hasil | null>(null);
  /* Mulai dari true: halaman ini memang langsung menghubungi Shopee
     begitu dibuka, jadi "sedang memuat" adalah keadaan awalnya yang
     sebenarnya — bukan sesuatu yang perlu dinyalakan dari effect. */
  const [memuat, setMemuat] = useState(true);
  const [galatJaringan, setGalatJaringan] = useState<string | null>(null);
  /* Penghitung pemicu, pola yang sama dengan ContohPertanyaan.tsx.
     Tombol "Uji ulang" menaikkan angka ini, bukan memanggil fungsi
     pengambil data — supaya seluruh pengambilan tetap di satu tempat
     dan effect tidak memanggil setState lewat jalan belakang. */
  const [versi, setVersi] = useState(0);

  /* Dijalankan sendiri saat halaman dibuka. Aman: panggilannya
     membaca saja, gratis, dan tidak menyentuh Claude maupun Voyage. */
  useEffect(() => {
    let batal = false;

    void (async () => {
      try {
        const h = await headerBerSesi();
        const res = await fetch("/api/shopee/pesanan", {
          headers: h,
          cache: "no-store",
        });
        const data = await res.json();
        if (batal) return;
        if (!res.ok) {
          setHasil(null);
          setGalatJaringan(data?.error ?? `HTTP ${res.status}`);
          return;
        }
        setHasil(data as Hasil);
        setGalatJaringan(null);
      } catch (err) {
        if (batal) return;
        setHasil(null);
        setGalatJaringan((err as Error).message);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    /* Halaman ditutup sebelum Shopee menjawab: jawaban yang telat
       tidak boleh menimpa layar yang sudah tidak ada lagi. */
    return () => {
      batal = true;
    };
  }, [versi]);

  const ujiUlang = () => {
    setMemuat(true);
    setGalatJaringan(null);
    setVersi((v) => v + 1);
  };

  return (
    <div className="flex flex-col gap-4.5 p-5 max-mini:p-4">
      <PageHead title="Uji Koneksi Shopee">
        <GhostButton onClick={ujiUlang}>
          {memuat ? "Menguji…" : "Uji ulang"}
        </GhostButton>
      </PageHead>

      <p className="m-0 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#f59e0b] bg-[#fffbeb] px-3.5 py-2 text-[0.78rem] text-[#92400e]">
        <b>Alat diagnosa, bukan halaman kerja.</b> Isinya langsung dari sandbox
        Shopee lewat <code>get_order_list</code> — hanya nomor pesanan dan
        statusnya. Membaca saja; tidak ada apa pun yang dikirim ke Shopee.
      </p>

      <Card>
        <CardHead title="Keadaan" note="diperbarui tiap kali halaman dibuka" />
        {memuat && !hasil && <p className="m-0 text-[0.9rem] text-muted">Menghubungi Shopee…</p>}

        {galatJaringan && (
          <p className="m-0 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[0.88rem] text-[#b91c1c]">
            Gagal memanggil endpoint kita sendiri: {galatJaringan}
          </p>
        )}

        {hasil && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={[
                  "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                  hasil.ok ? "bg-green" : "bg-[#b91c1c]",
                ].join(" ")}
                aria-hidden
              />
              <b className={hasil.ok ? "text-green-dark" : "text-[#b91c1c]"}>
                {hasil.ok ? "Tersambung" : "Belum tersambung"}
              </b>
              {hasil.diagnostik.lama_ms !== undefined && (
                <span className="text-[0.78rem] text-muted">
                  {hasil.diagnostik.lama_ms} ms
                </span>
              )}
            </div>

            {!hasil.ok && (
              <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5">
                <div className="text-[0.88rem] font-bold text-[#b91c1c]">{hasil.galat}</div>
                <div className="mt-1 text-[0.82rem] text-[#7f1d1d]">{hasil.saran}</div>
              </div>
            )}

            <Keterangan d={hasil.diagnostik} />
          </div>
        )}
      </Card>

      {hasil?.ok && (
        <Card>
          <CardHead
            title={`Pesanan ${hasil.diagnostik.rentang_hari} hari terakhir`}
            note={`${hasil.pesanan.length} baris`}
          />
          {hasil.pesanan.length === 0 ? (
            <p className="m-0 text-[0.88rem] text-muted">
              Tersambung, tetapi tokonya belum punya pesanan dalam rentang ini.
              Buat pesanan uji lewat menu Test Order di konsol Shopee, lalu tekan
              &quot;Uji ulang&quot;. Daftar kosong di sini <b>bukan</b> kegagalan
              koneksi — tanda tangan dan tokennya sudah terbukti diterima.
            </p>
          ) : (
            <TableWrap minWidth={520}>
              <thead>
                <tr>
                  <Th>Nomor Pesanan</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {hasil.pesanan.map((p) => (
                  <tr key={p.order_sn}>
                    <Td>
                      <span className="font-mono text-[0.84rem]">{p.order_sn}</span>
                    </Td>
                    <Td>{p.order_status ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * Keterangan teknis.
 *
 * Nilainya sengaja dipilih: partner key hanya panjangnya (cukup untuk
 * menangkap kunci yang terpotong saat disalin), dan access_token
 * maupun sign tidak pernah ikut sama sekali. Apa pun yang muncul di
 * sini bisa dibaca siapa saja yang membuka devtools.
 */
function Keterangan({ d }: { d: Diagnostik }) {
  const baris: [string, string][] = [
    ["Host", d.host],
    ["Endpoint", d.jalur],
    ["Partner ID", d.partner_id],
    ["Shop ID", d.shop_id],
    ["Panjang partner key", `${d.panjang_partner_key} karakter`],
    ...(d.http !== undefined ? ([["HTTP", String(d.http)]] as [string, string][]) : []),
    ...(d.request_id ? ([["Request ID", d.request_id]] as [string, string][]) : []),
  ];

  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.82rem]">
      {baris.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="m-0 font-mono break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
