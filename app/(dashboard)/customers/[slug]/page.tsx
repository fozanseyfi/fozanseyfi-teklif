import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDate,
  PROJECT_STATUS_LABELS,
  INSTALLATION_TYPE_LABELS,
} from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Lightbulb,
  ArrowUpRight,
  FolderOpen,
  Plus,
} from "lucide-react";
import type { GesSettings } from "@/lib/ges-defaults";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "info"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  SENT: "info",
  CLOSE_WIN: "success",
  CLOSE_LOST: "secondary",
  CANCELLED: "secondary",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-warning",
  COMPLETED: "bg-success",
  SENT: "bg-info",
  CLOSE_WIN: "bg-success",
  CLOSE_LOST: "bg-muted-foreground/40",
  CANCELLED: "bg-muted-foreground/40",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { slug } = await params;
  const customerName = decodeURIComponent(slug);
  const user = await requireAuth();

  const projects = await prisma.project.findMany({
    where: { firmId: user.firmId, isTemplate: false, customerName },
    orderBy: { updatedAt: "desc" },
    include: {
      pricingSnapshot: true,
      projectDetail: { select: { settings: true } },
    },
  });

  if (projects.length === 0) notFound();

  const latest = projects[0];
  const settings = latest.projectDetail?.settings as GesSettings | null;
  const insights: string[] = settings?.customerInsights ?? [];
  const totalKw = projects.reduce((s, p) => s + p.totalPowerKw, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/customers">
          <ArrowLeft className="size-3.5" />
          Müşterilere dön
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm">
          {customerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{customerName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects.length} proje · Son güncelleme {formatDate(latest.updatedAt)}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* Contact + insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>İletişim Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {latest.customerPhone && (
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info-soft">
                  <Phone className="size-4 text-info-soft-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Telefon
                  </p>
                  <p className="text-sm font-medium">{latest.customerPhone}</p>
                </div>
              </div>
            )}
            {latest.customerEmail && (
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                  <Mail className="size-4 text-primary-soft-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    E-posta
                  </p>
                  <p className="truncate text-sm font-medium">{latest.customerEmail}</p>
                </div>
              </div>
            )}
            {latest.customerAddress && (
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <MapPin className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Adres
                  </p>
                  <p className="text-sm">{latest.customerAddress}</p>
                </div>
              </div>
            )}
            {!latest.customerPhone && !latest.customerEmail && !latest.customerAddress && (
              <p className="text-sm text-muted-foreground">İletişim bilgisi girilmemiş.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-info-soft-foreground" />
              Müşteri Öngörüleri
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz öngörü/not eklenmemiş. Proje detayında ekleyebilirsiniz.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {insights.map((ins, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-info-soft-foreground/60">→</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b py-4">
          <div>
            <CardTitle>Projeler</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {projects.length} proje · Toplam {totalKw >= 1000 ? `${(totalKw / 1000).toFixed(2)} MWp` : `${totalKw.toFixed(1)} kWp`}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/detail`}
                className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/40"
              >
                <div
                  className={cn(
                    "h-10 w-1 shrink-0 rounded-full",
                    STATUS_BAR_COLOR[p.status] ?? "bg-muted-foreground/40",
                  )}
                />
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <FolderOpen className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {INSTALLATION_TYPE_LABELS[p.installationType]} · {formatDate(p.updatedAt)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  {p.totalPowerKw > 0 && (
                    <p className="text-sm font-medium text-muted-foreground">
                      {p.totalPowerKw >= 1000
                        ? `${(p.totalPowerKw / 1000).toFixed(2)} MWp`
                        : `${p.totalPowerKw.toFixed(1)} kWp`}
                    </p>
                  )}
                  {p.pricingSnapshot && (
                    <p className="text-xs font-semibold">
                      {formatCurrency(p.pricingSnapshot.finalSalePrice)}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                  {PROJECT_STATUS_LABELS[p.status]}
                </Badge>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
