"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateProjectPrice, distributeCosts } from "@/lib/pricing-engine";
import { InstallationType, SystemSize, TariffType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject() {
  const user = await requireAuth();
  const project = await prisma.project.create({
    data: {
      name: "",
      firmId: user.firmId,
      createdById: user.id,
      customerName: "",
      projectLocation: "",
      installationType: InstallationType.ROOFTOP,
      systemSize: SystemSize.SMALL,
      electricityTariff: TariffType.RESIDENTIAL,
      status: "DRAFT",
    },
  });
  redirect(`/projects/${project.id}/detail`);
}

export async function deleteProject(projectId: string) {
  const user = await requireAuth();
  await prisma.project.deleteMany({
    where: { id: projectId, firmId: user.firmId },
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function saveStep1(projectId: string, formData: FormData) {
  const user = await requireAuth();

  await ensureOwner(projectId, user.firmId);

  const name = formData.get("name") as string;
  const customerName = formData.get("customerName") as string;
  const customerEmail = formData.get("customerEmail") as string;
  const customerPhone = formData.get("customerPhone") as string;
  const customerAddress = formData.get("customerAddress") as string;
  const projectLocation = formData.get("projectLocation") as string;
  const installationType = formData.get("installationType") as InstallationType;
  const systemSize = formData.get("systemSize") as SystemSize;
  const electricityTariff = formData.get("electricityTariff") as TariffType;
  const electricityUnitPrice = parseFloat(formData.get("electricityUnitPrice") as string) || 0;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      projectLocation,
      installationType,
      systemSize,
      electricityTariff,
      electricityUnitPrice,
      currentStep: 2,
      status: "IN_PROGRESS",
    },
  });

  revalidatePath(`/projects/${projectId}/pricing`);
  redirect(`/projects/${projectId}/pricing`);
}

export async function saveStep2(projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.firmId);

  const panelCount = parseInt(formData.get("panelCount") as string) || 0;
  const panelPowerWp = parseFloat(formData.get("panelPowerWp") as string) || 0;
  const inverterCount = parseInt(formData.get("inverterCount") as string) || 0;
  const totalAreaM2 = parseFloat(formData.get("totalAreaM2") as string) || 0;
  const perimeterM = parseFloat(formData.get("perimeterM") as string) || 0;

  const totalPowerKw = (panelCount * panelPowerWp) / 1000;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const referenceTable = await prisma.referencePriceTable.findMany({
    where: { installationType: project.installationType },
    orderBy: { powerKw: "asc" },
  });

  let finalSalePrice = 0;
  let baseTotalPrice = 0;
  let referencePricePerKw = 0;

  if (referenceTable.length > 0) {
    const pricePoints = referenceTable.map((r) => ({ powerKw: r.powerKw, pricePerKw: r.pricePerKw }));
    baseTotalPrice = calculateProjectPrice(totalPowerKw, pricePoints);
    referencePricePerKw = totalPowerKw > 0 ? baseTotalPrice / totalPowerKw : 0;
  }

  const costs = distributeCosts(baseTotalPrice);
  finalSalePrice = baseTotalPrice * 1.2; // %20 kâr marjı varsayılan

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { panelCount, panelPowerWp, inverterCount, totalAreaM2, perimeterM, totalPowerKw, currentStep: 3 },
    }),
    prisma.pricingSnapshot.upsert({
      where: { projectId },
      create: {
        projectId,
        referencePricePerKw,
        baseTotalPrice,
        finalEquipmentCost: costs.panelInverterCost + costs.otherEquipmentCost,
        finalInstallationCost: costs.installationLaborCost,
        finalEngineeringCost: costs.engineeringDesignCost,
        finalOtherCosts: costs.otherCost,
        finalTotalCost: baseTotalPrice,
        profitMarginPercent: 0.2,
        finalSalePrice,
      },
      update: {
        referencePricePerKw,
        baseTotalPrice,
        finalEquipmentCost: costs.panelInverterCost + costs.otherEquipmentCost,
        finalInstallationCost: costs.installationLaborCost,
        finalEngineeringCost: costs.engineeringDesignCost,
        finalOtherCosts: costs.otherCost,
        finalTotalCost: baseTotalPrice,
        profitMarginPercent: 0.2,
        finalSalePrice,
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}/equipment`);
  redirect(`/projects/${projectId}/equipment`);
}

export async function saveStep3(projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.firmId);

  const profitMargin = parseFloat(formData.get("profitMargin") as string) / 100 || 0.2;

  // Ekipman ve maliyet toplamlarını DB'den hesapla
  const [equipmentItems, costItems] = await Promise.all([
    prisma.equipmentItem.findMany({ where: { projectId } }),
    prisma.costItem.findMany({ where: { projectId } }),
  ]);

  const equipmentTotal = equipmentItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const installationTotal = costItems
    .filter((i) => i.category === "INSTALLATION_LABOR")
    .reduce((sum, i) => sum + i.amount, 0);
  const engineeringTotal = costItems
    .filter((i) => i.category === "ENGINEERING_DESIGN")
    .reduce((sum, i) => sum + i.amount, 0);
  const otherTotal = costItems
    .filter((i) => !["INSTALLATION_LABOR", "ENGINEERING_DESIGN"].includes(i.category))
    .reduce((sum, i) => sum + i.amount, 0);

  const totalCost = equipmentTotal + installationTotal + engineeringTotal + otherTotal;
  const finalSalePrice = totalCost * (1 + profitMargin);

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { currentStep: 4 } }),
    prisma.pricingSnapshot.upsert({
      where: { projectId },
      create: {
        projectId,
        referencePricePerKw: 0,
        baseTotalPrice: totalCost,
        finalEquipmentCost: equipmentTotal,
        finalInstallationCost: installationTotal,
        finalEngineeringCost: engineeringTotal,
        finalOtherCosts: otherTotal,
        finalTotalCost: totalCost,
        profitMarginPercent: profitMargin,
        finalSalePrice,
      },
      update: {
        finalEquipmentCost: equipmentTotal,
        finalInstallationCost: installationTotal,
        finalEngineeringCost: engineeringTotal,
        finalOtherCosts: otherTotal,
        finalTotalCost: totalCost,
        profitMarginPercent: profitMargin,
        finalSalePrice,
      },
    }),
  ]);

  redirect(`/projects/${projectId}/financials`);
}

export async function saveStep4(projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.firmId);

  const annualInflationRate = parseFloat(formData.get("annualInflationRate") as string) / 100 || 0.4;
  const electricityEscalationRate =
    parseFloat(formData.get("electricityEscalationRate") as string) / 100 || 0.35;
  const projectLifeYears = parseInt(formData.get("projectLifeYears") as string) || 25;
  const electricityUnitPrice = parseFloat(formData.get("electricityUnitPrice") as string) || 0;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      annualInflationRate,
      electricityEscalationRate,
      projectLifeYears,
      electricityUnitPrice,
      currentStep: 5,
    },
  });

  redirect(`/projects/${projectId}/proposal`);
}

export async function markCompleted(projectId: string) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.firmId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED" },
  });

  revalidatePath(`/projects/${projectId}/proposal`);
  revalidatePath("/dashboard");
}

export async function updateProjectStatus(projectId: string, status: string) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.firmId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: status as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}


async function ensureOwner(projectId: string, firmId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.firmId !== firmId) {
    redirect("/projects");
  }
  if (project.isTemplate && project.templateLocked) {
    throw new Error("Şablon kilitli — düzenlenemez. 'Bu şablonu kullan' ile yeni proje oluşturun.");
  }
}
