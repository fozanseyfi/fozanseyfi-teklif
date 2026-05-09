import type { Metadata } from "next";
import { ContactForm } from "@/components/shared/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/site-config";
import { LinkedInIcon } from "@/components/shared/footer";
import { OtherPlatforms } from "@/components/auth/other-platforms";
import { LegalDisclaimerCard } from "@/components/shared/legal-disclaimer";
import {
  MessageSquare,
  Phone,
  Mail,
  Globe,
  ShieldCheck,
  TriangleAlert,
  Code2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "İletişime Geç — SolarTeklif",
};

export default function ContactPage() {
  const { developer } = siteConfig;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="space-y-3 px-7 py-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info-soft px-3 py-1 text-xs font-medium text-info-soft-foreground">
            <MessageSquare className="size-3.5" />
            İletişim &amp; Destek
          </span>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Sizden gelen her geri bildirim platformu daha iyi yapar.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hata bildirimi, özellik önerisi veya genel sorularınız için aşağıdaki
            formdan veya doğrudan iletişim kanallarından bana ulaşabilirsiniz.
          </p>
        </CardContent>
      </Card>

      {/* Developer card + Form */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Developer info — dark card */}
        <Card className="overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground">
          <CardContent className="space-y-5 p-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-border/40">
              <Code2 className="size-4 text-primary" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
                Geliştirici
              </p>
              <p className="text-lg font-semibold tracking-tight text-white">
                {developer.name}
              </p>
              <p className="mt-0.5 text-sm text-sidebar-muted">{developer.role}</p>
            </div>
            <p className="text-xs leading-relaxed text-sidebar-muted">
              {developer.bio}
            </p>

            <div className="space-y-3 border-t border-sidebar-border pt-4">
              <DevContactRow
                icon={Phone}
                label="Telefon"
                value={developer.phone}
                href={`tel:${developer.phone.replace(/\s/g, "")}`}
              />
              <DevContactRow
                icon={Mail}
                label="E-posta"
                value={developer.email}
                href={`mailto:${developer.email}`}
              />
              <DevContactRow
                icon={LinkedInIcon}
                label="LinkedIn"
                value={developer.linkedin.label}
                href={developer.linkedin.href}
              />
              <DevContactRow
                icon={Globe}
                label="Web Sitesi"
                value={developer.website.label}
                href={developer.website.href}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Mesaj Bırakın</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Aşağıdaki formu doldurun, doğrudan e-posta uygulamanız üzerinden
                iletilir.
              </p>
            </div>
            <ContactForm
              recipientEmail={developer.email}
              senderEmail={developer.email}
            />
          </CardContent>
        </Card>
      </div>

      {/* Trust strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-success/30 bg-success-soft/40">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-soft-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-success-soft-foreground">
                Veri Gizliliği
              </p>
              <p className="text-sm font-semibold text-success-soft-foreground">
                Verileriniz size aittir
              </p>
              <p className="text-xs leading-relaxed text-success-soft-foreground/85">
                Tüm veriler hesaplar arası izole edilir. Geliştirici dahil hiçbir
                üçüncü taraf içeriğinizi görmez veya indiremez.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning-soft/40">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
              <TriangleAlert className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-warning-soft-foreground">
                Sorumluluk Reddi
              </p>
              <p className="text-sm font-semibold text-warning-soft-foreground">
                Tahmin aracı — bağlayıcı teklif değildir
              </p>
              <p className="text-xs leading-relaxed text-warning-soft-foreground/85">
                Platformdaki tüm hesaplamalar, marka, model ve fiyat bilgileri
                yalnızca <strong>bilgilendirme amaçlıdır</strong>. Hazırlanan
                tekliflerin doğruluğu, güncelliği ve uygulanabilirliği tamamen
                kullanıcının sorumluluğundadır.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Yasal Uyarı — paylasilan reusable kart */}
      <LegalDisclaimerCard />

      {/* Diğer platformlar — fozanseyfi.com altındaki kardeş siteler */}
      <OtherPlatforms variant="compact" />
    </div>
  );
}

function DevContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="flex items-start gap-3 rounded-md p-1.5 -m-1.5 transition-colors hover:bg-sidebar-border/40"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-border/40 text-sidebar-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
          {label}
        </p>
        <p className="truncate text-sm text-white">{value}</p>
      </div>
    </a>
  );
}
