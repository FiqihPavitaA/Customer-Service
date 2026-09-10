/* ===========================================================
   Pesanan contoh untuk tab "Pesanan" di halaman Chat.

   KENAPA DIBUAT DI SINI, BUKAN DITULIS KE DATABASE

   Godaannya adalah mengisi kolom order_id, order_status, dan
   tracking_no lewat SQL sekali jalan. Itu keliru dua kali:

     1. Data pesanan BUKAN milik tabel kita. Sumbernya API
        marketplace (tech-stack.md Fase 3). Menulis pesanan karangan
        ke `conversations` berarti nanti harus dibersihkan lagi
        sebelum data sungguhan masuk — dan tidak akan ada yang
        ingat baris mana yang karangan.

     2. Persis inilah masalah yang baru diperbaiki di f89ee86:
        angka karangan bercampur angka nyata, tanpa ada yang
        memberi tahu. Menghitung di layar berarti tidak ada satu
        baris pun di database yang perlu dipercaya.

   `lengkapi()` di lib/db/store.ts sudah sengaja mengisi
   order_status dan order_courier dengan null, dengan komentar
   "sengaja TIDAK dikarang isinya". Berkas ini tidak melanggar itu
   — ia menghitung di titik render dan menandainya sebagai contoh
   di layar.

   SEMUANYA DETERMINISTIK, TIDAK ADA Math.random()

   Angka acak sungguhan berubah tiap render: nomor pesanan yang
   dicari CS lenyap sedetik kemudian, dan pencarian tidak akan
   pernah bisa dipercaya. Semua di sini diturunkan dari id
   percakapan lewat hash — pola yang sama dengan perkiraanPembeli()
   di lib/catalog.ts.
   =========================================================== */

import type { Product } from "./db/types";

/** Percakapan buatan simulasi memang tidak punya pesanan. */
const AWALAN_SIMULASI = "sim_";

export type ItemPesanan = {
  sku: string;
  nama: string;
  qty: number;
  harga: number;
};

export type PesananDummy = {
  id: string;
  tanggal: string;
  status: string;
  kurir: string;
  resi: string;
  item: ItemPesanan[];
  ongkir: number;
  total: number;
};

/** Percakapan seminimal yang dibutuhkan — sengaja bukan tipe penuh. */
export type SumberPesanan = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  tracking_no: string | null;
  created_at: string;
};

/* -----------------------------------------------------------
   Hash
   -----------------------------------------------------------
   Satu benih per percakapan, lalu diputar untuk tiap bidang.
   Tanpa pemutaran, dua bidang yang rentangnya sama akan selalu
   bergerak bersamaan — misalnya kurir dan status yang selalu
   berpasangan tetap, yang langsung terlihat palsu begitu ada
   sepuluh percakapan di layar. */

