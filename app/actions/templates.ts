"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { DEF_KA, DEF_KB, DEF_S, DEF_DOR, DEF_TL } from "@/lib/ges-defaults";
import { applyAutoQty, applyAutoQtyKB } from "@/lib/ges-engine";
import { TEMPLATE_SEEDS } from "@/lib/template-seeds";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Boyuta gore makul sayisal varsayilanlar — her sekme acik gelsin diye
 * panel/inverter/alan vs. doldurulur. Kullanici "Bu sablonu kullan"
 * dediginde bu degerler yeni projeye kopyalanir.
 */
function deriveTemplateMeta(dcMwp: number) {
  const dcWp = dcMwp * 1_000_000;
  const panelWp = 625;
  const panelCount = Math.round(dcWp / panelWp);
  const inverterKva = dcMwp >= 1 ? 250 : 50;
  const inverterCount = Math.max(1, Math.ceil((dcMwp * 1000) / inverterKva));
  // Cati tipi proje icin alan ~ DC*8 m2/kWp; arazi icin ~12 m2/kWp
  const isRoof = dcMwp < 0.5;
  const totalAreaM2 = Math.round(dcMwp * 1000 * (isRoof ? 8 : 12));
  const perimeterM = isRoof ? 0 : Math.round(4 * Math.sqrt(totalAreaM2));
  return { panelCount, panelWp, inverterCount, inverterKva, totalAreaM2, perimeterM };
}

function buildTemplateData(seed: (typeof TEMPLATE_SEEDS)[number]) {
  const meta = deriveTemplateMeta(seed.dcMwp);
  const settings = {
    ...DEF_S,
    projeAdi: `Sablon — ${seed.label}`,
    dcGuc: seed.dcMwp,
    acGuc: seed.dcMwp * 0.92, // tipik DC/AC ~1.08
    panelGuc: meta.panelWp,
    panelAdet: meta.panelCount,
    invGuc: meta.inverterKva,
    invAdet: meta.inverterCount,
    cevreTelcit: meta.perimeterM,
    projeAlani: meta.totalAreaM2,
    trafoSayisi: seed.dcMwp >= 5 ? Math.max(1, Math.ceil(seed.dcMwp / 5)) : 1,
  };
  const kesifA = applyAutoQty(JSON.parse(JSON.stringify(DEF_KA)), settings);
  const kesifB = applyAutoQtyKB(JSON.parse(JSON.stringify(DEF_KB)), settings);
  const timeline = JSON.parse(JSON.stringify(DEF_TL));
  return { settings, kesifA, kesifB, timeline, meta };
}

function timelineIsEmpty(tl: unknown): boolean {
  if (!tl || typeof tl !== "object") return true;
  const t = tl as { rows?: unknown[] };
  return !Array.isArray(t.rows) || t.rows.length === 0;
}

/**
 * Eksik sablonlari (label bazli) firma icin yaratir. Idempotent.
 * - Sablon yoksa: tam (timeline + DEF_TL + meta) yarat
 * - Sablon varsa ama timeline'i bos ise: tam veriyi geri-yukle (kullanici
 *   henuz duzenleme yapmamis demektir; "tamamlanmis sablon" hissi versin)
 * - Sablon varsa ve timeline doluysa: dokunma (kullanici customize etmis)
 */
export async function ensureTemplates() {
  const user = await requireAuth();

  const existing = await prisma.project.findMany({
    where: { organizationId: user.organizationId, isTemplate: true },
    include: { projectDetail: { select: { timeline: true } } },
  });
  const existingByLabel = new Map(
    existing.map((p) => [p.templateLabel ?? "", p] as const),
  );

  for (let i = 0; i < TEMPLATE_SEEDS.length; i++) {
    const seed = TEMPLATE_SEEDS[i];
    const { settings, kesifA, kesifB, timeline, meta } = buildTemplateData(seed);
    const found = existingByLabel.get(seed.label);

    if (!found) {
      await prisma.project.create({
        data: {
          organizationId: user.organizationId,
          createdById: user.id,
          name: `Sablon — ${seed.label}`,
          customerName: "Şablon",
          projectLocation: "Şablon",
          installationType: seed.installationType,
          systemSize: seed.systemSize,
          electricityTariff: "INDUSTRIAL",
          status: "COMPLETED",
          totalPowerKw: seed.dcMwp * 1000,
          panelCount: meta.panelCount,
          panelPowerWp: meta.panelWp,
          inverterCount: meta.inverterCount,
          totalAreaM2: meta.totalAreaM2,
          perimeterM: meta.perimeterM,
          isTemplate: true,
          templateLabel: seed.label,
          templateOrder: i,
          projectDetail: {
            create: {
              kesifA: kesifA as never,
              kesifB: kesifB as never,
              timeline: timeline as never,
              dor: DEF_DOR as never,
              settings: settings as never,
            },
          },
        },
      });
    } else if (timelineIsEmpty(found.projectDetail?.timeline)) {
      // Eski seed (timeline'sız) bulundu — kullanici henuz dokunmamis,
      // tam veriyi geri-yukle.
      await prisma.project.update({
        where: { id: found.id },
        data: {
          customerName: "Şablon",
          projectLocation: "Şablon",
          status: "COMPLETED",
          panelCount: meta.panelCount,
          panelPowerWp: meta.panelWp,
          inverterCount: meta.inverterCount,
          totalAreaM2: meta.totalAreaM2,
          perimeterM: meta.perimeterM,
          templateOrder: i,
          projectDetail: {
            update: {
              kesifA: kesifA as never,
              kesifB: kesifB as never,
              timeline: timeline as never,
              dor: DEF_DOR as never,
              settings: settings as never,
            },
          },
        },
      });
    }
  }
}

