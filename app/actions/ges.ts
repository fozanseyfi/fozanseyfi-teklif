"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { DEF_KA, DEF_KB, DEF_S, DEF_TL, DEF_DOR } from "@/lib/ges-defaults";
import { applyAutoQty, applyAutoQtyKB } from "@/lib/ges-engine";
import { InstallationType, SystemSize, TariffType } from "@prisma/client";

export async function getOrCreateProjectDetail(projectId: string) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  let detail = await prisma.projectDetail.findUnique({ where: { projectId } });

  if (!detail) {
    const dcGucMW = project.totalPowerKw / 1000 || 1;
    const settings = {
      ...DEF_S,
      projeAdi: project.name,
      isveren: project.customerName || "",
      dcGuc: dcGucMW,
      acGuc: dcGucMW * 0.9,
      panelAdet: project.panelCount || 0,
      panelGuc: project.panelPowerWp || 625,
      invAdet: project.inverterCount || 1,
      cevreTelcit: project.perimeterM || 400,
      projeAlani: project.totalAreaM2 || 10000,
      electricityUnitPriceTry: project.electricityUnitPrice || 3.5,
      electricityEscalationRate: project.electricityEscalationRate,
      annualInflationRate: project.annualInflationRate,
      projectLifeYears: project.projectLifeYears,
      electricityTariff: project.electricityTariff,
    };

    const kesifA = applyAutoQty(JSON.parse(JSON.stringify(DEF_KA)), settings);
    const kesifB = applyAutoQtyKB(JSON.parse(JSON.stringify(DEF_KB)), settings);

    detail = await prisma.projectDetail.create({
      data: {
        projectId,
        kesifA: kesifA as never,
        kesifB: kesifB as never,
        timeline: DEF_TL as never,
        dor: DEF_DOR as never,
        settings: settings as never,
      },
    });
  }

  return detail;
}

