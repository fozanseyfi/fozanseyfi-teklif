"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { generateToken } from "@/lib/utils";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
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

// Kullanicinin profil bilgilerini gunceller (sadece kendi profili).
// E-posta degisimi Supabase auth uzerinden yapilir; bu fonksiyon e-posta'yi
// guncellemez — sadece adi ve digerleri.
export async function updateMyProfile(formData: FormData) {
  const user = await requireAuth();
  const fullName = (formData.get("fullName") as string | null)?.trim();
  if (!fullName) return { error: "Ad Soyad boş olamaz" };

  await prisma.profile.update({
    where: { id: user.id },
    data: { fullName },
  });

  revalidatePath("/firm-settings");
  return { success: "Profil bilgileri güncellendi" };
}

// Sifre degistirme — Supabase auth uzerinden mevcut sifreyi dogrulayip
// yenisini set eder. Mevcut sifre yanlissa hata doner.
export async function updateMyPassword(formData: FormData) {
  const user = await requireAuth();
  const currentPwd = (formData.get("currentPassword") as string | null) ?? "";
  const newPwd = (formData.get("newPassword") as string | null) ?? "";
  const confirmPwd = (formData.get("confirmPassword") as string | null) ?? "";

  if (!currentPwd || !newPwd || !confirmPwd) {
    return { error: "Tüm şifre alanlarını doldurun" };
  }
  if (newPwd.length < 8) {
    return { error: "Yeni şifre en az 8 karakter olmalı" };
  }
  if (newPwd !== confirmPwd) {
    return { error: "Yeni şifre ve tekrarı eşleşmiyor" };
  }

  const supabase = await createSupabaseServer();

  // Mevcut sifreyi dogrula — sign-in attempt yap; basarisiz olursa hata.
  if (!user.email) {
    return { error: "Hesabınızda kayıtlı e-posta yok" };
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPwd,
  });
  if (signInError) {
    return { error: "Mevcut şifre hatalı" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPwd,
  });
  if (updateError) {
    return { error: updateError.message ?? "Şifre güncellenemedi" };
  }

  return { success: "Şifre güncellendi" };
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
      token,
      expiresAt,
      invitedBy: user.id,
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

  // Supabase admin.inviteUserByEmail kullaniyoruz — bu "Invite User" template'i
  // tetikler (Confirm Signup template'i degil; Karardestek "Confirm Signup"i
  // customize etmis ve {{ .SiteURL }}/auth/callback'e hardcoded yonlendirme
  // yapiyor). Invite template default `{{ .ConfirmationURL }}` kullanir,
  // bu URL bizim redirectTo'yu honored eder.
  // Vercel env'inde gizli newline/whitespace olabilir — trim sart.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  // /auth/handler client-side komponenti hem implicit flow (hash) hem de
  // PKCE/OTP query params'ini handle eder, sonra invitation_token'a gore
  // /invite/<token>'a yonlendirir.
  const callbackUrl = `${appUrl}/auth/handler`;
  console.log("[invite] DEBUG callbackUrl =", JSON.stringify(callbackUrl));

  try {
    const admin = createSupabaseAdmin();

    // generateLink: email gondermez, link uretip bize verir.
    // Bu sayede Supabase'in bizim redirectTo'yu honored edip etmedigini
    // direkt gorebiliyoruz.
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: callbackUrl,
        data: {
          full_name: email.split("@")[0],
          invitation_token: token,
          invited_to_org: user.organizationId,
          invited_role: role,
        },
      },
    });
    if (linkError) {
      console.error("[invite] generateLink error:", linkError.message);
      // already-exists durumunda link uretemez ama davet kaydi olusturuldu
    }
    const actionLink = data?.properties?.action_link;
    console.log("[invite] DEBUG generateLink action_link =", actionLink);

    // Asil email'i Supabase gondersin: inviteUserByEmail'i ek olarak cagiriyoruz.
    // Bu Supabase'in default email akisi. Eger redirect_to dogru yerleserse
    // kullanici email'den linke tiklayinca dogru URL'ye gider.
    const result = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: callbackUrl,
      data: {
        full_name: email.split("@")[0],
        invitation_token: token,
        invited_to_org: user.organizationId,
        invited_role: role,
      },
    });
    console.log("[invite] DEBUG inviteUserByEmail error =", result.error?.message ?? "(yok)");
  } catch (e) {
    console.error("[invite] Admin client error:", e);
  }

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
  return {
    success: `${email} adresine davet e-postası gönderildi`,
    inviteUrl,
  };
}

// Daveti kabul et — kullanici giris yapmis ve davet edilen email ile auth.users kayitli olmali.
// organization_members'a INSERT, profile.organizationId = yeni org (otomatik switch),
// invitation.acceptedAt = now().
export async function acceptInvitation(token: string) {
  console.log("[accept] start, token:", token);
  const user = await requireAuth();
  console.log("[accept] user:", user.id, user.email);

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });
  console.log("[accept] invitation found:", invitation ? `id=${invitation.id} email=${invitation.email} accepted=${!!invitation.acceptedAt}` : "(yok)");

  if (!invitation) return { error: "Davet bulunamadı" };
  if (invitation.acceptedAt) return { error: "Bu davet zaten kabul edilmiş" };
  if (invitation.expiresAt < new Date()) return { error: "Bu davetin süresi dolmuş" };

  // Davet edilen email ile mevcut auth user'in email'i eslesmeli
  if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    console.log("[accept] email mismatch — user:", user.email, "invite:", invitation.email);
    return { error: `Bu davet ${invitation.email} adresi için. Lütfen bu hesaptan çıkıp doğru hesapla giriş yapın.` };
  }

  // Idempotency: zaten uye ise hata vermesin
  try {
    await prisma.$transaction([
      prisma.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
        create: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
        update: { role: invitation.role },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.profile.update({
        where: { id: user.id },
        data: { organizationId: invitation.organizationId },
      }),
    ]);
    console.log("[accept] transaction OK");
  } catch (e) {
    console.error("[accept] transaction error:", e);
    return { error: e instanceof Error ? e.message : "Veritabanı hatası" };
  }

  return { success: `${invitation.organization.name} paneline katıldın`, organizationId: invitation.organizationId };
}

// Bekleyen daveti iptal et
export async function cancelInvitation(invitationId: string) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;

  await prisma.invitation.deleteMany({
    where: {
      id: invitationId,
      organizationId: admin.organizationId,
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
      userId_organizationId: {
        userId,
        organizationId: admin.organizationId,
      },
    },
  });
  if (!membership) return;

  await prisma.organizationMember.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId: admin.organizationId,
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
    },
  });

  // Eger hedef bu org'u aktif tutuyorsa, uye oldugu baska bir org'a yonlendir.
  const target = await prisma.profile.findUnique({
    where: { id: userId },
    include: {
      memberships: {
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
