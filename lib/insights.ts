import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectVisible } from "@/lib/project-status";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";

/**
 * Yönetici KPI dashboard'u için aggregate query helper'ları. Hepsi
 * org-scope'lu (organizationId), sadece aktif projeler (isProjectVisible)
 * dahil edilir.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface KpiSnapshot {
  // Bu ay
  thisMonthCount: number;
  thisMonthMwp: number;
  // Y/Y (geçen yıl aynı ay)
  lastYearSameMonthCount: number;
  // 30 gün → win rate
  winRate30d: number | null; // null = veri yok
  // Tüm zamanlar
  totalMwp: number;
  totalWonCount: number;
  totalLostCount: number;
  // Pipeline (bekleyen) ve tamamlanan ciro — PricingSnapshot.finalSalePrice
  pendingRevenueUsd: number;
  completedRevenueUsd: number;
  // $/Wp ortalaması — fiyatı dolu projelerden
  avgPerKwUsd: number | null;
  projectsWithPriceCount: number;
}

export async function getKpiSnapshot(organizationId: string): Promise<KpiSnapshot> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endOfLastYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59);

  const allProjects = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
    },
    select: {
      id: true,
      name: true,
      status: true,
      pipelineStage: true,
      totalPowerKw: true,
      createdAt: true,
      projectDetail: { select: { settings: true } },
      pricingSnapshot: {
        select: { finalSalePrice: true },
      },
    },
  });

  const visible = allProjects.filter(isProjectVisible);

  const thisMonth = visible.filter((p) => p.createdAt >= startOfMonth);
  const lastYearSameMonth = visible.filter(
    (p) => p.createdAt >= startOfLastYearSameMonth && p.createdAt <= endOfLastYearSameMonth,
  );

  // Win rate — son 30 günde "sonuçlanmış" (WON/LOST) projeler arasından
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);
  const closedRecent = visible.filter(
    (p) =>
      p.createdAt >= thirtyDaysAgo &&
      (p.pipelineStage === "WON" || p.pipelineStage === "LOST"),
  );
  const wonRecent = closedRecent.filter((p) => p.pipelineStage === "WON").length;
  const winRate30d =
    closedRecent.length === 0 ? null : Math.round((wonRecent / closedRecent.length) * 100);

  // Pipeline ciro (bekleyen): SENT, UNDER_REVIEW, REVISED
  const pendingStages = new Set(["SENT", "UNDER_REVIEW", "REVISED"]);
  const pendingRevenueUsd = visible
    .filter((p) => p.pipelineStage && pendingStages.has(p.pipelineStage))
    .reduce((sum, p) => sum + (p.pricingSnapshot?.finalSalePrice ?? 0), 0);

  // Tamamlanan ciro: WON
  const completedRevenueUsd = visible
    .filter((p) => p.pipelineStage === "WON")
    .reduce((sum, p) => sum + (p.pricingSnapshot?.finalSalePrice ?? 0), 0);

  // Ortalama $/Wp — fiyat bilgili projeler
  const withPrice = visible.filter(
    (p) => p.pricingSnapshot && p.pricingSnapshot.finalSalePrice > 0 && p.totalPowerKw > 0,
  );
  const avgPerKwUsd =
    withPrice.length === 0
      ? null
      : withPrice.reduce(
          (sum, p) => sum + p.pricingSnapshot!.finalSalePrice / p.totalPowerKw,
          0,
        ) / withPrice.length;

  return {
    thisMonthCount: thisMonth.length,
    thisMonthMwp: thisMonth.reduce((s, p) => s + p.totalPowerKw / 1000, 0),
    lastYearSameMonthCount: lastYearSameMonth.length,
    winRate30d,
    totalMwp: visible.reduce((s, p) => s + p.totalPowerKw / 1000, 0),
    totalWonCount: visible.filter((p) => p.pipelineStage === "WON").length,
    totalLostCount: visible.filter((p) => p.pipelineStage === "LOST").length,
    pendingRevenueUsd,
    completedRevenueUsd,
    avgPerKwUsd,
    projectsWithPriceCount: withPrice.length,
  };
}

export interface MonthlyTrendPoint {
  month: string; // "May" / "Haz" / vb.
  monthKey: string; // "2026-05" sıralama için
  count: number;
  mwp: number;
}

export async function getMonthlyTrend(
  organizationId: string,
  monthsBack: number = 12,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
      createdAt: { gte: start },
    },
    select: {
      createdAt: true,
      totalPowerKw: true,
      status: true,
      projectDetail: { select: { settings: true } },
    },
  });

  const visible = projects.filter(isProjectVisible);

  // Ay bazlı bucket
  const buckets = new Map<string, { count: number; mwp: number; date: Date }>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { count: 0, mwp: 0, date: d });
  }

  for (const p of visible) {
    const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (b) {
      b.count += 1;
      b.mwp += p.totalPowerKw / 1000;
    }
  }

  const tr = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return Array.from(buckets.entries()).map(([key, b]) => ({
    month: tr[b.date.getMonth()],
    monthKey: key,
    count: b.count,
    mwp: Math.round(b.mwp * 100) / 100,
  }));
}

export interface SalespersonStat {
  id: string;
  name: string;
  email: string;
  count: number;
  wonCount: number;
  wonRate: number | null;
  totalMwp: number;
}

export async function getTopSalespeople(
  organizationId: string,
  limit: number = 3,
): Promise<SalespersonStat[]> {
  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
    },
    select: {
      createdById: true,
      pipelineStage: true,
      status: true,
      totalPowerKw: true,
      projectDetail: { select: { settings: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  const visible = projects.filter(isProjectVisible);

  const grouped = new Map<
    string,
    SalespersonStat & { _wonOrLost: number }
  >();

  for (const p of visible) {
    const id = p.createdBy.id;
    const existing = grouped.get(id) ?? {
      id,
      name: p.createdBy.fullName ?? p.createdBy.email ?? "—",
      email: p.createdBy.email ?? "",
      count: 0,
      wonCount: 0,
      wonRate: null,
      totalMwp: 0,
      _wonOrLost: 0,
    };
    existing.count += 1;
    existing.totalMwp += p.totalPowerKw / 1000;
    if (p.pipelineStage === "WON") {
      existing.wonCount += 1;
      existing._wonOrLost += 1;
    } else if (p.pipelineStage === "LOST") {
      existing._wonOrLost += 1;
    }
    grouped.set(id, existing);
  }

  const stats = Array.from(grouped.values()).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    count: s.count,
    wonCount: s.wonCount,
    wonRate: s._wonOrLost === 0 ? null : Math.round((s.wonCount / s._wonOrLost) * 100),
    totalMwp: Math.round(s.totalMwp * 10) / 10,
  }));

  // Sıralama: önce wonCount (yüksek), sonra count (yüksek)
  stats.sort((a, b) => {
    if (b.wonCount !== a.wonCount) return b.wonCount - a.wonCount;
    return b.count - a.count;
  });

  return stats.slice(0, limit);
}

export interface StatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  IN_PROGRESS: "#d97706",
  COMPLETED: "#059669",
  SENT: "#2563eb",
  CLOSE_WIN: "#16a34a",
  CLOSE_LOST: "#dc2626",
  CANCELLED: "#64748b",
};

export async function getStatusBreakdown(organizationId: string): Promise<StatusBreakdownItem[]> {
  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
    },
    select: {
      status: true,
      projectDetail: { select: { settings: true } },
    },
  });
  const visible = projects.filter(isProjectVisible);

  const counts = new Map<string, number>();
  for (const p of visible) {
    counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([status, count]) => ({
      status,
      label: PROJECT_STATUS_LABELS[status] ?? status,
      count,
      color: STATUS_COLORS[status] ?? "#64748b",
    }))
    .sort((a, b) => b.count - a.count);
}

export interface RiskFlag {
  kind: "stale_offer" | "unviewed_share" | "abandoned_draft";
  count: number;
  examples: { id: string; name: string; days: number }[];
}

export async function getRiskFlags(organizationId: string): Promise<RiskFlag[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_PER_DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);

  // 1) 90+ gün önce SENT/UNDER_REVIEW kalmış teklifler (kaybedildi mi?)
  const staleOffers = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
      pipelineStage: { in: ["SENT", "UNDER_REVIEW", "REVISED"] },
      updatedAt: { lt: ninetyDaysAgo },
    },
    select: { id: true, name: true, updatedAt: true },
    take: 3,
  });

  // 2) Aktif paylaşım linki var ama 7+ gündür açılmamış
  const unviewedShares = await prisma.shareLink.findMany({
    where: {
      organizationId,
      revokedAt: null,
      OR: [{ lastViewedAt: { lt: sevenDaysAgo } }, { lastViewedAt: null }],
      createdAt: { lt: sevenDaysAgo },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: {
      id: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
    take: 3,
  });

  // 3) 30+ gün dokunulmamış DRAFT projeler
  const abandonedDrafts = await prisma.project.findMany({
    where: {
      organizationId,
      isTemplate: false,
      name: { not: "" },
      status: "DRAFT",
      updatedAt: { lt: thirtyDaysAgo },
    },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      projectDetail: { select: { settings: true } },
    },
    take: 3,
  });

  const visibleDrafts = abandonedDrafts.filter(isProjectVisible);

  const out: RiskFlag[] = [
    {
      kind: "stale_offer",
      count: staleOffers.length,
      examples: staleOffers.map((p) => ({
        id: p.id,
        name: p.name,
        days: Math.floor((now.getTime() - p.updatedAt.getTime()) / MS_PER_DAY),
      })),
    },
    {
      kind: "unviewed_share",
      count: unviewedShares.length,
      examples: unviewedShares.map((s) => ({
        id: s.project.id,
        name: s.project.name,
        days: Math.floor((now.getTime() - s.createdAt.getTime()) / MS_PER_DAY),
      })),
    },
    {
      kind: "abandoned_draft",
      count: visibleDrafts.length,
      examples: visibleDrafts.map((p) => ({
        id: p.id,
        name: p.name,
        days: Math.floor((now.getTime() - p.updatedAt.getTime()) / MS_PER_DAY),
      })),
    },
  ];
  return out.filter((r) => r.count > 0);
}
