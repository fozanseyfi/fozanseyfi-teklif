import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GesDetailNav } from "@/components/ges/ges-detail-nav";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Zap, Sparkles, LayoutTemplate, Lock, Unlock } from "lucide-react";
import type { GesSettings, KesifGroup } from "@/lib/ges-defaults";
import { useTemplate, setTemplateLock } from "@/app/actions/templates";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function hasItems(groups: unknown): boolean {
  if (!Array.isArray(groups)) return false;
  for (const g of groups as KesifGroup[]) {
    for (const it of g.items ?? []) {
      if ((it.miktar ?? 0) > 0) return true;
    }
  }
  return false;
}

function timelineHasData(timeline: unknown): boolean {
  if (!timeline || typeof timeline !== "object") return false;
  const tl = timeline as { rows?: { values?: number[] }[] };
  if (!Array.isArray(tl.rows) || tl.rows.length === 0) return false;
  return tl.rows.some((r) => Array.isArray(r.values) && r.values.some((v) => v > 0));
}

export default async function ProjectDetailLayout({ children, params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
    include: {
      projectDetail: {
        select: { kesifA: true, kesifB: true, settings: true, timeline: true },
      },
    },
  });

  if (!project) notFound();

  const settings = project.projectDetail?.settings as GesSettings | undefined;
  const isTemplate = project.isTemplate;
  const isLocked = isTemplate && project.templateLocked;

  // Progress gates — compute purely from data. A user can complete steps in
  // any order; the nav unlocks downstream tabs as soon as the prerequisite
  // has data. Timeline is now a hard gate before Analiz/CF/BoQ/PBoQ/DoR.
  const progress = {
    info: !!project.name?.trim() && !!project.customerName?.trim(),
    teknik: (settings?.dcGuc ?? 0) > 0 && (settings?.panelGuc ?? 0) > 0,
    kesifA: hasItems(project.projectDetail?.kesifA),
    kesifB: hasItems(project.projectDetail?.kesifB),
    timeline: timelineHasData(project.projectDetail?.timeline),
  };

  // Status etiketi — TASLAK (timeline doldurulmadan) vs TAMAMLANDI (sonra)
  const isCompleted =
    project.status === "COMPLETED" ||
    project.status === "CLOSE_WIN" ||
    project.status === "CLOSE_LOST";
  const statusLabel = isCompleted ? "Tamamlandı" : project.status === "CANCELLED" ? "İptal" : "Taslak";
  const statusVariant: "success" | "secondary" | "destructive" =
    isCompleted ? "success" : project.status === "CANCELLED" ? "destructive" : "secondary";

  function fmtPower(mw: number, suffix: "MWp" | "MWe"): string | null {
    if (mw <= 0) return null;
    if (mw < 1) {
      const kw = mw * 1000;
      const kwSuffix = suffix === "MWp" ? "kWp" : "kWe";
      const decimals = kw < 10 ? 2 : kw < 100 ? 1 : 0;
      return `${kw.toLocaleString("tr-TR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })} ${kwSuffix}`;
    }
    return `${mw.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${suffix}`;
  }
  const dc = settings?.dcGuc ?? project.totalPowerKw / 1000;
  const ac = settings?.acGuc ?? 0;
  const dcLabel = fmtPower(dc, "MWp");
  const acLabel = fmtPower(ac, "MWe");
  const kwLabel = dcLabel
    ? acLabel
      ? `${dcLabel} / ${acLabel}`
      : dcLabel
    : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Tek bir kompakt kart — emerald-soft tonlu, header + nav birleşik;
          kalın kenarlık ile içerikten net ayrılır. */}
      <div className={cn(
        "overflow-hidden rounded-xl border-2 shadow-md",
        isTemplate
          ? "border-info/50 bg-info-soft/20"
          : "border-primary/30 bg-emerald-50/40",
      )}>
        {/* Üst: kompakt proje meta bilgisi — tek satır, sağa yaslanan secondary info */}
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/10 bg-white/40 px-3 py-1.5 backdrop-blur-sm">
          <div className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            isTemplate
              ? "bg-info-soft text-info-soft-foreground"
              : "bg-primary text-primary-foreground",
          )}>
            {isTemplate
              ? <LayoutTemplate className="size-3.5" strokeWidth={2.5} />
              : <Zap className="size-3.5" strokeWidth={2.5} />}
          </div>
          <h1 className="min-w-0 max-w-[280px] truncate text-[13px] font-bold leading-tight tracking-tight text-foreground">
            {project.name || "İsimsiz Proje"}
          </h1>
          {isTemplate ? (
            isLocked ? (
              <Badge className="h-5 border-info/40 bg-info-soft px-1.5 text-[9.5px] text-info-soft-foreground" variant="outline">
                <Lock className="mr-0.5 size-2.5" />
                Şablon · Kilitli
              </Badge>
            ) : (
              <Badge className="h-5 border-warning/40 bg-warning-soft px-1.5 text-[9.5px] text-warning-soft-foreground" variant="outline">
                <Unlock className="mr-0.5 size-2.5" />
                Şablon · Düzenleniyor
              </Badge>
            )
          ) : (
            <Badge className="h-5 px-1.5 text-[9.5px]" variant={statusVariant}>
              {statusLabel}
            </Badge>
          )}

          {/* Sağa yaslanan: müşteri · lokasyon · güç */}
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {!isTemplate && project.customerName && (
              <span className="flex items-center gap-1">
                <User className="size-3 shrink-0" />
                <span className="truncate max-w-[140px]">{project.customerName}</span>
              </span>
            )}
            {!isTemplate && project.projectLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate max-w-[120px]">{project.projectLocation}</span>
              </span>
            )}
            {kwLabel && (
              <span className="flex items-center gap-1 rounded-md bg-primary-soft/60 px-2 py-0.5 font-mono text-[10.5px] font-bold tabular-nums text-primary-soft-foreground">
                <Zap className="size-3" />
                {kwLabel}
              </span>
            )}
          </div>

          {isTemplate && (
            <div className="flex shrink-0 items-center gap-1.5">
              <form
                action={async () => {
                  "use server";
                  await setTemplateLock(id, !project.templateLocked);
                }}
              >
                <button
                  type="submit"
                  title={isLocked ? "Şablonu düzenlemeye aç" : "Son halini kilitle"}
                  className={
                    isLocked
                      ? "inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10.5px] font-semibold text-warning-soft-foreground hover:bg-warning-soft/80"
                      : "inline-flex items-center gap-1 rounded-md border border-info/30 bg-info-soft px-2 py-0.5 text-[10.5px] font-semibold text-info-soft-foreground hover:bg-info-soft/80"
                  }
                >
                  {isLocked ? <Unlock className="size-2.5" /> : <Lock className="size-2.5" />}
                  {isLocked ? "Kilidi Aç" : "Kilitle"}
                </button>
              </form>
              {isLocked && (
                <form
                  action={async () => {
                    "use server";
                    await useTemplate(id);
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10.5px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    <Sparkles className="size-2.5" />
                    Şablonu kullan
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Alt: nav stages — emerald-soft tone, ferah padding */}
        <div className="px-4 py-3">
          <GesDetailNav projectId={id} progress={progress} />
        </div>
      </div>

      <div className={isLocked ? "template-readonly" : undefined}>{children}</div>
    </div>
  );
}
