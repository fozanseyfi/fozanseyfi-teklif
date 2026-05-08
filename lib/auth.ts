import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Organization } from "@prisma/client";
import { redirect } from "next/navigation";

const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

export type ProfileWithOrg = Profile & {
  organization: Organization;
  // platformRole: aktif org icindeki kullanici rolu (organization_members'tan).
  // profile.role ile genelde aynidir; switch sirasinda guncellenir.
  platformRole: "admin" | "user" | "viewer";
};

// Yeni signup'da Supabase auth.users trigger'i (handle_new_user) profile +
// organization + organization_members yaratir. Burada fallback olarak yine
// olusturuyoruz (trigger calismadiysa veya pre-existing user icin).
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
      await tx.organizationMember.create({
        data: { userId: authUser.id, organizationId: org.id, role: "admin" },
      });
      return profile;
    });

    return { ...created, platformRole: "admin" as const };
  }

  // Profile var — aktif org icin uyelik var mi?
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: authUser.id,
        organizationId: existing.organizationId,
      },
    },
  });

  if (membership) {
    return { ...existing, platformRole: membership.role as "admin" | "user" | "viewer" };
  }

  // Aktif org icin uyelik yok — kullanicinin uye oldugu ilk org'a tasi.
  const fallback = await prisma.organizationMember.findFirst({
    where: { userId: authUser.id },
    orderBy: { joinedAt: "asc" },
    include: { organization: true },
  });

  if (fallback) {
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

  // Hicbir uyelik yok — kendi org'una admin uyelik ekle.
  await prisma.organizationMember.create({
    data: {
      userId: authUser.id,
      organizationId: existing.organizationId,
      role: "admin",
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
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });
}

// Aktif organizasyonu degistirme — sadece bu platformdaki uyelikler arasinda gecis yapilir.
export async function switchActiveOrganization(userId: string, newOrgId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: newOrgId,
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
