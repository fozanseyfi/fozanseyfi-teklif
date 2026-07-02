"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, X } from "lucide-react";

interface Props {
  src: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

type Rect = { x: number; y: number; w: number; h: number }; // normalize [0..1]

/**
 * Kırpma adımı — yakalanan uydu görüntüsünde kullanıcı bir dikdörtgeni köşe
 * tutamaklarıyla ayarlar. Onaylanınca görüntü o bölgeye 1:1 kırpılır (ölçek
 * korunur) ve altlık olarak kullanılır.
 */
export default function CropStep({ src, onConfirm, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const drag = useRef<{ mode: "move" | "nw" | "ne" | "sw" | "se"; sx: number; sy: number; start: Rect } | null>(null);

  useEffect(() => {
    const im = new window.Image();
    im.onload = () => {
      imgRef.current = im;
      setNatural({ w: im.naturalWidth, h: im.naturalHeight });
    };
    im.src = src;
  }, [src]);

  function onDown(mode: "move" | "nw" | "ne" | "sw" | "se", e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const d = drag.current;
      const wrap = wrapRef.current;
      if (!d || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = (e.clientX - d.sx) / rect.width;
      const dy = (e.clientY - d.sy) / rect.height;
      let { x, y, w, h } = d.start;
      const MIN = 0.05;
      if (d.mode === "move") {
        x = Math.max(0, Math.min(1 - w, x + dx));
        y = Math.max(0, Math.min(1 - h, y + dy));
      } else {
        if (d.mode === "nw") { const nx = Math.min(x + w - MIN, x + dx); const ny = Math.min(y + h - MIN, y + dy); w += x - nx; h += y - ny; x = nx; y = ny; }
        if (d.mode === "ne") { const ny = Math.min(y + h - MIN, y + dy); w = Math.max(MIN, w + dx); h += y - ny; y = ny; }
        if (d.mode === "sw") { const nx = Math.min(x + w - MIN, x + dx); w += x - nx; x = nx; h = Math.max(MIN, h + dy); }
        if (d.mode === "se") { w = Math.max(MIN, w + dx); h = Math.max(MIN, h + dy); }
        x = Math.max(0, x); y = Math.max(0, y);
        w = Math.min(1 - x, w); h = Math.min(1 - y, h);
      }
      setBox({ x, y, w, h });
    }
    function up() { drag.current = null; }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function confirm() {
    const im = imgRef.current;
    if (!im || !natural) return;
    const sx = Math.round(box.x * natural.w);
    const sy = Math.round(box.y * natural.h);
    const sw = Math.max(1, Math.round(box.w * natural.w));
    const sh = Math.max(1, Math.round(box.h * natural.h));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  }

  const handle = "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-emerald-600 bg-white shadow";

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
        <p className="text-sm font-medium text-slate-700">Kırpma — köşeleri sürükleyerek binanın etrafını ayarla</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><X className="size-4" /> Vazgeç</button>
          <button type="button" onClick={confirm} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"><Crop className="size-4" /> Kırp & Kullan</button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl border bg-slate-900">
        <div ref={wrapRef} className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="uydu" className="max-h-full max-w-full select-none" draggable={false} />
          {/* Karartma + kırpma penceresi */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute border-2 border-emerald-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            />
          </div>
          {/* Etkileşim katmanı */}
          <div
            className="absolute cursor-move"
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            onPointerDown={(e) => onDown("move", e)}
          />
          {(["nw", "ne", "sw", "se"] as const).map((c) => {
            const left = (c === "nw" || c === "sw" ? box.x : box.x + box.w) * 100;
            const top = (c === "nw" || c === "ne" ? box.y : box.y + box.h) * 100;
            return (
              <div
                key={c}
                className={handle}
                style={{ left: `${left}%`, top: `${top}%`, cursor: `${c}-resize` }}
                onPointerDown={(e) => onDown(c, e)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
