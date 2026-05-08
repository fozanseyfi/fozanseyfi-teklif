"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markCompleted } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  INSTALLATION_TYPE_LABELS,
  TARIFF_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  COST_CATEGORY_LABELS,
} from "@/lib/utils";
import {
  calculateAnnualProductionKwh,
  calculateCashFlow,
  calculatePaybackYear,
  calculateCO2Saving,
  calculateEquivalentTrees,
} from "@/lib/pricing-engine";
import { FileDown, CheckCircle, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Project, PricingSnapshot, EquipmentItem, CostItem, Proposal, Organization } from "@prisma/client";

type FullProject = Project & {
  pricingSnapshot: PricingSnapshot | null;
  equipmentItems: EquipmentItem[];
  costItems: CostItem[];
  proposal: Proposal | null;
  organization: Organization;
};

const SECTIONS = [
  { id: "executive_summary", label: "Yönetici Özeti" },
  { id: "technical_scope", label: "Teknik Kapsam" },
  { id: "commercial_scope", label: "Ticari Kapsam" },
  { id: "feasibility", label: "Fizibilite Analizi" },
  { id: "service_scope", label: "Proje Kapsamı & Hizmetler" },
  { id: "warranty", label: "Garanti & Servis Koşulları" },
  { id: "signature", label: "İmza & Onay Sayfası" },
];

