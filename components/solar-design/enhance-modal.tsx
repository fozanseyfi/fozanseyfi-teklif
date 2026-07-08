"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Öncesi/sonrası kaydırmalı karşılaştırma modalı (görüntü netleştirme). */
export default function EnhanceModal({ original, enhanced, ms, scale, onUseOriginal, onUseEnhanced }: {
  original: string;
  enhanced: string;
  ms: number;
  scale: number;
  onUseOriginal: () => void;
  onUseEnhanced: () => void;
}) {
  const [pos, setPos] = useState(50); // % — bölücü konumu
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseUp={() => (dragging.current = false)} onMouseMove={(e) => { if (dragging.current) setFromClientX(e.clientX); }}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600"><Sparkles className="size-5" /></div>
            <div>
              <p className="text-[15px] font-semibold">Görüntü İyileştirme</p>
              <p className="text-[11px] text-slate-400">{scale.toFixed(1)}× büyütme + keskinleştirme ile netlik artırıldı</p>
            </div>
          </div>
          <button type="button" onClick={onUseOriginal} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
        </div>

        <div className="px-4">
          <div ref={wrapRef} className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl bg-slate-800">
            <img src={enhanced} alt="İyileştirilmiş" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <img src={original} alt="Orijinal" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
            <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold">Orijinal</span>
            <span className="absolute right-2 top-2 rounded-md bg-blue-600/90 px-2 py-0.5 text-[11px] font-semibold">İyileştirilmiş</span>
            {/* bölücü */}
            <div className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${pos}%` }}>
              <button type="button" onMouseDown={() => (dragging.current = true)} onClick={(e) => e.stopPropagation()}
                className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-slate-700 shadow-lg">
                <span className="text-xs">‖</span>
              </button>
            </div>
          </div>
          <p className="py-2 text-center text-[11px] text-slate-400">İşlem süresi: {(ms / 1000).toFixed(1)}s · Kaydırıcıyı sürükleyerek karşılaştırın</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 p-4">
          <button type="button" onClick={onUseOriginal} className="text-[13px] text-slate-300 hover:text-white">Orijinali Kullan</button>
          <Button onClick={onUseEnhanced} className="bg-emerald-600 hover:bg-emerald-700"><Sparkles className="size-4" /> İyileştirilmiş Görüntüyü Kullan</Button>
        </div>
      </div>
    </div>
  );
}
