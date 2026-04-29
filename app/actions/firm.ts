"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateToken } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateFirmProfile(formData: FormData) {
  const user = await requireRole([UserRole.FIRM_ADMIN]);

  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  const website = formData.get("website") as string;
  const taxNumber = formData.get("taxNumber") as string;
  const themeColor = formData.get("themeColor") as string;

  await prisma.firm.update({
    where: { id: user.firmId },
    data: {
      name: name || undefined,
      address: address || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      taxNumber: taxNumber || null,
      themeColor: themeColor || "#F59E0B",
    },
  });

  revalidatePath("/firm-settings");
}

export async function inviteUser(formData: FormData) {
  const user = await requireRole([UserRole.FIRM_ADMIN]);

  const email = formData.get("email") as string;
  const role = formData.get("role") as UserRole;

  if (!email || !role) return { error: "E-posta ve rol zorunludur" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Bu e-posta zaten kayıtlı" };

  await prisma.inviteToken.deleteMany({ where: { firmId: user.firmId, email } });

  const token = generateToken(64);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.inviteToken.create({
    data: { firmId: user.firmId, email, role, token, expiresAt },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?token=${token}`;

  // TODO: Resend ile e-posta gönder
  console.log(`Davet linki (${email}): ${inviteUrl}`);

  revalidatePath("/firm-settings");
  return { success: `${email} adresine davet gönderildi`, inviteUrl };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const admin = await requireRole([UserRole.FIRM_ADMIN]);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.firmId !== admin.firmId) return;
  if (target.role === UserRole.FIRM_ADMIN) return; // FIRM_ADMIN rolü değiştirilemez

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/firm-settings");
}

export async function toggleUserActive(userId: string) {
  const admin = await requireRole([UserRole.FIRM_ADMIN]);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.firmId !== admin.firmId) return;
  if (target.role === UserRole.FIRM_ADMIN) return;

  await prisma.user.update({ where: { id: userId }, data: { isActive: !target.isActive } });
  revalidatePath("/firm-settings");
}

export async function removeUser(userId: string) {
  const admin = await requireRole([UserRole.FIRM_ADMIN]);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.firmId !== admin.firmId) return;
  if (target.role === UserRole.FIRM_ADMIN) return;

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/firm-settings");
}
