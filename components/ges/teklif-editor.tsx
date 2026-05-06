"use client";

import { useState } from "react";
import { markProjectCompleted } from "@/app/actions/ges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
    <div className="max-w-4xl space-y-5">
      {/* Satış Fiyatı Banner */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
        <p className="mb-1 text-sm font-medium opacity-90">EPC Satış Fiyatı</p>
        <p className="text-4xl font-bold tracking-tight">{fmtUsd(result.salePriceUsd)}</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-sm opacity-90">{fmtTry(result.salePriceTry)}</span>
          <span className="rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-xs font-semibold">
            {result.perKwUsd.toFixed(0)} $/kWp
          </span>
          <span className="rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-xs font-semibold">
            Net Kâr: %{settings.netKar}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Sol: Bölüm Seçimi + Ayarlar */}
        <div className="space-y-4 lg:col-span-2">
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
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                      active
                        ? "border-primary bg-primary-soft text-primary-soft-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded border-2 transition-colors",
                        active ? "border-primary bg-primary" : "border-border",
                      )}
                    >
                      {active && <CheckCircle2 className="size-3.5 text-primary-foreground" />}
                    </div>
                    <Icon className={cn("size-4", active ? "text-primary-soft-foreground" : "text-muted-foreground")} />
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
              <div className="flex justify-between text-muted-foreground">
                <span>Kesif-A</span>
                <span className="font-medium text-foreground">{fmtUsd(result.kaTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Kesif-B</span>
                <span className="font-medium text-foreground">{fmtUsd(result.kbTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Contingency %{settings.contingency}</span>
                <span>{fmtUsd(result.contingencyAmt)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Genel Gider %{settings.genelGider}</span>
                <span>{fmtUsd(result.genelGiderAmt)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Net Kâr %{settings.netKar}</span>
                <span>{fmtUsd(result.netKarAmt)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold text-primary-soft-foreground">
                <span>TOPLAM</span>
                <span>{fmtUsd(result.salePriceUsd)}</span>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {fmtTry(result.salePriceTry)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-4">
              <p className="text-xs font-medium text-muted-foreground">Seçili Bölümler: {selected.size}/{SECTIONS.length}</p>
              <Button
                className="w-full"
                onClick={handleDownload}
                disabled={generating || selected.size === 0}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                {generating ? "Oluşturuluyor..." : "PDF İndir"}
              </Button>
            </CardContent>
          </Card>

          {status !== "COMPLETED" && (
            <Card className="border-success/30 bg-success-soft">
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start gap-2">
                  <Leaf className="mt-0.5 size-4 shrink-0 text-success-soft-foreground" />
                  <p className="text-xs text-success-soft-foreground">
                    Teklif hazır ve müşteriye iletildi. Projeyi tamamlandı olarak işaretleyebilirsiniz.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-success/40 text-success-soft-foreground hover:bg-success-soft"
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {completing ? "İşleniyor..." : "Projeyi Tamamla"}
                </Button>
              </CardContent>
            </Card>
          )}

          {status === "COMPLETED" && (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-3">
              <CheckCircle2 className="size-4 shrink-0 text-success-soft-foreground" />
              <span className="text-xs font-medium text-success-soft-foreground">Proje tamamlandı</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
