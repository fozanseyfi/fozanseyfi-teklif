import type { Metadata } from "next";
import Link from "next/link";
import { TourView } from "@/components/tanitim/tour-view";

export const metadata: Metadata = {
  title: "Platform Tanıtımı — SolarTeklif",
  description: "SolarTeklif platformunun bütün modülleri, gerçek ekranlar üzerinden adım adım.",
};

/** Herkese açık tanıtım sayfası (giriş gerektirmez). Platform içindeki kopyası: /platform-tanitimi */
export default function TanitimPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center justify-between px-4 text-[13px]">
          <span className="font-semibold">
            SolarTeklif <span className="font-normal text-muted-foreground">· Platform Tanıtımı</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/register" className="hidden border border-border px-3 py-1 hover:bg-secondary sm:inline-block">
              Kayıt Ol
            </Link>
            <Link href="/login" className="border border-primary bg-primary px-3 py-1 font-medium text-primary-foreground hover:opacity-90">
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>
      <main className="px-4 py-4">
        <TourView top={48 + 32} />
      </main>
    </div>
  );
}
