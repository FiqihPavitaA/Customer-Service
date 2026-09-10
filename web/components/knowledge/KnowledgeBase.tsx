"use client";

/* ===========================================================
   Halaman Knowledge Base — /knowledge

   Dipindahkan dari Pengaturan → Knowledge Base → Template Jawaban
   pada 10 Sep 2026. Alasannya ada di komentar RAIL_MAIN
   (lib/nav.ts): kategorinya berubah dari konfigurasi menjadi
   pekerjaan harian, dan navigasinya tertinggal.

   KENAPA SELURUH PENGELOLA TEMPLATE IKUT PINDAH, BUKAN HANYA
   BAGIAN CONTOH PERTANYAAN

   Rencana awal memisahkan keduanya: contoh pertanyaan untuk CS,
   pengelolaan template tetap di Pengaturan untuk admin. Ternyata
   tidak bisa — contoh pertanyaan diisi PER TEMPLATE, jadi
   editornya menumpang pada daftar template yang sama. Memisahkan
   keduanya berarti menduplikasi daftar itu, dan dua daftar
   template yang harus dijaga tetap sepadan adalah harga yang jauh
   lebih mahal daripada masalah yang dipecahkannya.

   Yang menjaga dosis tetap aman bukan jarak navigasi, melainkan
   dua lapis yang sudah ada dan tidak berubah:

     RLS   templates_write ... using (public.is_admin())
     UI    bolehUbah = isDemo || isAdmin, plus keterangan 🔒 yang
           menjelaskan kepada CS kenapa tombolnya mati

   Peran `cs` tetap tidak bisa menyimpan perubahan template, sedekat
   apa pun ikonnya di rail. Yang BISA ia simpan adalah contoh
   pertanyaan — dan kebijakan template_examples memang sudah
   `to authenticated using (true)` sejak awal.
   =========================================================== */

import TemplateManager from "@/components/settings/TemplateManager";

export default function KnowledgeBase() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-page p-5 px-6 pb-10 max-mobile:p-3.5 max-mobile:pb-8">
      <div className="mb-4">
        <h2 className="m-0 mb-1 text-[1.4rem] font-bold">📚 Knowledge Base</h2>
        <p className="m-0 text-[0.88rem] leading-relaxed text-muted">
          Sumber jawaban AI. Pilih sebuah template untuk melihat balasannya dan
          menambahkan contoh pertanyaan — semakin banyak ragam kalimat pelanggan
          yang ditulis, semakin sering AI menjawab tanpa biaya.
        </p>
      </div>

      <TemplateManager />
    </div>
  );
}
