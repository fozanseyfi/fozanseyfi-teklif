import Link from "next/link";
import type { PipelineStage } from "@prisma/client";
import { PIPELINE_STAGE_LABELS } from "@/lib/pipeline-labels";
import { cn } from "@/lib/utils";

export const STAGE_ORDER: PipelineStage[] = ["DRAFT", "SENT", "REVISED", "WON", "LOST", "CANCELLED"];

/** Aşama sayıları — pipeline'a hiç girmemiş (null) projeler Taslak sayılır. */
export function countStages(projects: { pipelineStage: PipelineStage | null }[]) {
  const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<PipelineStage, number>;
  for (const p of projects) counts[p.pipelineStage ?? "DRAFT"]++;
  return counts;
}

export function matchesStage(p: { pipelineStage: PipelineStage | null }, stage: string | undefined) {
  if (!stage) return true;
  return (p.pipelineStage ?? "DRAFT") === stage;
}

export function parseStage(raw: string | string[] | undefined): PipelineStage | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return STAGE_ORDER.includes(v as PipelineStage) ? (v as PipelineStage) : undefined;
}

/**
 * Aşama filtre çipleri (Tümü, Taslak, …) — her birinde o aşamadaki teklif sayısı.
 * Teklifler ve Dashboard sayfalarında ortak kullanılır.
 */
export function StageFilters({
  basePath,
  active,
  counts,
  total,
  params = {},
}: {
  basePath: string;
  active?: string;
  counts: Record<PipelineStage, number>;
  total: number;
  /** Korunacak diğer arama parametreleri (ör. q) */
  params?: Record<string, string | undefined>;
}) {
  const href = (stage?: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (stage) sp.set("stage", stage);
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const items: { value?: PipelineStage; label: string; count: number }[] = [
    { value: undefined, label: "Tümü", count: total },
    ...STAGE_ORDER.map((s) => ({ value: s, label: PIPELINE_STAGE_LABELS[s], count: counts[s] })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((f) => {
        const isActive = active === f.value || (!active && !f.value);
        return (
          <Link
            key={f.value ?? "all"}
            href={href(f.value)}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full py-1.5 pl-4 pr-2 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              f.count === 0 && !isActive && "opacity-60",
            )}
          >
            {f.label}
            <span
              className={cn(
                "min-w-5 rounded-full px-1.5 py-px text-center text-[10.5px] font-semibold tabular-nums",
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-foreground/70",
              )}
            >
              {f.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
