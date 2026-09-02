/* ===========================================================
   Katalog produk — pengganti catalog.js + fetch('products.json')
   di halaman lama (Step 6b).

   Kenapa lewat API dan bukan import langsung: products.json
   berukuran ~124 KB berisi 373 SKU. Meng-import-nya ke komponen
   klien akan ikut masuk ke bundel JavaScript setiap halaman.
   Lewat route ini isinya dibaca sekali di server, diratakan,
   lalu di-cache oleh browser.

   Berkasnya sama dengan yang dipakai system prompt
   (web/content/products.json) — satu sumber, tidak digandakan.
   =========================================================== */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { Product } from "@/lib/db/types";

type ProductsFile = {
  metadata?: { total_sku?: number };
  produk_per_kategori?: Record<string, Omit<Product, "kategori">[]>;
};

/** Dibaca sekali per proses; isinya statis selama runtime. */
let cache: { total: number; products: Product[] } | null = null;

function loadCatalog() {
  if (cache) return cache;

  const raw = readFileSync(join(process.cwd(), "content", "products.json"), "utf8");
  const data = JSON.parse(raw) as ProductsFile;

  const products: Product[] = [];
  for (const [kategori, items] of Object.entries(data.produk_per_kategori ?? {})) {
    items.forEach((p) => products.push({ ...p, kategori } as Product));
  }

  cache = { total: data.metadata?.total_sku ?? products.length, products };
  return cache;
}

export async function GET() {
  try {
    const { total, products } = loadCatalog();
    return NextResponse.json(
      { total, products },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (err) {
    // Sama seperti catalog.js: kegagalan katalog tidak boleh
    // mematikan halaman — kembalikan daftar kosong + pesannya.
    return NextResponse.json(
      { total: 0, products: [], error: (err as Error).message },
      { status: 500 },
    );
  }
}
