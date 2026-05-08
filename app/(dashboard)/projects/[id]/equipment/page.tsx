import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/project/step-indicator";
import { EquipmentTable } from "@/components/project/equipment-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EquipmentPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      pricingSnapshot: true,
      equipmentItems: { orderBy: { sortOrder: "asc" } },
      costItems: true,
    },
  });
  if (!project) notFound();

  return (
    <div className="max-w-5xl mx-auto">
      <StepIndicator currentStep={3} />
      <Card>
        <CardHeader>
          <CardTitle>Ekipman & Maliyet Detayları</CardTitle>
          <CardDescription>
            Ekipman ve maliyet kalemlerini düzenleyin. Sistem otomatik doldurdu, siz özelleştirebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentTable project={project} />
        </CardContent>
      </Card>
    </div>
  );
}
