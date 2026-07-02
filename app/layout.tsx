import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/shared/pwa-register";

// latin-ext sart: Turkce-spesifik harfler (g, s, I) Latin Extended-A blogunda;
// "latin" subset'i bunlari icermez, eksik olunca tarayici sistem fontuna
// fallback yapar ve kelimenin ortasinda font degisikligi gorunur.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SolarTeklif — Solar EPC Teklif Yönetim Platformu",
  description: "Solar EPC projelerinde maliyet, kapsam ve teklif kalemlerini düzenli tutmak için bireysel inisiyatifle geliştirilmiş bir araç.",
  applicationName: "SolarTeklif",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SolarTeklif" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
