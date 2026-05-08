import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PLATFORM_KEY } from "@/lib/platform";
import type { Profile, Organization } from "@prisma/client";
import { redirect } from "next/navigation";

const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

export type ProfileWithOrg = Profile & {
  organization: Organization;
  // platformRole: bu platformda + active org icindeki rolu (organization_members'tan)
  // profile.role Karardestek'in tuttugu degeri yansitir (kendi platformu icin);
  // Solar Teklif kararlari hep platformRole'u kullanir.
  platformRole: "admin" | "user" | "viewer";
};

// Karardestek pattern: kimlik public.profiles + public.organizations'tan gelir;
// her platform organization_members.platform = '<platform-key>' filtresiyle
// kendi uyeliklerini ayri yonetir.
async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: unknown; full_name?: unknown } | null;
}): Promise<ProfileWithOrg | null> {
  const existing = await prisma.profile.findUnique({
    where: { id: authUser.id },
    include: { organization: true },
  });

  if (!existing) {
    // Profil hic yok — Karardestek trigger'i calismami olabilir, fallback olusturma.
    const email = (authUser.email ?? "").trim();
    const meta = authUser.user_metadata ?? {};
    const metaName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : "";
    const fullName = metaName || email.split("@")[0] || "Kullanıcı";

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: `${fullName} Paneli`, ownerId: authUser.id },
      });
      const profile = await tx.profile.create({
        data: {
          id: authUser.id,
          email,
          fullName,
          role: "admin",
          organizationId: org.id,
          onboardingCompleted: true,
        },
        include: { organization: true },
      });
      // Iki platforma da owner-admin uyelik (kendi org'una her yerde erisebilsin)
      await tx.organizationMember.createMany({
        data: [
          { userId: authUser.id, organizationId: org.id, role: "admin", platform: "karar-destek" },
          { userId: authUser.id, organizationId: org.id, role: "admin", platform: PLATFORM_KEY },
        ],
        skipDuplicates: true,
      });
      return profile;
    });

    return { ...created, platformRole: "admin" as const };
  }

  // Profile var — bu platforma uyeligi var mi? Aktif org icin.
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId_platform: {
        userId: authUser.id,
        organizationId: existing.organizationId,
        platform: PLATFORM_KEY,
      },
    },
  });

  if (membership) {
    return { ...existing, platformRole: membership.role as "admin" | "user" | "viewer" };
  }

  // Aktif org bu platformda yok — kullanicinin bu platformda uye oldugu ilk org'a yonlendir.
  const fallback = await prisma.organizationMember.findFirst({
    where: { userId: authUser.id, platform: PLATFORM_KEY },
    orderBy: { joinedAt: "asc" },
    include: { organization: true },
  });

  if (fallback) {
    // Profile.organizationId'yi aktif platformda gecerli bir org'a tasi.
    await prisma.profile.update({
      where: { id: authUser.id },
      data: { organizationId: fallback.organizationId },
    });
    return {
      ...existing,
      organizationId: fallback.organizationId,
      organization: fallback.organization,
      platformRole: fallback.role as "admin" | "user" | "viewer",
    };
  }

  // Bu kullanicinin bu platformda hic uyeligi yok — kendi org'una owner-admin uyelik ekle.
  await prisma.organizationMember.create({
    data: {
      userId: authUser.id,
      organizationId: existing.organizationId,
      role: "admin",
      platform: PLATFORM_KEY,
    },
  });
  return { ...existing, platformRole: "admin" as const };
}

export async function getCurrentUser(): Promise<ProfileWithOrg | null> {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  return await ensureProfile(authUser);
}

export async function requireAuth(): Promise<ProfileWithOrg> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type Role = "admin" | "user" | "viewer";

export async function requireRole(allowed: Role[]): Promise<ProfileWithOrg> {
  const user = await requireAuth();
  if (!allowed.includes(user.platformRole)) redirect("/dashboard");
  return user;
}

// Bu platformda kullanicinin uye oldugu tum organizasyonlar (panel switcher icin).
export async function getUserOrganizations(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId, platform: PLATFORM_KEY },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });
}

// Aktif organizasyonu degistirme — sadece bu platformdaki uyelikler arasinda gecis yapilir.
export async function switchActiveOrganization(userId: string, newOrgId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId_platform: {
        userId,
        organizationId: newOrgId,
        platform: PLATFORM_KEY,
      },
    },
  });
  if (!membership) throw new Error("Bu organizasyona uyeligin yok");

  return prisma.profile.update({
    where: { id: userId },
    data: { organizationId: newOrgId },
  });
}

export const PLATFORM_OWNER = PLATFORM_OWNER_EMAIL;
