"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { isProjectVisible } from "@/lib/project-status";
import { revalidatePath } from "next/cache";

export type ResourceType = "project" | "customer";
export type AccessLevel = "full" | "readonly" | "hidden";

export interface UserAccessProjectRow {
  id: string;
  name: string;
  customerName: string;
  status: string;
  updatedAt: string;
  access: AccessLevel;
}
export interface UserAccessTemplateRow {
  id: string;
  name: string;
  access: AccessLevel;
}
export interface UserAccessCustomerRow {
  id: string;
  name: string;
  projectCount: number;
  lastTouched: string;
  access: AccessLevel;
}
export interface UserAccessData {
  targetUserId: string;
  fullName: string;
  email: string;
  role: "admin" | "user" | "viewer";
  projects: UserAccessProjectRow[];
  templates: UserAccessTemplateRow[];
  customers: UserAccessCustomerRow[];
}

// Bir kullanicinin tum kaynak erisim seviyelerini ve panel uyeligini getirir.
// Modal acildiginda cagrilir.
export async function getUserAccessData(
  targetUserId: string,
): Promise<{ data: UserAccessData } | { error: string }> {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return { error: "Yetkin yok" };
  if (targetUserId === admin.id) return { error: "Kendi yetkilerini goremezsin" };

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: targetUserId, organizationId: admin.organizationId },
    },
    include: { user: true },
  });
  if (!membership) return { error: "Bu kullanici bu paneldeki bir uye degil" };

  const [projectsRaw, hidden, locked] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: admin.organizationId },
      orderBy: [{ isTemplate: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        customerName: true,
        isTemplate: true,
        templateLabel: true,
        status: true,
        updatedAt: true,
        // gesStep gating icin gerekli — yarim kalmis projeleri filtreler.
        projectDetail: { select: { settings: true } },
      },
    }),
    prisma.userHiddenResource.findMany({
      where: { userId: targetUserId, organizationId: admin.organizationId },
      select: { resourceType: true, resourceId: true },
    }),
    prisma.userLockedResource.findMany({
      where: { userId: targetUserId, organizationId: admin.organizationId },
      select: { resourceType: true, resourceId: true },
    }),
  ]);

  const hiddenSet = new Set(hidden.map((h) => `${h.resourceType}:${h.resourceId}`));
  const lockedSet = new Set(locked.map((l) => `${l.resourceType}:${l.resourceId}`));
  const accessOf = (rt: ResourceType, rid: string): AccessLevel =>
    hiddenSet.has(`${rt}:${rid}`)
      ? "hidden"
      : lockedSet.has(`${rt}:${rid}`)
        ? "readonly"
        : "full";

  // Yarim kalmis projeleri (gesStep < 2 olan, kullanici Proje + Teknik
  // sekmelerini Kaydet & İlerle ile gecmemis) bu listeden de cikar — bu
  // modal Dashboard ve Projeler sayfalarinda gozuken aksiyon-alinabilir
  // projeler icin tasarlandi. Sablonlar her zaman gosterilir (isProjectVisible
  // sablonlari ele almaz, biz isTemplate dali ile ayriyoruz).
  const projects = projectsRaw.filter((p) => p.isTemplate || isProjectVisible(p));

  const customerMap = new Map<string, { count: number; lastTouched: Date }>();
  for (const p of projects) {
    if (p.isTemplate) continue;
    const name = p.customerName?.trim();
    if (!name) continue;
    const cur = customerMap.get(name);
    if (!cur) customerMap.set(name, { count: 1, lastTouched: p.updatedAt });
    else {
      cur.count += 1;
      if (p.updatedAt > cur.lastTouched) cur.lastTouched = p.updatedAt;
    }
  }

  const projectsRows: UserAccessProjectRow[] = projects
    .filter((p) => !p.isTemplate)
    .map((p) => ({
      id: p.id,
      name: p.name || "(isimsiz)",
      customerName: p.customerName,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
      access: accessOf("project", p.id),
    }));

  const templatesRows: UserAccessTemplateRow[] = projects
    .filter((p) => p.isTemplate)
    .map((p) => ({
      id: p.id,
      name: p.templateLabel ?? p.name,
      access: accessOf("project", p.id),
    }));

  const customersRows: UserAccessCustomerRow[] = Array.from(customerMap.entries()).map(
    ([name, info]) => ({
      id: name,
      name,
      projectCount: info.count,
      lastTouched: info.lastTouched.toISOString(),
      access: accessOf("customer", name),
    }),
  );

  return {
    data: {
      targetUserId,
      fullName: membership.user.fullName ?? membership.user.email ?? "—",
      email: membership.user.email ?? "",
      role: membership.role as "admin" | "user" | "viewer",
      projects: projectsRows,
      templates: templatesRows,
      customers: customersRows,
    },
  };
}

