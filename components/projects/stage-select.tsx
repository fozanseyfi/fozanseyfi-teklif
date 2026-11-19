"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PipelineStage } from "@prisma/client";
import { updatePipelineStageAction } from "@/app/actions/share-response";
import {
  LOST_REASON_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_TONE,
} from "@/lib/pipeline-labels";
import { cn } from "@/lib/utils";

const STAGES: PipelineStage[] = ["DRAFT", "SENT", "REVISED", "WON", "LOST", "CANCELLED"];

const DOT: Record<PipelineStage, string> = {
  DRAFT: "bg-slate-400",
  SENT: "bg-sky-500",
  REVISED: "bg-violet-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-500",
  CANCELLED: "bg-slate-300",
};

/**
 * Teklifler listesindeki aşama rozeti — tıklanınca aşama seçilir.
 * Aşama elle yalnızca buradan değiştirilir (proje içindeki Pipeline sekmesi kaldırıldı).
 * "Closed Lost" seçilince kayıp sebebi (zorunlu) ve rakip firma sorulur.
 */
export function StageSelect({
  projectId,
  stage,
  lostReason,
  competitorName,
}: {
  projectId: string;
  stage: PipelineStage | null;
  lostReason?: string | null;
  competitorName?: string | null;
}) {
  const current = stage ?? "DRAFT";
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [lostStep, setLostStep] = useState(false);
  const [reason, setReason] = useState(lostReason ?? "");
  const [competitor, setCompetitor] = useState(competitorName ?? "");
  const [pending, startTransition] = useTransition();

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 240;
    const up = r.bottom + 330 > window.innerHeight && r.top > 330;
    setPos({
      top: up ? r.top - 6 : r.bottom + 6,
      left: Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8),
      up,
    });
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onMove() {
      place();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setLostStep(false);
  }

  function save(next: PipelineStage) {
    if (next === "LOST" && !reason) {
      toast.error("Kayıp sebebi seçmelisiniz");
      return;
    }
    startTransition(async () => {
      const res = await updatePipelineStageAction({
        projectId,
        newStage: next,
        lostReason: next === "LOST" ? reason : null,
        competitorName: next === "LOST" ? competitor.trim() : null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Aşama: ${PIPELINE_STAGE_LABELS[next]}`);
      close();
      router.refresh();
    });
  }

  function choose(s: PipelineStage) {
    if (s === "LOST") {
      setLostStep(true);
      return;
    }
    if (s === current) {
      close();
      return;
    }
    save(s);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (open) return close();
          place();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full border py-1 pl-2.5 pr-1.5 text-[11px] font-semibold transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          PIPELINE_STAGE_TONE[current],
        )}
        title="Aşamayı değiştirmek için tıklayın"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : null}
        {PIPELINE_STAGE_LABELS[current]}
        <ChevronDown className={cn("size-3 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] w-60 overflow-hidden rounded-xl border bg-card text-left text-card-foreground shadow-lg"
            style={{
              left: pos.left,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {!lostStep ? (
              <>
                <p className="border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Aşamayı değiştir
                </p>
                <ul className="py-1">
                  {STAGES.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={pending}
                        onClick={() => choose(s)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted disabled:opacity-50",
                          s === current && "font-semibold",
                        )}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", DOT[s])} />
                        <span className="flex-1">{PIPELINE_STAGE_LABELS[s]}</span>
                        {s === current && <Check className="size-3.5 text-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="space-y-2.5 p-3">
                <p className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className={cn("size-2 rounded-full", DOT.LOST)} />
                  Closed Lost
                </p>
                <label className="block">
                  <span className="text-[11px] font-medium text-muted-foreground">Kayıp sebebi *</span>
                  <select
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-[13px]"
                  >
                    <option value="">Seçin…</option>
                    {Object.entries(LOST_REASON_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-muted-foreground">Kazanan rakip (opsiyonel)</span>
                  <input
                    value={competitor}
                    onChange={(e) => setCompetitor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") save("LOST"); }}
                    placeholder="Firma adı"
                    className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-[13px]"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setLostStep(false)}
                    className="h-8 rounded-md border px-3 text-[12px] font-medium hover:bg-muted"
                  >
                    Geri
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save("LOST")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {pending && <Loader2 className="size-3 animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
