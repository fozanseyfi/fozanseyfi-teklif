"use server";

import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateEmail, validatePassword, validateRequired } from "@/lib/validations";
import { PlanType, SubStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export type ActionResult = {
  error?: string;
  success?: string;
};

// Bootstrap: ilk kayit olan ve fozanseyfi@gmail.com olan hesap otomatik olarak
// platform sahibi (FIRM_ADMIN) yapilir. Diger sitelerden ortak Supabase Auth
// uzerinden gelen kullanicilar default firma altinda MEMBER baslar; davet
// linki ile farkli firma altina alinabilirler.
const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

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

  // Davet akisi disindaki kullanicilar firma adi girmek zorunda
  if (!inviteToken) {
    const firmNameError = validateRequired(firmName, "Firma Adı");
    if (firmNameError) return { error: firmNameError };
  }

  const supabase = await createSupabaseServer();

  // Eger ayni email ile mevcut bir Profile satiri varsa, baska bir siteden
  // (paylasilan auth.users uzerinden) kayit olmus demektir; tekrar kayit
  // yerine uyari verip giris sayfasina yonlendiriyoruz.
  const existingProfile = await prisma.user.findUnique({ where: { email } });
  if (existingProfile) {
    return {
      error:
        "Bu e-posta diğer platformlarımızdan biriyle zaten kayıtlı. Aynı şifreyle giriş yapabilirsiniz.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error || !data.user) {
    return { error: error?.message || "Kayıt sırasında bir hata oluştu." };
  }

  const authUserId = data.user.id;

  try {
    if (inviteToken) {
      const invite = await prisma.inviteToken.findUnique({ where: { token: inviteToken } });
      if (!invite || invite.expiresAt < new Date() || invite.usedAt) {
        return { error: "Davet linki geçersiz veya süresi dolmuş" };
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: authUserId,
            name,
            email,
            role: invite.role,
            firmId: invite.firmId,
          },
        });
        await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      });
    } else {
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const isPlatformOwner = email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;

      await prisma.$transaction(async (tx) => {
        const firm = await tx.firm.create({ data: { name: firmName } });
        await tx.user.create({
          data: {
            id: authUserId,
            name,
            email,
            role: UserRole.FIRM_ADMIN,
            firmId: firm.id,
          },
        });
        await tx.subscription.create({
          data: {
            firmId: firm.id,
            // Platform sahibi sınırsız, diğerleri FREE plandan başlar.
            plan: isPlatformOwner ? PlanType.ENTERPRISE : PlanType.FREE,
            status: SubStatus.ACTIVE,
            monthlyProposalLimit: isPlatformOwner ? 99999 : 3,
            periodStart: now,
            periodEnd,
          },
        });
      });
    }
  } catch (e) {
    console.error("Profile creation failed after Supabase signUp", e);
    return { error: "Profil oluşturulamadı. Lütfen daha sonra tekrar deneyin." };
  }

  redirect("/dashboard");
}

export async function login(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };
  if (!password) return { error: "Şifre zorunludur" };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "E-posta veya şifre hatalı" };
  }

  // Diger sitelerden olusturulmus auth.users satirlari icin bu sitede henuz
  // Profile yok olabilir — ortak hesap havuzunda yeni siteye ilk girisi yapan
  // kullaniciya default Firma + MEMBER profili otomatik aciliyor.
  const profile = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!profile) {
    const fullName = (data.user.user_metadata?.name as string | undefined) || email.split("@")[0];
    const isPlatformOwner = email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await prisma.$transaction(async (tx) => {
      const firm = await tx.firm.create({ data: { name: `${fullName} (Otomatik)` } });
      await tx.user.create({
        data: {
          id: data.user.id,
          name: fullName,
          email,
          role: UserRole.FIRM_ADMIN,
          firmId: firm.id,
        },
      });
      await tx.subscription.create({
        data: {
          firmId: firm.id,
          plan: isPlatformOwner ? PlanType.ENTERPRISE : PlanType.FREE,
          status: SubStatus.ACTIVE,
          monthlyProposalLimit: isPlatformOwner ? 99999 : 3,
          periodStart: now,
          periodEnd,
        },
      });
    });
  } else if (!profile.isActive) {
    await supabase.auth.signOut();
    return { error: "Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };

  const supabase = await createSupabaseServer();
  // Supabase'in gonderdigi link once /auth/callback'e dusup code -> session
  // takasini yapacak, sonra /reset-password'a redirect olacak.
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/reset-password`;

  // Hesap olup olmadigini ifsa etmemek icin hata mesaji ne olursa olsun
  // ayni success mesajini donduruyoruz.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { success: "Şifre sıfırlama linki gönderildi (eğer hesap varsa)" };
}

export async function resetPassword(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const password = formData.get("password") as string;
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  // Bu action, kullanici Supabase'in gonderdigi reset link'inden /reset-password
  // sayfasina geldikten sonra calisir; o sayfada exchangeCodeForSession ile
  // gecerli bir oturum elde edilmis olmali.
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message || "Şifre güncellenemedi. Lütfen linki yenileyip tekrar deneyin." };
  }

  return { success: "Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz." };
}
