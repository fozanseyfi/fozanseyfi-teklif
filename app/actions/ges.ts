"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadEditableProject } from "@/lib/project-access";
import { revalidatePath } from "next/cache";
import { DEF_KA, DEF_KB, DEF_S, DEF_TL, DEF_DOR } from "@/lib/ges-defaults";
import { applyAutoQty, applyAutoQtyKB } from "@/lib/ges-engine";
import { InstallationType, SystemSize, TariffType } from "@prisma/client";

export async function getOrCreateProjectDetail(projectId: string) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
  });
  if (!project) throw new Error("Proje bulunamadı");
  // Sablonlar icin auto-create yok — ensureTemplates onu zaten yarattı.
  // Detail varolan kayit oldugu icin bu fonksiyon read-only davranir.

  let detail = await prisma.projectDetail.findUnique({ where: { projectId } });

  if (!detail) {
    // Yeni proje: settings DEF_S'ten gelir (her sey 0/bos), kullanici doldurur.
    // Sadece proje meta-bilgisi ve regulatory sabitler aktarilir.
    const settings = {
      ...DEF_S,
      projeAdi: project.name,
      isveren: project.customerName || "",
      dcGuc: project.totalPowerKw / 1000,
      panelAdet: project.panelCount,
      panelGuc: project.panelPowerWp,
      invAdet: project.inverterCount,
      cevreTelcit: project.perimeterM,
      projeAlani: project.totalAreaM2,
      electricityUnitPriceTry: project.electricityUnitPrice,
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
        // Timeline bos baslar — kullanici dolduracak ki Analiz acilsin
        timeline: {} as never,
        dor: DEF_DOR as never,
        settings: settings as never,
      },
    });
  }

  return detail;
}

/**
 * GES kurulum adim sayaci — settings JSON'una gomulu.
 *  0: hicbiri kaydedilmedi (yeni proje veya yeni klon)
 *  1: Proje bilgileri "Kaydet & İlerle" basildi
 *  2: Teknik "Kaydet & İlerle" basildi
 *  3: Keşif-A "Kaydet & İlerle" basildi
 *  4: Keşif-B "Kaydet & İlerle" basildi
 *  5: Timeline "Kaydet & İlerle" basildi (Analiz acildi → COMPLETED)
 *
 * Kural: yalnizca artirir, asla geri almaz. Kullanici eski sekmeye donup
 * tekrar Kaydet'e bassa bile, ileri sekmeler kilidi acik kalir.
 */
async function bumpGesStep(projectId: string, minStep: number): Promise<void> {
  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  if (!detail) return;
  const settings = (detail.settings as Record<string, unknown>) || {};
  const current = Number(settings.gesStep) || 0;
  if (minStep <= current) return;
  await prisma.projectDetail.update({
    where: { projectId },
    data: { settings: { ...settings, gesStep: minStep } as never },
  });
}

/**
 * Timeline veri tabanindan dolu mu? Analiz/CF/BoQ/PBoQ/DoR sekmelerini
 * acmak icin kullanicinin Timeline'i kaydetmis olmasi gerekir.
 */
function timelineHasData(timeline: unknown): boolean {
  if (!timeline || typeof timeline !== "object") return false;
  const tl = timeline as { rows?: { values?: number[] }[] };
  if (!Array.isArray(tl.rows) || tl.rows.length === 0) return false;
  return tl.rows.some((r) => Array.isArray(r.values) && r.values.some((v) => v > 0));
}

/**
 * Proje statusunu Timeline durumuna gore otomatik gunceller:
 * - Timeline dolu ise COMPLETED
 * - Aksi halde DRAFT
 * Kullanici manual olarak CLOSE_WIN/CLOSE_LOST/CANCELLED'a gecmisse dokunmaz.
 */
async function recomputeProjectStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { projectDetail: { select: { timeline: true } } },
  });
  if (!project) return;
  // Manuel kapanis/iptal durumlarini koru
  if (
    project.status === "CLOSE_WIN" ||
    project.status === "CLOSE_LOST" ||
    project.status === "CANCELLED"
  ) {
    return;
  }
  const tlFilled = timelineHasData(project.projectDetail?.timeline);
  const desired = tlFilled ? "COMPLETED" : "DRAFT";
  if (project.status !== desired) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: desired },
    });
  }
}

