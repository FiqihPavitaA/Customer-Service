"use client";

/* ===========================================================
   Hook: pesanan pembeli untuk panel kanan halaman Chat.

   Membaca tabel orders LANGSUNG dari peramban — itu memang boleh:
   policy orders_select memberi SELECT ke semua akun login, dan
   tabelnya tidak memuat data pribadi pembeli (alamat/telepon ada di
   orders_raw, yang tertutup). Tidak ada route handler di antaranya,
   sama seperti halaman Chat membaca conversations.

   Satu kueri per percakapan yang dibuka, bukan per render: kriteria
   dihitung dari id percakapan dan hook dipasang ulang bersama
   InfoPanel lewat prop `key`.
   =========================================================== */

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import {
  filterOr,
  kriteriaPesanan,
  type PesananPembeli,
  type SumberPembeli,
} from "@/lib/pesananPembeli";

export type KeadaanPesanan = "lewat" | "memuat" | "siap" | "galat";

const KOLOM =
  "id, external_order_id, status, raw_status, total_amount, currency, " +
  "shipping_carrier, tracking_number, items, ship_by_date, order_created_at, order_updated_at";

const BATAS = 20;

export function usePesananPembeli(c: SumberPembeli): {
  keadaan: KeadaanPesanan;
  daftar: PesananPembeli[];
  galat: string | null;
} {
  const kriteria = kriteriaPesanan(c);
  const kunci = kriteria ? filterOr(kriteria) : "";

  const [hasil, setHasil] = useState<{ keadaan: KeadaanPesanan; daftar: PesananPembeli[]; galat: string | null }>({
    keadaan: kunci ? "memuat" : "lewat",
    daftar: [],
    galat: null,
  });

  useEffect(() => {
    if (!kunci) return;
    const sb = getSupabase();
    if (!sb) return;

    let batal = false;
    void (async () => {
      const { data, error } = await sb
        .from("orders")
        .select(KOLOM)
        .or(kunci)
        .order("order_created_at", { ascending: false, nullsFirst: false })
        .limit(BATAS);
      if (batal) return;
      if (error) {
        console.error("[pesanan pembeli]", error.message);
        setHasil({ keadaan: "galat", daftar: [], galat: error.message });
        return;
      }
      setHasil({ keadaan: "siap", daftar: (data ?? []) as unknown as PesananPembeli[], galat: null });
    })();

    return () => {
      batal = true;
    };
  }, [kunci]);

  return hasil;
}
