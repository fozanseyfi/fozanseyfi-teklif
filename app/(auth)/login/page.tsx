"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Sun, Sparkles, Mail, Globe } from "lucide-react";
import { LoginDemo } from "@/components/auth/login-demo";
import { PlatformNoteCard, PrivacyCard } from "@/components/auth/login-info";
import { OtherPlatforms } from "@/components/auth/other-platforms";

const DEV_LINKS = {
  linkedin: "https://www.linkedin.com/in/furkan-ozan-seyfi",
  portfolio: "https://fozanseyfi.com",
  email: "mailto:ozan.seyfi@kontrolmatik.com",
};

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>
  );
}

function SocialIcons({ size = "size-4" }: { size?: string }) {
  return (
    <>
      <a
        href={DEV_LINKS.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        title="LinkedIn"
        className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
      >
        <LinkedInIcon className={size} />
      </a>
      <a
        href={DEV_LINKS.portfolio}
        target="_blank"
        rel="noopener noreferrer"
        title="fozanseyfi.com"
        className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
      >
        <Globe className={size} />
      </a>
      <a
        href={DEV_LINKS.email}
        title="E-posta"
        className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft hover:text-primary-soft-foreground"
      >
        <Mail className={size} />
      </a>
    </>
  );
}

export default function LoginPage() {
  const [result, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-soft-gradient">
      {/* TOP HEADER — responsive */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-10">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-9">
              <Sun className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-bold tracking-tight text-foreground sm:text-sm">
                SolarTeklif
              </p>
              <p className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Solar Teklif Platformu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <SocialIcons />
            </div>
            <Link
              href="/register"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:ml-1.5 sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-xs"
            >
              <Sparkles className="size-3 sm:size-3.5" />
              <span className="hidden xs:inline">Hesap Oluştur</span>
              <span className="xs:hidden">Kayıt</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN — 2-kolon (lg+), tek kolon mobil/tablet */}
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 pb-8 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(380px,5fr)_7fr] lg:gap-12 lg:px-10 lg:pt-12">
        {/* SOL — Form */}
        <section className="flex flex-col">
          <div className="flex flex-1 flex-col">
            <div className="mx-auto w-full max-w-md animate-in-up">
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-soft-foreground sm:px-3 sm:py-1 sm:text-[10px]">
                <Sparkles className="size-2.5 sm:size-3" />
                Bağımsız bir inisiyatif
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[2.4rem] lg:leading-tight">
                Hoş Geldiniz
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground sm:mt-2 sm:text-sm">
                Hesabınıza giriş yapın ve teklif yönetimine kaldığınız yerden devam edin.
              </p>

              <form action={action} className="mt-5 space-y-3.5 sm:mt-7 sm:space-y-4">
                {result?.error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive-soft-foreground">
                    {result.error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="ornek@firma.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Şifre</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Şifremi unuttum
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="h-10 w-full text-sm font-semibold" disabled={pending}>
                  {pending ? "Yükleniyor..." : "Giriş Yap"}
                </Button>
              </form>

              <p className="mt-4 text-center text-[13px] text-muted-foreground sm:mt-5 sm:text-sm">
                Hesabın yok mu?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Hemen kayıt ol
                </Link>
              </p>

              {/* Bilgi paylaşımı kartı — form genişliğinde (Giriş Yap butonu ile aynı) */}
              <div className="mt-5 sm:mt-6">
                <PlatformNoteCard />
              </div>
            </div>
          </div>
        </section>

        {/* SAĞ — Animasyon + altında Veri Gizliliği. lg'den önce gizli
            (mobile/tablet'te yer kaplamayan demo); lg+'da self-start ile
            sol büyüse de etkilenmez. */}
        <section className="hidden flex-col gap-4 lg:flex lg:self-start">
          <LoginDemo />
          <PrivacyCard />
        </section>
      </main>

      {/* DİĞER PLATFORMLAR — geliştirici footer'ının hemen üstü */}
      <OtherPlatforms />

      {/* DEVELOPER FOOTER — karardestek tarzi, responsive */}
      <footer className="border-t border-border/60 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4 sm:px-6 sm:py-5 sm:text-[12px] lg:px-10">
          <span className="flex flex-wrap items-center justify-center gap-1.5 text-center sm:text-left">
            <span>© {new Date().getFullYear()} SolarTeklif</span>
            <span className="text-muted-foreground/60">·</span>
            <span>
              Tasarım & Geliştirme:{" "}
              <a
                href={DEV_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-primary hover:underline"
              >
                Furkan Ozan Seyfi
              </a>
            </span>
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SocialIcons />
          </div>
        </div>
      </footer>
    </div>
  );
}
