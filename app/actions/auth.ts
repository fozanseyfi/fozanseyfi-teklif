"use server";

import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateEmail, validatePassword, validateRequired } from "@/lib/validations";
import { redirect } from "next/navigation";

export type ActionResult = {
  error?: string;
  success?: string;
};

const PLATFORM_OWNER_EMAIL = "fozanseyfi@gmail.com";

// Karardestek pattern: profiles + organizations Karardestek tarafindan
// trigger ile signup'ta otomatik yaratilir. Biz sadece auth.users uretip
// bu trigger'in calismasini bekliyoruz; ek ekleme yok.
export async function register(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const nameError = validateRequired(name, "Ad Soyad");
  if (nameError) return { error: nameError };
  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, full_name: name } },
  });

  if (error || !data.user) {
    return { error: error?.message || "Kayıt sırasında bir hata oluştu." };
  }

  // Karardestek'in handle_new_user() trigger'i profile + organization yaratir.
  // Burada ekstra is yapmiyoruz — getCurrentUser ilk istekte profile'i okur.
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
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/reset-password`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { success: "Şifre sıfırlama linki gönderildi (eğer hesap varsa)" };
}

export async function resetPassword(_state: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const password = formData.get("password") as string;
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message || "Şifre güncellenemedi. Lütfen linki yenileyip tekrar deneyin." };
  }

  return { success: "Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz." };
}

// Aktif organizasyonu degistirme — top bar panel switcher tarafindan cagrilir.
export async function switchOrganization(organizationId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: "Yetkisiz" };

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: authUser.id,
        organizationId,
      },
    },
  });
  if (!membership) return { error: "Bu organizasyona üyeliğin yok" };

  await prisma.profile.update({
    where: { id: authUser.id },
    data: { organizationId, role: membership.role },
  });

  return { success: "Aktif panel değiştirildi" };
}

export { PLATFORM_OWNER_EMAIL };
