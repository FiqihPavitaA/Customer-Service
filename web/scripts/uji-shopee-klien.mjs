/* ===========================================================
   Klien Shopee — lib/shopee/klien.ts, tanpa jaringan.

     npm run uji-shopee-klien

   Biaya Rp 0. fetch diganti tiruan; tidak ada satu byte pun yang
   keluar dari mesin ini, dan env tidak dibaca sama sekali.

   YANG DIJAGA DI SINI

   1. Bentuk permintaan: parameter umum selalu ada, parameter toko
      hanya ada untuk endpoint toko, badan POST berbentuk JSON tetapi
      parameter umum TETAP di query string.

   2. Penanganan jawaban: `error` terisi berarti gagal walau HTTP 200;
      HTTP bukan 2xx berarti gagal walau `error` kosong; jawaban bukan
      JSON dan jaringan putus sama-sama jadi GalatShopee yang bisa
      dibedakan dari kodenya.

   3. Yang TIDAK boleh bocor: pesan galat tidak pernah memuat URL,
      sign, access_token, atau partner key. Satu kasus di bawah
      memeriksa ini secara harfiah.

   Dijalankan dengan --conditions=react-server supaya paket
   `server-only` terpecahkan ke modul kosong — lihat package.json.
   =========================================================== */

import { GalatKonfigurasi, GalatShopee, permintaanMentah, permintaanShopee } from "../lib/shopee/klien.ts";
import { buatSign } from "../lib/shopee/tandaTangan.ts";

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

