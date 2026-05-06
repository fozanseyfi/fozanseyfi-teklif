"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { updateProjectStatus } from "@/app/actions/project";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPLETION_TRANSITION_VALUES } from "@/lib/project-status";

const STATUSES = [
  {
    value: "DRAFT",
    label: "Taslak",
    pill: "bg-secondary text-secondary-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  {
    value: "COMPLETED",
    label: "Tamamlandı",
    pill: "bg-success-soft text-success-soft-foreground border-success-soft",
    dot: "bg-success",
  },
  {
    value: "CLOSE_WIN",
    label: "Close Win",
    pill: "bg-success text-success-foreground border-success/30",
    dot: "bg-success-foreground/70",
  },
  {
    value: "CLOSE_LOST",
    label: "Close Lost",
    pill: "bg-destructive-soft text-destructive-soft-foreground border-destructive-soft",
    dot: "bg-destructive",
  },
  {
    value: "CANCELLED",
    label: "Proje İptal",
    pill: "bg-secondary text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
];

interface Props {
  projectId: string;
  currentStatus: string;
  /**
   * Hangi gecislere izin verilsin? Verilmezse hepsi gosterilir.
   * Dashboard'da yalniz tamamlanmis projeler icin
   * COMPLETION_TRANSITIONS ile sinirlanir.
   */
  allowedTransitions?: string[];
}

interface DropdownPos {
  top: number;
  left: number;
}

export function ProjectStatusChanger({
  projectId,
  currentStatus,
  allowedTransitions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleStatuses = STATUSES.filter((s) =>
    allowedTransitions ? allowedTransitions.includes(s.value) : true,
  );

  function openDropdown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  }

  function handleSelect(value: string) {
    if (value === status) {
      setOpen(false);
      return;
    }
    setStatus(value);
    setOpen(false);
    startTransition(() => {
      updateProjectStatus(projectId, value);
    });
  }

  const current = STATUSES.find((s) => s.value === status) ?? STATUSES[0];

  const dropdown = open && pos && (
    <>
      <div className="fixed inset-0 z-[400]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[500] min-w-[200px] overflow-hidden rounded-md border bg-popover shadow-xl"
        style={{ top: pos.top, left: pos.left }}
      >
        {visibleStatuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleSelect(s.value)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted"
          >
            <span className={cn("size-2 shrink-0 rounded-full", s.dot)} />
            <span className="flex-1">{s.label}</span>
            {s.value === status && <Check className="size-3.5 text-primary" />}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 select-none rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-opacity",
          current.pill,
          isPending ? "opacity-60" : "cursor-pointer hover:opacity-90",
        )}
      >
        <span className={cn("size-1.5 rounded-full", current.dot)} />
        {current.label}
        <ChevronDown
          className={cn("size-2.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {mounted && createPortal(dropdown, document.body)}
    </>
  );
}

