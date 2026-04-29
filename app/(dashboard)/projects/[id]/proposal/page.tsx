import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/project/step-indicator";
import { ProposalEditor } from "@/components/project/proposal-editor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProposalPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const [project, subscription] = await Promise.all([
    prisma.project.findFirst({
      where: { id, firmId: user.firmId },
      include: {
        pricingSnapshot: true,
        equipmentItems: { orderBy: { sortOrder: "asc" } },
        costItems: true,
        proposal: true,
        firm: true,
      },
    }),
    prisma.subscription.findUnique({ where: { firmId: user.firmId } }),
  ]);

  if (!project) notFound();

  const canGeneratePDF = hasPermission(user.role, "canGeneratePDF");
  const isLimitReached =
    subscription &&
    subscription.monthlyProposalLimit !== -1 &&
    subscription.currentMonthCount >= subscription.monthlyProposalLimit;

  return (
    <div className="max-w-5xl mx-auto">
      <StepIndicator currentStep={5} />
      <Card>
        <CardHeader>
          <CardTitle>Teklif Önizleme & PDF</CardTitle>
          <CardDescription>
            Teklif ayarlarını yapın ve PDF belgesini oluşturun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProposalEditor
            project={project}
            canGeneratePDF={canGeneratePDF}
            isLimitReached={!!isLimitReached}
          />
        </CardContent>
      </Card>
    </div>
  );
}