const RESOURCE_TYPES: ResourceType[] = ["project", "customer"];

function isValidType(t: string): t is ResourceType {
  return (RESOURCE_TYPES as string[]).includes(t);
}

// Hedef kullanicinin AKTIF org icindeki uyeligini dogrular. Admin yalnizca
// kendi org'undaki uyelere yetki ayari yapabilir.
async function requireMembership(adminOrgId: string, targetUserId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: targetUserId, organizationId: adminOrgId },
    },
  });
  if (!membership) throw new Error("Bu kullanici bu paneldeki bir uye degil");
  return membership;
}

// Erisim seviyesini ayarlar — hidden/readonly/full. Tek action, tum gecisleri
// idempotent yapar (mevcut hidden/locked kayitlarini siler veya ekler).
export async function setResourceAccess(
  targetUserId: string,
  resourceType: string,
  resourceId: string,
  level: AccessLevel,
) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return { error: "Yetkin yok" };
  if (targetUserId === admin.id) return { error: "Kendi yetkilerini degistiremezsin" };
  if (!isValidType(resourceType)) return { error: "Gecersiz kaynak tipi" };
  if (!["full", "readonly", "hidden"].includes(level))
    return { error: "Gecersiz erisim seviyesi" };

  const target = await requireMembership(admin.organizationId, targetUserId);

  // Admin uyeyi kisitlayamaz — semantik olarak admin her zaman tam erisim.
  if (target.role === "admin" && level !== "full") {
    return { error: "Admin kullanicilarin erisimi kisitlanamaz" };
  }

  const orgId = admin.organizationId;

  await prisma.$transaction(async (tx) => {
    // Once mevcut iki kaydi temizle
    await tx.userHiddenResource.deleteMany({
      where: { userId: targetUserId, resourceType, resourceId },
    });
    await tx.userLockedResource.deleteMany({
      where: { userId: targetUserId, resourceType, resourceId },
    });

    if (level === "hidden") {
      await tx.userHiddenResource.create({
        data: {
          userId: targetUserId,
          resourceType,
          resourceId,
          organizationId: orgId,
          hiddenBy: admin.id,
        },
      });
    } else if (level === "readonly") {
      await tx.userLockedResource.create({
        data: {
          userId: targetUserId,
          resourceType,
          resourceId,
          organizationId: orgId,
          lockedBy: admin.id,
        },
      });
    }
    // 'full' ise her iki silme yeterli.
  });

  revalidatePath("/admin/users");
  return { success: true };
}

// Toplu uygulama — admin "tum projeleri gizle" gibi bir aksiyon icin.
export async function bulkSetResourceAccess(
  targetUserId: string,
  resourceType: string,
  resourceIds: string[],
  level: AccessLevel,
) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return { error: "Yetkin yok" };
  if (targetUserId === admin.id) return { error: "Kendi yetkilerini degistiremezsin" };
  if (!isValidType(resourceType)) return { error: "Gecersiz kaynak tipi" };
  if (!resourceIds.length) return { success: true };

  const target = await requireMembership(admin.organizationId, targetUserId);
  if (target.role === "admin" && level !== "full") {
    return { error: "Admin kullanicilarin erisimi kisitlanamaz" };
  }

  const orgId = admin.organizationId;

  await prisma.$transaction(async (tx) => {
    await tx.userHiddenResource.deleteMany({
      where: { userId: targetUserId, resourceType, resourceId: { in: resourceIds } },
    });
    await tx.userLockedResource.deleteMany({
      where: { userId: targetUserId, resourceType, resourceId: { in: resourceIds } },
    });

    if (level === "hidden") {
      await tx.userHiddenResource.createMany({
        data: resourceIds.map((rid) => ({
          userId: targetUserId,
          resourceType,
          resourceId: rid,
          organizationId: orgId,
          hiddenBy: admin.id,
        })),
        skipDuplicates: true,
      });
    } else if (level === "readonly") {
      await tx.userLockedResource.createMany({
        data: resourceIds.map((rid) => ({
          userId: targetUserId,
          resourceType,
          resourceId: rid,
          organizationId: orgId,
          lockedBy: admin.id,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/admin/users");
  return { success: true };
}
