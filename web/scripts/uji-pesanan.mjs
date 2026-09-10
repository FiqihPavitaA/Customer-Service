/* ===========================================================
   Uji pembuat pesanan contoh (lib/pesananDummy.ts).

     npm run uji-pesanan

   Biaya Rp 0, tanpa jaringan, tanpa database.

   KENAPA INI PERLU DIUJI TERSENDIRI

   Yang dijaga di sini bukan tampilan, melainkan satu sifat:
   NOMOR PESANAN TIDAK BOLEH BERUBAH.

   Kalau ia bergeser di antara dua render, CS membaca sebuah nomor
   di panel kanan, mengetiknya di kotak pencarian, dan hasilnya
   "tidak ditemukan". Tidak ada galat, tidak ada layar merah — yang
   ada hanya orang yang perlahan berhenti memercayai pencarian,
   termasuk untuk data pesanan yang nanti sungguhan.

   Satu Math.random() yang tidak sengaja lolos ke berkas itu sudah
   cukup menyebabkannya, dan tidak satu pun uji tampilan akan
   menangkapnya.
   =========================================================== */

const { buatPesananDummy, idPesananDummy, resiDummy, rupiah } = await import(
  "../lib/pesananDummy.ts"
);

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, catatan = "") {
  if (benar) {
    lulus++;
    console.log(`  v ${nama}`);
  } else {
    gagal++;
    console.log(`  X ${nama}${catatan ? ` — ${catatan}` : ""}`);
  }
}

const KATALOG = [
  { sku: "POC-BUAH-250", nama_produk: "INFARM - POC Buah 250 ml", kategori: "Nutrisi Tanaman" },
  { sku: "NT-FURADAN-1KG", nama_produk: "INFARM - Furadan 3GR 1 Kg", kategori: "Pestisida" },
  { sku: "BCA-CMK-MICHA", nama_produk: "INFARM - Benih Cabai Micha", kategori: "Benih" },
  { sku: "PKT-HIDRO-12LT", nama_produk: "INFARM - Paket Hidroponik 12 Lubang", kategori: "Hidroponik" },
  { sku: "BAG-PLANTER", nama_produk: "INFARM - Planter Bag 50 Liter", kategori: "Pot & Polybag" },
];

const percakapan = (ganti = {}) => ({
  id: "c0000000-0000-4000-8000-000000000001",
  customer_id: "yoga",
  order_id: null,
  tracking_no: null,
  created_at: "2026-09-10T09:00:00+07:00",
  ...ganti,
});

console.log("\n1. Determinisme — sifat yang paling penting");
const a = percakapan();
const id1 = idPesananDummy(a);
const id2 = idPesananDummy(a);
const id3 = idPesananDummy({ ...a });
periksa("dipanggil dua kali -> nomor sama", id1 === id2, `${id1} vs ${id2}`);
periksa("objek baru dengan isi sama -> nomor sama", id1 === id3, `${id1} vs ${id3}`);

const p1 = buatPesananDummy(a, KATALOG);
const p2 = buatPesananDummy({ ...a }, KATALOG);
periksa("seluruh pesanan sama persis", JSON.stringify(p1) === JSON.stringify(p2));
periksa("resi juga tetap", resiDummy(a) === resiDummy({ ...a }));

console.log("\n2. Percakapan berbeda -> nomor berbeda");
const kumpulan = new Set();
for (let i = 0; i < 40; i++) {
  kumpulan.add(idPesananDummy(percakapan({ id: `c${i}-uuid-percobaan` })));
}
periksa(`40 percakapan -> 40 nomor unik`, kumpulan.size === 40, `dapat ${kumpulan.size}`);

console.log("\n3. Percakapan simulasi TIDAK dibuatkan pesanan");
const sim = percakapan({ customer_id: "sim_ab12cd34" });
periksa("idPesananDummy -> null", idPesananDummy(sim) === null);
periksa("resiDummy -> null", resiDummy(sim) === null);
periksa("buatPesananDummy -> null", buatPesananDummy(sim, KATALOG) === null);

