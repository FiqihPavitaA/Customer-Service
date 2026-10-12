/* ===========================================================
   Pesanan pembeli di panel kanan Chat — lib/pesananPembeli.ts.

     npm run uji-pesanan-pembeli

   Biaya Rp 0. Tidak ada jaringan, tidak ada Supabase.

   YANG DIJAGA DI SINI

   1. Percakapan simulasi tidak pernah dicocokkan.
   2. order_id menang; id pembeli hanya dipakai bila berupa angka
      (buyer_user_id Shopee selalu angka); customer_id non-angka
      dicoba sebagai nama akun.
   3. Filter PostgREST aman terhadap koma dan kurung di nama akun.
   4. "Terlambat" hanya untuk perlu_dikirim yang lewat batas — pesanan
      yang sudah dikirim atau batal tidak pernah terlambat.
   =========================================================== */

import {
  filterOr,
  kriteriaPesanan,
  labelStatus,
  teksJumlah,
  terlambatKirim,
} from "../lib/pesananPembeli.ts";

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

console.log("\nkriteriaPesanan");
{
  uji("simulasi -> null", kriteriaPesanan({ customer_id: "sim_abc", customer_name: "Jungsu", order_id: null }), null);
  uji("simulasi dengan order_id tetap null", kriteriaPesanan({ customer_id: "sim_1", customer_name: "x", order_id: "123" }), null);
  uji("semua kosong -> null", kriteriaPesanan({ customer_id: null, customer_name: null, order_id: null }), null);
  uji("hanya spasi -> null", kriteriaPesanan({ customer_id: "  ", customer_name: " ", order_id: "" }), null);

  uji(
    "id angka -> buyer_user_id, nama -> buyer_username",
    kriteriaPesanan({ customer_id: "1170319091", customer_name: "xt4fdsf96j", order_id: null }),
    { order_id: null, buyer_user_id: "1170319091", buyer_username: "xt4fdsf96j" },
  );
  uji(
    "customer_id non-angka (data lama) dicoba sebagai nama akun",
    kriteriaPesanan({ customer_id: "dikymarzuki", customer_name: null, order_id: null }),
    { order_id: null, buyer_user_id: null, buyer_username: "dikymarzuki" },
  );
  uji(
    "customer_name menang atas customer_id non-angka untuk nama akun",
    kriteriaPesanan({ customer_id: "dikymarzuki", customer_name: "diky", order_id: null }).buyer_username,
    "diky",
  );
  uji(
    "order_id ikut dibawa",
    kriteriaPesanan({ customer_id: "99", customer_name: null, order_id: "2404098R48U37H" }).order_id,
    "2404098R48U37H",
  );
  uji("nilai dirapikan dari spasi", kriteriaPesanan({ customer_id: " 42 ", customer_name: " a ", order_id: null }), {
    order_id: null,
    buyer_user_id: "42",
    buyer_username: "a",
  });
}

console.log("\nfilterOr — sintaks PostgREST");
{
  uji(
    "tiga kriteria digabung dengan koma",
    filterOr({ order_id: "A1", buyer_user_id: "7", buyer_username: "tom" }),
    'external_order_id.eq."A1",buyer_user_id.eq."7",buyer_username.eq."tom"',
  );
  uji("hanya yang terisi", filterOr({ order_id: null, buyer_user_id: null, buyer_username: "tom" }), 'buyer_username.eq."tom"');
  uji(
    "koma di nama akun tidak memecah filter",
    filterOr({ order_id: null, buyer_user_id: null, buyer_username: "a,b" }),
    'buyer_username.eq."a,b"',
  );
  uji(
    "kutip ganda di nama akun di-escape",
    filterOr({ order_id: null, buyer_user_id: null, buyer_username: 'x"y' }),
    'buyer_username.eq."x\\"y"',
  );
}

console.log("\nterlambatKirim");
{
  const KINI = Date.parse("2026-10-12T10:00:00Z");
  const kemarin = "2026-10-11T10:00:00Z";
  const besok = "2026-10-13T10:00:00Z";
  uji("perlu_dikirim, batas kemarin -> terlambat", terlambatKirim({ status: "perlu_dikirim", ship_by_date: kemarin }, KINI), true);
  uji("perlu_dikirim, batas besok -> belum", terlambatKirim({ status: "perlu_dikirim", ship_by_date: besok }, KINI), false);
  uji("dalam_pengiriman, batas kemarin -> TIDAK terlambat", terlambatKirim({ status: "dalam_pengiriman", ship_by_date: kemarin }, KINI), false);
  uji("dibatalkan, batas kemarin -> TIDAK terlambat", terlambatKirim({ status: "dibatalkan", ship_by_date: kemarin }, KINI), false);
  uji("tanpa batas -> tidak", terlambatKirim({ status: "perlu_dikirim", ship_by_date: null }, KINI), false);
  uji("batas rusak -> tidak", terlambatKirim({ status: "perlu_dikirim", ship_by_date: "nanti" }, KINI), false);
}

console.log("\nlabelStatus & teksJumlah");
{
  uji("status dikenal -> label Indonesia", labelStatus("perlu_dikirim"), "Perlu dikirim");
  uji("status asing -> apa adanya", labelStatus("PENDING"), "PENDING");
  uji("belum bayar -> —", teksJumlah(null, "IDR"), "—");
  uji("mata uang kosong -> IDR", teksJumlah(15000, null).includes("15.000"), true);
  uji("VND dari contoh dokumentasi terformat", teksJumlah(1004, "VND").includes("1.004"), true);
}

console.log(`\n${"-".repeat(52)}`);
console.log(`Pesanan pembeli : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);

if (gagal > 0) {
  console.error(`\n${gagal} kasus gagal.`);
  process.exit(1);
}
console.log("\nSemua kasus lulus");