async function tangkap(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

const KRED = { partnerId: "1000000", partnerKey: "kunci-uji-shopee" };
const HOST = "https://sandbox.uji.invalid";
const TS = 1700000000;
const TOKEN = "token-uji-rahasia-abc";

/** fetch tiruan: mencatat permintaan terakhir, menjawab sesuai skenario. */
function fetchTiruan(skenario) {
  const catatan = { url: null, init: null };
  const impl = async (url, init) => {
    catatan.url = url instanceof URL ? url : new URL(String(url));
    catatan.init = init;
    const s = typeof skenario === "function" ? skenario() : skenario;
    if (s.lempar) throw new Error(s.lempar);
    return {
      ok: s.status >= 200 && s.status < 300,
      status: s.status,
      text: async () => (typeof s.badan === "string" ? s.badan : JSON.stringify(s.badan)),
    };
  };
  return { impl, catatan };
}

const pengait = (impl) => ({ fetchImpl: impl, kredensial: KRED, host: HOST, sekarang: () => TS });

console.log("\nBentuk permintaan — endpoint publik");
{
  const { impl, catatan } = fetchTiruan({ status: 200, badan: { error: "", response: { x: 1 } } });
  const hasil = await permintaanShopee({ path: "/api/v2/public/get_shops_by_partner" }, pengait(impl));
  const q = catatan.url.searchParams;
  uji("host dipakai apa adanya", catatan.url.origin, HOST);
  uji("jalur utuh", catatan.url.pathname, "/api/v2/public/get_shops_by_partner");
  uji("partner_id ada", q.get("partner_id"), "1000000");
  uji("timestamp dari pengait", q.get("timestamp"), String(TS));
  uji(
    "sign = HMAC(partner_id + path + timestamp)",
    q.get("sign"),
    buatSign(KRED.partnerKey, ["1000000", "/api/v2/public/get_shops_by_partner", TS]),
  );
  uji("TIDAK ada access_token", q.has("access_token"), false);
  uji("TIDAK ada shop_id", q.has("shop_id"), false);
  uji("method bawaan GET", catatan.init.method, "GET");
  uji("tanpa badan", catatan.init.body, undefined);
  uji("response dibuka dari amplop", hasil.data, { x: 1 });
  uji("http dilaporkan", hasil.http, 200);
}

console.log("\nBentuk permintaan — endpoint toko");
{
  const { impl, catatan } = fetchTiruan({ status: 200, badan: { error: "", response: {} } });
  await permintaanShopee(
    { path: "/api/v2/order/get_order_list", shopId: 227948354, accessToken: TOKEN, query: { page_size: 20, lebih: true } },
    pengait(impl),
  );
  const q = catatan.url.searchParams;
  uji("access_token ikut", q.get("access_token"), TOKEN);
  uji("shop_id ikut, sebagai teks", q.get("shop_id"), "227948354");
  uji(
    "sign = HMAC(partner_id + path + timestamp + access_token + shop_id)",
    q.get("sign"),
    buatSign(KRED.partnerKey, ["1000000", "/api/v2/order/get_order_list", TS, TOKEN, 227948354]),
  );
  uji("parameter khas endpoint ikut", q.get("page_size"), "20");
  uji("boolean jadi teks", q.get("lebih"), "true");
}

console.log("\nBentuk permintaan — POST");
{
  const { impl, catatan } = fetchTiruan({ status: 200, badan: { error: "", access_token: "a", refresh_token: "r" } });
  const hasil = await permintaanMentah(
    { path: "/api/v2/auth/token/get", method: "POST", body: { code: "kode", shop_id: 1, partner_id: 1000000 } },
    pengait(impl),
  );
  uji("method POST", catatan.init.method, "POST");
  uji("badan JSON", JSON.parse(catatan.init.body), { code: "kode", shop_id: 1, partner_id: 1000000 });
  uji("Content-Type JSON", catatan.init.headers["Content-Type"], "application/json");
  uji("parameter umum TETAP di query string", catatan.url.searchParams.has("sign"), true);
  uji("permintaanMentah mengembalikan seluruh badan", hasil.data.access_token, "a");
}

console.log("\nPenanganan jawaban");
{
  const { impl } = fetchTiruan({
    status: 200,
    badan: { error: "invalid_acceess_token", message: "Invalid access_token, please have a check.", request_id: "rq1" },
  });
  const e = await tangkap(() => permintaanShopee({ path: "/x", shopId: 1, accessToken: TOKEN }, pengait(impl)));
  uji("HTTP 200 dengan error terisi = GalatShopee", e instanceof GalatShopee, true);
  uji("kode dari Shopee, apa adanya (termasuk salah ketiknya)", e?.kode, "invalid_acceess_token");
  uji("pesan dari Shopee", e?.pesan, "Invalid access_token, please have a check.");
  uji("request_id ikut", e?.requestId, "rq1");
  uji("http ikut", e?.http, 200);
}
{
  const { impl } = fetchTiruan({ status: 403, badan: { error: "error_sign", message: "Wrong sign", request_id: "rq2" } });
  const e = await tangkap(() => permintaanShopee({ path: "/x" }, pengait(impl)));
  uji("HTTP 403 dengan error = kode Shopee (bukan http_403)", e?.kode, "error_sign");
  uji("http 403 tercatat", e?.http, 403);
}
{
  const { impl } = fetchTiruan({ status: 502, badan: { message: "Bad Gateway" } });
  const e = await tangkap(() => permintaanShopee({ path: "/x" }, pengait(impl)));
  uji("HTTP 502 tanpa error = http_502", e?.kode, "http_502");
}
{
  const { impl } = fetchTiruan({ status: 200, badan: "<html>proxy error</html>" });
  const e = await tangkap(() => permintaanShopee({ path: "/x" }, pengait(impl)));
  uji("bukan JSON = bukan_json", e?.kode, "bukan_json");
  uji("potongan badan dibawa sebagai pesan", e?.pesan.startsWith("<html>"), true);
}
{
  const { impl } = fetchTiruan({ lempar: "getaddrinfo ENOTFOUND" });
  const e = await tangkap(() => permintaanShopee({ path: "/x" }, pengait(impl)));
  uji("fetch gagal = jaringan", e?.kode, "jaringan");
  uji("http null karena tidak ada jawaban", e?.http, null);
}
{
  const { impl } = fetchTiruan({ status: 200, badan: { error: "", response: { a: 1 } } });
  const h = await permintaanShopee({ path: "/x" }, pengait(impl));
  uji("error string kosong = berhasil", h.data, { a: 1 });
}
{
  const { impl } = fetchTiruan({ status: 200, badan: { response: { b: 2 } } });
  const h = await permintaanShopee({ path: "/x" }, pengait(impl));
  uji("error tidak ada sama sekali = berhasil", h.data, { b: 2 });
}

console.log("\nYang tidak boleh bocor ke pesan galat");
{
  const { impl } = fetchTiruan({ status: 403, badan: { error: "error_sign", message: "Wrong sign" } });
  const e = await tangkap(() => permintaanShopee({ path: "/x", shopId: 1, accessToken: TOKEN }, pengait(impl)));
  const teks = `${e?.message} ${e?.stack ?? ""}`;
  uji("access_token tidak ada di pesan/stack", teks.includes(TOKEN), false);
  uji("partner key tidak ada di pesan/stack", teks.includes(KRED.partnerKey), false);
  uji("sign tidak ada di pesan/stack", /sign=[0-9a-f]{64}/.test(teks), false);
  uji("host/URL tidak ada di pesan", e?.message.includes(HOST), false);
}

console.log("\nPemeriksaan sebelum mengirim");
{
  const { impl, catatan } = fetchTiruan({ status: 200, badan: {} });
  const e = await tangkap(() => permintaanShopee({ path: "/x", accessToken: TOKEN }, pengait(impl)));
  uji("accessToken tanpa shopId ditolak sebelum fetch", e instanceof GalatKonfigurasi, true);
  uji("yang kurang disebut namanya", e?.kurang, ["shopId"]);
  uji("fetch tidak pernah dipanggil", catatan.url, null);
}
{
  const { impl } = fetchTiruan({ status: 200, badan: {} });
  const e = await tangkap(() => permintaanShopee({ path: "/x", shopId: 1 }, pengait(impl)));
  uji("shopId tanpa accessToken ditolak", e?.kurang, ["accessToken"]);
}
{
  /* Tanpa pengait kredensial dan env kosong: kedua nama disebut. */
  const simpan = { id: process.env.SHOPEE_PARTNER_ID, key: process.env.SHOPEE_PARTNER_KEY };
  delete process.env.SHOPEE_PARTNER_ID;
  delete process.env.SHOPEE_PARTNER_KEY;
  const { impl } = fetchTiruan({ status: 200, badan: {} });
  const e = await tangkap(() => permintaanShopee({ path: "/x" }, { fetchImpl: impl, host: HOST }));
  uji("env kosong = GalatKonfigurasi dengan KEDUA nama", e?.kurang, ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY"]);
  if (simpan.id !== undefined) process.env.SHOPEE_PARTNER_ID = simpan.id;
  if (simpan.key !== undefined) process.env.SHOPEE_PARTNER_KEY = simpan.key;
}

console.log(`\n${"-".repeat(52)}`);
console.log(`Klien Shopee : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);

if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
