import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SolarTeklif — Solar EPC Teklif Yönetim Platformu",
  description: "Solar EPC projelerinde maliyet, kapsam ve teklif kalemlerini düzenli tutmak için bireysel inisiyatifle geliştirilmiş bir araç.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
