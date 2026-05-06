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
} from "lucide-react";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import { DeleteProjectButton } from "@/components/project/delete-project-button";
import { TurkeyMap } from "@/components/dashboard/turkey-map";
import {
  ProjectStatusChanger,
  COMPLETION_TRANSITION_VALUES,
} from "@/components/ges/project-status-changer";

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

  const [projects, allProjects, allForMap] = await Promise.all([
    prisma.project.findMany({
      where: { firmId: user.firmId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        pricingSnapshot: true,
        projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
      },
    }),
    prisma.project.findMany({
      where: { firmId: user.firmId, totalPowerKw: { gt: 0 } },
      select: {
        totalPowerKw: true,
        projectDetail: { select: { kesifA: true, kesifB: true, settings: true } },
      },
    }),
    prisma.project.findMany({
      where: { firmId: user.firmId },
      select: { projectDetail: { select: { settings: true } } },
    }),
  ]);

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

  const totalCount = await prisma.project.count({ where: { firmId: user.firmId } });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Merhaba, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            İşte projelerinizin genel durumu
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" />
            Yeni Proje
          </Link>
        </Button>
      </div>

      {/* MWp Stats — clean stat cards */}
      {totalMWp > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Toplam Kurulu Güç"
            value={totalMWp.toFixed(2)}
            unit="MWp"
            sublabel="kurulu kapasite"
            icon={Zap}
            tone="primary"
          />
          <StatCard
            label="Ortalama Proje Gücü"
            value={avgMWp.toFixed(2)}
            unit="MWp"
            sublabel="proje başına"
            icon={BarChart3}
            tone="info"
          />
          {avgUsdPerKwp > 0 ? (
            <StatCard
              label="Ort. EPC Birim Fiyatı"
              value={avgUsdPerKwp.toFixed(3)}
              unit="$/kWp"
              sublabel="ortalama"
              icon={DollarSign}
              tone="success"
            />
          ) : (
            <StatCard
              label="EPC Birim Fiyatı"
              value="—"
              sublabel="henüz hesaplanmadı"
              icon={DollarSign}
              tone="muted"
            />
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={FolderOpen}
          label="Tüm Projeler"
          value={totalCount}
          sublabel="toplam proje"
          tone="muted"
        />
        <KpiCard
          icon={TrendingUp}
          label="Devam Eden"
          value={inProgressCount}
          sublabel="taslak / süreçte"
          tone="info"
        />
        <KpiCard
          icon={CheckCircle}
          label="Close Win"
          value={closeWinCount}
          sublabel="kazanılan proje"
          tone="success"
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
                            {epc.perKwUsd.toFixed(3)} $/kWp
                          </p>
                        </div>
                      ) : project.pricingSnapshot ? (
                        <p className="hidden text-sm font-semibold md:block">
                          {formatCurrency(project.pricingSnapshot.finalSalePrice)}
                        </p>
                      ) : null}
                      {COMPLETION_TRANSITION_VALUES.includes(project.status) ? (
                        <ProjectStatusChanger
                          projectId={project.id}
                          currentStatus={project.status}
                          allowedTransitions={COMPLETION_TRANSITION_VALUES}
                        />
                      ) : (
                        <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Link href={`/projects/${project.id}/detail`}>Düzenle</Link>
                      </Button>
                      <DeleteProjectButton projectId={project.id} />
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

type Tone = "primary" | "info" | "success" | "warning" | "muted";

const TONE_STYLES: Record<Tone, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary-soft", iconText: "text-primary-soft-foreground" },
  info: { iconBg: "bg-info-soft", iconText: "text-info-soft-foreground" },
  success: { iconBg: "bg-success-soft", iconText: "text-success-soft-foreground" },
  warning: { iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground" },
  muted: { iconBg: "bg-secondary", iconText: "text-muted-foreground" },
};

function StatCard({
  label,
  value,
  unit,
  sublabel,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {value}
            {unit && <span className="ml-1.5 text-sm font-medium text-muted-foreground">{unit}</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", t.iconBg)}>
          <Icon className={cn("size-5", t.iconText)} />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel: string;
  tone: Tone;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className={cn("flex size-9 items-center justify-center rounded-lg", t.iconBg)}>
            <Icon className={cn("size-4", t.iconText)} />
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      </CardContent>
    </Card>
  );
}
