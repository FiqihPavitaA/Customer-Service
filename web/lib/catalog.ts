"use client";

/* ===========================================================
   Katalog produk sisi klien — pengganti catalog.js.
   Dipakai halaman Broadcast (Segmentasi Pelanggan) dan halaman
   Chat (tab Rincian Produk), sama seperti versi lama.

   Perbedaan dari catalog.js:
   - Sumbernya /api/products (dibaca server dari content/),
     bukan fetch('products.json') relatif yang gagal saat
     halaman dibuka lewat file://.
   - Hasilnya di-cache di level modul, jadi berpindah halaman
     tidak memuat ulang 373 SKU.
   =========================================================== */

import { useEffect, useState } from "react";
import type { Product } from "./db/types";

/** Contoh SKU bila /api/products gagal — sepadan PRODUCT_FALLBACK. */
const FALLBACK: Product[] = [
  { sku: "POC-BUAH-250", nama_produk: "INFARM - POC Buah 250 ml Pupuk Organik Cair untuk Fase Berbunga & Berbuah", kategori: "Nutrisi Tanaman" },
  { sku: "NT-FURADAN-1KG", nama_produk: "INFARM - Furadan 3GR Ukuran 1 Kg Insektisida & Nematisida", kategori: "Pestisida" },
  { sku: "NT-MAGNESIUM-1KG", nama_produk: "INFARM - Pupuk Magnesium Sulfat 1 Kg (MgSO4) Garam Inggris", kategori: "Nutrisi Tanaman" },
  { sku: "BCA-CMK-MICHA", nama_produk: "INFARM - Benih Cabai Keriting Micha Hibrida Bibit Cabe Pedas", kategori: "Benih" },
  { sku: "BCA-TMT-BIGMATO", nama_produk: "INFARM - Benih Tomat Big Mato Hibrida Bibit Tomat Besar", kategori: "Benih" },
  { sku: "BCA-MLN-SUNMELO", nama_produk: "INFARM - Benih Buah Melon Sunmelo Hibrida Bibit Melon Premium", kategori: "Benih" },
  { sku: "PKT-HIDRO-12LT", nama_produk: "INFARM - Paket Hidroponik Lengkap 12 Lubang Free Benih AB Mix Rockwool", kategori: "Hidroponik" },
  { sku: "BAG-PLANTER", nama_produk: "INFARM - Planter Bag 25 35 50 75 Liter Pot Tanaman Kain Tebal Premium", kategori: "Pot & Polybag" },
];

type CatalogState = { products: Product[]; loaded: boolean; total: number };

let cache: CatalogState | null = null;
let inflight: Promise<CatalogState> | null = null;

async function fetchCatalog(): Promise<CatalogState> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { total: number; products: Product[] };
      cache = { products: data.products, loaded: true, total: data.total };
    } catch {
      cache = { products: FALLBACK, loaded: false, total: FALLBACK.length };
    }
    inflight = null;
    return cache;
  })();

  return inflight;
}

/** Muat katalog sekali lalu pakai di komponen mana pun. */
export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>(
    cache ?? { products: [], loaded: false, total: 0 },
  );

  useEffect(() => {
    let hidup = true;
    fetchCatalog().then((s) => {
      if (hidup) setState(s);
    });
    return () => {
      hidup = false;
    };
  }, []);

  return state;
}

/** Pencarian nama/SKU — logika sama dengan searchProducts() lama. */
export function searchProducts(products: Product[], query: string, limit = 20) {
  const q = query.trim().toLowerCase();
  return products
    .filter(
      (p) =>
        !q ||
        p.nama_produk.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

/** Teks status katalog di bawah kotak pencarian. */
export function catalogStatusText(state: CatalogState) {
  return state.loaded
    ? `${state.total} SKU termuat dari products.json`
    : `Mode contoh (${state.products.length} SKU) — katalog penuh gagal dimuat.`;
}

/**
 * Perkiraan jumlah pembeli per SKU.
 * Sengaja hasil hash, bukan acak, supaya angkanya tidak berubah
 * setiap render (persis hashCount() di broadcast.js). Diganti
 * data transaksi nyata setelah integrasi API pesanan.
 */
export function perkiraanPembeli(sku: string, min = 8, max = 95) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) >>> 0;
  return min + (h % (max - min + 1));
}
