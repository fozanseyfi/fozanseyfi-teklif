import { requireAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bell,
  Megaphone,
  Eye,
  UserPlus,
  Edit3,
  Settings,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationType {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  tone: "primary" | "info" | "success" | "warning";
}

const TYPES: NotificationType[] = [
  {
    icon: Megaphone,
    label: "Platform Duyuruları",
    desc: "Yeni özellik, bakım, sürüm notu — geliştirici tarafından firmana gönderilir.",
    tone: "primary",
  },
  {
    icon: Eye,
    label: "Görüntüleme Olayları",
    desc: "Bir görüntüleyici (Viewer) projeni açtığında bildirilir.",
    tone: "info",
  },
  {
    icon: Edit3,
    label: "Düzenleme Olayları",
    desc: "Ekibinden biri Keşif, Timeline, Marj gibi alanlarda değişiklik yaparsa bildirilir.",
    tone: "warning",
  },
  {
    icon: UserPlus,
    label: "Yetki & Davet",
    desc: "Firmana yeni üye eklendiğinde ya da rol değiştirildiğinde bildirilir.",
    tone: "success",
  },
];

const TONE_STYLES: Record<NotificationType["tone"], string> = {
  primary: "bg-primary-soft text-primary-soft-foreground border-primary/30",
  info: "bg-info-soft text-info-soft-foreground border-info/30",
  success: "bg-success-soft text-success-soft-foreground border-success/30",
  warning: "bg-warning-soft text-warning-soft-foreground border-warning/30",
};

export default async function NotificationsPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
        <div className="flex items-start gap-4 p-6 sm:items-center">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Bell className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Bildirimler
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform duyuruları, ekip aktiviteleri ve yetki bildirimlerini buradan görürsün.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex"
            title="Tüm bildirimleri okundu olarak işaretle (yakında)"
          >
            <CheckCheck className="size-3.5" />
            Tümünü Okundu İşaretle
          </button>
        </div>
      </div>

      {/* Boş durum */}
      <Card className="overflow-hidden border-dashed shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Bell className="size-6" />
          </div>
          <h2 className="text-base font-bold text-foreground">Henüz bildirim yok</h2>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Platform duyuruları, ekip arkadaşlarının yaptığı değişiklikler ve yetki bildirimleri
            burada listelenecek. Yakında aktif olacak.
          </p>
        </CardContent>
      </Card>

      {/* Bildirim tipleri */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Settings className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bildirim Türleri
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TYPES.map((t) => (
            <Card key={t.label} className="overflow-hidden shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                    TONE_STYLES[t.tone],
                  )}
                >
                  <t.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground">{t.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {t.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Roadmap notu */}
      <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-4">
        <div className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-warning-soft-foreground">
          <Megaphone className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Yakında aktif:</strong> Bildirim altyapısı planlandı; önce ekip-üye bildirimleri,
            ardından platform duyuruları çalışmaya başlayacak. Geliştirici tarafından gönderilen
            sürüm notları, bakım uyarıları ve yeni özellik haberleri buradan firma yöneticilerine
            iletilecek.
          </p>
        </div>
      </div>
    </div>
  );
}
