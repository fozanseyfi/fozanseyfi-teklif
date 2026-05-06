import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GesDetailNav } from "@/components/ges/ges-detail-nav";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, User, Zap } from "lucide-react";
import type { GesSettings, KesifGroup } from "@/lib/ges-defaults";

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

  const kwLabel =
    project.totalPowerKw >= 1000
      ? `${(project.totalPowerKw / 1000).toFixed(2)} MWp`
      : project.totalPowerKw > 0
        ? `${project.totalPowerKw.toFixed(1)} kWp`
        : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      {/* Project header — token-based, glass over background */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-4 px-5 py-3.5">
          <Link
            href="/projects"
            aria-label="Projelere dön"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Zap className="size-5" strokeWidth={2.5} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight">
                {project.name || "İsimsiz Proje"}
              </h1>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {project.customerName && (
                <span className="flex items-center gap-1">
                  <User className="size-3 shrink-0" />
                  {project.customerName}
                </span>
              )}
              {project.projectLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" />
                  {project.projectLocation}
                </span>
              )}
            </div>
          </div>

          {kwLabel && (
            <div className="hidden shrink-0 items-center gap-3 rounded-lg border border-primary/20 bg-primary-soft/40 px-4 py-2 sm:flex">
              <Zap className="size-4 text-primary-soft-foreground/70" />
              <div>
                <p className="text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-primary-soft-foreground/70">
                  Kurulu Güç
                </p>
                <p className="mt-1 text-lg font-bold leading-none tracking-tight tabular-nums text-primary-soft-foreground">
                  {kwLabel}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <GesDetailNav projectId={id} progress={progress} />

      <div>{children}</div>
    </div>
  );
}