function benih(teks: string): number {
  let h = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function putar(h: number, langkah: number): number {
  let x = (h + langkah * 0x9e3779b9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

function pilih<T>(arr: readonly T[], h: number): T {
  return arr[h % arr.length];
}

const STATUS = [
  "Menunggu pembayaran",
  "Sedang diproses",
  "Dalam pengiriman",
  "Selesai",
] as const;

const KURIR = ["JNE REG", "J&T Express", "SiCepat REG", "AnterAja", "Ninja Xpress"] as const;

/** Awalan resi tiap kurir — supaya nomornya tidak terlihat asal. */
const AWALAN_RESI: Record<string, string> = {
  "JNE REG": "JP",
  "J&T Express": "JX",
  "SiCepat REG": "SC",
  AnterAja: "AA",
  "Ninja Xpress": "NJ",
};

const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // tanpa I dan O — mudah tertukar 1 dan 0

/**
 * Harga per kategori, dalam rupiah.
 *
 * Angka kasar yang masuk akal untuk produk urban farming, BUKAN
 * harga sungguhan. Begitu katalog membawa harga betulan, seluruh
 * blok ini dibuang dan diganti p.harga.
 */
const RENTANG_HARGA: Record<string, [number, number]> = {
  "Nutrisi Tanaman": [18_000, 85_000],
  Pestisida: [25_000, 120_000],
  Benih: [12_000, 45_000],
  Hidroponik: [95_000, 450_000],
  "Pot & Polybag": [15_000, 90_000],
};
const HARGA_BAWAAN: [number, number] = [20_000, 150_000];

function hargaSku(sku: string, kategori: string, h: number): number {
  const [min, max] = RENTANG_HARGA[kategori] ?? HARGA_BAWAAN;
  const rentang = Math.floor((max - min) / 500) + 1;
  return min + (putar(h, sku.length) % rentang) * 500;
}

/**
 * Nomor pesanan — TIDAK butuh katalog.
 *
 * Dipisah dari buatPesananDummy() supaya penyaringan pencarian bisa
 * memakainya tanpa menunggu 373 SKU selesai dimuat. Kalau pencarian
 * bergantung pada katalog, mengetik nomor pesanan pada detik
 * pertama halaman terbuka akan menghasilkan "tidak ditemukan" —
 * kegagalan yang hilang sendiri setelah beberapa saat, dan karena
 * itu nyaris mustahil dilaporkan orang.
 *
 * @returns null bila percakapan ini buatan simulasi.
 */
export function idPesananDummy(c: SumberPesanan): string | null {
  if ((c.customer_id ?? "").startsWith(AWALAN_SIMULASI)) return null;
  if (c.order_id) return c.order_id;

  const h = benih(c.id);
  const t = new Date(c.created_at);
  const tanggal = Number.isNaN(t.getTime()) ? new Date() : t;

  const yy = String(tanggal.getFullYear()).slice(2);
  const mm = String(tanggal.getMonth() + 1).padStart(2, "0");
  const dd = String(tanggal.getDate()).padStart(2, "0");

  let ekor = "";
  for (let i = 0; i < 7; i++) {
    ekor += HURUF[putar(h, i + 3) % HURUF.length];
  }
  return `${yy}${mm}${dd}${ekor}`;
}

/** Nomor resi — juga tidak butuh katalog, dipakai pencarian lingkup resi. */
export function resiDummy(c: SumberPesanan): string | null {
  if ((c.customer_id ?? "").startsWith(AWALAN_SIMULASI)) return null;
  if (c.tracking_no) return c.tracking_no;

  const h = benih(c.id);
  const kurir = pilih(KURIR, putar(h, 11));
  let angka = "";
  for (let i = 0; i < 10; i++) angka += String(putar(h, i + 20) % 10);
  return AWALAN_RESI[kurir] + angka;
}

/**
 * Pesanan lengkap untuk panel kanan.
 *
 * @param produk katalog nyata; bila masih kosong (belum termuat),
 *        mengembalikan pesanan TANPA item alih-alih mengarang nama
 *        produk. Nama produk karangan di layar CS lebih berbahaya
 *        daripada daftar item yang kosong sesaat — yang pertama
 *        bisa terbaca sebagai stok yang benar-benar dikirim.
 */
export function buatPesananDummy(
  c: SumberPesanan,
  produk: readonly Product[],
): PesananDummy | null {
  const id = idPesananDummy(c);
  if (!id) return null;

  const h = benih(c.id);
  const kurir = pilih(KURIR, putar(h, 11));

  const item: ItemPesanan[] = [];
  if (produk.length > 0) {
    const jumlahBaris = 1 + (putar(h, 31) % 3); // 1–3 baris
    const dipakai = new Set<string>();
    for (let i = 0; i < jumlahBaris; i++) {
      const p = produk[putar(h, 40 + i * 7) % produk.length];
      if (dipakai.has(p.sku)) continue;
      dipakai.add(p.sku);
      item.push({
        sku: p.sku,
        nama: p.nama_produk,
        qty: 1 + (putar(h, 60 + i) % 3),
        harga: hargaSku(p.sku, p.kategori, h),
      });
    }
  }

  const subtotal = item.reduce((n, x) => n + x.harga * x.qty, 0);
  const ongkir = 9_000 + (putar(h, 91) % 13) * 1_000;

  const t = new Date(c.created_at);
  const dasar = Number.isNaN(t.getTime()) ? new Date() : t;
  const mundurHari = 1 + (putar(h, 77) % 9);
  const tanggal = new Date(dasar.getTime() - mundurHari * 86_400_000);

  return {
    id,
    tanggal: tanggal.toISOString(),
    status: pilih(STATUS, putar(h, 5)),
    kurir,
    resi: resiDummy(c) ?? "",
    item,
    ongkir,
    total: subtotal + ongkir,
  };
}

/** Rupiah tanpa desimal — "Rp 128.500". */
export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
