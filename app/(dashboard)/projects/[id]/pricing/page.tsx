import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveStep2 } from "@/app/actions/project";
import { StepIndicator } from "@/components/project/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PricingPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
    include: { pricingSnapshot: true },
  });
  if (!project) notFound();

  const action = saveStep2.bind(null, id);

  const totalPower = (project.panelCount * project.panelPowerWp) / 1000;

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator currentStep={2} />
      <Card>
        <CardHeader>
          <CardTitle>Teknik Parametreler & Fiyatlandırma</CardTitle>
          <CardDescription>Sistem boyutunu girin, otomatik fiyat hesaplansın</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="panelCount">Panel Adedi *</Label>
                <Input id="panelCount" name="panelCount" type="number" min="1" defaultValue={project.panelCount || ""} placeholder="620" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="panelPowerWp">Panel Gücü (Wp) *</Label>
                <Input id="panelPowerWp" name="panelPowerWp" type="number" min="1" step="0.1" defaultValue={project.panelPowerWp || ""} placeholder="400" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inverterCount">İnvertör Adedi</Label>
                <Input id="inverterCount" name="inverterCount" type="number" min="0" defaultValue={project.inverterCount || ""} placeholder="4" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalAreaM2">Toplam Alan (m²)</Label>
                <Input id="totalAreaM2" name="totalAreaM2" type="number" min="0" step="0.1" defaultValue={project.totalAreaM2 || ""} placeholder="1200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="perimeterM">Çevre Uzunluğu (m)</Label>
                <Input id="perimeterM" name="perimeterM" type="number" min="0" step="0.1" defaultValue={project.perimeterM || ""} placeholder="140" />
              </div>
            </div>

            {project.panelCount > 0 && project.panelPowerWp > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <p className="text-sm font-semibold text-amber-800">Sistem Özeti</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Sistem Gücü</p>
                    <p className="text-lg font-bold text-slate-900">{formatNumber(totalPower, 1)} kWp</p>
                  </div>
                  {project.pricingSnapshot && (
                    <div>
                      <p className="text-xs text-slate-500">Tahmini Satış Fiyatı</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(project.pricingSnapshot.finalSalePrice)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href={`/projects/${id}/setup`}>
                  <ArrowLeft className="w-4 h-4" /> Geri
                </Link>
              </Button>
              <Button type="submit" size="lg">
                Kaydet & Devam →
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
