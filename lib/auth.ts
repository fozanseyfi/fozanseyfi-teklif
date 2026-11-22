import "server-only";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Profile, Organization } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";

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
  // Profil ve tum uyelikler tek seferde, paralel — ardisik sorgu = ekstra DB gidis-donusu.
  const [existing, memberships] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: authUser.id },
      include: { organization: true },
    }),
    fetchMemberships(authUser.id),
  ]);

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

  // Profile var — aktif org icin uyelik var mi? (Uyelikler profille paralel cekildi.)
  const membership = memberships.find((m) => m.organizationId === existing.organizationId);

  if (membership) {
    return { ...existing, platformRole: membership.role as "admin" | "user" | "viewer" };
  }

  // Aktif org icin uyelik yok — kullanicinin uye oldugu ilk org'a tasi.
  const fallback = memberships[0];

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

// Uyelikler (panel switcher + aktif rol icin). Istek basina tek sorgu: ensureProfile ve
// layout'taki getUserOrganizations ayni cache'i paylasir.
const fetchMemberships = cache((userId: string) =>
  prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  }),
);

// React cache(): ayni istekteki layout(lar) + sayfa ayni sonucu paylasir — Supabase
// getUser + profil sorgusu istek basina 1 kez calisir (onceden her katmanda tekrar ediyordu).
// Server action'larda cache devrede degildir, her cagri taze okur.
export const getCurrentUser = cache(async (): Promise<ProfileWithOrg | null> => {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  return await ensureProfile(authUser);
});

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
// ensureProfile ile ayni istek-ici cache'i kullanir (ek sorgu yok). Liste bossa ensureProfile
// bu istekte uyelik yaratmis olabilir (ilk giris) — o durumda taze oku.
export async function getUserOrganizations(userId: string) {
  const cached = await fetchMemberships(userId);
  if (cached.length > 0) return cached;
  return prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });
}

/**
 * Davet ile signup yapan bir kullanici, kendi paneli olusturulmadan dogrudan
 * davet edilen org'a katildiysa, "kendi panel"i hic yok olabilir. Profilim
 * sayfasi acildiginda bu helper cagrilir; idempotent — kullanicinin ownerId'li
 * bir org'u varsa hicbir sey yapmaz, yoksa "{Ad} Paneli" adinda yeni bir
 * organizasyon + admin uyelik yaratir. Kullanici Profilim → Panellerim'de
 * kendi panelini gorur, oradan tek tiklamayla gecis yapabilir.
 */
export async function ensureOwnPanelForUser(profile: ProfileWithOrg): Promise<void> {
  const existing = await prisma.organization.findFirst({
    where: { ownerId: profile.id },
    select: { id: true },
  });
  if (existing) return;

  const fullName =
    profile.fullName?.trim() ||
    profile.email?.split("@")[0] ||
    "Kullanici";

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: `${fullName} Paneli`, ownerId: profile.id },
    });
    // Admin olarak kendi panelinde uye yap — switch ettiginde admin haklarina
    // sahip olur (kullanici davet edebilir, proje yaratabilir).
    await tx.organizationMember.create({
      data: { userId: profile.id, organizationId: org.id, role: "admin" },
    });
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
