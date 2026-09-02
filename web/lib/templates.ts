/* ===========================================================
   Lapisan 1 — pencocokan template sebelum memanggil AI.

   Sumber template: empat berkas di content/knowledge-base/ (hasil
   pemecahan faq-cs.md), pustaka 152 kode balasan milik tim CS, tiap
   entri berkode `### [KODE]`. Berkas yang sama tetap ikut ke system

   Prinsip yang dipegang di sini:
   1. RAGU = LEMPAR KE AI. Salah balas lebih mahal daripada Rp 140.
      Setiap aturan hanya dinyalakan bila sinyalnya kuat.
   2. Pertanyaan yang butuh penilaian (kenapa, boleh tidak, aman
      tidak, rekomendasi) TIDAK PERNAH dijawab template — itu
      wilayah AI, dan sop.md melarang menjawab tanpa dasar.
   3. Tiap aturan mencatat alasannya, supaya hasilnya bisa diaudit.
   =========================================================== */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAQ_FILES, type Action } from "./knowledge";

const CONTENT_DIR = join(process.cwd(), "content");

/* ---------- Pembaca pustaka template ---------- */

let library: Map<string, string> | null = null;

/** Baca keempat berkas FAQ → peta { KODE → isi balasan }. Sekali saja. */
export function getTemplateLibrary(): Map<string, string> {
  if (library) return library;

  const map = new Map<string, string>();
  // Urutan berkas menentukan entri mana yang menang saat kodenya
  // kembar — lihat catatan pada flush() di bawah.
  const potongan: string[] = [];
  for (const berkas of FAQ_FILES) {
    try {
      potongan.push(readFileSync(join(CONTENT_DIR, berkas), "utf8"));
    } catch (err) {
      console.warn(`[TPL] Gagal membaca ${berkas}: ${(err as Error).message}`);
    }
  }
  const raw = potongan.join("\n\n");
  if (!raw) {
    library = map;
    return map;
  }

  const lines = raw.split(/\r?\n/);
  let code: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!code) return;
    const text = buffer.join("\n").trim();
    // Kode kembar (KOMPLAIN, IDUL FITRI, BERTAHAP) — pakai yang pertama,
    // karena itu yang paling ringkas dan paling umum dipakai CS.
    if (text && !map.has(code)) map.set(code, text);
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^###\s*\[(.+?)\]\s*$/);
    if (heading) {
      flush();
      code = heading[1].trim();
      continue;
    }
    // Judul bagian (## Interaksi, dst) mengakhiri entri sebelumnya.
    if (/^##\s+/.test(line)) {
      flush();
      code = null;
      continue;
    }
    if (code) buffer.push(line);
  }
  flush();

  library = map;
  return map;
}

/* ---------- Kata yang membatalkan pencocokan ---------- */

/**
 * Kalau pesan mengandung salah satu ini, pertanyaannya menuntut
 * penilaian — bukan kalimat baku. Selalu diserahkan ke AI.
 */
const BUTUH_PENILAIAN =
  /\b(kenapa|mengapa|kok|apakah boleh|boleh nggak|boleh gak|bolehkah|bisa nggak|bisa gak|aman nggak|aman gak|bahaya|cocok nggak|cocok gak|sebaiknya|rekomendasi|saran|bagusnya|lebih baik|campur)\b/i;

/* ---------- Daftar aturan ---------- */

type Rule = {
  /** Kode entri di berkas knowledge-base/. */
  code: string;
  /** Klasifikasi yang dilaporkan, setara keluaran AI. */
  action: Action;
  /** Pesan harus cocok dengan salah satu pola ini. */
  when: RegExp[];
  /** Bila salah satu pola ini cocok, aturan dibatalkan. */
  unless?: RegExp[];
  /** Alasan aturan ini aman ditangani tanpa AI (untuk audit). */
  why: string;
};

