import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveStep1 } from "@/app/actions/project";
import { StepIndicator } from "@/components/project/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TARIFF_LABELS, INSTALLATION_TYPE_LABELS, SYSTEM_SIZE_LABELS } from "@/lib/utils";
import Link from "next/link";
import { Zap } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SetupPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
  });
  if (!project) notFound();

  const tariffs = await prisma.electricityTariff.findMany({ orderBy: { effectiveDate: "desc" } });
  const tariffMap: Record<string, number> = {};
  for (const t of tariffs) {
    if (!tariffMap[t.type]) tariffMap[t.type] = t.unitPrice;
  }

  const action = saveStep1.bind(null, id);

  const isGesEpc = project.installationType === "GROUND_MOUNTED" && project.totalPowerKw > 25;

  return (
    <div className="max-w-2xl mx-auto">
      {isGesEpc && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">GES EPC Analizi Mevcut</p>
              <p className="text-xs text-amber-600">Bu proje arazi tipi ve &gt;25 kW olduğu için detaylı EPC analizi yapabilirsiniz</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-100">
            <Link href={`/projects/${id}/detail`}>EPC Analiz →</Link>
          </Button>
        </div>
      )}
      <StepIndicator currentStep={1} />
      <Card>
        <CardHeader>
          <CardTitle>Proje & Müşteri Bilgileri</CardTitle>
          <CardDescription>Projeye ait temel bilgileri girin</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Proje Bilgileri</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Proje Adı *</Label>
                  <Input id="name" name="name" defaultValue={project.name} placeholder="ABC Solar Çatı Projesi" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Proje Konumu *</Label>
                  <Input name="projectLocation" defaultValue={project.projectLocation} placeholder="İstanbul / Kadıköy" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Kurulum Tipi *</Label>
                    <Select name="installationType" defaultValue={project.installationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INSTALLATION_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sistem Büyüklüğü *</Label>
                    <Select name="systemSize" defaultValue={project.systemSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SYSTEM_SIZE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Müşteri Bilgileri</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customerName">Müşteri Adı / Firma Adı *</Label>
                  <Input id="customerName" name="customerName" defaultValue={project.customerName} placeholder="Ahmet Yılmaz" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>E-posta</Label>
                    <Input name="customerEmail" type="email" defaultValue={project.customerEmail ?? ""} placeholder="musteri@email.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefon</Label>
                    <Input name="customerPhone" defaultValue={project.customerPhone ?? ""} placeholder="0532 000 00 00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Adres</Label>
                  <Input name="customerAddress" defaultValue={project.customerAddress ?? ""} placeholder="Müşteri adresi" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Tarife & Elektrik</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tarife Tipi *</Label>
                  <Select name="electricityTariff" defaultValue={project.electricityTariff}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TARIFF_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Elektrik Birim Fiyatı (TL/kWh)</Label>
                  <Input
                    name="electricityUnitPrice"
                    type="number"
                    step="0.001"
                    defaultValue={project.electricityUnitPrice || (tariffMap[project.electricityTariff] ?? "")}
                    placeholder="3.500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
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
