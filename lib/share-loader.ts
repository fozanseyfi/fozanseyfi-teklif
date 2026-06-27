import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseBrandSettings, type BrandSettings } from "@/lib/pdf-brand";
import { normalizeTabId, isDocTabId, extractDocId } from "@/lib/share-tabs";
import { recordActivity } from "@/lib/project-activity";
import type { Project } from "@prisma/client";
import type { CustomerResponseKind } from "@/lib/email";

export interface ShareContext {
  link: {
    id: string;
    token: string;
    customerLabel: string | null;
    includedTabs: string[];
    // Admin'in paylaşıma eklediği ek belge id'leri. brand.customDocuments
    // ile eşlenerek public "Belgeler" sekmesinde gösterilir. Silinmiş
    // belgeler de buradan filtrelenir (kaybolur — paylaşımda da yok).
    includedDocIds: string[];
    expiresAt: Date | null;
    viewCount: number;
  };
  project: Project;
  detail: {
    kesifA: unknown;
    kesifB: unknown;
    settings: unknown;
    timeline: unknown;
    dor: unknown;
  };
  firmName: string;
  brand: BrandSettings;
  // Müşterinin daha önce kabul / revizyon yanıtı verdiyse buradan okunur,
  // yanıt bar'ı kilitli "zaten yanıtlandı" görünümüne döner.
  // Soru sorma sayılmaz (müşteri ek soru sorabilir).
  alreadyResponded: { kind: CustomerResponseKind; at: string } | null;
}

/**
 * Token validate eder + share context'i döner. Cache'lenmiş — aynı request
 * içinde layout + page birden çağırırsa DB'ye sadece bir kez gider.
 *
 * Geçersiz/expired/revoked token → null döner; çağıran notFound() çağırır.
 */
export const loadShareContext = cache(async (token: string): Promise<ShareContext | null> => {
  if (!token || typeof token !== "string") return null;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      project: true,
      organization: { select: { name: true, brandSettings: true } },
    },
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;

  const detail = await prisma.projectDetail.findUnique({
    where: { projectId: link.projectId },
  });

  // includedTabs Json — string[] olarak güvenle parse et + eski id'leri yeni
  // id'lere migrate et (boq → boq-unpriced, priced-boq → priced-boq-detailed).
  // "doc:xxx" entry'leri ayrı tutulur — sabit tab değiller, "Belgeler" tab'ı
  // için meta-data olarak çalışırlar.
  const rawTabs = Array.isArray(link.includedTabs)
    ? (link.includedTabs as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const docTabEntries = rawTabs.filter(isDocTabId);
  const sabitTabs = rawTabs.filter((t) => !isDocTabId(t));

  // Brand'deki güncel belge id'leriyle eşle — silinmiş belgeler otomatik
  // düşer ("kaybolur" semantiği).
  const brand = parseBrandSettings(link.organization.brandSettings);
  const validDocIds = new Set((brand.customDocuments ?? []).map((d) => d.id));
  const includedDocIds = Array.from(
    new Set(
      docTabEntries
        .map((t) => extractDocId(t))
        .filter((d): d is string => d !== null && validDocIds.has(d)),
    ),
  );

  const normalizedTabs = Array.from(
    new Set(
      sabitTabs
        .map((t) => normalizeTabId(t))
        .filter((t): t is NonNullable<typeof t> => t !== null),
    ),
  );

  // Eğer en az 1 geçerli ek belge varsa "belgeler" tab'ını otomatik dahil et.
  // (Admin form'da hem "belgeler" sentinel hem doc:xxx ekleyebilir, ya da
  // sadece doc:xxx — her durumda tab nav'da görünür.)
  let tabs: typeof normalizedTabs;
  if (includedDocIds.length > 0 && !normalizedTabs.includes("belgeler")) {
    tabs = [...normalizedTabs, "belgeler"];
  } else if (includedDocIds.length === 0 && normalizedTabs.includes("belgeler")) {
    // belgeler sentinel var ama hiç geçerli doc yok → tab'ı çıkar.
    tabs = normalizedTabs.filter((t) => t !== "belgeler");
  } else {
    tabs = normalizedTabs;
  }

  // Bu paylaşım üzerinden gelmiş kabul/revizyon var mı? Soru sorma sayılmaz.
  const lastDecision = await prisma.projectActivity.findFirst({
    where: {
      shareLinkId: link.id,
      type: { in: ["CUSTOMER_ACCEPTED", "CUSTOMER_REVISION"] },
    },
    orderBy: { createdAt: "desc" },
    select: { type: true, createdAt: true },
  });
  const alreadyResponded = lastDecision
    ? {
        kind:
          lastDecision.type === "CUSTOMER_ACCEPTED"
            ? ("accept" as CustomerResponseKind)
            : ("revision" as CustomerResponseKind),
        at: lastDecision.createdAt.toISOString(),
      }
    : null;

  return {
    link: {
      id: link.id,
      token: link.token,
      customerLabel: link.customerLabel,
      includedTabs: tabs,
      includedDocIds,
      expiresAt: link.expiresAt,
      viewCount: link.viewCount,
    },
    project: link.project,
    detail: {
      kesifA: detail?.kesifA ?? [],
      kesifB: detail?.kesifB ?? [],
      settings: detail?.settings ?? {},
      timeline: detail?.timeline ?? {},
      dor: detail?.dor ?? [],
    },
    firmName: link.organization.name,
    brand,
    alreadyResponded,
  };
});

/**
 * Görüntülenme sayısını artırır. Layout'tan tek sefer çağrılır (cache yok —
 * her sayfa yüklenmesinde counter artar). Hata yutsun ki public sayfa
 * görünmesin diye logu fail edip dönmesin.
 *
 * İlk view'da (viewCount=0 iken) ek olarak CUSTOMER_VIEWED activity yazılır.
 */
export async function recordShareView(linkId: string): Promise<void> {
  try {
    // Mevcut state'i oku (ilk view mu yoksa tekrar view mu?)
    const before = await prisma.shareLink.findUnique({
      where: { id: linkId },
      select: {
        viewCount: true,
        projectId: true,
        project: { select: { organizationId: true } },
      },
    });
    if (!before) return;

    // Counter increment
    await prisma.shareLink.update({
      where: { id: linkId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    // İlk view ise CUSTOMER_VIEWED activity'si yaz. (Pipeline aşaması müşteri
    // görüntülemesiyle otomatik ilerlemez — aşama değişimi yöneticinin manuel
    // kararı.)
    if (before.viewCount === 0) {
      await recordActivity({
        projectId: before.projectId,
        organizationId: before.project.organizationId,
        type: "CUSTOMER_VIEWED",
        shareLinkId: linkId,
      });
    }
  } catch (err) {
    console.warn("[share-loader] view increment failed:", err);
  }
}
