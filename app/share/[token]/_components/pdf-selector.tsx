"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BrandSettings } from "@/lib/pdf-brand";

interface Props {
  token: string;
  brand: BrandSettings;
  // Paylaşımda kaç parça var? Hiç yoksa buton render edilmez.
  itemCount: number;
}

/**
 * Tek "Tek PDF İndir" butonu — paylaşımda gözüken HER tab ve HER ek belge
 * tek dosyada birleştirilir. Her tab kendi orijinal "PDF İndir" şablonuyla
 * server-side renderlenir, uploaded PDF'ler direkt indirilir, pdf-lib
 * sıralı olarak birleştirir.
 */
export function PdfSelector({ token, brand, itemCount }: Props) {
  const accent = brand.colorEnabled && brand.color ? brand.color : "#059669";
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    toast.info("PDF hazırlanıyor — birkaç saniye sürebilir");
    try {
      const res = await fetch(`/api/share/${token}/combined-pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "PDF üretilemedi");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teklif-paketi.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Tek PDF olarak indirildi");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  }

  if (itemCount === 0) return null;

  return (
    <div
      data-share-chrome="pdf-selector"
      className="border-b border-slate-200 bg-white/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="min-w-0 text-[12px] text-slate-700">
          <strong className="text-slate-900">{itemCount} bölüm</strong> paylaşıldı —
          <span className="text-slate-500"> hepsini tek PDF olarak indirebilirsin</span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" />
          )}
          Tek PDF İndir
        </button>
      </div>
    </div>
  );
}
