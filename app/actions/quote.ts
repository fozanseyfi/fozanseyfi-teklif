"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getProjectAccess } from "@/lib/project-access";
import {
  parseQuoteItems,
  parseQuoteMeta,
  parseQuoteRevisions,
  type QuoteItem,
  type QuoteMeta,
} from "@/lib/quote";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";

// meta alanlarını settings JSON'una yansıtır (mirror = son revizyon).
function metaToSettings(
  base: Record<string, unknown>,
  meta: QuoteMeta,
  quoteStep: number,
): Record<string, unknown> {
  return {
    ...base,
    usd: meta.usd,
    eur: meta.eur,
    kdvRate: meta.kdvRate,
    outputCurrency: meta.outputCurrency,
    quoteNo: meta.quoteNo,
    quoteDate: meta.quoteDate,
    validityDays: meta.validityDays,
    notes: meta.notes,
    paymentTerms: meta.paymentTerms ?? [],
    quoteStep,
  };
}

/**
 * Yeni bir Malzeme & Hizmet teklifi oluşturur ve müşteri sayfasına yönlendirir.
 */
export async function createMaterialServiceProject() {
  const user = await requireAuth();
  if (user.platformRole === "viewer") {
    throw new Error("Görüntüleyici kullanıcılar teklif oluşturamaz");
  }

  const project = await prisma.project.create({
    data: {
      name: "",
      organizationId: user.organizationId,
      createdById: user.id,
      customerName: "",
      projectLocation: "",
      status: "DRAFT",
      quoteKind: "MATERIAL_SERVICE",
      projectDetail: {
        create: {
          quoteItems: [] as never,
          settings: {
            quoteStep: 0,
            kdvRate: 20,
            validityDays: 30,
            quoteDate: new Date().toISOString().slice(0, 10),
          } as never,
        },
      },
    },
  });

  redirect(`/projects/${project.id}/detail`);
}

async function assertQuoteEditable(projectId: string) {
  const user = await requireAuth();
  const access = await getProjectAccess(user, projectId);
  if (!access || !access.canView) throw new Error("Bu teklife erişiminiz yok");
  if (!access.canEdit) throw new Error("Bu teklif salt-okunur");
  return { user, access };
}

/** Müşteri bilgilerini kaydeder (Malzeme & Hizmet teklifinde ilk adım). */
export async function saveQuoteCustomer(projectId: string, formData: FormData) {
  await assertQuoteEditable(projectId);

  const name = ((formData.get("name") as string) ?? "").trim();
  const customerName = ((formData.get("customerName") as string) ?? "").trim();
  const customerEmail = ((formData.get("customerEmail") as string) ?? "").trim();
  const customerPhone = ((formData.get("customerPhone") as string) ?? "").trim();
  const customerAddress = ((formData.get("customerAddress") as string) ?? "").trim();
  const il = ((formData.get("il") as string) ?? "").trim();
  const ilce = ((formData.get("ilce") as string) ?? "").trim();
  // Lokasyon = il + ilçe birleşimi (projeler sayfası/harita projectLocation kullanır).
  const projectLocation = [il, ilce].filter(Boolean).join(" / ");

  const detail = await prisma.projectDetail.findUnique({
    where: { projectId },
    select: { settings: true },
  });
  const settings = (detail?.settings as Record<string, unknown> | null) ?? {};
  const nextStep = Math.max(1, Number(settings.quoteStep) || 0);
  const nextSettings = { ...settings, il, ilce, quoteStep: nextStep };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: name || "İsimsiz Teklif",
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      projectLocation,
      projectDetail: {
        upsert: {
          create: {
            quoteItems: [] as never,
            settings: nextSettings as never,
          },
          update: {
            settings: nextSettings as never,
          },
        },
      },
    },
  });

  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

/**
 * Teklif kalemlerini + meta'yı (KDV, kur, tarih) kaydeder. Hem Kalemler hem
 * Analiz sayfasından çağrılır. Kod'u olan kalemleri firma kataloğuna upsert
 * eder (kod tekrar girildiğinde ad/birim/son fiyat otomatik gelsin).
 *
 * @param reachStep kaydettikten sonra ulaşılacak minimum quoteStep (2=kalemler, 3=analiz)
 */
