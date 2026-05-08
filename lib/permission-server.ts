import "server-only";
import { prisma } from "@/lib/prisma";
import type { ResourceType } from "@/lib/permissions";

// Bu user icin gizlenmis kaynak ID'lerini getirir — listeleme sorgularinda
// `WHERE id NOT IN (gizliler)` icin kullanilir.
export async function getHiddenResourceIds(
  userId: string,
  organizationId: string,
  resourceType: ResourceType,
): Promise<string[]> {
  const rows = await prisma.userHiddenResource.findMany({
    where: { userId, organizationId, resourceType },
    select: { resourceId: true },
  });
  return rows.map((r) => r.resourceId);
}

export async function isResourceHidden(
  userId: string,
  organizationId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<boolean> {
  const row = await prisma.userHiddenResource.findUnique({
    where: {
      userId_resourceType_resourceId: { userId, resourceType, resourceId },
    },
  });
  return row !== null && row.organizationId === organizationId;
}

export async function isResourceLocked(
  userId: string,
  organizationId: string,
  resourceType: ResourceType,
  resourceId: string,
): Promise<boolean> {
  const row = await prisma.userLockedResource.findUnique({
    where: {
      userId_resourceType_resourceId: { userId, resourceType, resourceId },
    },
  });
  return row !== null && row.organizationId === organizationId;
}
