import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SolarTeklif — Güneş Enerjisi Teklif Platformu",
  description: "Solar enerji projeleriniz için hızlı, profesyonel teklif hazırlayın",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className={`${inter.className} min-h-full bg-slate-50 text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
