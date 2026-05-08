"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { PLATFORM_KEY } from "@/lib/platform";
import { generateToken } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function updateFirmProfile(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return;

  const name = formData.get("name") as string;
  if (!name || name.trim() === "") return;

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { name: name.trim() },
  });

  revalidatePath("/firm-settings");
}

// Davet olustur — public.invitations'a INSERT (platform-scoped).
// E-posta gonderimi henuz yok; admin link'i kopyalayip elden iletir.
export async function inviteUser(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Bu islem icin yetkin yok" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as Role;

  if (!email || !role) return { error: "E-posta ve rol zorunludur" };
  if (!["admin", "user", "viewer"].includes(role)) return { error: "Gecersiz rol" };

  // Bu org + platform'a ayni email ile mevcut bir uye varsa (zaten kabul edilmis davet)
  const existingMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: user.organizationId,
      platform: PLATFORM_KEY,
      user: { email: { equals: email, mode: "insensitive" } },
    },
  });
  if (existingMember) {
    return { error: "Bu e-posta zaten bu paneldeki bir kullaniciya ait" };
  }

  // Bekleyen davet varsa once temizle (yeni token uret)
  await prisma.invitation.deleteMany({
    where: {
      email,
      organizationId: user.organizationId,
      platform: PLATFORM_KEY,
      acceptedAt: null,
    },
  });

  const token = generateToken(48);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gun

  await prisma.invitation.create({
    data: {
      email,
      role,
      organizationId: user.organizationId,
      platform: PLATFORM_KEY,
      token,
      expiresAt,
      invitedBy: user.id,
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

  // TODO: Resend ile e-posta gonderimi. Simdilik admin link'i kopyalar.
  console.log(`[${PLATFORM_KEY}] Davet (${email}, role=${role}): ${inviteUrl}`);

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
  return { success: `${email} icin davet linki olusturuldu`, inviteUrl };
}

// Bekleyen daveti iptal et
export async function cancelInvitation(invitationId: string) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;

  await prisma.invitation.deleteMany({
    where: {
      id: invitationId,
      organizationId: admin.organizationId,
      platform: PLATFORM_KEY,
      acceptedAt: null,
    },
  });

  revalidatePath("/admin/users");
}

// Bu platformdaki rol guncellemesi — diger platformlardaki uyelikleri etkilemez.
export async function updateUserRole(userId: string, role: Role) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;
  if (!["admin", "user", "viewer"].includes(role)) return;
  if (userId === admin.id) return;

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId_platform: {
        userId,
        organizationId: admin.organizationId,
        platform: PLATFORM_KEY,
      },
    },
  });
  if (!membership) return;

  await prisma.organizationMember.update({
    where: {
      userId_organizationId_platform: {
        userId,
        organizationId: admin.organizationId,
        platform: PLATFORM_KEY,
      },
    },
    data: { role },
  });

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
}

// Bu platformdan kaldir — diger platformlardaki uyelikleri korur.
export async function removeUser(userId: string) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;
  if (userId === admin.id) return;

  await prisma.organizationMember.deleteMany({
    where: {
      userId,
      organizationId: admin.organizationId,
      platform: PLATFORM_KEY,
    },
  });

  // Eger hedef bu org'u aktif tutuyorsa, kullanicinin bu platformda uye oldugu baska bir org'a yonlendir.
  const target = await prisma.profile.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { platform: PLATFORM_KEY },
        include: { organization: true },
        take: 1,
      },
    },
  });
  if (target && target.organizationId === admin.organizationId) {
    const fallback = target.memberships[0];
    if (fallback) {
      await prisma.profile.update({
        where: { id: userId },
        data: { organizationId: fallback.organizationId },
      });
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
}
