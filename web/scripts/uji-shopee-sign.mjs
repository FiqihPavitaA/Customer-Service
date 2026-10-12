/* ===========================================================
   Tanda tangan permintaan Shopee.

     npm run uji-shopee-sign

   Biaya Rp 0. Tidak ada jaringan — tidak memanggil Shopee sama
   sekali, hanya menghitung HMAC atas nilai tetap.

   KENAPA UJI INI ADA

   Tanda tangan yang salah sedikit saja dijawab `error_sign`, dan
   kata itu tidak menunjuk ke bagian mana pun. Pada 30 Sep 2026
   penyebabnya ternyata host yang keliru, bukan rumusnya — tetapi
   dua hari habis justru karena rumusnya tidak pernah bisa
   dinyatakan benar secara terpisah. Berkas ini membuat pernyataan
   itu mungkin: kalau uji ini lulus, rumusnya bukan tersangka.

   NILAI HARAPANNYA DARI MANA

   Bukan dari menjalankan kode ini lalu menyalin keluarannya — itu
   hanya mengunci bug kalau ada. Vektor pertama diverifikasi dengan
   OpenSSL, implementasi yang sama sekali terpisah dari Node:

     printf '%s' "1000000/api/v2/public/get_shops_by_partner1700000000" \
       | openssl dgst -sha256 -hmac "kunci-uji-shopee"

   Keluarannya identik dengan yang diharapkan di bawah.
   =========================================================== */

import {
  HOST_PRODUKSI,
  HOST_SANDBOX,
  buatSign,
  paramPublik,
  paramToko,
  susunUrl,
  timestampSekarang,
} from "../lib/shopee/tandaTangan.ts";
import { BATAS_RENTANG_HARI_SHOPEE, parameterPesanan } from "../lib/shopee/pesanan.ts";

let lulus = 0;
let gagal = 0;

function uji(nama, dapat, harap) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  if (sama) {
    lulus++;
    console.log(`  v ${nama}`);
  } else {
    gagal++;
    console.log(`  X ${nama}`);
    console.log(`      harap : ${JSON.stringify(harap)}`);
    console.log(`      dapat : ${JSON.stringify(dapat)}`);
  }
}

const KRED = { partnerId: "1000000", partnerKey: "kunci-uji-shopee" };
const TS = 1700000000;

console.log("\nNilai tetap — diverifikasi silang dengan OpenSSL");

uji(
  "endpoint publik",
  paramPublik(KRED, "/api/v2/public/get_shops_by_partner", TS).sign,
  "993924c9dc54315eec741560410a7e388b0691dadbbf3251d82d3e6f14daea4f",
);

uji(
  "endpoint toko",
  paramToko(KRED, "/api/v2/order/get_order_list", "token-uji-abc", 7000001, TS).sign,
  "7ccc5a0e4f033fbeecbc291a16e5c7e0a7fb7172c0ea3f6c3da8fb62a7666271",
);

console.log("\nBentuk parameter");

uji("publik tidak membawa access_token", "access_token" in paramPublik(KRED, "/x", TS), false);
uji("publik tidak membawa shop_id", "shop_id" in paramPublik(KRED, "/x", TS), false);
uji(
  "toko membawa keempat parameter wajib",
  Object.keys(paramToko(KRED, "/x", "t", 1, TS)).sort(),
  ["access_token", "partner_id", "shop_id", "sign", "timestamp"],
);
uji("timestamp berupa teks, bukan angka", typeof paramPublik(KRED, "/x", TS).timestamp, "string");
uji("shop_id angka diubah jadi teks", paramToko(KRED, "/x", "t", 7000001, TS).shop_id, "7000001");

console.log("\nSifat rumus yang tidak boleh berubah");

/* Kalau "ab" dan ["a","b"] berbeda, berarti ada pemisah yang
   diselipkan di antara bagian. Satu koma saja membuat setiap
   permintaan ditolak. */
uji(
  "bagian disambung TANPA pemisah apa pun",
  buatSign("k", ["ab"]) === buatSign("k", ["a", "b"]),
  true,
);

/* Urutan bagian adalah bagian dari rumusnya. Uji ini gagal kalau
   seseorang menyusun ulang argumen "supaya lebih rapi". */
uji("urutan bagian berpengaruh", buatSign("k", ["a", "b"]) !== buatSign("k", ["b", "a"]), true);

uji("kunci berbeda menghasilkan tanda tangan berbeda", buatSign("k1", ["a"]) !== buatSign("k2", ["a"]), true);

uji("keluarannya 64 huruf hex kecil", /^[0-9a-f]{64}$/.test(buatSign("k", ["a"])), true);

/* Spasi di ujung kunci adalah kesalahan menyalin yang paling sering
   terjadi, dan akibatnya tanda tangan yang sama sekali berbeda —
   bukan "hampir benar". Dicatat di sini supaya alasan itu kelihatan
   saat seseorang menelusuri error_sign berikutnya. */
uji(
  "spasi di ujung kunci mengubah hasilnya total",
  buatSign("kunci", ["a"]) !== buatSign("kunci ", ["a"]),
  true,
);

console.log("\nHost dan URL");

uji("host sandbox adalah cluster Singapura", HOST_SANDBOX.includes(".shopee.sg"), true);
uji("host produksi terpisah", HOST_PRODUKSI, "https://partner.shopeemobile.com");
uji("keduanya tidak tertukar", HOST_SANDBOX !== HOST_PRODUKSI, true);

const url = susunUrl(HOST_SANDBOX, "/api/v2/order/get_order_list", {
  partner_id: 1000000,
  page_size: 20,
});
uji("jalur disusun utuh", url.pathname, "/api/v2/order/get_order_list");
uji("angka jadi teks di query", url.searchParams.get("page_size"), "20");
uji("host tidak berubah", url.origin, HOST_SANDBOX);

console.log("\nParameter get_order_list — dari dokumentasi Shopee");

const q = parameterPesanan(TS);

/* Tanpa ini Shopee hanya mengembalikan order_sn. Contoh balasan di
   dokumentasinya memang tidak memuat status sama sekali; status
   tergolong "optional field" dan harus diminta. */
uji("order_status diminta eksplisit", q.response_optional_fields, "order_status");

uji(
  `rentang tidak melebihi batas ${BATAS_RENTANG_HARI_SHOPEE} hari Shopee`,
  Number(q.time_to) - Number(q.time_from) <= BATAS_RENTANG_HARI_SHOPEE * 86400,
  true,
);
uji("time_from lebih awal dari time_to", Number(q.time_from) < Number(q.time_to), true);
uji("time_to adalah saat sekarang", q.time_to, TS);
uji("page_size di rentang 1..100", Number(q.page_size) >= 1 && Number(q.page_size) <= 100, true);
uji(
  "time_range_field adalah nilai yang dikenal",
  ["create_time", "update_time"].includes(String(q.time_range_field)),
  true,
);

console.log("\nTimestamp");

const t = timestampSekarang();
uji("berupa detik, bukan milidetik", String(t).length, 10);
uji("bilangan bulat", Number.isInteger(t), true);

console.log(`\n${"-".repeat(52)}`);
console.log(`Tanda tangan Shopee : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);

if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
