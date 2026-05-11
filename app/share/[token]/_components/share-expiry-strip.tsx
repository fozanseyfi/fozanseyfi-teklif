"use client";

import { Clock, Infinity as InfinityIcon } from "lucide-react";
import type { BrandSettings } from "@/lib/pdf-brand";

interface Props {
  expiresAt: string | null;
  brand: BrandSettings;
}

function formatRemaining(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "süresi doldu";
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days >= 1) return `${days} gün kaldı`;
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours >= 1) return `${hours} saat kaldı`;
  return "1 saatten az kaldı";
}

function formatExpiry(target: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(target);
}

export function ShareExpiryStrip({ expiresAt, brand }: Props) {
  const accent = brand.colorEnabled && brand.color ? brand.color : "#059669";

  if (!expiresAt) {
    return (
      <div
        className="border-b border-slate-200 bg-white/60 px-4 py-2 text-center text-[12px] text-slate-600 sm:px-6 lg:px-8"
        style={{ borderBottomColor: `${accent}22` }}
      >
        <span className="inline-flex items-center gap-1.5">
          <InfinityIcon className="size-3.5" style={{ color: accent }} />
          Bu bağlantı süresizdir.
        </span>
      </div>
    );
  }

  const target = new Date(expiresAt);
  const expired = target.getTime() <= Date.now();
  const formatted = formatExpiry(target);
  const remaining = formatRemaining(target);

  return (
    <div
      className="border-b border-slate-200 bg-white/60 px-4 py-2 text-center text-[12px] text-slate-600 sm:px-6 lg:px-8"
      style={{ borderBottomColor: `${accent}22` }}
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
        <Clock className="size-3.5" style={{ color: accent }} />
        {expired ? (
          <span>Bu bağlantının süresi <strong>{formatted}</strong> tarihinde dolmuştur.</span>
        ) : (
          <>
            <span>
              Bu bağlantı <strong>{formatted}</strong> tarihine kadar geçerlidir
            </span>
            <span className="text-slate-500">· ({remaining})</span>
          </>
        )}
      </span>
    </div>
  );
}
