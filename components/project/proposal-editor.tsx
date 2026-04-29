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
import type { Project, PricingSnapshot, EquipmentItem, CostItem, Proposal, Firm } from "@prisma/client";

type FullProject = Project & {
  pricingSnapshot: PricingSnapshot | null;
  equipmentItems: EquipmentItem[];
  costItems: CostItem[];
  proposal: Proposal | null;
  firm: Firm;
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
    <div className="grid lg:grid-cols-5 gap-8">
      {/* Sol Panel - Ayarlar */}
      <div className="lg:col-span-2 space-y-6">
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
                <label htmlFor={section.id} className="text-sm text-slate-700 cursor-pointer">
                  {section.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {!canGeneratePDF && (
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 text-xs text-slate-600 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              PDF oluşturmak için Yönetici veya Firma Yöneticisi rolü gereklidir.
            </div>
          )}
          {isLimitReached && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Aylık teklif limitinize ulaştınız.{" "}
              <Link href="/subscription" className="underline font-medium">
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
            <FileDown className="w-4 h-4" />
            {isGenerating ? "PDF Oluşturuluyor..." : "PDF İndir"}
          </Button>
          <form action={markCompleted.bind(null, project.id)}>
            <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
              <CheckCircle className="w-4 h-4" />
              Tamamlandı Olarak İşaretle
            </Button>
          </form>
        </div>
      </div>

      {/* Sağ Panel - Önizleme */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white text-slate-900 text-sm shadow-sm">
          {/* Kapak */}
          <div className="bg-slate-800 p-8 text-center">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">☀</span>
            </div>
            <p className="text-amber-400 font-bold text-lg">{project.firm.name}</p>
            <h1 className="text-white text-2xl font-bold mt-4">SOLAR ENERJİ SİSTEMİ</h1>
            <h2 className="text-white text-xl">PROJE TEKLİFİ</h2>
            <div className="mt-6 text-left bg-slate-700 rounded-lg p-4 inline-block w-full max-w-xs mx-auto">
              <p className="text-slate-300 text-xs">Müşteri</p>
              <p className="text-white font-semibold">{project.customerName}</p>
              <p className="text-slate-400 text-xs mt-2">Tarih: {formatDate(new Date())}</p>
              <p className="text-slate-400 text-xs">Geçerlilik: {validityDays} gün</p>
            </div>
          </div>

          {/* KPI Özet */}
          <div className="bg-amber-50 p-6 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Sistem Gücü</p>
              <p className="font-bold text-lg text-gray-900">{project.totalPowerKw.toFixed(1)} kWp</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Proje Bedeli</p>
              <p className="font-bold text-lg text-amber-600">{formatCurrency(totalInvestment)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Geri Ödeme</p>
              <p className="font-bold text-lg text-gray-900">
                {paybackYear > 0 ? `${paybackYear} Yıl` : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">İlk Yıl Tasarruf</p>
              <p className="font-bold text-lg text-green-600">{formatCurrency(firstYearSaving)}</p>
            </div>
          </div>

          {/* Teknik Bilgiler */}
          <div className="p-6 border-t">
            <h3 className="font-bold text-gray-900 mb-3">Teknik Bilgiler</h3>
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
          <div className="p-6 bg-green-50 border-t">
            <h3 className="font-bold text-green-800 mb-2 text-xs">Çevre Katkısı</h3>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div>
                <p className="text-gray-500">Yıllık CO₂</p>
                <p className="font-bold text-green-700">{(totalCO2 / project.projectLifeYears).toFixed(1)} ton</p>
              </div>
              <div>
                <p className="text-gray-500">{project.projectLifeYears}Y CO₂</p>
                <p className="font-bold text-green-700">{totalCO2.toFixed(0)} ton</p>
              </div>
              <div>
                <p className="text-gray-500">Eşd. Ağaç</p>
                <p className="font-bold text-green-700">{trees}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start mt-4">
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/financials`}>
              <ArrowLeft className="w-4 h-4" /> Geri
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
