import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-access";
import { GesDetailNav } from "@/components/ges/ges-detail-nav";
import { QuoteDetailNav } from "@/components/ges/quote-detail-nav";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Zap, Sparkles, LayoutTemplate, Lock, Unlock, GitBranch, Package } from "lucide-react";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_TONE } from "@/lib/pipeline-labels";
import type { GesSettings, KesifGroup } from "@/lib/ges-defaults";
import { useTemplate, setTemplateLock } from "@/app/actions/templates";
import { cn } from "@/lib/utils";
import { UnstartedProjectCleanup } from "@/components/ges/unstarted-cleanup";
import { ViewModeOverride } from "@/components/ges/view-mode-override";

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

  // Hide kontrolu — gizliyse 404. Lock kontrolu sayfa formlarinda yapilir.
  const access = await getProjectAccess(user, id);
  if (!access || !access.canView) notFound();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      projectDetail: {
        select: { kesifA: true, kesifB: true, settings: true, timeline: true },
      },
    },
  });

  if (!project) notFound();

  const settings = project.projectDetail?.settings as GesSettings | undefined;
  const isTemplate = project.isTemplate;
  const isTemplateLocked = isTemplate && project.templateLocked;
  // Salt-okunur mod: ya sablon kilidi ya da kullaniciya ozel kilit/viewer rolu.
  // access.canEdit false oldugunda sayfa view-only olur — edit affordance'lari
  // template-readonly CSS ile gizlenir.
  const isLocked = isTemplateLocked || !access.canEdit;
  const lockReason: "template" | "user" = isTemplateLocked ? "template" : "user";

  // gesStep — settings JSON'una gomulu, save action'larinda "Kaydet & İlerle"
  // basildiginda artirilir. Yeni proje ve sablon klonu 0'dan baslar; her
  // sekme acilmasi icin onceki sekmenin advance'i gerekli. Sablonlar icin
  // gesStep'i ignore et (zaten her sey acik gozuksun).
  const settingsRecord = (project.projectDetail?.settings as Record<string, unknown> | undefined) ?? {};
  const gesStep = isTemplate ? 5 : Math.max(0, Number(settingsRecord.gesStep) || 0);

  // Malzeme & Hizmet teklifi: ayrı (sade) akış. quoteStep: 1=müşteri, 2=kalemler, 3=analiz.
  const isMaterialService = project.quoteKind === "MATERIAL_SERVICE";
  const quoteStep = Math.max(0, Number(settingsRecord.quoteStep) || 0);

  // Progress gates — gesStep'e gore. Sablon haricinde, sadece ileri-advance
  // ile sekmeler acilir (hem yeni proje hem sablon klonu).
  const progress = {
    info: gesStep >= 1,
    teknik: gesStep >= 2,
    kesifA: gesStep >= 3,
    kesifB: gesStep >= 4,
    timeline: gesStep >= 5,
  };

  // Status etiketi — gesStep ve project.status birlikte:
  // - CANCELLED  → İptal
  // - CLOSE_WIN/CLOSE_LOST → ilgili
  // - COMPLETED veya gesStep == 5 → Tamamlandı
  // - aksi halde → Taslak
  const isCompleted =
    project.status === "COMPLETED" ||
    project.status === "CLOSE_WIN" ||
    project.status === "CLOSE_LOST" ||
    (isMaterialService ? quoteStep >= 3 : gesStep >= 5);
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
      {/* Yarim kalmis proje temizleyicisi: kullanici Proje + Teknik
          sekmelerini Kaydet & İlerle ile gecmeden detail'den ayrilirsa
          projeyi DB'den sessizce siler. Sablonlar etkilenmez (gesStep=5
          set edilir). */}
      {!isTemplate && !isMaterialService && gesStep < 2 && (
        <UnstartedProjectCleanup projectId={id} initialGesStep={gesStep} />
      )}
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
              : isMaterialService
                ? <Package className="size-3.5" strokeWidth={2.5} />
                : <Zap className="size-3.5" strokeWidth={2.5} />}
          </div>
          <h1 className="min-w-0 max-w-[280px] truncate text-[13px] font-bold leading-tight tracking-tight text-foreground">
            {project.name || "İsimsiz Proje"}
          </h1>
          {isTemplate ? (
            isTemplateLocked ? (
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
          ) : isLocked ? (
            <Badge className="h-5 border-info/40 bg-info-soft px-1.5 text-[9.5px] text-info-soft-foreground" variant="outline">
              <Lock className="mr-0.5 size-2.5" />
              Salt Okunur
            </Badge>
          ) : (
            <Badge className="h-5 px-1.5 text-[9.5px]" variant={statusVariant}>
              {statusLabel}
            </Badge>
          )}

          {/* Pipeline aşaması — durum badge'in yaninda, sablonlar disinda gozukur.
              Detayli yonetim Pipeline sekmesinde. */}
          {!isTemplate && project.pipelineStage && (
            <span
              className={cn(
                "inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-[9.5px] font-semibold uppercase tracking-wider",
                PIPELINE_STAGE_TONE[project.pipelineStage],
              )}
              title="Pipeline aşaması — Pipeline sekmesinden yönetin"
            >
              <GitBranch className="mr-0.5 size-2.5" />
              {PIPELINE_STAGE_LABELS[project.pipelineStage]}
            </span>
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
                  title={isTemplateLocked ? "Şablonu düzenlemeye aç" : "Son halini kilitle"}
                  className={
                    isTemplateLocked
                      ? "inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10.5px] font-semibold text-warning-soft-foreground hover:bg-warning-soft/80"
                      : "inline-flex items-center gap-1 rounded-md border border-info/30 bg-info-soft px-2 py-0.5 text-[10.5px] font-semibold text-info-soft-foreground hover:bg-info-soft/80"
                  }
                >
                  {isTemplateLocked ? <Unlock className="size-2.5" /> : <Lock className="size-2.5" />}
                  {isTemplateLocked ? "Kilidi Aç" : "Kilitle"}
                </button>
              </form>
              {isTemplateLocked && (
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
          {isMaterialService ? (
            <QuoteDetailNav projectId={id} step={quoteStep} />
          ) : (
            <GesDetailNav projectId={id} progress={progress} />
          )}
        </div>
      </div>

      {/* View mode (?view=1) destegi: kullanici Görüntüle butonu ile geldiyse
          salt-okunur acilir. Hem ReadOnly context hem DirtyGuardScope hem
          template-readonly CSS bu wrapper icinde set edilir. */}
      <ViewModeOverride
        baseLocked={isLocked}
        baseLockReason={lockReason}
        dirtyGuardEnabled={!isCompleted && !isTemplate}
      >
        {children}
      </ViewModeOverride>
    </div>
  );
}
