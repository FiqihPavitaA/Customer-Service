# Instruksi Proyek — AI Customer Service Infarm

> Berkas ini **hanya untuk Claude Code / agen coding**, bukan system
> prompt aplikasi. Isinya cuma menunjuk ke dua dokumen di bawah.
>
> Sejak 2 September 2026 `claude.md` lama dipecah dua supaya dokumentasi
> developer tidak ikut dibayar sebagai token di setiap chat pelanggan
> (hemat ±16% token system prompt). Cadangannya ada di `claude.md.OLD`.

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
