import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./dark.css";
import { PwaRegister } from "@/components/shared/pwa-register";
import { I18nRoot } from "@/components/shared/i18n-root";

// İlk boyamadan önce: gece modu sınıfı + EN ise çeviri bitene kadar gövdeyi gizle (yanıp sönme olmaz).
// Yazdırma sırasında gece modu kapatılır (kâğıt çıktısı her zaman açık zeminli).
const BOOT_SCRIPT =
  "try{var d=document.documentElement;if(localStorage.getItem('theme')==='dark')d.classList.add('dark');" +
  "if(/(^|; )locale=en/.test(document.cookie)){d.classList.add('i18n-pending');setTimeout(function(){d.classList.remove('i18n-pending')},2500)}" +
  "var w=false;addEventListener('beforeprint',function(){w=d.classList.contains('dark');d.classList.remove('dark')});" +
  "addEventListener('afterprint',function(){if(w)d.classList.add('dark')})}catch(e){}";

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
    <html lang="tr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
        <PwaRegister />
        <I18nRoot />
      </body>
    </html>
  );
}
