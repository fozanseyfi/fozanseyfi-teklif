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
          <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1 font-medium text-foreground hover:bg-secondary"
          >
            <span aria-hidden="true">←</span>
            <span className="sm:hidden">Geri</span>
            <span className="hidden sm:inline">Giriş ekranına dön</span>
          </Link>
          <span className="hidden truncate font-semibold text-foreground sm:inline">
            SolarTeklif <span className="font-normal text-muted-foreground">· Platform Tanıtımı</span>
          </span>
          </div>
          <nav className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <a href="https://www.linkedin.com/in/fozanseyfi/" target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" /></svg>
              </a>
              <a href="https://fozanseyfi.com" target="_blank" rel="noopener noreferrer" title="fozanseyfi.com" aria-label="fozanseyfi.com" className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
              </a>
              <a href="mailto:fozanseyfi@gmail.com" title="E-posta" aria-label="E-posta" className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              </a>
            </span>
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
        <TourView top={48 + 16} />
      </main>
    </div>
  );
}
