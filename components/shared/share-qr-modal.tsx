"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Copy,
  Check,
  MessageCircle,
  Mail,
  ExternalLink,
  Download,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  // Müşteri / proje bağlamı — paylaşılan mesajın metnini şekillendirir
  projectName?: string;
  customerName?: string;
  firmName?: string;
  // Müşterinin maili varsa "mailto:" butonu açılır
  recipientEmail?: string | null;
}

/**
 * Paylaşım linkini hızlıca yaymak için modal: QR kodu (telefondan tarat),
 * WhatsApp tıkla-paylaş, mailto, kopyala, yeni sekmede aç.
 *
 * Saha/fuar kullanımı için QR + WhatsApp en kritik iki kanal — telefonun
 * kamerasıyla QR taratan müşteri direkt linke gider, WhatsApp butonuyla
 * müşterinin numarasını biliyorsan mesaj hazır gönderirsin.
 */
export function ShareQrModal({
  open,
  onClose,
  url,
  projectName,
  customerName,
  firmName,
  recipientEmail,
}: Props) {
  const [copied, setCopied] = useState(false);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Paylaşım mesajı — kullanıcı pre-filled görsün, isterse mesajı düzenler
  const greeting = customerName ? `Merhaba ${customerName},` : "Merhaba,";
  const projectLabel = projectName ? ` "${projectName}"` : "";
  const firmLabel = firmName ? ` (${firmName})` : "";
  const shareText = `${greeting}\n\nHazırladığım${projectLabel} teklif sunumuna aşağıdaki bağlantıdan ulaşabilirsiniz:\n\n${url}\n\nSorularınız için müsaitim${firmLabel}.`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailtoUrl = recipientEmail
    ? `mailto:${recipientEmail}?subject=${encodeURIComponent(
        projectName ? `${projectName} — Teklif Sunumu` : "Teklif Sunumu",
      )}&body=${encodeURIComponent(shareText)}`
    : `mailto:?subject=${encodeURIComponent(
        projectName ? `${projectName} — Teklif Sunumu` : "Teklif Sunumu",
      )}&body=${encodeURIComponent(shareText)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopyalanamadı");
    }
  }

  function handleDownloadQr() {
    // SVG'yi PNG'ye çevir ve indir
    const svg = document.getElementById("share-qr-svg") as SVGSVGElement | null;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        const name = projectName
          ? projectName.replace(/[^\w-]+/g, "-")
          : "teklif-paylasim";
        a.download = `qr-${name}.png`;
        a.click();
        URL.revokeObjectURL(dlUrl);
      }, "image/png");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-emerald-600" />
            <h2 className="text-[15px] font-bold text-slate-900">
              Paylaşım Linki
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Proje bilgisi (varsa) */}
          {projectName && (
            <p className="mb-3 text-center text-[12px] text-slate-500">
              <strong className="text-slate-700">{projectName}</strong>
              {customerName && ` · ${customerName}`}
            </p>
          )}

          {/* QR — telefondan taratabilirsin */}
          <div className="mx-auto flex w-fit flex-col items-center gap-2">
            <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
              <QRCodeSVG
                id="share-qr-svg"
                value={url}
                size={200}
                level="M"
                marginSize={0}
              />
            </div>
            <button
              type="button"
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-700"
            >
              <Download className="size-3" />
              PNG olarak indir
            </button>
          </div>

          <p className="mt-3 text-center text-[11.5px] text-slate-500">
            Müşteri telefonunun kamerasıyla taratıp linki açabilir.
          </p>

          {/* URL satırı */}
          <div className="mt-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
            <code className="min-w-0 flex-1 truncate text-[11.5px] text-slate-600">
              {url}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                copied
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100",
              )}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>

          {/* Aksiyon butonları */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#25D366] px-3 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" />
              WhatsApp'tan Paylaş
            </a>
            <a
              href={mailtoUrl}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-800 px-3 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Mail className="size-4" />
              Mail Gönder
            </a>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ExternalLink className="size-3.5" />
            Yeni Sekmede Aç (Önizle)
          </a>
        </div>
      </div>
    </div>
  );
}
