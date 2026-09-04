# Instruksi Proyek — AI Customer Service Infarm

> Berkas ini **hanya untuk Claude Code / agen coding**, bukan system
> prompt aplikasi.
>
> Sejak 2 September 2026 `claude.md` lama dipecah dua supaya dokumentasi
> developer tidak ikut dibayar sebagai token di setiap chat pelanggan
> (hemat ±16% token system prompt). Cadangannya ada di `claude.md.OLD`.

---

## ⛔ ATURAN PERTAMA: JANGAN PANGGIL API BERBAYAR TANPA IZIN

**Saldo Anthropic milik pemilik proyek terpotong sungguhan setiap kali
Claude API dipanggil.** Aturan ini pernah dilanggar dan menghabiskan
saldo tanpa sepengetahuan pemiliknya — jangan diulangi.

### Yang WAJIB minta izin dulu, setiap kali

- `POST /api/chat` (Next.js) dan endpoint chat di `backend/server.js`
- Skrip apa pun yang meng-import `@anthropic-ai/sdk` atau memanggil
  `api.anthropic.com`
- Uji apa pun yang tujuannya "memastikan balasan AI benar"

**`/api/chat` berbahaya justru karena kadang gratis.** Pesan yang cocok
template dijawab tanpa memanggil Claude, tapi yang tidak cocok
langsung berbayar — dan tidak ada cara memastikan sebelum menekan.
Jangan pakai alasan "pesan ini pasti kena template".

### Cara meminta izin

Sebutkan **berapa panggilan**, **pesan apa**, dan **perkiraan biayanya**
dalam rupiah. Lalu berhenti dan tunggu jawaban. Jangan lanjut sampai
pemilik proyek menjawab.

### Yang GRATIS — pakai ini untuk memverifikasi

| Perintah | Yang dibuktikan |
|---|---|
| `node knowledge-base/router.test.mjs` | 48 kasus pencocokan template |
| `POST /api/templates/uji` | Pesan tertentu kena template mana |
| `GET /api/templates` | Daftar 152 template + aturan pemicunya |
| `GET /api/health` | Konfigurasi & ukuran KB (tidak memanggil Claude) |
| `npx tsc --noEmit` · `npx eslint .` · `npx next build` | Kode benar |
| `npm run sync-kb -- --check` | Berkas KB sinkron |

`knowledge-base/router.js` hanya meng-import `node:fs`, `node:path`,
dan `node:url` — tidak ada jaringan sama sekali. Semua yang di atas
berbiaya **Rp 0** berapa kali pun dijalankan.

### Kalau memang tidak bisa diverifikasi tanpa panggilan berbayar

Katakan apa adanya: **"bagian ini belum diuji karena butuh panggilan
berbayar"**. Laporan jujur jauh lebih baik daripada saldo terpotong
diam-diam. Jangan menulis seolah sesuatu sudah terbukti padahal belum.

---

## Aturan perilaku AI CS

Dikirim ke Claude API sebagai system prompt oleh `web/lib/knowledge.ts`
dan `backend/knowledge.js`. **Setiap tambahan di sini menambah biaya
setiap chat** — pastikan isinya benar-benar memengaruhi cara AI
menjawab pelanggan.

@claude-core.md

## Panduan developer

Tema warna, standar responsivitas, arsitektur, roadmap, estimasi biaya.
Tidak pernah dikirim ke Claude API — bebas ditambah tanpa biaya token.
Wajib diikuti saat membuat atau mengubah halaman UI.

@docs/tech-stack.md
