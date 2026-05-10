import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, PROJECT_STATUS_LABELS, cn } from "@/lib/utils";
import {
  FolderOpen,
  Plus,
  TrendingUp,
  CheckCircle,
  ArrowUpRight,
  Zap,
  BarChart3,
  DollarSign,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DisclaimerButton } from "@/components/shared/legal-disclaimer";
import { TurkeyMapLazy as TurkeyMap } from "@/components/dashboard/turkey-map-lazy";
import { ProjectStatusChanger } from "@/components/ges/project-status-changer";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import {
  COMPLETION_TRANSITION_VALUES,
  isCompletionStatus,
  isProjectVisible,
} from "@/lib/project-status";

const STATUS_BAR_COLOR: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-warning",
  COMPLETED: "bg-success",
  SENT: "bg-info",
  CLOSE_WIN: "bg-success",
  CLOSE_LOST: "bg-muted-foreground/40",
  CANCELLED: "bg-muted-foreground/40",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "info"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  SENT: "info",
  CLOSE_WIN: "success",
  CLOSE_LOST: "secondary",
  CANCELLED: "secondary",
};

export default async function DashboardPage() {
  const user = await requireAuth();

  // Admin disindaki kullanicilar icin gizlenmis proje + musteri ID'lerini al.
  // Gizli musteri => o musteriye bagli projeler de listede cikmaz. Bu
  // /projects sayfasiyla ayni filter mantigi — dashboard'da da gecerli
  // olmaliki KPI sayilari (toplam, MWp), Son Projeler ve harita tutarli.
  const hiddenProjectIds = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "project");
  const hiddenCustomerNames = isAdmin(user)
    ? []
    : await getHiddenResourceIds(user.id, user.organizationId, "customer");

  // Tum gercek projeleri tek sorguda cek; sonra isProjectVisible ile yarim
  // kalmislari filtrele. Yarim kalmis projeler temizleyici tarafindan
  // genelde silinir ama race/cleanup-fail durumlarinda yine de UI'da
  // gozukmesinler.
  const allRawProjects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      isTemplate: false,
      ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
      ...(hiddenCustomerNames.length
        ? { customerName: { notIn: hiddenCustomerNames } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      pricingSnapshot: true,
      projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
    },
  });
  const allVisibleProjects = allRawProjects.filter(isProjectVisible);
  const projects = allVisibleProjects.slice(0, 10);
  // Toplam guc hesabi icin: gucu olan tum gozuken projeler.
  const allProjects = allVisibleProjects.filter((p) => p.totalPowerKw > 0);
  // Turkiye haritasi icin: sadece gozuken projeler.
  const allForMap = allVisibleProjects;

  function getEpcPrice(p: {
    projectDetail?: { kesifA: unknown; kesifB: unknown; settings: unknown } | null;
    totalPowerKw: number;
  }) {
    if (!p.projectDetail) return null;
    try {
      const r = calc(
        p.projectDetail.kesifA as unknown as KesifGroup[],
        p.projectDetail.kesifB as unknown as KesifGroup[],
        p.projectDetail.settings as unknown as GesSettings,
      );
      if (r.salePriceUsd < 100) return null;
      return r;
    } catch {
      return null;
    }
  }

  const totalCount = allVisibleProjects.length;
  const inProgressCount = projects.filter(
    (p) => p.status === "IN_PROGRESS" || p.status === "DRAFT",
  ).length;
  const closeWinCount = projects.filter((p) => p.status === "CLOSE_WIN").length;

  const allWithPrice = allProjects
    .filter((p) => p.totalPowerKw > 0)
    .map((p) => ({ kw: p.totalPowerKw, epc: getEpcPrice(p) }));
  const totalMWp = allWithPrice.reduce((s, p) => s + p.kw / 1000, 0);
  const avgMWp = allWithPrice.length > 0 ? totalMWp / allWithPrice.length : 0;
  const priced = allWithPrice.filter((p) => p.epc);
  const avgUsdPerKwp =
    priced.length > 0
      ? priced.reduce((s, p) => s + p.epc!.salePriceUsd / p.kw, 0) / priced.length
      : 0;

  const provinceCounts: Record<string, number> = {};
  for (const p of allForMap) {
    const il = (p.projectDetail?.settings as GesSettings | null)?.il;
    if (il) provinceCounts[il] = (provinceCounts[il] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero welcome banner — emerald gradient, karşılama */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-700 px-5 py-6 text-primary-foreground shadow-lg sm:px-8 sm:py-7">
        {/* Dekoratif arkaplan parıltıları */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground backdrop-blur-sm">
            <Sparkles className="size-3" />
            Solar EPC Teklif Yönetimi
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Hoş geldin, {(user.fullName ?? user.email ?? "").split(" ")[0]}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-emerald-50/90 sm:text-[15px]">
            Solar EPC projelerinde malzeme ve iş kalemlerini düzenle, kapsamı
            ve maliyeti tek ekranda görüntüle. Şablonlardan başlayarak yeni
            bir proje açabilirsin.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              asChild
              variant="secondary"
              className="bg-white text-primary shadow-sm hover:bg-white/95"
            >
              <Link href="/projects/new">
                <Plus className="size-4" /> Yeni Proje
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-white/10 text-primary-foreground backdrop-blur-sm hover:bg-white/20 hover:text-primary-foreground"
            >
              <Link href="/templates">
                <LayoutTemplate className="size-4" /> Şablonları Gör
              </Link>
            </Button>
            {/* Yasal uyari — modal'da tam metin */}
            <DisclaimerButton />
          </div>
        </div>
      </div>

      {/* KPI ızgaranın tamamı — profesyonel, sade slate paleti, tek aksent
          (emerald) ile rakamlar one chıkar. 6 kart birbiriyle aynı sablonu
          paylasir; renkli kakofoni yok. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totalMWp > 0 && (
          <>
            <MetricCard
              icon={Zap}
              label="Toplam Kurulu Güç"
              value={totalMWp.toFixed(2)}
              unit="MWp"
              sublabel={`bugüne kadar hazırlanan ${allWithPrice.length} teklif`}
            />
            <MetricCard
              icon={BarChart3}
              label="Ortalama Proje Gücü"
              value={avgMWp.toFixed(2)}
              unit="MWp"
              sublabel="proje başına"
            />
            {avgUsdPerKwp > 0 ? (
              <MetricCard
                icon={DollarSign}
                label="Ort. EPC Birim Fiyatı"
                value={Math.round(avgUsdPerKwp).toLocaleString("en-US")}
                unit="$/kWp"
                sublabel="ortalama"
                accent
              />
            ) : (
              <MetricCard
                icon={DollarSign}
                label="EPC Birim Fiyatı"
                value="—"
                sublabel="henüz hesaplanmadı"
                muted
              />
            )}
          </>
        )}
        <MetricCard
          icon={FolderOpen}
          label="Tüm Projeler"
          value={String(totalCount)}
          sublabel="toplam proje"
        />
        <MetricCard
          icon={TrendingUp}
          label="Devam Eden"
          value={String(inProgressCount)}
          sublabel="taslak / süreçte"
        />
        <MetricCard
          icon={CheckCircle}
          label="Close Win"
          value={String(closeWinCount)}
          sublabel="kazanılan proje"
          accent
        />
      </div>

      {/* Son Projeler */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <CardTitle>Son Projeler</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects" className="flex items-center gap-1">
              Tümünü Gör <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
                <FolderOpen className="size-8 text-muted-foreground" />
              </div>
              <p className="font-semibold">Henüz proje yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                İlk projeyi oluşturarak başlayın
              </p>
              <Button asChild className="mt-5">
                <Link href="/projects/new">
                  <Plus className="size-4" />
                  İlk Projeyi Oluştur
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {projects.map((project) => {
                const epc = getEpcPrice(project);
                return (
                  <div
                    key={project.id}
                    className="group flex items-center px-6 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        "mr-4 h-10 w-1 shrink-0 rounded-full",
                        STATUS_BAR_COLOR[project.status] ?? "bg-muted-foreground/40",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {project.customerName} · {formatDate(project.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      {project.totalPowerKw > 0 && (
                        <p className="hidden text-sm font-medium text-muted-foreground sm:block">
                          {project.totalPowerKw >= 1000
                            ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
                            : `${project.totalPowerKw.toFixed(1)} kWp`}
                        </p>
                      )}
                      {epc ? (
                        <div className="hidden text-right md:block">
                          <p className="text-sm font-semibold text-foreground">
                            ${epc.salePriceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Math.round(epc.perKwUsd).toLocaleString("en-US")} $/kWp
                          </p>
                        </div>
                      ) : project.pricingSnapshot ? (
                        <p className="hidden text-sm font-semibold md:block">
                          {formatCurrency(project.pricingSnapshot.finalSalePrice)}
                        </p>
                      ) : null}
                      {isCompletionStatus(project.status) ? (
                        <ProjectStatusChanger
                          projectId={project.id}
                          currentStatus={project.status}
                          allowedTransitions={[...COMPLETION_TRANSITION_VALUES]}
                        />
                      ) : (
                        <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${project.id}/detail`}>Düzenle</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Turkey Map */}
      {Object.keys(provinceCounts).length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <BarChart3 className="size-4" />
              </div>
              <CardTitle>Proje Dağılımı</CardTitle>
            </div>
            <p className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
              Kaydır: yakınlaştır · Sürükle: taşı
            </p>
          </CardHeader>
          <CardContent className="bg-muted/30 p-0">
            <TurkeyMap provinceCounts={provinceCounts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Internal components ---------- */

// Profesyonel, sade KPI/Stat kartı: sol kenarda ince emerald accent, slate
// agirlikli typografi. `accent` props'u ile yalnizca o karta vurgu (emerald
// rakam + kosede dot) verir; "muted" sonuclari icin daha soft.
function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sublabel,
  accent = false,
  muted = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  sublabel: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md",
        muted && "bg-slate-50/60",
      )}
    >
      {/* Sol kenar emerald accent */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          accent ? "bg-emerald-500" : "bg-slate-200",
        )}
      />
      <CardContent className="flex items-start justify-between gap-3 p-4 pl-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              accent ? "text-emerald-700" : muted ? "text-slate-400" : "text-slate-900",
            )}
          >
            {value}
            {unit && (
              <span
                className={cn(
                  "ml-1.5 text-xs font-semibold",
                  accent ? "text-emerald-600/80" : "text-slate-400",
                )}
              >
                {unit}
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-500">{sublabel}</p>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
            accent
              ? "bg-emerald-50 ring-emerald-200/70 text-emerald-700"
              : "bg-slate-100 ring-slate-200 text-slate-600",
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
