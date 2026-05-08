import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Organization } from "@prisma/client";
import { redirect } from "next/navigation";

const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

export type ProfileWithOrg = Profile & { organization: Organization };

// Karardestek pattern: kimlik public.profiles + public.organizations'tan
// gelir; bu projedeki tablolar (Project, Subscription) profile.organizationId
// uzerinden filtrelenir. profiles ve organizations Karardestek tarafindan
// trigger ile signup'ta otomatik yaratilir.
//
// Profile yoksa default org acan onboarding fallback'i: kullanici Karardestek
// trigger'i calismadan dogrudan bu siteye gelmisse (eski kullanicilar veya
// trigger devre disi) burada yedek olarak yaratiliyor.
async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: unknown; full_name?: unknown } | null;
}): Promise<ProfileWithOrg> {
  const existing = await prisma.profile.findUnique({
    where: { id: authUser.id },
    include: { organization: true },
  });
  if (existing) return existing;

  const email = (authUser.email ?? "").trim();
  const meta = authUser.user_metadata ?? {};
  const metaName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : "";
  const fullName = metaName || email.split("@")[0] || "Kullanıcı";

  return prisma.$transaction(async (tx) => {
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
}

// Aktif organizasyonu doner. Profile.organizationId = "active" olarak kullanilir;
// kullanici panel switcher ile bu degeri degistirir, RLS otomatik filtreler.
export async function getCurrentUser(): Promise<ProfileWithOrg | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

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
  if (!allowed.includes(user.role as Role)) redirect("/dashboard");
  return user;
}

// Kullanicinin uye oldugu tum organizasyonlar (panel switcher icin).
export async function getUserOrganizations(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });
}

// Aktif organizasyonu degistirme — profile.organizationId + profile.role
// guncellenir, RLS uyumlu kalir.
export async function switchActiveOrganization(userId: string, newOrgId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: newOrgId } },
  });
  if (!membership) throw new Error("Bu organizasyona uyeligin yok");

  return prisma.profile.update({
    where: { id: userId },
    data: { organizationId: newOrgId, role: membership.role },
  });
}

export const PLATFORM_OWNER = PLATFORM_OWNER_EMAIL;
