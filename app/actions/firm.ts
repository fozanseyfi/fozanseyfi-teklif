"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { PLATFORM_KEY } from "@/lib/platform";
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

// Davet — bu platforma ozel.
// public.invitations tablosu Karardestek tarafindan yonetiliyor;
// orada da bir 'platform' kolonu var/eklenmeli. Simdilik invitation
// kaydini Supabase client ile yapacagiz.
export async function inviteUser(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Bu islem icin yetkin yok" };

  const email = formData.get("email") as string;
  const role = formData.get("role") as Role;

  if (!email || !role) return { error: "E-posta ve rol zorunludur" };
  if (!["admin", "user", "viewer"].includes(role)) return { error: "Gecersiz rol" };

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept`;

  // TODO: invitations tablosuna INSERT (platform=PLATFORM_KEY); Resend ile e-posta gonder.
  console.log(`[${PLATFORM_KEY}] Davet linki (${email}, role=${role}): ${inviteUrl}`);

  revalidatePath("/firm-settings");
  return { success: `${email} adresine davet linki olusturuldu (e-posta gonderimi henuz aktif degil)`, inviteUrl };
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
