/* ===========================================================
   Pembantu format tampilan (Step 6b).
   Dipisah dari data supaya seed menyimpan waktu dalam ISO 8601
   (bentuk timestamptz Supabase), sementara UI tetap menampilkan
   format yang sama dengan halaman HTML lama.
   =========================================================== */

const WIB = "Asia/Jakarta";

/** '14:06' — jam pada daftar percakapan. */
export function jam(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** '06/24 14:06' — stempel waktu di bawah gelembung chat. */
export function stempel(iso: string) {
  const d = new Date(iso);
  const tgl = d.toLocaleDateString("id-ID", {
    timeZone: WIB,
    month: "2-digit",
    day: "2-digit",
  });
  return `${tgl.replace("/", "/")} ${jam(iso)}`;
}

/** '24 Juni 2026' — pemisah hari di aliran chat. */
export function tanggalPanjang(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** 'DM' — inisial avatar dari nama pengguna marketplace. */
export function inisial(nama: string | null | undefined) {
  const bersih = (nama || "?").replace(/\*/g, "");
  const bagian = bersih.split(/[\s._-]+/).filter(Boolean);
  if (!bagian.length) return "?";
  return bagian
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** 1.234 — angka dengan pemisah ribuan gaya Indonesia. */
export function angka(n: number) {
  return n.toLocaleString("id-ID");
}

/** 75,8 — persentase satu desimal, koma sebagai pemisah desimal. */
export function persen(bagian: number, total: number, desimal = 1) {
  if (!total) return "0";
  return ((bagian / total) * 100).toFixed(desimal).replace(".", ",");
}
