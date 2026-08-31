import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Berkas KB di `content/` dibaca saat runtime lewat fs, jadi
   * Next.js tidak bisa mendeteksinya otomatis. Tanpa baris ini,
   * build Vercel akan lolos tetapi /api/chat gagal baca KB di
   * produksi. Kunci "/api/*" mencakup /api/chat & /api/health.
   */
  outputFileTracingIncludes: {
    "/api/*": ["content/**/*"],
  },
};

export default nextConfig;