export async function saveProjectInfo(projectId: string, formData: FormData, advance = false) {
  const project = await loadEditableProject(projectId);

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

  if (advance) await bumpGesStep(projectId, 1);
  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveTeknik(projectId: string, data: Record<string, unknown>, advance = false) {
  const project = await loadEditableProject(projectId);

  const dcGuc = Number(data.dcGuc) || 0;
  const panelCount = Number(data.panelAdet) || 0;
  const panelPowerWp = Number(data.panelGuc) || 0;
  const inverterCount = Number(data.invAdet) || 0;
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

  // applyAutoQty oldSettings ile cagrilir ki formul-takipli kalemler
  // guncellensin, kullanicinin manuel duzelttigi miktarlar korunsun.
  const kesifA = applyAutoQty(
    JSON.parse(JSON.stringify(detail?.kesifA || DEF_KA)),
    newSettings as never,
    oldSettings as never,
  );
  const kesifB = applyAutoQtyKB(
    JSON.parse(JSON.stringify(detail?.kesifB || DEF_KB)),
    newSettings as never,
    oldSettings as never,
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

  if (advance) await bumpGesStep(projectId, 2);
  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveFizibilite(projectId: string, data: Record<string, unknown>) {
  const project = await loadEditableProject(projectId);

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

  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveGesSettings(projectId: string, settings: Record<string, unknown>) {
  const project = await loadEditableProject(projectId);

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

  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

/**
 * Bir kesif grubunu ardisik kod ile yeniden numaralandirir:
 * `${group.code}.${idx+1}` — eklenmis/silinmis kalemlerden sonra bosluksuz
 * sirali kalsin diye.
 */
function renumberGroups(groups: unknown[]): unknown[] {
  if (!Array.isArray(groups)) return groups;
  return groups.map((g) => {
    if (!g || typeof g !== "object") return g;
    const grp = g as { code?: string; items?: unknown[] };
    if (!grp.code || !Array.isArray(grp.items)) return g;
    return {
      ...grp,
      items: grp.items.map((it, idx) => {
        if (!it || typeof it !== "object") return it;
        return { ...it, code: `${grp.code}.${idx + 1}` };
      }),
    };
  });
}

export async function saveKesifA(projectId: string, kesifA: unknown[], advance = false) {
  const project = await loadEditableProject(projectId);

  const normalized = renumberGroups(kesifA);
  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      kesifA: normalized as never,
      settings: DEF_S as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { kesifA: normalized as never },
  });

  if (advance) await bumpGesStep(projectId, 3);
  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveKesifB(projectId: string, kesifB: unknown[], advance = false) {
  const project = await loadEditableProject(projectId);

  const normalized = renumberGroups(kesifB);
  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      kesifB: normalized as never,
      settings: DEF_S as never,
      kesifA: DEF_KA as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { kesifB: normalized as never },
  });

  if (advance) await bumpGesStep(projectId, 4);
  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveTimeline(projectId: string, timeline: unknown, advance = false) {
  const project = await loadEditableProject(projectId);

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

  if (advance) {
    await bumpGesStep(projectId, 5);
    // Timeline'da "Kaydet & İlerle" basildiginda proje TAMAMLANDI sayilir.
    // (Eski mantik: timeline data dolu olunca otomatik COMPLETED — bu hala
    // calisir ama explicit advance daha kesin.)
    if (project.status === "DRAFT") {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED" },
      });
    }
  }

  // Eski otomatik recompute — timeline silinirse veya tekrar bos kalirsa
  // status DRAFT'a doner.
  await recomputeProjectStatus(projectId);

  revalidatePath(`/projects/${projectId}/detail`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

export async function saveDor(projectId: string, dor: unknown[]) {
  const project = await loadEditableProject(projectId);

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

  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveRoofs(
  projectId: string,
  roofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[],
) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!project) throw new Error("Proje bulunamadı");
  if (project.isTemplate && project.templateLocked) throw new Error("Şablon kilitli — düzenlenemez. 'Bu şablonu kullan' ile yeni proje oluşturun.");

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

  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function saveDrawing(
  projectId: string,
  roofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[],
  panelCfg: { orientation: string; panelsPerGroup: number; panelHGap: number; groupHGap: number; panelVGap: number },
  removedPanels: number[],
  panelCount: number,
) {
  const user = await requireAuth();
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!project) throw new Error("Proje bulunamadı");
  if (project.isTemplate && project.templateLocked) throw new Error("Şablon kilitli — düzenlenemez. 'Bu şablonu kullan' ile yeni proje oluşturun.");

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

  revalidatePath(`/projects/${projectId}/detail`, "layout");
}

export async function markProjectCompleted(projectId: string) {
  const user = await requireAuth();
  await prisma.project.update({
    where: { id: projectId, organizationId: user.organizationId },
    data: { status: "COMPLETED" },
  });
  revalidatePath(`/projects/${projectId}/detail`, "layout");
  revalidatePath("/projects");
}