export async function saveProjectInfo(projectId: string, formData: FormData) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  const name = formData.get("name") as string;
  const customerName = formData.get("customerName") as string;
  const customerEmail = formData.get("customerEmail") as string;
  const customerPhone = formData.get("customerPhone") as string;
  const customerAddress = formData.get("customerAddress") as string;
  const projectLocation = formData.get("projectLocation") as string;
  const il = formData.get("il") as string;
  const ilce = formData.get("ilce") as string;
  const installationType = formData.get("installationType") as InstallationType;
  const systemSize = formData.get("systemSize") as SystemSize;
  const electricityTariff = (formData.get("electricityTariff") as string) || "INDUSTRIAL";
  const notesRaw = (formData.get("notes") as string) || "";
  const risksRaw = (formData.get("risks") as string) || "";
  const insightsRaw = (formData.get("customerInsights") as string) || "";
  const notes = notesRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const risks = risksRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const customerInsights = insightsRaw.split("\n").map((l) => l.trim()).filter(Boolean);

  // Harita verisi
  const haritaLatRaw = formData.get("haritaLat") as string;
  const haritaLngRaw = formData.get("haritaLng") as string;
  const haritaZoomRaw = formData.get("haritaZoom") as string;
  const haritaPolygonRaw = formData.get("haritaPolygon") as string;
  const haritaScreenshot = (formData.get("haritaScreenshot") as string) || undefined;
  const haritaPanelCountRaw = formData.get("haritaPanelCount") as string;
  const haritaLat = haritaLatRaw ? parseFloat(haritaLatRaw) : undefined;
  const haritaLng = haritaLngRaw ? parseFloat(haritaLngRaw) : undefined;
  const haritaZoom = haritaZoomRaw ? parseInt(haritaZoomRaw) : undefined;
  const haritaPanelCount = haritaPanelCountRaw ? parseInt(haritaPanelCountRaw) : undefined;
  let haritaPolygon: [number, number][] | undefined;
  try { haritaPolygon = haritaPolygonRaw ? JSON.parse(haritaPolygonRaw) : undefined; } catch { /* ignore */ }

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
      electricityTariff: electricityTariff as TariffType,
      status: "IN_PROGRESS",
    },
  });

  const settingsUpdate: Record<string, unknown> = {
    projeAdi: name, isveren: customerName, il, ilce, notes, risks, customerInsights, electricityTariff,
    ...(haritaLat !== undefined && { haritaLat }),
    ...(haritaLng !== undefined && { haritaLng }),
    ...(haritaZoom !== undefined && { haritaZoom }),
    ...(haritaPolygon !== undefined && { haritaPolygon }),
    ...(haritaScreenshot !== undefined && { haritaScreenshot }),
    ...(haritaPanelCount !== undefined && { haritaPanelCount }),
  };

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  if (detail) {
    const existing = detail.settings as Record<string, unknown>;
    await prisma.projectDetail.update({
      where: { projectId },
      data: { settings: { ...existing, ...settingsUpdate } as never },
    });
  } else {
    await getOrCreateProjectDetail(projectId);
    const freshDetail = await prisma.projectDetail.findUnique({ where: { projectId } });
    if (freshDetail) {
      const existing = freshDetail.settings as Record<string, unknown>;
      await prisma.projectDetail.update({
        where: { projectId },
        data: { settings: { ...existing, ...settingsUpdate } as never },
      });
    }
  }

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveTeknik(projectId: string, data: Record<string, unknown>) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  const dcGuc = Number(data.dcGuc) || 1;
  const panelCount = Number(data.panelAdet) || 0;
  const panelPowerWp = Number(data.panelGuc) || 625;
  const inverterCount = Number(data.invAdet) || 1;
  const totalPowerKw = dcGuc * 1000;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      panelCount,
      panelPowerWp,
      inverterCount,
      totalAreaM2: Number(data.projeAlani) || 0,
      perimeterM: Number(data.cevreTelcit) || 0,
      totalPowerKw,
    },
  });

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const oldSettings = (detail?.settings as Record<string, unknown>) || DEF_S;
  const newSettings = { ...oldSettings, ...data };

  const kesifA = applyAutoQty(
    JSON.parse(JSON.stringify(detail?.kesifA || DEF_KA)),
    newSettings as never
  );
  const kesifB = applyAutoQtyKB(
    JSON.parse(JSON.stringify(detail?.kesifB || DEF_KB)),
    newSettings as never
  );

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: kesifA as never,
      kesifB: kesifB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: {
      settings: newSettings as never,
      kesifA: kesifA as never,
      kesifB: kesifB as never,
    },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveFizibilite(projectId: string, data: Record<string, unknown>) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      electricityUnitPrice: Number(data.electricityUnitPriceTry) || 0,
      electricityTariff: (data.electricityTariff as TariffType) || "INDUSTRIAL",
      annualInflationRate: Number(data.annualInflationRate) || 0.4,
      electricityEscalationRate: Number(data.electricityEscalationRate) || 0.35,
      projectLifeYears: Number(data.projectLifeYears) || 25,
    },
  });

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const oldSettings = (detail?.settings as Record<string, unknown>) || DEF_S;
  const newSettings = { ...oldSettings, ...data };

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { settings: newSettings as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveGesSettings(projectId: string, settings: Record<string, unknown>) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const oldSettings = (detail?.settings as Record<string, unknown>) || {};
  const newSettings = { ...oldSettings, ...settings };

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { settings: newSettings as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveKesifA(projectId: string, kesifA: unknown[]) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      kesifA: kesifA as never,
      settings: DEF_S as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { kesifA: kesifA as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveKesifB(projectId: string, kesifB: unknown[]) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      kesifB: kesifB as never,
      settings: DEF_S as never,
      kesifA: DEF_KA as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { kesifB: kesifB as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveTimeline(projectId: string, timeline: unknown) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      timeline: timeline as never,
      settings: DEF_S as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      dor: DEF_DOR as never,
    },
    update: { timeline: timeline as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveDor(projectId: string, dor: unknown[]) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, firmId: user.firmId },
  });
  if (!project) throw new Error("Proje bulunamadı");

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      dor: dor as never,
      settings: DEF_S as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
    },
    update: { dor: dor as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveRoofs(
  projectId: string,
  roofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[],
) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id: projectId, firmId: user.firmId } });
  if (!project) throw new Error("Proje bulunamadı");

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const old = (detail?.settings as Record<string, unknown>) || {};
  const newSettings = { ...old, haritaRoofs: roofs };

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { settings: newSettings as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function saveDrawing(
  projectId: string,
  roofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[],
  panelCfg: { orientation: string; panelsPerGroup: number; panelHGap: number; groupHGap: number; panelVGap: number },
  removedPanels: number[],
  panelCount: number,
) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id: projectId, firmId: user.firmId } });
  if (!project) throw new Error("Proje bulunamadı");

  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const old = (detail?.settings as Record<string, unknown>) || {};
  const newSettings = {
    ...old,
    haritaRoofs: roofs,
    haritaPanelCfg: panelCfg,
    haritaRemovedPanels: removedPanels,
    haritaPanelCount: panelCount,
  };

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { settings: newSettings as never },
  });

  revalidatePath(`/projects/${projectId}/detail`);
}

export async function markProjectCompleted(projectId: string) {
  const user = await requireAuth();
  await prisma.project.update({
    where: { id: projectId, firmId: user.firmId },
    data: { status: "COMPLETED" },
  });
  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/projects");
}
