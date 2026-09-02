/* ===========================================================
   Salin berkas Knowledge Base dari root proyek ke web/content/.

   Kenapa perlu disalin, bukan dibaca langsung dari root:
   Vercel Root Directory = `web`, jadi berkas di atas folder itu
   tidak ikut ter-upload saat deploy. `web/content/` adalah satu-
   satunya tempat yang pasti ada di produksi (dan sudah didaftarkan
   di outputFileTracingIncludes pada next.config.ts).

   Sejak router.js ikut disalin, jumlah berkas yang harus tetap
   sinkron ada tujuh. Menyalin manual satu per satu cepat atau
   lambat akan menyisakan versi lama — karena itu skrip ini ada.

   Pakai:  npm run sync-kb        (dari folder web/)
           npm run sync-kb -- --check   (hanya periksa, tidak menyalin)
   =========================================================== */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB_DIR, "..");
const CONTENT = join(WEB_DIR, "content");

/** [sumber di root, tujuan relatif terhadap web/content] */
const BERKAS = [
  ["claude-core.md", "claude-core.md"],
  ["products.json", "products.json"],
  ["template jawaban.md", "template-jawaban.md"],
  ["knowledge-base/faq-interaksi.md", "knowledge-base/faq-interaksi.md"],
  ["knowledge-base/faq-cara-pakai.md", "knowledge-base/faq-cara-pakai.md"],
  ["knowledge-base/faq-produk.md", "knowledge-base/faq-produk.md"],
  ["knowledge-base/faq-umum.md", "knowledge-base/faq-umum.md"],
  ["knowledge-base/index.json", "knowledge-base/index.json"],
  ["knowledge-base/router.js", "knowledge-base/router.js"],
  ["knowledge-base/router.d.ts", "knowledge-base/router.d.ts"],
];

const hanyaPeriksa = process.argv.includes("--check");

mkdirSync(join(CONTENT, "knowledge-base"), { recursive: true });

let berubah = 0;
let hilang = 0;

for (const [dariRel, keRel] of BERKAS) {
  const dari = join(ROOT, dariRel);
  const ke = join(CONTENT, keRel);

  if (!existsSync(dari)) {
    console.error(`  HILANG  ${dariRel} — tidak ada di root`);
    hilang++;
    continue;
  }

  const sumber = readFileSync(dari);
  const sama = existsSync(ke) && readFileSync(ke).equals(sumber);

  if (sama) continue;

  berubah++;
  if (hanyaPeriksa) {
    console.error(`  BEDA    ${dariRel} -> content/${keRel}`);
  } else {
    copyFileSync(dari, ke);
    console.log(`  disalin ${dariRel} -> content/${keRel}`);
  }
}

if (hilang) {
  console.error(`\n${hilang} berkas sumber tidak ditemukan.`);
  process.exit(1);
}

if (hanyaPeriksa && berubah) {
  console.error(`\n${berubah} berkas belum sinkron. Jalankan: npm run sync-kb`);
  process.exit(1);
}

console.log(
  berubah
    ? `\n${berubah} berkas disalin, ${BERKAS.length - berubah} sudah sama.`
    : `\nSemua ${BERKAS.length} berkas KB sudah sinkron.`,
);
