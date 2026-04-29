import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { firm: true },
  });

  if (!user || !user.isActive) return null;
  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export const ROLE_PERMISSIONS = {
  canCreateProject: [UserRole.FIRM_ADMIN, UserRole.MANAGER, UserRole.MEMBER],
  canEditOwnProject: [UserRole.FIRM_ADMIN, UserRole.MANAGER, UserRole.MEMBER],
  canEditAllProjects: [UserRole.FIRM_ADMIN, UserRole.MANAGER],
  canGeneratePDF: [UserRole.FIRM_ADMIN, UserRole.MANAGER],
  canViewProjects: [UserRole.FIRM_ADMIN, UserRole.MANAGER, UserRole.MEMBER, UserRole.VIEWER],
  canManageUsers: [UserRole.FIRM_ADMIN],
  canManageFirm: [UserRole.FIRM_ADMIN],
  canManageSubscription: [UserRole.FIRM_ADMIN],
  isAdmin: [] as UserRole[],
} as const;

export function hasPermission(role: UserRole, permission: keyof typeof ROLE_PERMISSIONS): boolean {
  const allowed = ROLE_PERMISSIONS[permission] as readonly UserRole[];
  return allowed.includes(role);
}
