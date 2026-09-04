/* ===========================================================
   Periksa berkas SQL hasil bangkitan tanpa PostgreSQL.

   Kenapa perlu: pemeriksaan naif "hitung kutip per baris" MENYESATKAN,
   karena isi template mengandung baris baru sehingga satu nilai SQL
   membentang beberapa baris fisik. Pemeriksa itu melaporkan 77 galat
   palsu pada berkas yang sebenarnya benar.

   Yang dilakukan di sini: menelusuri berkas karakter per karakter
   dengan menghormati literal string SQL (termasuk '' sebagai apostrof),
   lalu memastikan:
     1. semua literal string tertutup rapi
     2. jumlah tuple pada setiap VALUES sesuai harapan
     3. isi tiap tuple bisa dibaca kembali utuh

   Jalankan: npm run periksa-sql
   =========================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Pisahkan SQL jadi potongan: literal string dan sisanya.
 * @returns {{literal: string[], sisa: string, terbuka: boolean}}
 */
function telusuri(sql) {
  const literal = [];
  let sisa = "";
  let i = 0;
  let terbuka = false;

  while (i < sql.length) {
    const c = sql[i];

    // Komentar baris — abaikan seluruhnya, isinya bisa memuat apostrof.
    if (c === "-" && sql[i + 1] === "-") {
      const akhir = sql.indexOf("\n", i);
      i = akhir === -1 ? sql.length : akhir;
      continue;
    }

    if (c !== "'") {
      sisa += c;
      i++;
      continue;
    }

    // Awal literal string.
    let isi = "";
    i++;
    let tertutup = false;
    while (i < sql.length) {
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          isi += "'"; // apostrof yang di-escape
          i += 2;
          continue;
        }
        i++;
        tertutup = true;
        break;
      }
      isi += sql[i];
      i++;
    }
    if (!tertutup) {
      terbuka = true;
      break;
    }
    literal.push(isi);
    // Penanda tetap memakai kutip, supaya tuple data — yang selalu
    // diawali nilai berkutip — bisa dibedakan dari daftar kolom
    // insert into ... (code, category_slug, ...) yang tidak berkutip.
    sisa += String.fromCharCode(39) + "@" + String.fromCharCode(39);
  }

  return { literal, sisa, terbuka };
}

let gagal = 0;

function periksa(namaBerkas, harap) {
  const jalur = join(AKAR, "supabase", namaBerkas);
  const sql = readFileSync(jalur, "utf8");
  const { literal, sisa, terbuka } = telusuri(sql);

  console.log(`\n${namaBerkas}`);

  if (terbuka) {
    console.error("  ✗ ada literal string yang tidak ditutup");
    gagal++;
    return;
  }
  console.log("  ✓ semua literal string tertutup rapi");
  console.log("  · jumlah literal:", literal.length);

  // Tuple = dua spasi + kurung + KUTIP di awal baris.
  //
  // Kutipnya penting: tuple data selalu diawali nilai berkutip,
  // sedangkan daftar kolom `insert into ... (code, category_slug, …)`
  // tidak. Tanpa syarat itu, daftar kolom ikut terhitung sebagai
  // tuple — persis kekeliruan yang membuat pemeriksaan ini melaporkan
  // 197 dan 13, dua dan tiga lebih banyak dari yang sebenarnya.
  //
  // Kurung di dalam teks template tidak mungkin ikut terhitung karena
  // seluruh literal sudah diganti penanda oleh telusuri().
  const KUTIP = String.fromCharCode(39);
  const tuple = (sisa.match(new RegExp("\\n {2}\\(" + KUTIP, "g")) || []).length;
  console.log("  · jumlah tuple :", tuple, "(harap", harap.tuple + ")");
  if (tuple !== harap.tuple) {
    console.error("  ✗ jumlah tuple tidak sesuai");
    gagal++;
  } else {
    console.log("  ✓ jumlah tuple sesuai");
  }

  // begin/commit harus berpasangan.
  const b = (sisa.match(/\bbegin;/g) || []).length;
  const k = (sisa.match(/\bcommit;/g) || []).length;
  if (b !== k || b === 0) {
    console.error(`  ✗ begin/commit tidak berpasangan (${b}/${k})`);
    gagal++;
  } else {
    console.log("  ✓ begin/commit berpasangan");
  }

  if (harap.memuat) {
    for (const t of harap.memuat) {
      if (literal.some((l) => l.includes(t))) {
        console.log("  ✓ isi terbaca utuh:", JSON.stringify(t.slice(0, 40)));
      } else {
        console.error("  ✗ isi tidak ditemukan:", JSON.stringify(t.slice(0, 40)));
        gagal++;
      }
    }
  }
}

/* 152 template + 43 aturan = 195 tuple. */
periksa("seed-templates.sql", {
  tuple: 195,
  // Apostrof di dalam pola regex — pembuktian escaping bekerja.
  memuat: ["assalamu'alaikum", "Cara penggunaan POC:"],
});

/* 6 percakapan + 1 eskalasi + 3 flag = 10 tuple. */
periksa("seed-demo.sql", { tuple: 10 });

console.log(gagal ? `\n${gagal} PEMERIKSAAN GAGAL` : "\nSemua pemeriksaan lulus");
process.exit(gagal ? 1 : 0);
