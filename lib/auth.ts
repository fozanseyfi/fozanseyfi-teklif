import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PlanType, SubStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

// Paylasilan auth.users uzerinden ilk defa bu siteye giris yapan kullanici
// icin Profile (solar.User) + default Firm + Subscription olusturur.
// Idempotent: mevcut Profile varsa hicbir sey yapmaz, ayni satiri doner.
// 4 site arasinda click-through SSO icin kritik — Karardestek'ten gelen
// kullanici otomatik olarak buraya da onboarding yapilmis sayilir.
type AuthLike = {
  id: string;
  email?: string | null;
  user_metadata?: { name?: unknown } | null;
};

async function ensureProfile(authUser: AuthLike) {
  // Once mevcut auth.users.id ile bagli Profile var mi?
  const byId = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { firm: true },
  });
  if (byId) return byId;

  const email = (authUser.email ?? "").trim();

  // ID ile bulunmadi ama ayni email'le bir Profile varsa: muhtemelen Supabase
  // signUp obfuscation veya Karardestek'ten gelen kullanici icin daha onceki
  // baska bir id ile yaratilmis. ID'yi gercek auth.users.id ile senkron et —
  // Project FK'lari yoksa basit update, varsa cascade gerek (simdilik User
  // henuz proje olusturmamissa cascade'siz update calisir).
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { firm: true },
    });
    if (byEmail) {
      try {
        const synced = await prisma.user.update({
          where: { id: byEmail.id },
          data: { id: authUser.id },
          include: { firm: true },
        });
        return synced;
      } catch (e) {
        // Cascade yoksa update fail edebilir — fallback: eski satiri sil, yeni id ile yarat (firmId ayni).
        console.warn("User.id sync failed, falling back to delete+create", e);
        await prisma.user.delete({ where: { id: byEmail.id } });
        return prisma.user.create({
          data: {
            id: authUser.id,
            name: byEmail.name,
            email: byEmail.email,
            role: byEmail.role,
            firmId: byEmail.firmId,
            isActive: byEmail.isActive,
          },
          include: { firm: true },
        });
      }
    }
  }

  const metaName = typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name : "";
  const name = metaName || email.split("@")[0] || "Kullanıcı";
  const isPlatformOwner = email.toLowerCase() === PLATFORM_OWNER_EMAIL;

  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return prisma.$transaction(async (tx) => {
    const firm = await tx.firm.create({ data: { name } });
    const user = await tx.user.create({
      data: {
        id: authUser.id,
        name,
        email,
        role: UserRole.FIRM_ADMIN,
        firmId: firm.id,
      },
      include: { firm: true },
    });
    await tx.subscription.create({
      data: {
        firmId: firm.id,
        plan: isPlatformOwner ? PlanType.ENTERPRISE : PlanType.FREE,
        status: SubStatus.ACTIVE,
        monthlyProposalLimit: isPlatformOwner ? 99999 : 3,
        periodStart: now,
        periodEnd,
      },
    });
    return user;
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await ensureProfile(authUser);
  if (!user.isActive) return null;
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