console.log("\n4. Data sungguhan TIDAK ditimpa");
/* Kalau nomor karangan menimpa nomor asli, CS akan mencari nomor
   yang diberikan pelanggan dan tidak menemukannya — persis kasus
   yang paling merugikan. */
const asli = percakapan({ order_id: "240617XXXX", tracking_no: "JNT112233445" });
periksa("order_id asli dipertahankan", idPesananDummy(asli) === "240617XXXX");
periksa("tracking_no asli dipertahankan", resiDummy(asli) === "JNT112233445");
periksa(
  "pesanan memakai nomor asli",
  buatPesananDummy(asli, KATALOG)?.id === "240617XXXX",
);

console.log("\n5. Katalog kosong -> tanpa item, BUKAN nama karangan");
/* Nama produk karangan di layar CS lebih berbahaya daripada daftar
   kosong sesaat: yang pertama bisa terbaca sebagai barang yang
   benar-benar dikirim. */
const tanpaKatalog = buatPesananDummy(a, []);
periksa("pesanan tetap dibuat", tanpaKatalog !== null);
periksa("itemnya kosong", tanpaKatalog?.item.length === 0);
periksa("nomornya tetap sama dengan yang berkatalog", tanpaKatalog?.id === id1);

console.log("\n6. Isi pesanan masuk akal");
const p = buatPesananDummy(a, KATALOG);
periksa("ada 1-3 baris barang", p.item.length >= 1 && p.item.length <= 3, `${p.item.length}`);
periksa("qty selalu >= 1", p.item.every((i) => i.qty >= 1));
periksa("harga selalu > 0", p.item.every((i) => i.harga > 0));
periksa("harga kelipatan 500", p.item.every((i) => i.harga % 500 === 0));
periksa("tidak ada SKU kembar", new Set(p.item.map((i) => i.sku)).size === p.item.length);

const subtotal = p.item.reduce((n, i) => n + i.harga * i.qty, 0);
periksa("total = subtotal + ongkir", p.total === subtotal + p.ongkir, `${p.total}`);
periksa("ongkir wajar (9rb-21rb)", p.ongkir >= 9000 && p.ongkir <= 21000, `${p.ongkir}`);

console.log("\n7. Bentuk nomor — harus bisa diketik ulang orang");
for (let i = 0; i < 30; i++) {
  const nomor = idPesananDummy(percakapan({ id: `x${i}-uuid` }));
  if (!/^[0-9]{6}[A-Z]{7}$/.test(nomor)) {
    periksa(`bentuk nomor "${nomor}"`, false, "tidak sesuai pola YYMMDD + 7 huruf");
    break;
  }
  if (i === 29) periksa("30 nomor semuanya berpola YYMMDD + 7 huruf kapital", true);
}
/* Huruf I dan O dibuang: di layar keduanya nyaris tidak bisa
   dibedakan dari angka 1 dan 0, dan nomor pesanan justru sering
   dibacakan lewat telepon atau diketik ulang dari tangkapan layar. */
const semuaHuruf = [...Array(60)]
  .map((_, i) => idPesananDummy(percakapan({ id: `h${i}-uuid` })).slice(6))
  .join("");
periksa("tidak pernah memakai huruf I", !semuaHuruf.includes("I"));
periksa("tidak pernah memakai huruf O", !semuaHuruf.includes("O"));

console.log("\n8. Format rupiah");
periksa('128500 -> "Rp 128.500"', rupiah(128500) === "Rp 128.500", rupiah(128500));
periksa('0 -> "Rp 0"', rupiah(0) === "Rp 0");

console.log(`\n${"-".repeat(52)}`);
console.log(`Pesanan contoh : ${gagal === 0 ? "LULUS" : "GAGAL"} ${lulus}/${lulus + gagal}`);
if (gagal > 0) process.exit(1);
console.log("\nSemua kasus lulus");
