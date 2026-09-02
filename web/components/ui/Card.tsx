/* ===========================================================
   Kartu putih — pengganti `.card` + `.card-head` yang selama
   ini ditulis ulang di beranda.css, statistik.css, pesanan.css,
   broadcast.css, dan settings.css dengan nilai yang sama persis.
   Satu komponen supaya sudut, garis, dan bayangannya tidak
   pelan-pelan berbeda antar halaman.
   =========================================================== */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[18px] border border-line bg-white p-5 px-5.5 shadow-[0_8px_30px_rgb(15_23_42/0.04)] max-mini:p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  note,
  children,
}: {
  title: string;
  /** Teks miring kecil di kanan judul (mis. "sesuai claude.md"). */
  note?: string;
  /** Aksi di kanan: tab tanggal, tautan, legenda. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4.5 flex flex-wrap items-center justify-between gap-2.5">
      <h2 className="m-0 text-[1.05rem] font-bold">{title}</h2>
      {note && <span className="text-[0.76rem] text-muted italic">{note}</span>}
      {children}
    </div>
  );
}

/** Tautan kecil hijau di sudut kartu ("Kelola ›", "Lihat Lainnya ›"). */
export function CardLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-[0.85rem] font-semibold text-green-dark no-underline hover:underline"
    >
      {children}
    </a>
  );
}
