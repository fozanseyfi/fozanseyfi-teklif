"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  currentYear: number;
}

export function YearlyReportButton({ currentYear }: Props) {
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const [selected, setSelected] = useState(currentYear);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const res = await fetch(`/api/pdf/yearly-report?year=${selected}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Rapor üretilemedi");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yillik-rapor-${selected}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${selected} raporu indirildi`);
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/15 p-1.5 backdrop-blur-sm">
      <select
        value={selected}
        onChange={(e) => setSelected(parseInt(e.target.value, 10))}
        disabled={busy}
        className="rounded-md bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white outline-none ring-1 ring-white/30 hover:ring-white/50 disabled:opacity-50"
      >
        {years.map((y) => (
          <option key={y} value={y} className="bg-emerald-700 text-white">
            {y}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-primary shadow-sm transition-colors hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
        Yıllık Rapor
      </button>
    </div>
  );
}
