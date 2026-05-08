"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { PLATFORM_KEY } from "@/lib/platform";
import { generateToken } from "@/lib/utils";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
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

  // Supabase admin.inviteUserByEmail kullaniyoruz — bu "Invite User" template'i
  // tetikler (Confirm Signup template'i degil; Karardestek "Confirm Signup"i
  // customize etmis ve {{ .SiteURL }}/auth/callback'e hardcoded yonlendirme
  // yapiyor). Invite template default `{{ .ConfirmationURL }}` kullanir,
  // bu URL bizim redirectTo'yu honored eder.
  // Supabase'in inviteUserByEmail / signUp email link akisi paylasilan Site URL
  // (Karardestek) yuzunden bizim platforma yonlendirilemiyor. Supabase email
  // sistemini bypass edip admin.createUser ile kullaniciyi zaten onaylanmis
  // olarak olusturuyoruz: email gonderme yok, admin link + (yeni user icin)
  // gecici sifreyi UI'da kopyalayip manuel iletiyor.
  let tempPassword: string | null = null;

  try {
    const admin = createSupabaseAdmin();
    const newPassword = generateToken(16); // 16 karakter rastgele

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true, // confirmation by-pass — admin onayli kabul edilir
      user_metadata: {
        full_name: email.split("@")[0],
        invitation_token: token,
        invited_to_org: user.organizationId,
        invited_role: role,
        platform: PLATFORM_KEY,
      },
    });

    if (createError) {
      const msg = createError.message ?? "";
      if (/already.*regist|already.*exist/i.test(msg)) {
        // Kullanici zaten kayitli — sadece davet linki yeter, sifre vermeyiz
        console.log(`[${PLATFORM_KEY}] Mevcut kullanici davet edildi (${email}): ${inviteUrl}`);
      } else {
        console.error("[invite] createUser error:", msg);
        return { error: `Kullanici olusturulamadi: ${msg}` };
      }
    } else {
      // Yeni kullanici olusturuldu — gecici sifre admin'e gosterilecek
      tempPassword = newPassword;
      console.log(`[${PLATFORM_KEY}] Yeni kullanici olusturuldu (${email}): ${inviteUrl}`);
    }
  } catch (e) {
    console.error("[invite] Admin client error:", e);
    return { error: "Sunucu hatasi" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
  return {
    success: tempPassword
      ? `${email} için davet hazır. Aşağıdaki link ve geçici şifreyi kullanıcıya iletin.`
      : `${email} zaten kayıtlı bir kullanıcı. Davet linkini aşağıdan kopyalayıp iletin (mevcut şifresiyle giriş yapacaktır).`,
    inviteUrl,
    tempPassword,
  };
}

// Daveti kabul et — kullanici giris yapmis ve davet edilen email ile auth.users kayitli olmali.
// organization_members'a INSERT, profile.organizationId = yeni org (otomatik switch),
// invitation.acceptedAt = now().
export async function acceptInvitation(token: string) {
  const user = await requireAuth();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation) return { error: "Davet bulunamadı" };
  if (invitation.acceptedAt) return { error: "Bu davet zaten kabul edilmiş" };
  if (invitation.expiresAt < new Date()) return { error: "Bu davetin süresi dolmuş" };
  if (invitation.platform !== PLATFORM_KEY) return { error: "Bu davet bu platform için değil" };

  // Davet edilen email ile mevcut auth user'in email'i eslesmeli
  if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: `Bu davet ${invitation.email} adresi için. Lütfen bu hesaptan çıkıp doğru hesapla giriş yapın.` };
  }

  // Idempotency: zaten uye ise hata vermesin
  await prisma.$transaction([
    prisma.organizationMember.upsert({
      where: {
        userId_organizationId_platform: {
          userId: user.id,
          organizationId: invitation.organizationId,
          platform: PLATFORM_KEY,
        },
      },
      create: {
        userId: user.id,
        organizationId: invitation.organizationId,
        platform: PLATFORM_KEY,
        role: invitation.role,
      },
      update: { role: invitation.role },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
    // Davet edilen kullanici aktif panel olarak yeni org'u gorsun
    prisma.profile.update({
      where: { id: user.id },
      data: { organizationId: invitation.organizationId },
    }),
  ]);

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