export async function saveQuote(
  projectId: string,
  rawItems: unknown,
  rawMeta: unknown,
  reachStep = 2,
) {
  const { user } = await assertQuoteEditable(projectId);
  const items = parseQuoteItems(rawItems);
  const meta = parseQuoteMeta(rawMeta);

  const detail = await prisma.projectDetail.findUnique({
    where: { projectId },
    select: { settings: true, quoteItems: true, quoteRevisions: true },
  });
  const settings = (detail?.settings as Record<string, unknown> | null) ?? {};
  const nextStep = Math.max(Number(settings.quoteStep) || 0, reachStep);

  // Düzenleme her zaman SON revizyona yazılır; quoteItems+settings = son revizyon aynası.
  const revisions = parseQuoteRevisions(
    detail?.quoteRevisions,
    parseQuoteItems(detail?.quoteItems),
    parseQuoteMeta(detail?.settings),
  );
  revisions[revisions.length - 1] = { ...revisions[revisions.length - 1], items, meta };

  const nextSettings = metaToSettings(settings, meta, nextStep);

  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      quoteItems: items as never,
      quoteRevisions: revisions as never,
      settings: nextSettings as never,
    },
    update: {
      quoteItems: items as never,
      quoteRevisions: revisions as never,
      settings: nextSettings as never,
    },
  });

  // Katalog upsert — kodu olan kalemler firma geneli kataloğa yazılır.
  await upsertCatalog(user.organizationId, items);

  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

/**
 * Mevcut son revizyonun kopyasını yeni bir revizyon olarak ekler. Yeni revizyon
 * aktif (düzenlenebilir) olur; quoteItems+settings ona aynalanır. Kullanıcı
 * Kalemler/Analiz'de bu yeni revizyonu serbestçe düzenler (kalem ekle/çıkar).
 */
export async function createRevision(projectId: string): Promise<{ id: string }> {
  const isoNow = new Date().toISOString();
  await assertQuoteEditable(projectId);

  const detail = await prisma.projectDetail.findUnique({
    where: { projectId },
    select: { settings: true, quoteItems: true, quoteRevisions: true },
  });
  const settings = (detail?.settings as Record<string, unknown> | null) ?? {};
  const revisions = parseQuoteRevisions(
    detail?.quoteRevisions,
    parseQuoteItems(detail?.quoteItems),
    parseQuoteMeta(detail?.settings),
  );
  const last = revisions[revisions.length - 1];
  const newId = randomBytes(8).toString("base64url");
  // Yeni revize, son revizenin birebir kopyası: kalemler, fiyatlar, KDV, kur,
  // ÖDEME ŞEKLİ ve TEKLİF NOTLARI da aynen gelir (kullanıcı sonra değiştirebilir).
  const newRev = {
    id: newId,
    label: `Revize ${revisions.length}`,
    createdAt: isoNow,
    items: last.items.map((it) => ({ ...it })),
    meta: {
      ...last.meta,
      notes: last.meta.notes,
      paymentTerms: (last.meta.paymentTerms ?? []).map((p) => ({ ...p })),
    },
  };
  revisions.push(newRev);

  const nextStep = Math.max(Number(settings.quoteStep) || 0, 2);
  const nextSettings = metaToSettings(settings, newRev.meta, nextStep);

  await prisma.projectDetail.update({
    where: { projectId },
    data: {
      quoteItems: newRev.items as never,
      quoteRevisions: revisions as never,
      settings: nextSettings as never,
    },
  });

  revalidatePath(`/projects/${projectId}/detail`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { id: newId };
}

// Teklifte kullanılan kodları kataloğa (fiyatsız) garanti et — inline "yeni
// kaydet" dışında elle eklenenler de kataloğa düşsün. Fiyat saklanmaz.
async function upsertCatalog(organizationId: string, items: QuoteItem[]) {
  const seen = new Set<string>();
  for (const it of items) {
    const code = it.code.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const data = { name: it.name.trim() || code, unit: it.unit || "adet", kind: it.kind };
    try {
      await prisma.materialCatalogItem.upsert({
        where: { organizationId_code: { organizationId, code } },
        create: { organizationId, code, ...data },
        update: data,
      });
    } catch {
      // tekil kalem upsert'i hata verirse teklif kaydını engelleme
    }
  }
}
