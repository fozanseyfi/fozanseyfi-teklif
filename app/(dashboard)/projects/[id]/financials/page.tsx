import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveStep4 } from "@/app/actions/project";
import { StepIndicator } from "@/components/project/step-indicator";
import { FinancialAnalysis } from "@/components/project/financial-analysis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FinancialsPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id, firmId: user.firmId },
    include: { pricingSnapshot: true },
  });
  if (!project) notFound();

  return (
    <div className="max-w-5xl mx-auto">
      <StepIndicator currentStep={4} />
      <Card>
        <CardHeader>
          <CardTitle>Finansal Analiz</CardTitle>
          <CardDescription>25 yıllık cash flow ve geri ödeme analizi</CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialAnalysis project={project} />
        </CardContent>
      </Card>
    </div>
  );
}
