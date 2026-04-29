"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { validateEmail, validatePassword, validateRequired } from "@/lib/validations";
import { generateToken } from "@/lib/utils";
import { PlanType, SubStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export type ActionResult = {
  error?: string;
  success?: string;
};

export async function register(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firmName = formData.get("firmName") as string;
  const inviteToken = formData.get("inviteToken") as string | null;

  const nameError = validateRequired(name, "Ad Soyad");
  if (nameError) return { error: nameError };
  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Bu e-posta adresi zaten kullanılıyor" };

  const passwordHash = await bcrypt.hash(password, 12);

  if (inviteToken) {
    const invite = await prisma.inviteToken.findUnique({ where: { token: inviteToken } });
    if (!invite || invite.expiresAt < new Date() || invite.usedAt) {
      return { error: "Davet linki geçersiz veya süresi dolmuş" };
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: invite.role, firmId: invite.firmId },
    });
    await prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    await createSession({ userId: user.id, firmId: user.firmId, role: user.role, expiresAt: new Date() });
  } else {
    const firmNameError = validateRequired(firmName, "Firma Adı");
    if (firmNameError) return { error: firmNameError };

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const result = await prisma.$transaction(async (tx) => {
      const firm = await tx.firm.create({ data: { name: firmName } });
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: UserRole.FIRM_ADMIN, firmId: firm.id },
      });
      await tx.subscription.create({
        data: {
          firmId: firm.id,
          plan: PlanType.FREE,
          status: SubStatus.ACTIVE,
          monthlyProposalLimit: 3,
          periodStart: now,
          periodEnd,
        },
      });
      return user;
    });

    await createSession({ userId: result.id, firmId: result.firmId, role: result.role, expiresAt: new Date() });
  }

  redirect("/dashboard");
}

export async function login(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };
  if (!password) return { error: "Şifre zorunludur" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { error: "E-posta veya şifre hatalı" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: "E-posta veya şifre hatalı" };

  await createSession({ userId: user.id, firmId: user.firmId, role: user.role, expiresAt: new Date() });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function forgotPassword(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { success: "Şifre sıfırlama linki gönderildi (eğer hesap varsa)" };

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  const token = generateToken(64);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

  await prisma.passwordResetToken.create({ data: { email, token, expiresAt } });

  // TODO: Resend ile e-posta gönder
  console.log(`Reset link: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`);

  return { success: "Şifre sıfırlama linki e-posta adresinize gönderildi" };
}

export async function resetPassword(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  if (!token) return { error: "Geçersiz link" };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.expiresAt < new Date()) return { error: "Link geçersiz veya süresi dolmuş" };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email: resetToken.email }, data: { passwordHash } });
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

  return { success: "Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz." };
}