export function ProposalEditor({
  project,
  canGeneratePDF,
  isLimitReached,
}: {
  project: FullProject;
  canGeneratePDF: boolean;
  isLimitReached: boolean;
}) {
  const [coverNote, setCoverNote] = useState(project.proposal?.coverNote ?? "");
  const [validityDays, setValidityDays] = useState(project.proposal?.validityDays ?? 30);
  const [selectedSections, setSelectedSections] = useState<string[]>(
    (project.proposal?.includedSections as string[]) ?? SECTIONS.map((s) => s.id)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalInvestment = project.pricingSnapshot?.finalSalePrice ?? 0;
  const annualProduction = calculateAnnualProductionKwh(project.totalPowerKw, 4.5);
  const cashFlow = calculateCashFlow({
    totalInvestment,
    annualProductionKwh: annualProduction,
    electricityUnitPrice: project.electricityUnitPrice,
    electricityEscalationRate: project.electricityEscalationRate,
    panelDegradationRate: 0.005,
    projectLifeYears: project.projectLifeYears,
  });
  const paybackYear = calculatePaybackYear(cashFlow);
  const firstYearSaving = cashFlow[0]?.annualSaving ?? 0;
  const totalCO2 = calculateCO2Saving(annualProduction, project.projectLifeYears);
  const trees = calculateEquivalentTrees(totalCO2);

  function toggleSection(id: string) {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleGeneratePDF() {
    if (!canGeneratePDF) {
      toast.error("PDF oluşturma yetkiniz yok");
      return;
    }
    if (isLimitReached) {
      toast.error("Aylık teklif limitinize ulaştınız");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/pdf/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          coverNote,
          validityDays,
          includedSections: selectedSections,
        }),
      });
      if (!res.ok) throw new Error("PDF oluşturulamadı");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teklif-${project.name.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF başarıyla indirildi!");
    } catch {
      toast.error("PDF oluşturulurken hata oluştu");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Sol Panel - Ayarlar */}
      <div className="space-y-6 lg:col-span-2">
        <div className="space-y-3">
          <Label>Kapak Sayfası Notu</Label>
          <Textarea
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder="Müşteriye özel mesajınızı yazın..."
            rows={4}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Teklif Geçerlilik Süresi (gün)</Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={validityDays}
            onChange={(e) => setValidityDays(parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-3">
          <Label>Teklif Bölümleri</Label>
          <div className="space-y-2">
            {SECTIONS.map((section) => (
              <div key={section.id} className="flex items-center gap-2">
                <Checkbox
                  id={section.id}
                  checked={selectedSections.includes(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                />
                <label htmlFor={section.id} className="cursor-pointer text-sm text-foreground">
                  {section.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {!canGeneratePDF && (
            <div className="flex gap-2 rounded-lg border bg-muted p-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              PDF oluşturmak için Yönetici veya Firma Yöneticisi rolü gereklidir.
            </div>
          )}
          {isLimitReached && (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning-soft-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Aylık teklif limitinize ulaştınız.{" "}
              <Link href="/subscription" className="font-medium underline">
                Planınızı yükseltin
              </Link>
            </div>
          )}
          <Button
            onClick={handleGeneratePDF}
            disabled={!canGeneratePDF || isLimitReached || isGenerating}
            className="w-full"
            size="lg"
          >
            <FileDown className="size-4" />
            {isGenerating ? "PDF Oluşturuluyor..." : "PDF İndir"}
          </Button>
          <form action={markCompleted.bind(null, project.id)}>
            <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
              <CheckCircle className="size-4" />
              Tamamlandı Olarak İşaretle
            </Button>
          </form>
        </div>
      </div>

      {/* Sağ Panel - Önizleme (PDF preview — kept hardcoded colors for print fidelity) */}
      <div className="lg:col-span-3">
        <div className="overflow-hidden rounded-xl border bg-white text-sm text-slate-900 shadow-sm">
          {/* Kapak */}
          <div className="bg-slate-800 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600">
              <span className="text-xl">☀</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">{project.organization.name}</p>
            <h1 className="mt-4 text-2xl font-bold text-white">SOLAR ENERJİ SİSTEMİ</h1>
            <h2 className="text-xl text-white">PROJE TEKLİFİ</h2>
            <div className="mx-auto mt-6 inline-block w-full max-w-xs rounded-lg bg-slate-700 p-4 text-left">
              <p className="text-xs text-slate-300">Müşteri</p>
              <p className="font-semibold text-white">{project.customerName}</p>
              <p className="mt-2 text-xs text-slate-400">Tarih: {formatDate(new Date())}</p>
              <p className="text-xs text-slate-400">Geçerlilik: {validityDays} gün</p>
            </div>
          </div>

          {/* KPI Özet */}
          <div className="grid grid-cols-2 gap-3 bg-emerald-50 p-6">
            <div className="text-center">
              <p className="text-xs text-slate-500">Sistem Gücü</p>
              <p className="text-lg font-bold text-slate-900">{project.totalPowerKw.toFixed(1)} kWp</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Proje Bedeli</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalInvestment)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Geri Ödeme</p>
              <p className="text-lg font-bold text-slate-900">
                {paybackYear > 0 ? `${paybackYear} Yıl` : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">İlk Yıl Tasarruf</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(firstYearSaving)}</p>
            </div>
          </div>

          {/* Teknik Bilgiler */}
          <div className="border-t p-6">
            <h3 className="mb-3 font-bold text-slate-900">Teknik Bilgiler</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Kurulum Tipi: <strong>{INSTALLATION_TYPE_LABELS[project.installationType]}</strong></div>
              <div>Lokasyon: <strong>{project.projectLocation}</strong></div>
              <div>Panel Adedi: <strong>{project.panelCount}</strong></div>
              <div>İnvertör Adedi: <strong>{project.inverterCount}</strong></div>
              <div>Tarife: <strong>{TARIFF_LABELS[project.electricityTariff]}</strong></div>
              <div>Yıllık Üretim: <strong>{Math.round(annualProduction).toLocaleString("tr")} kWh</strong></div>
            </div>
          </div>

          {/* Çevre */}
          <div className="border-t bg-emerald-50 p-6">
            <h3 className="mb-2 text-xs font-bold text-emerald-800">Çevre Katkısı</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-slate-500">Yıllık CO₂</p>
                <p className="font-bold text-emerald-700">{(totalCO2 / project.projectLifeYears).toFixed(1)} ton</p>
              </div>
              <div>
                <p className="text-slate-500">{project.projectLifeYears}Y CO₂</p>
                <p className="font-bold text-emerald-700">{totalCO2.toFixed(0)} ton</p>
              </div>
              <div>
                <p className="text-slate-500">Eşd. Ağaç</p>
                <p className="font-bold text-emerald-700">{trees}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-start">
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/financials`}>
              <ArrowLeft className="size-4" /> Geri
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
