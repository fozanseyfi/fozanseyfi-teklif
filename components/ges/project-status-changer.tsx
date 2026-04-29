"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { updateProjectStatus } from "@/app/actions/project";
import { ChevronDown, Check } from "lucide-react";

const STATUSES = [
  { value: "DRAFT",       label: "Taslak",                 color: "bg-slate-500/20 text-slate-200 ring-slate-400/40",       dot: "#94a3b8" },
  { value: "SENT",        label: "Müşteriye Gönderildi",   color: "bg-amber-500/20 text-amber-200 ring-amber-400/40",       dot: "#fbbf24" },
  { value: "CLOSE_WIN",   label: "Close Win",              color: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40", dot: "#34d399" },
  { value: "CLOSE_LOST",  label: "Close Lost",             color: "bg-red-500/20 text-red-200 ring-red-400/40",             dot: "#f87171" },
  { value: "CANCELLED",   label: "Proje İptal",            color: "bg-slate-600/20 text-slate-300 ring-slate-500/40",       dot: "#64748b" },
];

interface Props {
  projectId: string;
  currentStatus: string;
}

interface DropdownPos { top: number; left: number; }

export function ProjectStatusChanger({ projectId, currentStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function openDropdown() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  }

  function handleSelect(value: string) {
    if (value === status) { setOpen(false); return; }
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
        className="fixed z-[500] min-w-[190px] rounded-xl overflow-hidden shadow-2xl"
        style={{ top: pos.top, left: pos.left, background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleSelect(s.value)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] font-medium transition-colors hover:bg-white/10"
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
            <span className="flex-1 text-white/90">{s.label}</span>
            {s.value === status && <Check className="w-3 h-3 text-amber-400" />}
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
        className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold ring-1 transition-all select-none ${current.color} ${isPending ? "opacity-60" : "hover:opacity-90 cursor-pointer"}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: current.dot }} />
        {current.label}
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {mounted && createPortal(dropdown, document.body)}
    </>
  );
}
