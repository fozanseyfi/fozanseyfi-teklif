"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { EquipmentCategory, CostCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function addEquipmentItem(projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  const category = formData.get("category") as EquipmentCategory;
  const brand = formData.get("brand") as string;
  const model = formData.get("model") as string;
  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const notes = formData.get("notes") as string;

  await prisma.equipmentItem.create({
    data: {
      projectId,
      category,
      brand: brand || null,
      model: model || null,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      notes: notes || null,
    },
  });

  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function updateEquipmentItem(itemId: string, projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  const quantity = parseInt(formData.get("quantity") as string) || 1;
  const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
  const brand = formData.get("brand") as string;
  const model = formData.get("model") as string;
  const notes = formData.get("notes") as string;

  await prisma.equipmentItem.update({
    where: { id: itemId },
    data: {
      brand: brand || null,
      model: model || null,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      notes: notes || null,
    },
  });

  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function deleteEquipmentItem(itemId: string, projectId: string) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  await prisma.equipmentItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function addCostItem(projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  const category = formData.get("category") as CostCategory;
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string) || 0;
  const notes = formData.get("notes") as string;

  await prisma.costItem.create({
    data: { projectId, category, description, amount, notes: notes || null },
  });

  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function updateCostItem(itemId: string, projectId: string, formData: FormData) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  const amount = parseFloat(formData.get("amount") as string) || 0;
  const description = formData.get("description") as string;
  const notes = formData.get("notes") as string;

  await prisma.costItem.update({
    where: { id: itemId },
    data: { amount, description, notes: notes || null },
  });

  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function deleteCostItem(itemId: string, projectId: string) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  await prisma.costItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${projectId}/equipment`);
}

export async function seedDefaultEquipment(projectId: string) {
  const user = await requireAuth();
  await ensureOwner(projectId, user.organizationId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { pricingSnapshot: true },
  });
  if (!project || !project.pricingSnapshot) return;

  const snapshot = project.pricingSnapshot;
  const equipmentCost = snapshot.finalEquipmentCost;
  const panelCost = equipmentCost * 0.78;
  const inverterCost = equipmentCost * 0.22;
  const otherEqCost = snapshot.finalTotalCost * 0.15;

  const existing = await prisma.equipmentItem.count({ where: { projectId } });
  if (existing > 0) return;

  await prisma.$transaction([
    prisma.equipmentItem.create({
      data: {
        projectId,
        category: "PANEL",
        quantity: project.panelCount || 1,
        unitPrice: project.panelCount ? panelCost / project.panelCount : panelCost,
        totalPrice: panelCost,
        sortOrder: 1,
      },
    }),
    prisma.equipmentItem.create({
      data: {
        projectId,
        category: "INVERTER",
        quantity: project.inverterCount || 1,
        unitPrice: project.inverterCount ? inverterCost / project.inverterCount : inverterCost,
        totalPrice: inverterCost,
        sortOrder: 2,
      },
    }),
    prisma.equipmentItem.create({
      data: {
        projectId,
        category: "MOUNTING_SYSTEM",
        quantity: 1,
        unitPrice: otherEqCost * 0.4,
        totalPrice: otherEqCost * 0.4,
        sortOrder: 3,
      },
    }),
    prisma.equipmentItem.create({
      data: {
        projectId,
        category: "DC_CABLE",
        quantity: 1,
        unitPrice: otherEqCost * 0.15,
        totalPrice: otherEqCost * 0.15,
        sortOrder: 4,
      },
    }),
    prisma.equipmentItem.create({
      data: {
        projectId,
        category: "MONITORING_SYSTEM",
        quantity: 1,
        unitPrice: otherEqCost * 0.1,
        totalPrice: otherEqCost * 0.1,
        sortOrder: 5,
      },
    }),
    prisma.costItem.createMany({
      data: [
        { projectId, category: "INSTALLATION_LABOR", description: "Montaj Ä°ÅŸÃ§iliÄŸi", amount: snapshot.finalInstallationCost },
        { projectId, category: "ENGINEERING_DESIGN", description: "MÃ¼hendislik & TasarÄ±m", amount: snapshot.finalEngineeringCost },
        { projectId, category: "PERMITS_LICENSING", description: "Ä°zin & Lisans", amount: snapshot.finalOtherCosts * 0.5 },
        { projectId, category: "TRANSPORTATION", description: "Nakliye", amount: snapshot.finalOtherCosts * 0.3 },
        { projectId, category: "COMMISSIONING", description: "Devreye Alma", amount: snapshot.finalOtherCosts * 0.2 },
      ],
    }),
  ]);

  revalidatePath(`/projects/${projectId}/equipment`);
}

async function ensureOwner(projectId: string, organizationId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== organizationId) throw new Error("Unauthorized");
}
