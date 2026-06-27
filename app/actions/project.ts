"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateProjectPrice, distributeCosts } from "@/lib/pricing-engine";
import { assertProjectEditable, getProjectAccess } from "@/lib/project-access";
import { InstallationType, SystemSize, TariffType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject() {
  const user = await requireAuth();
  const project = await prisma.project.create({
    data: {
      name: "",
      organizationId: user.organizationId,
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

/**
 * Mevcut bir projeyi yeni bir gerçek projeye kopyalar (klonlar). Teknik veri
 * (projectDetail / kesif / settings), ekipman, maliyet ve fiyat anlık görüntüsü
 * dahil. Paylaşım linkleri, aktivite akışı ve pipeline durumu KOPYALANMAZ —
 * yeni proje sıfırdan taslak olarak başlar. Yeni projenin id'sini döner;
 * yönlendirmeyi çağıran (client) yapar.
 */
export async function duplicateProject(projectId: string): Promise<{ id: string }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") {
    throw new Error("Görüntüleyici kullanıcılar proje kopyalayamaz");
  }

  const access = await getProjectAccess(user, projectId);
  if (!access || !access.canView) throw new Error("Bu projeye erişiminiz yok");

  const source = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: {
      projectDetail: true,
      equipmentItems: true,
      costItems: true,
      pricingSnapshot: true,
    },
  });
  if (!source) throw new Error("Proje bulunamadı");

  const newProject = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      name: `${source.name || "Adsız Proje"} (Kopya)`,
      customerName: source.customerName,
      customerEmail: source.customerEmail,
      customerPhone: source.customerPhone,
      customerAddress: source.customerAddress,
      projectLocation: source.projectLocation,
      installationType: source.installationType,
      systemSize: source.systemSize,
      panelCount: source.panelCount,
      panelPowerWp: source.panelPowerWp,
      inverterCount: source.inverterCount,
      totalAreaM2: source.totalAreaM2,
      perimeterM: source.perimeterM,
      totalPowerKw: source.totalPowerKw,
      electricityTariff: source.electricityTariff,
      electricityUnitPrice: source.electricityUnitPrice,
      annualInflationRate: source.annualInflationRate,
      electricityEscalationRate: source.electricityEscalationRate,
      projectLifeYears: source.projectLifeYears,
      currentStep: source.currentStep,
      // Yeni proje: taslak, pipeline'a girmemiş, şablon değil.
      status: "DRAFT",
      pipelineStage: null,
      lostReason: null,
      competitorName: null,
      isTemplate: false,
      ...(source.projectDetail
        ? {
            projectDetail: {
              create: {
                kesifA: source.projectDetail.kesifA as never,
                kesifB: source.projectDetail.kesifB as never,
                timeline: source.projectDetail.timeline as never,
                dor: source.projectDetail.dor as never,
                // settings'i (gesStep dahil) aynen kopyala — kopya kaynak kadar
                // tamamlanmış başlar; sekmeler kilitli gelmez, listede görünür.
                settings: source.projectDetail.settings as never,
              },
            },
          }
        : {}),
      ...(source.equipmentItems.length
        ? {
            equipmentItems: {
              create: source.equipmentItems.map((e) => ({
                category: e.category,
                brand: e.brand,
                model: e.model,
                quantity: e.quantity,
                unitPrice: e.unitPrice,
                totalPrice: e.totalPrice,
                notes: e.notes,
                sortOrder: e.sortOrder,
              })),
            },
          }
        : {}),
      ...(source.costItems.length
        ? {
            costItems: {
              create: source.costItems.map((c) => ({
                category: c.category,
                description: c.description,
                amount: c.amount,
                notes: c.notes,
              })),
            },
          }
        : {}),
      ...(source.pricingSnapshot
        ? {
            pricingSnapshot: {
              create: {
                referencePricePerKw: source.pricingSnapshot.referencePricePerKw,
                baseTotalPrice: source.pricingSnapshot.baseTotalPrice,
                finalEquipmentCost: source.pricingSnapshot.finalEquipmentCost,
                finalInstallationCost: source.pricingSnapshot.finalInstallationCost,
                finalEngineeringCost: source.pricingSnapshot.finalEngineeringCost,
                finalOtherCosts: source.pricingSnapshot.finalOtherCosts,
                finalTotalCost: source.pricingSnapshot.finalTotalCost,
                profitMarginPercent: source.pricingSnapshot.profitMarginPercent,
                finalSalePrice: source.pricingSnapshot.finalSalePrice,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { id: newProject.id };
}

export async function deleteProject(projectId: string) {
  const user = await requireAuth();
  const access = await getProjectAccess(user, projectId);
  if (!access || !access.canView) return;
  // Silme: admin her sey, owner kendi projesini, ama kilitliyse owner da silemez.
  const isOwner = access.project.createdById === user.id;
  const canDelete = (access.canEdit && isOwner) || user.platformRole === "admin";
  if (!canDelete) throw new Error("Bu projeyi silme yetkiniz yok");

  await prisma.project.deleteMany({
    where: { id: projectId, organizationId: user.organizationId },
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function saveStep1(projectId: string, formData: FormData) {
  const user = await requireAuth();

  await ensureEditable(projectId);

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
  await ensureEditable(projectId);

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
  await ensureEditable(projectId);

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
  await ensureEditable(projectId);

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
  await ensureEditable(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED" },
  });

  revalidatePath(`/projects/${projectId}/proposal`);
  revalidatePath("/dashboard");
}

export async function updateProjectStatus(projectId: string, status: string) {
  const user = await requireAuth();
  await ensureEditable(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { status: status as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}


// Org membership + per-user hide/lock + sablon kilidi.
async function ensureEditable(projectId: string) {
  const user = await requireAuth();
  await assertProjectEditable(user, projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project?.isTemplate && project.templateLocked) {
    throw new Error("Şablon kilitli — düzenlenemez. 'Bu şablonu kullan' ile yeni proje oluşturun.");
  }
}
