import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

/* Font Inter — sama dengan stack font di styles.css/dashboard.css lama. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Infarm CS — Console",
    template: "Infarm CS — %s",
  },
  description:
    "Console Customer Service Infarm: inbox chat marketplace, pesanan, broadcast, dan AI Chatbot.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      {/* AuthProvider dipasang di akar, bukan di (dashboard), supaya
          halaman login dan console memakai sesi yang sama. */}
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