const RULES: Rule[] = [
  {
    code: "BANTU",
    action: "ASK_INFORMATION",
    // Hanya sapaan telanjang — begitu ada pertanyaan menempel, lewat.
    // \p{P}\p{S} menampung tanda baca sekaligus emoji (🙏😊) di ekor pesan.
    when: [
      /^\s*(halo|hallo|hai|hay|hi|hello|pagi|siang|sore|malam|permisi|assalamualaikum|assalamu'alaikum)(\s+(kak|ka|kk|min|minfarm|admin|bang|sis))?[\s\p{P}\p{S}]*$/iu,
      /^\s*(min|kak|kk|admin|minfarm)[\s\p{P}\p{S}]*$/iu,
    ],
    why: "Sapaan tanpa pertanyaan. Balasan pembuka CS memang kalimat tetap.",
  },
  {
    code: "TQ",
    action: "AUTO_REPLY",
    when: [
      /^\s*(makasih|makasi|mksh|terima ?kasih|thanks|thank you|tq|oke|okey|ok|sip|siap|baik|noted)(\s+(kak|ka|kk|min|minfarm|admin))?[\s\p{P}\p{S}]*$/iu,
    ],
    why: "Ucapan terima kasih. Tidak ada informasi yang perlu dicari.",
  },
  {
    code: "LACAK",
    action: "CHECK_ORDER_SYSTEM",
    when: [
      /\b(lacak|tracking)\b/i,
      /\b(posisi|status)\s+(paket|pesanan|barang)\b/i,
      /\bpaket\w*\s+(saya|aku|ku)?\s*(sudah )?(sampai )?mana\b/i,
      /\bsampai mana\b/i,
    ],
    // Keluhan keterlambatan bukan sekadar minta cara melacak.
    unless: [/\b(belum sampai|tidak sampai|hilang|lama|telat|terlambat|refund|komplain)\b/i],
    why: "Permintaan cara melacak paket. Balasannya arahan baku ke menu lacak.",
  },
  {
    code: "HARGA",
    action: "AUTO_REPLY",
    when: [/\bharga\b/i, /\bberapa(an)? (harganya|duit|rupiah)\b/i],
    // sop.md melarang AI menyebut harga; template pun tidak menyebut
    // angka, hanya mengarahkan ke halaman produk. Aman.
    unless: [/\b(dosis|takaran|ongkir|ongkos kirim)\b/i],
    why: "Pertanyaan harga. Template mengarahkan ke halaman produk tanpa menyebut angka — sesuai larangan sop.md.",
  },
  {
    code: "GARANSI",
    action: "AUTO_REPLY",
    when: [/\bgaransi\b/i],
    why: "Syarat garansi adalah kebijakan tetap yang tidak boleh bervariasi.",
  },
  {
    code: "OFFLINE",
    action: "AUTO_REPLY",
    when: [
      /\b(toko|gerai|outlet)\s*(offline|fisik)\b/i,
      /\boffline store\b/i,
      /\b(bisa|boleh)\s+(datang|mampir|ke toko)\b/i,
    ],
    why: "Ketersediaan toko offline adalah fakta tetap.",
  },
  {
    code: "LIBUR",
    action: "AUTO_REPLY",
    when: [/\b(tanggal merah|hari libur|libur nasional)\b/i],
    why: "Jadwal operasional hari libur adalah kebijakan tetap.",
  },
  {
    code: "SENIN",
    action: "AUTO_REPLY",
    when: [/\b(sabtu|minggu|weekend|akhir pekan)\b.*\b(kirim|dikirim|proses|diproses)\b/i,
           /\b(kirim|dikirim|proses|diproses)\b.*\b(sabtu|minggu|weekend|akhir pekan)\b/i],
    why: "Kebijakan pemrosesan pesanan akhir pekan, kalimatnya tetap.",
  },
  {
    code: "PAKAI POC",
    action: "AUTO_REPLY",
    when: [/\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran)\b.*\bpoc\b/i,
           /\bpoc\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i],
    why: "Dosis POC wajib persis Knowledge Base — justru berbahaya bila dikarang AI.",
  },
  {
    code: "PAKAI NEEM",
    action: "AUTO_REPLY",
    when: [/\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\b(neem|pestisida)\b/i,
           /\b(neem|pestisida)\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i],
    why: "Dosis pestisida wajib persis Knowledge Base.",
  },
  {
    code: "PAKAI ABMB",
    action: "AUTO_REPLY",
    when: [/\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\bab ?mix\b/i,
           /\bab ?mix\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b/i],
    why: "Dosis AB Mix wajib persis Knowledge Base, termasuk larangan mencampur stok A dan B.",
  },
  {
    code: "KOMPLAIN",
    action: "HANDOVER_TO_CS",
    when: [
      /\b(rusak|pecah|bocor|penyok|jamuran|busuk)\b/i,
      /\b(salah kirim|kurang|tidak sesuai|gak sesuai|nggak sesuai|beda)\b.*\b(pesanan|barang|isi|produk)\b/i,
    ],
    why: "Keluhan barang. sop.md mewajibkan alih ke CS manusia — balasan baku justru lebih aman daripada AI menyusun kalimat sendiri.",
  },
];

/* ---------- Pencocokan ---------- */

export type TemplateMatch = {
  code: string;
  action: Action;
  reply: string;
  /** Alasan aturan ini dianggap aman — ditampilkan untuk audit. */
  why: string;
};

/**
 * Cocokkan pesan pelanggan dengan template.
 * @returns template yang cocok, atau null bila harus diserahkan ke AI.
 */
export function matchTemplate(message: string): TemplateMatch | null {
  const msg = message.trim();
  if (!msg) return null;

  // Pertanyaan yang menuntut penilaian selalu ke AI.
  if (BUTUH_PENILAIAN.test(msg)) return null;

  // Pesan panjang biasanya bercerita/berlapis — bukan pertanyaan baku.
  if (msg.length > 180) return null;

  const lib = getTemplateLibrary();

  for (const rule of RULES) {
    if (rule.unless?.some((re) => re.test(msg))) continue;
    if (!rule.when.some((re) => re.test(msg))) continue;

    const reply = lib.get(rule.code);
    if (!reply) {
      // Kode tidak ada di berkas FAQ (mis. judulnya diubah) — jangan
      // mengarang, serahkan saja ke AI.
      console.warn(`[TPL] Kode [${rule.code}] tidak ada di berkas FAQ mana pun`);
      continue;
    }
    return { code: rule.code, action: rule.action, reply, why: rule.why };
  }

  return null;
}

/** Jumlah aturan & template yang termuat — untuk /api/health. */
export function templateStats() {
  return { rules: RULES.length, templates: getTemplateLibrary().size };
}
