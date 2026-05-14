"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { isProjectVisible } from "@/lib/project-status";
import { toUSD, calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings, KesifItem } from "@/lib/ges-defaults";

export type SearchKind = "project" | "customer" | "item";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global Ctrl+K arama. Üç tür sonuç döner:
 *   • project — proje adı / lokasyonu eşleşenler
 *   • customer — müşteri adı eşleşenler (proje türetmesi)
 *   • item — Keşif-A/B kalem eşleşmeleri (tanım/tip/marka/kod)
 *           → "Solar Panel 540W" yazınca farklı projelerdeki kalemleri
 *             ve USD birim fiyatını gösterir
 *
 * Sadece aktif görünen projeler (isTemplate=false + isProjectVisible).
 * Gizli kaynaklar admin değilse filtrelenir.
 *
 * Şu an basit ILIKE (Postgres LIKE case-insensitive). Item araması için
 * proje detaylarının JSON kolonu üzerinde text cast + ILIKE kullanılır —
 * 1000+ proje varsa tsvector + GIN index'e yükseltmek gerekir.
 */
export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const user = await requireAuth();
  const q = rawQuery.trim();
  if (!q) return [];
  if (q.length < 2) return []; // tek harf = çok geniş arama

  // Admin değilse gizli proje/müşteri ID'lerini al — filter dışı tut.
  const [hiddenProjectIds, hiddenCustomerNames] = await Promise.all([
    isAdmin(user) ? [] : getHiddenResourceIds(user.id, user.organizationId, "project"),
    isAdmin(user) ? [] : getHiddenResourceIds(user.id, user.organizationId, "customer"),
  ]);

  // ILIKE pattern — SQL injection güvenli (Prisma parametre eklemesi)
  const pattern = `%${q}%`;
  const qLower = q.toLowerCase();

  const [projectsRaw, customers, itemCandidates] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: user.organizationId,
        isTemplate: false,
        name: { not: "" },
        ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
        ...(hiddenCustomerNames.length
          ? { customerName: { notIn: hiddenCustomerNames } }
          : {}),
        OR: [
          { name: { contains: pattern.slice(1, -1), mode: "insensitive" } },
          { customerName: { contains: pattern.slice(1, -1), mode: "insensitive" } },
          { projectLocation: { contains: pattern.slice(1, -1), mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        customerName: true,
        status: true,
        totalPowerKw: true,
        projectLocation: true,
        projectDetail: {
          select: { settings: true, kesifA: true, kesifB: true },
        },
      },
    }),
    // Aktif projelerden türetilen müşteri seti (Customer tablosu yok)
    prisma.project.findMany({
      where: {
        organizationId: user.organizationId,
        isTemplate: false,
        customerName: { contains: pattern.slice(1, -1), mode: "insensitive", not: "" },
        ...(hiddenCustomerNames.length
          ? { customerName: { notIn: hiddenCustomerNames } }
          : {}),
      },
      select: { customerName: true },
      distinct: ["customerName"],
      take: 6,
    }),
    // Kalem araması için projelerin Keşif JSON'larını cast ederek ILIKE.
    // Tablolar solar schema'sında, organizationId snake_case (organization_id)
    // map'li — diğer kolonlar (isTemplate, updatedAt, projectId, kesifA/B)
    // camelCase olduğu gibi DB'de duruyor.
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM solar."Project" p
      LEFT JOIN solar."ProjectDetail" d ON d."projectId" = p.id
      WHERE p."organization_id" = ${user.organizationId}::uuid
        AND p."isTemplate" = false
        AND p.name <> ''
        AND (
          d."kesifA"::text ILIKE ${pattern}
          OR d."kesifB"::text ILIKE ${pattern}
        )
      ORDER BY p."updatedAt" DESC
      LIMIT 20
    `,
  ]);

  // isProjectVisible filter — yarım kalmış projeler dışarıda
  const projects = projectsRaw.filter(isProjectVisible);

  const results: SearchResult[] = [];

  for (const p of projects) {
    const subtitleParts: string[] = [];
    if (p.customerName) subtitleParts.push(p.customerName);

    // Güç ve fiyat — settings/kesif varsa calc() ile USD satış + $/kWp
    let mwpLabel = "";
    let mweLabel = "";
    let salePriceLabel = "";
    let perKwLabel = "";

    if (p.projectDetail) {
      const settings = (p.projectDetail.settings as unknown as GesSettings) ?? null;
      const kesifA = (p.projectDetail.kesifA as unknown as KesifGroup[]) ?? [];
      const kesifB = (p.projectDetail.kesifB as unknown as KesifGroup[]) ?? [];

      if (settings) {
        if (settings.dcGuc > 0) {
          mwpLabel = settings.dcGuc >= 1
            ? `${settings.dcGuc.toFixed(2)} MWp`
            : `${(settings.dcGuc * 1000).toFixed(0)} kWp`;
        }
        if (settings.acGuc > 0) {
          mweLabel = settings.acGuc >= 1
            ? `${settings.acGuc.toFixed(2)} MWe`
            : `${(settings.acGuc * 1000).toFixed(0)} kWe`;
        }

        try {
          const r = calc(kesifA, kesifB, settings);
          if (r.salePriceUsd > 0) {
            salePriceLabel = r.salePriceUsd >= 1_000_000
              ? `$${(r.salePriceUsd / 1_000_000).toFixed(2)}M`
              : r.salePriceUsd >= 1_000
                ? `$${(r.salePriceUsd / 1_000).toFixed(0)}K`
                : `$${Math.round(r.salePriceUsd)}`;
            if (r.perKwUsd > 0) {
              perKwLabel = `$${r.perKwUsd.toFixed(0)}/kWp`;
            }
          }
        } catch {
          // calc() bir nedenle başarısız olursa fiyat gizli kalır
        }
      }
    }

    // Fallback: settings yoksa eski totalPowerKw göster
    if (!mwpLabel && p.totalPowerKw > 0) {
      mwpLabel = p.totalPowerKw >= 1000
        ? `${(p.totalPowerKw / 1000).toFixed(2)} MWp`
        : `${p.totalPowerKw.toFixed(0)} kWp`;
    }

    const powerLabel = [mwpLabel, mweLabel].filter(Boolean).join(" / ");
    if (powerLabel) subtitleParts.push(powerLabel);
    if (salePriceLabel) subtitleParts.push(salePriceLabel);
    if (perKwLabel) subtitleParts.push(perKwLabel);
    if (p.projectLocation) subtitleParts.push(p.projectLocation);

    results.push({
      kind: "project",
      id: p.id,
      title: p.name,
      subtitle: subtitleParts.join(" · ") || "—",
      href: `/projects/${p.id}/detail`,
    });
  }

  // Müşterileri ekle — projeler tarafından zaten gösterilmemiş olanlar
  const seenCustomers = new Set<string>();
  for (const c of customers) {
    if (!c.customerName || seenCustomers.has(c.customerName)) continue;
    seenCustomers.add(c.customerName);
    const slug = encodeURIComponent(c.customerName);
    results.push({
      kind: "customer",
      id: c.customerName,
      title: c.customerName,
      subtitle: "Müşteri",
      href: `/customers/${slug}`,
    });
  }

  // Kalem eşleşmelerini ekle — proje detaylarını yükle, JSON'u parse et,
  // tanim/tip/marka/code içinde arama yap, USD'ye çevir.
  const itemCandidateIds = itemCandidates.map((r) => r.id);
  if (itemCandidateIds.length > 0) {
    const candidateProjects = await prisma.project.findMany({
      where: {
        id: { in: itemCandidateIds },
        ...(hiddenProjectIds.length ? { id: { notIn: hiddenProjectIds } } : {}),
        ...(hiddenCustomerNames.length
          ? { customerName: { notIn: hiddenCustomerNames } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        customerName: true,
        projectDetail: {
          select: { kesifA: true, kesifB: true, settings: true },
        },
      },
    });

    const itemResults: SearchResult[] = [];
    for (const p of candidateProjects.filter(isProjectVisible)) {
      if (!p.projectDetail) continue;
      const kesifA = (p.projectDetail.kesifA as unknown as KesifGroup[]) ?? [];
      const kesifB = (p.projectDetail.kesifB as unknown as KesifGroup[]) ?? [];
      const settings = (p.projectDetail.settings as unknown as GesSettings) ?? null;

      for (const [groups, type] of [[kesifA, "A"], [kesifB, "B"]] as const) {
        for (const g of groups) {
          for (const it of g.items) {
            if (!matchesItem(it, qLower)) continue;
            // USD'ye çevir — settings yoksa raw değer
            const usdUnit = settings
              ? toUSD(it.rawFiyat, it.fiyatCur, settings)
              : it.rawFiyat;
            const totalUsd = usdUnit * it.miktar;
            const titleParts = [it.tanim];
            if (it.marka) titleParts.push(it.marka);
            const subtitleParts: string[] = [];
            subtitleParts.push(p.name);
            if (it.miktar > 0) {
              subtitleParts.push(
                `${it.miktar.toLocaleString("tr-TR", { maximumFractionDigits: it.miktar < 100 ? 2 : 0 })} ${it.birim}`,
              );
            }
            subtitleParts.push(
              `$${usdUnit.toLocaleString("en-US", { maximumFractionDigits: 3 })}/${it.birim}`,
            );
            if (totalUsd > 0) {
              subtitleParts.push(`Σ $${totalUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
            }
            itemResults.push({
              kind: "item",
              id: `${p.id}-${it.code}`,
              title: titleParts.join(" · "),
              subtitle: subtitleParts.join(" · "),
              href: `/projects/${p.id}/detail/${type === "A" ? "kesif-a" : "kesif-b"}`,
            });
            // Aynı projede aynı kalem birden çok grupta tekrarlanabilir,
            // ama farklı kodlu — yine de cap koy
            if (itemResults.length >= 30) break;
          }
          if (itemResults.length >= 30) break;
        }
        if (itemResults.length >= 30) break;
      }
      if (itemResults.length >= 30) break;
    }

    // En fazla 8 kalem sonucu göster — proje listesinin önüne geçmesin
    results.push(...itemResults.slice(0, 8));
  }

  return results.slice(0, 24);
}

function matchesItem(item: KesifItem, qLower: string): boolean {
  const fields = [item.tanim, item.tip, item.marka, item.code];
  for (const f of fields) {
    if (f && f.toLowerCase().includes(qLower)) return true;
  }
  return false;
}
