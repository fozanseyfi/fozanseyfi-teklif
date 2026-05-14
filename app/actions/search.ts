"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getHiddenResourceIds } from "@/lib/permission-server";
import { isProjectVisible } from "@/lib/project-status";

export type SearchKind = "project" | "customer";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global Ctrl+K arama — proje adı + müşteri adı + proje lokasyonu.
 * Sadece aktif görünen projeler (isTemplate=false + isProjectVisible).
 * Gizli kaynaklar admin değilse filtrelenir.
 *
 * Şu an basit ILIKE (Postgres LIKE case-insensitive). 1000+ proje
 * varsa tsvector + GIN index'e yükseltmek gerekir.
 */
export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const user = await requireAuth();
  const q = rawQuery.trim();
  if (!q) return [];

  // Admin değilse gizli proje/müşteri ID'lerini al — filter dışı tut.
  const [hiddenProjectIds, hiddenCustomerNames] = await Promise.all([
    isAdmin(user) ? [] : getHiddenResourceIds(user.id, user.organizationId, "project"),
    isAdmin(user) ? [] : getHiddenResourceIds(user.id, user.organizationId, "customer"),
  ]);

  // ILIKE pattern — SQL injection güvenli (Prisma parametre eklemesi)
  const pattern = `%${q}%`;

  const [projectsRaw, customers] = await Promise.all([
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
        projectDetail: { select: { settings: true } },
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
  ]);

  // isProjectVisible filter — yarım kalmış projeler dışarıda
  const projects = projectsRaw.filter(isProjectVisible);

  const results: SearchResult[] = [];

  for (const p of projects) {
    const subtitleParts: string[] = [];
    if (p.customerName) subtitleParts.push(p.customerName);
    if (p.totalPowerKw > 0) {
      subtitleParts.push(
        p.totalPowerKw >= 1000
          ? `${(p.totalPowerKw / 1000).toFixed(1)} MWp`
          : `${p.totalPowerKw.toFixed(0)} kWp`,
      );
    }
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
    // Müşteri "card"ı yerine doğrudan müşteri detay sayfasına git (slug = url-safe ad)
    const slug = encodeURIComponent(c.customerName);
    results.push({
      kind: "customer",
      id: c.customerName,
      title: c.customerName,
      subtitle: "Müşteri",
      href: `/customers/${slug}`,
    });
  }

  return results.slice(0, 18);
}
