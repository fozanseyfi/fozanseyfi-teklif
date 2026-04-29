"use client";

import { useState } from "react";
import { markProjectCompleted } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings } from "@/lib/ges-defaults";
import {
  FileDown,
  CheckCircle2,
  FileText,
  TrendingUp,
  LayoutList,
  Table2,
  Leaf,
  PenLine,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const SECTIONS = [
  { id: "kapak", label: "Kapak Sayfası", icon: FileText, default: true },
  { id: "ozet", label: "Yönetici Özeti & Maliyet", icon: LayoutList, default: true },
  { id: "kesif-a", label: "Kesif-A Detayı", icon: Table2, default: true },
  { id: "kesif-b", label: "Kesif-B Detayı", icon: Table2, default: true },
  { id: "fizibilite", label: "Fizibilite Analizi", icon: TrendingUp, default: true },
  { id: "imza", label: "İmza & Onay", icon: PenLine, default: true },
];

interface Props {
  projectId: string;
  projectName: string;
  customerName: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  status: string;
}

export function TeklifEditor({ projectId, projectName, customerName, kesifA, kesifB, settings, status }: Props) {
  const result = calc(kesifA, kesifB, settings);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(SECTIONS.filter((s) => s.default).map((s) => s.id))
  );
  const [coverNote, setCoverNote] = useState("");
  const [validityDays, setValidityDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);

  function toggleSection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const res = await fetch("/api/pdf/ges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          includedSections: Array.from(selected),
          coverNote,
          validityDays,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `epc-teklif-${projectName.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF indirildi");
    } catch {
      toast.error("PDF oluşturulamadı");
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await markProjectCompleted(projectId);
      toast.success("Proje tamamlandı olarak işaretlendi");
    } catch {
      toast.error("Güncelleme başarısız");
    } finally {
      setCompleting(false);
    }
  }

  function fmtUsd(n: number) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  function fmtTry(n: number) {
    return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Satış Fiyatı Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
        <p className="text-amber-100 text-sm font-medium mb-1">EPC Satış Fiyatı</p>
        <p className="text-4xl font-black tracking-tight">{fmtUsd(result.salePriceUsd)}</p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-amber-100 text-sm">{fmtTry(result.salePriceTry)}</span>
          <span className="bg-amber-400/40 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {result.perKwUsd.toFixed(0)} $/kWp
          </span>
          <span className="bg-amber-400/40 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Net Kâr: %{settings.netKar}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Sol: Bölüm Seçimi + Ayarlar */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Teklif Bölümleri</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = selected.has(sec.id);
                return (
                  <button
                    key={sec.id}
                    onClick={() => toggleSection(sec.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      active
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                      active ? "bg-amber-500 border-amber-500" : "border-slate-300"
                    }`}>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <Icon className={`w-4 h-4 ${active ? "text-amber-600" : "text-slate-400"}`} />
                    <span className="text-sm font-medium">{sec.label}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Kapak Notu</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Kapak sayfasına eklenecek özel mesaj (opsiyonel)</Label>
                <Textarea
                  rows={3}
                  placeholder="Sayın müşterimiz, hazırladığımız bu EPC teklif sunumunu..."
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  className="mt-1.5 text-sm"
                />
              </div>
              <div className="max-w-xs">
                <Label className="text-xs">Teklif Geçerlilik Süresi (gün)</Label>
                <Input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                  className="mt-1.5 h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: Özet + Aksiyon */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Maliyet Özeti</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Kesif-A</span>
                <span className="font-medium text-slate-800">{fmtUsd(result.kaTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Kesif-B</span>
                <span className="font-medium text-slate-800">{fmtUsd(result.kbTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Contingency %{settings.contingency}</span>
                <span>{fmtUsd(result.contingencyAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Genel Gider %{settings.genelGider}</span>
                <span>{fmtUsd(result.genelGiderAmt)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Net Kâr %{settings.netKar}</span>
                <span>{fmtUsd(result.netKarAmt)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-amber-600">
                <span>TOPLAM</span>
                <span>{fmtUsd(result.salePriceUsd)}</span>
              </div>
              <div className="text-xs text-slate-400 text-right">
                {fmtTry(result.salePriceTry)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs text-slate-500 font-medium">Seçili Bölümler: {selected.size}/{SECTIONS.length}</p>
              <Button
                className="w-full"
                onClick={handleDownload}
                disabled={generating || selected.size === 0}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                {generating ? "Oluşturuluyor..." : "PDF İndir"}
              </Button>
            </CardContent>
          </Card>

          {status !== "COMPLETED" && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Leaf className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700">
                    Teklif hazır ve müşteriye iletildi. Projeyi tamamlandı olarak işaretleyebilirsiniz.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {completing ? "İşleniyor..." : "Projeyi Tamamla"}
                </Button>
              </CardContent>
            </Card>
          )}

          {status === "COMPLETED" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-700 font-medium">Proje tamamlandı</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
