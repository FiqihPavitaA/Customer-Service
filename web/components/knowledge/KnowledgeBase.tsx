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

import { useState } from "react";
import TemplateManager from "@/components/settings/TemplateManager";
import KataSensitif from "./KataSensitif";

/* KENAPA KATA SENSITIF JADI TAB DI SINI, BUKAN IKON RAIL SENDIRI

   Dua alasan, dan yang kedua yang menentukan.

   Pertama, rail sudah memuat 7 ikon; menambah yang kedelapan
   membuat baris bawah di mobile mulai perlu digulir mendatar.

   Kedua, keduanya menjawab pertanyaan yang sama — "apa yang
   menentukan balasan pelanggan" — hanya pada lapisan berbeda.
   Template menentukan APA yang dijawab; kata sensitif menentukan
   APA YANG TIDAK BOLEH dijawab mesin sama sekali. Orang yang
   sedang menelusuri kenapa sebuah pesan dibalas begitu perlu
   melihat keduanya, dan memisahkannya ke dua halaman berarti ia
   harus sudah tahu lebih dulu di lapisan mana jawabannya berada —
   padahal itulah yang sedang ia cari. */

type Tab = "template" | "sensitif";

export default function KnowledgeBase() {
  const [tab, setTab] = useState<Tab>("template");

  const tombol = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      aria-current={tab === id}
      className={`cursor-pointer whitespace-nowrap border-none bg-transparent px-1 pb-2 text-[0.92rem] font-bold transition ${
        tab === id
          ? "border-b-2 border-solid border-green text-green-dark"
          : "text-muted hover:text-text-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-page p-5 px-6 pb-10 max-mobile:p-3.5 max-mobile:pb-8">
      <div className="mb-3">
        <h2 className="m-0 mb-1 text-[1.4rem] font-bold">📚 Knowledge Base</h2>
        <p className="m-0 text-[0.88rem] leading-relaxed text-muted">
          {tab === "template"
            ? "Sumber jawaban AI. Pilih sebuah template untuk melihat balasannya dan menambahkan contoh pertanyaan — semakin banyak ragam kalimat pelanggan yang ditulis, semakin sering AI menjawab tanpa biaya."
            : "Kata yang membuat pesan langsung dialihkan ke CS manusia, sebelum AI dipanggil sama sekali. Diperiksa paling awal, jadi biayanya Rp 0."}
        </p>
      </div>

      {/* flex-wrap + overflow-x: dua tab masih muat di layar sempit,
          tapi aturannya ditegakkan sejak sekarang supaya tab ketiga
          tidak memotong tata letak di mobile. */}
      <div className="mb-4 flex gap-4 overflow-x-auto border-0 border-b border-solid border-line-soft">
        {tombol("template", "🗂️ Template Jawaban")}
        {tombol("sensitif", "🛡️ Kata Sensitif")}
      </div>

      {tab === "template" ? <TemplateManager /> : <KataSensitif />}
    </div>
  );
}
