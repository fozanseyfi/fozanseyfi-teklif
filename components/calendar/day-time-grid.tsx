"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Outlook benzeri gunluk zaman izgarasi.
 * - Bos alana tiklayip surukleyerek aralik secilir; tek tiklamada varsayilan 30 dk.
 * - Blogun alt kenarindan asagi cekerek 10'ar dakika uzatilir/kisaltilir.
 * - Blogun govdesinden tutup tasinabilir (sure korunur).
 * Saat alanlarina elle yazma modal'daki saat kutularindan yapilir.
 */

const SLOT_MIN = 10;              // en kucuk adim: 10 dk
const SLOT_H = 14;                // 10 dk = 14px  → 30 dk = 42px, 1 saat = 84px
const SLOTS = (24 * 60) / SLOT_MIN; // 144
const DEFAULT_SLOTS = 3;          // varsayilan sure: 30 dk

const pad = (n: number) => String(n).padStart(2, "0");
const slotLabel = (s: number) => `${pad(Math.floor((s * SLOT_MIN) / 60))}:${pad((s * SLOT_MIN) % 60)}`;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Gun basindan itibaren dakika → slot (asagi yuvarla). */
const dateToSlot = (d: Date) => clamp(Math.floor((d.getHours() * 60 + d.getMinutes()) / SLOT_MIN), 0, SLOTS - 1);

export function DayTimeGrid({
  dayISO, startISO, endISO, disabled, onChange,
}: {
  dayISO: string;                 // yyyy-mm-dd — izgaranin gunu
  startISO: string;
  endISO: string | null;
  disabled?: boolean;
  onChange: (startISO: string, endISO: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<null | { mode: "create" | "move" | "resize"; anchor: number; dur: number; grab: number }>(null);

  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date(start.getTime() + DEFAULT_SLOTS * SLOT_MIN * 60_000);
  // Etkinlik baska gune tasmissa izgarada gun sonuna kadar gosterilir.
  const startSlot = dateToSlot(start);
  const endSlot = clamp(
    end.getDate() !== start.getDate() || end < start ? SLOTS : Math.ceil((end.getHours() * 60 + end.getMinutes()) / SLOT_MIN),
    startSlot + 1,
    SLOTS,
  );

  // Acilista secili saate kaydir.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, startSlot * SLOT_H - 120);
    // sadece mount'ta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (s: number, e: number) => {
    const mk = (slot: number) => {
      const d = new Date(dayISO + "T00:00");
      d.setMinutes(slot * SLOT_MIN);
      return d.toISOString();
    };
    onChange(mk(clamp(s, 0, SLOTS - 1)), mk(clamp(e, 1, SLOTS)));
  };

  const slotAt = (clientY: number) => {
    const r = gridRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return clamp(Math.floor((clientY - r.top) / SLOT_H), 0, SLOTS - 1);
  };

  function down(e: React.PointerEvent, mode: "create" | "move" | "resize") {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const s = slotAt(e.clientY);
    if (mode === "create") {
      setDrag({ mode, anchor: s, dur: DEFAULT_SLOTS, grab: 0 });
      emit(s, s + DEFAULT_SLOTS);
    } else if (mode === "move") {
      setDrag({ mode, anchor: startSlot, dur: endSlot - startSlot, grab: s - startSlot });
    } else {
      setDrag({ mode, anchor: startSlot, dur: endSlot - startSlot, grab: 0 });
    }
  }

  function move(e: React.PointerEvent) {
    if (!drag || disabled) return;
    const s = slotAt(e.clientY);
    if (drag.mode === "create") {
      const lo = Math.min(drag.anchor, s);
      const hi = Math.max(drag.anchor, s) + 1;
      emit(lo, Math.max(hi, lo + 1));
    } else if (drag.mode === "move") {
      const ns = clamp(s - drag.grab, 0, SLOTS - drag.dur);
      emit(ns, ns + drag.dur);
    } else {
      emit(startSlot, Math.max(s + 1, startSlot + 1));
    }
  }

  const up = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  };

  const dur = (endSlot - startSlot) * SLOT_MIN;
  const durLabel = dur >= 60 ? `${Math.floor(dur / 60)} sa${dur % 60 ? ` ${dur % 60} dk` : ""}` : `${dur} dk`;
  const now = new Date();
  const nowSlot = now.toISOString().slice(0, 10) === dayISO ? (now.getHours() * 60 + now.getMinutes()) / SLOT_MIN : null;

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[12px]">
        <span className="font-semibold text-foreground">{slotLabel(startSlot)} – {slotLabel(endSlot)}</span>
        <span className="text-muted-foreground">· {durLabel}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{"Sürükleyerek seç · alt kenardan 10'ar dk uzat"}</span>
      </div>

      <div ref={scrollRef} className="max-h-[260px] overflow-y-auto">
        <div
          ref={gridRef}
          onPointerDown={(e) => down(e, "create")}
          onPointerMove={move}
          onPointerUp={up}
          className={cn("relative select-none", disabled ? "cursor-default" : "cursor-crosshair")}
          style={{ height: SLOTS * SLOT_H, touchAction: "none" }}
        >
          {/* saat satirlari */}
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/60" style={{ top: h * 6 * SLOT_H, height: 6 * SLOT_H }}>
              <span className="absolute -top-[7px] left-1.5 bg-card px-1 text-[10.5px] tabular-nums text-muted-foreground">{pad(h)}:00</span>
              <div className="absolute left-12 right-0 top-1/2 border-t border-dashed border-border/40" />
            </div>
          ))}

          {/* simdi cizgisi */}
          {nowSlot !== null && (
            <div className="pointer-events-none absolute left-12 right-0 z-10 border-t-2 border-rose-500" style={{ top: nowSlot * SLOT_H }}>
              <span className="absolute -left-1 -top-1 size-2 rounded-full bg-rose-500" />
            </div>
          )}

          {/* secili aralik */}
          <div
            onPointerDown={(e) => down(e, "move")}
            className={cn("absolute left-12 right-2 z-20 rounded-md border-2 border-primary bg-primary-soft/80 shadow-sm",
              disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing")}
            style={{ top: startSlot * SLOT_H, height: (endSlot - startSlot) * SLOT_H }}
          >
            <div className="px-2 py-0.5 text-[11.5px] font-semibold text-primary">
              {slotLabel(startSlot)} – {slotLabel(endSlot)}
            </div>
            {!disabled && (
              <div
                onPointerDown={(e) => down(e, "resize")}
                className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-end justify-center"
                title="Aşağı çekerek 10'ar dakika uzat"
              >
                <span className="mb-0.5 h-1 w-8 rounded-full bg-primary/70" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