/**
 * Sabloncu firma icindeki sablonu yeni bir gercek projeye klonlar
 * (isTemplate=false). Ardindan kullaniciyi yeni projenin detail sayfasina
 * yonlendirir.
 */
export async function useTemplate(templateId: string) {
  const user = await requireAuth();

  // Sablonu kullanmak yeni proje yarattigi icin viewer kullanamaz.
  if (user.platformRole === "viewer") {
    throw new Error("Goruntuleyici kullanicilar sablon kullanamaz");
  }

  const template = await prisma.project.findFirst({
    where: { id: templateId, organizationId: user.organizationId, isTemplate: true },
    include: { projectDetail: true },
  });
  if (!template) throw new Error("Sablon bulunamadi");

  // Admin disindaki kullanici bu sablona gizli erisimde mi?
  if (!isAdmin(user)) {
    const hiddenIds = await getHiddenResourceIds(
      user.id,
      user.organizationId,
      "project",
    );
    if (hiddenIds.includes(templateId)) {
      throw new Error("Bu sablona erisiminiz yok");
    }
  }

  const newProject = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      name: "",
      customerName: "",
      projectLocation: "",
      installationType: template.installationType,
      systemSize: template.systemSize,
      electricityTariff: template.electricityTariff,
      status: "DRAFT",
      totalPowerKw: template.totalPowerKw,
      panelCount: template.panelCount,
      panelPowerWp: template.panelPowerWp,
      inverterCount: template.inverterCount,
      totalAreaM2: template.totalAreaM2,
      perimeterM: template.perimeterM,
      electricityUnitPrice: template.electricityUnitPrice,
      annualInflationRate: template.annualInflationRate,
      electricityEscalationRate: template.electricityEscalationRate,
      projectLifeYears: template.projectLifeYears,
      // Template flagleri YOK — bu artik gercek proje
      isTemplate: false,
      ...(template.projectDetail
        ? {
            projectDetail: {
              create: {
                kesifA: template.projectDetail.kesifA as never,
                kesifB: template.projectDetail.kesifB as never,
                timeline: template.projectDetail.timeline as never,
                dor: template.projectDetail.dor as never,
                // gesStep=0 — sablon klonu da sifirdan baslar; kullanici
                // her sekmede "Kaydet & İlerle" basana kadar diger sekmeler
                // kilitli kalir (yeni proje akisiyla ayni davranir). Sablonun
                // kendi gesStep degerini kopyalamiyoruz.
                settings: {
                  ...((template.projectDetail.settings as Record<string, unknown>) || {}),
                  gesStep: 0,
                } as never,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${newProject.id}/detail`);
}

/**
 * Sablon silme (admin/owner amacli — varsayilan listeye dokunmaz, yalnizca
 * fazladan eklenmis veya yanlis seed'i temizlemek icin).
 */
export async function deleteTemplate(templateId: string) {
  const user = await requireAuth();
  if (!isAdmin(user)) throw new Error("Sablon silme yetkiniz yok");
  await prisma.project.deleteMany({
    where: { id: templateId, organizationId: user.organizationId, isTemplate: true },
  });
  revalidatePath("/templates");
}

/**
 * Sablon kilidini ac/kapa. Locked=true iken tum save action'lari
 * engellenir, sayfada CSS read-only kilidi devreye girer.
 */
export async function setTemplateLock(templateId: string, locked: boolean) {
  const user = await requireAuth();
  if (!isAdmin(user)) throw new Error("Sablon kilidi sadece yoneticiler tarafindan acilip kapatilabilir");
  await prisma.project.updateMany({
    where: { id: templateId, organizationId: user.organizationId, isTemplate: true },
    data: { templateLocked: locked },
  });
  revalidatePath(`/projects/${templateId}/detail`);
  revalidatePath("/templates");
}
