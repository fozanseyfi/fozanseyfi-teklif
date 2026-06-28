"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { generateToken } from "@/lib/utils";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { parseBrandSettings, type BrandSettings, type BrandDocument } from "@/lib/pdf-brand";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

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

// ─── Marka Ayarlari (BoQ/PDF ciktilarinda kullanilir) ────────────────────
// Tip + parser lib/pdf-brand.tsx'te (server actions dosyasi non-async export
// yasakli oldugu icin). Burada sadece async server action'lar.

export async function updateBrandSettings(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler marka ayarlarını güncelleyebilir" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!org) return { error: "Organizasyon bulunamadı" };

  const current = parseBrandSettings(org.brandSettings);

  // Form'dan gelen alanlar — toggle'lar checkbox formundan "on" olarak gelir
  // veya hic gelmez (false). String alanlari trim'lenir.
  const next: BrandSettings = {
    ...current,
    color: ((formData.get("color") as string) || current.color || "#059669").trim(),
    colorEnabled: formData.get("colorEnabled") === "on",
    slogan: ((formData.get("slogan") as string) || "").trim() || undefined,
    sloganEnabled: formData.get("sloganEnabled") === "on",
    logoEnabled: formData.get("logoEnabled") === "on",
    watermarkEnabled: formData.get("watermarkEnabled") === "on",
    taxNumber: ((formData.get("taxNumber") as string) || "").trim() || undefined,
    contact: ((formData.get("contact") as string) || "").trim() || undefined,
  };

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { brandSettings: next as never },
  });

  revalidatePath("/firm-settings");
  return { success: "Marka ayarları kaydedildi" };
}

export async function uploadBrandLogo(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler logo yükleyebilir" };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.size > 2 * 1024 * 1024) return { error: "Logo 2 MB'tan büyük olamaz" };
  if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
    return { error: "Sadece PNG, JPG, SVG veya WebP yükleyebilirsiniz" };
  }

  const admin = createSupabaseAdmin();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `org-${user.organizationId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("brand-logos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    return { error: `Logo yüklenemedi: ${uploadError.message}` };
  }

  const { data: pub } = admin.storage.from("brand-logos").getPublicUrl(path);
  if (!pub?.publicUrl) return { error: "Logo URL'si alınamadı" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        logoUrl: pub.publicUrl,
        logoEnabled: true, // Yeni logo yuklendiginde otomatik aktif
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Logo yüklendi", url: pub.publicUrl };
}

export async function removeBrandLogo() {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler logoyu kaldırabilir" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  if (current.logoUrl) {
    // Storage'dan sil — URL'den path'i extract et
    try {
      const admin = createSupabaseAdmin();
      const url = new URL(current.logoUrl);
      const idx = url.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const path = url.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([path]);
      }
    } catch {
      // Storage silinmediyse sorun degil; DB'den temizleyelim
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        logoUrl: undefined,
        logoEnabled: false,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Logo kaldırıldı" };
}

// ─── Kaşe / İmza görseli ──────────────────────────────────────────────

export async function uploadBrandStamp(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler kaşe yükleyebilir" };

  const file = formData.get("stamp") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.size > 3 * 1024 * 1024) return { error: "Kaşe 3 MB'tan büyük olamaz" };
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return { error: "Sadece PNG, JPG veya WebP yükleyebilirsiniz" };
  }

  const admin = createSupabaseAdmin();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `org-${user.organizationId}/stamp-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("brand-logos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Kaşe yüklenemedi: ${uploadError.message}` };

  const { data: pub } = admin.storage.from("brand-logos").getPublicUrl(path);
  if (!pub?.publicUrl) return { error: "Kaşe URL'si alınamadı" };

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  const current = parseBrandSettings(org?.brandSettings);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        stampUrl: pub.publicUrl,
        stampFileName: file.name,
        stampEnabled: true,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Kaşe yüklendi", url: pub.publicUrl };
}

export async function removeBrandStamp() {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler kaldırabilir" };

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  const current = parseBrandSettings(org?.brandSettings);

  if (current.stampUrl) {
    try {
      const admin = createSupabaseAdmin();
      const url = new URL(current.stampUrl);
      const idx = url.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const path = url.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([path]);
      }
    } catch {
      // sessiz yut
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: { ...current, stampUrl: undefined, stampFileName: undefined, stampEnabled: false } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Kaşe kaldırıldı" };
}

// ─── Firma Tanıtım PDF'i ──────────────────────────────────────────────

export async function uploadBrandBrochure(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler tanıtım yükleyebilir" };

  const file = formData.get("brochure") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.size > 10 * 1024 * 1024) return { error: "PDF 10 MB'tan büyük olamaz" };
  if (file.type !== "application/pdf") {
    return { error: "Sadece PDF formatı kabul edilir" };
  }

  const admin = createSupabaseAdmin();
  // Bucket'i logo ile aynı tutuyoruz (zaten public, aynı RLS); brochures/ alt-klasörü.
  const path = `org-${user.organizationId}/brochures/firma-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("brand-logos")
    .upload(path, file, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    return { error: `PDF yüklenemedi: ${uploadError.message}` };
  }

  const { data: pub } = admin.storage.from("brand-logos").getPublicUrl(path);
  if (!pub?.publicUrl) return { error: "PDF URL'si alınamadı" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  // Önce eski PDF'i Storage'dan sil — gereksiz dosya birikmesin.
  if (current.brochureUrl) {
    try {
      const oldUrl = new URL(current.brochureUrl);
      const idx = oldUrl.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const oldPath = oldUrl.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([oldPath]);
      }
    } catch {
      // sessiz yut
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        brochureUrl: pub.publicUrl,
        brochureFileName: file.name,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Tanıtım PDF'i yüklendi" };
}

export async function removeBrandBrochure() {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler kaldırabilir" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  if (current.brochureUrl) {
    try {
      const admin = createSupabaseAdmin();
      const url = new URL(current.brochureUrl);
      const idx = url.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const path = url.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([path]);
      }
    } catch {
      // sessiz yut
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        brochureUrl: undefined,
        brochureFileName: undefined,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Tanıtım PDF'i kaldırıldı" };
}

// ─── Referans listesi PDF'i ───────────────────────────────────────────

export async function uploadReferencesBrochure(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler yükleyebilir" };

  const file = formData.get("brochure") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.size > 10 * 1024 * 1024) return { error: "PDF 10 MB'tan büyük olamaz" };
  if (file.type !== "application/pdf") {
    return { error: "Sadece PDF formatı kabul edilir" };
  }

  const admin = createSupabaseAdmin();
  const path = `org-${user.organizationId}/references/referanslar-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("brand-logos")
    .upload(path, file, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    return { error: `PDF yüklenemedi: ${uploadError.message}` };
  }

  const { data: pub } = admin.storage.from("brand-logos").getPublicUrl(path);
  if (!pub?.publicUrl) return { error: "PDF URL'si alınamadı" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  if (current.referencesBrochureUrl) {
    try {
      const oldUrl = new URL(current.referencesBrochureUrl);
      const idx = oldUrl.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const oldPath = oldUrl.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([oldPath]);
      }
    } catch {
      // sessiz yut
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        referencesBrochureUrl: pub.publicUrl,
        referencesBrochureFileName: file.name,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Referans PDF'i yüklendi" };
}

export async function removeReferencesBrochure() {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler kaldırabilir" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  if (current.referencesBrochureUrl) {
    try {
      const admin = createSupabaseAdmin();
      const url = new URL(current.referencesBrochureUrl);
      const idx = url.pathname.indexOf("/brand-logos/");
      if (idx >= 0) {
        const path = url.pathname.slice(idx + "/brand-logos/".length);
        await admin.storage.from("brand-logos").remove([path]);
      }
    } catch {
      // sessiz yut
    }
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        referencesBrochureUrl: undefined,
        referencesBrochureFileName: undefined,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: "Referans PDF'i kaldırıldı" };
}

// ─── Ek Belgeler — serbest başlıklı PDF'ler ───────────────────────────

const MAX_CUSTOM_DOCS = 10;

export async function uploadCustomDocument(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler yükleyebilir" };

  const title = ((formData.get("title") as string) ?? "").trim().slice(0, 120);
  const file = formData.get("file") as File | null;

  if (!title) return { error: "Belge başlığı zorunludur" };
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.size > 10 * 1024 * 1024) return { error: "PDF 10 MB'tan büyük olamaz" };
  if (file.type !== "application/pdf") {
    return { error: "Sadece PDF formatı kabul edilir" };
  }

  // Mevcut belge sayısı limiti
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);
  const existing = current.customDocuments ?? [];
  if (existing.length >= MAX_CUSTOM_DOCS) {
    return { error: `En fazla ${MAX_CUSTOM_DOCS} belge yükleyebilirsiniz` };
  }

  const docId = randomBytes(12).toString("base64url");
  const admin = createSupabaseAdmin();
  const path = `org-${user.organizationId}/documents/${docId}-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("brand-logos")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return { error: `PDF yüklenemedi: ${uploadError.message}` };
  }

  const { data: pub } = admin.storage.from("brand-logos").getPublicUrl(path);
  if (!pub?.publicUrl) return { error: "PDF URL'si alınamadı" };

  const newDoc: BrandDocument = {
    id: docId,
    title,
    url: pub.publicUrl,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        customDocuments: [...existing, newDoc],
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  revalidatePath("/admin/share-links");
  return { success: "Belge yüklendi", documentId: docId };
}

export async function removeCustomDocument(documentId: string) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler kaldırabilir" };

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);
  const existing = current.customDocuments ?? [];
  const target = existing.find((d) => d.id === documentId);
  if (!target) return { error: "Belge bulunamadı" };

  // Storage'tan sil — başarısız olursa metadata'yı temizle, sessiz yut
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(target.url);
    const idx = url.pathname.indexOf("/brand-logos/");
    if (idx >= 0) {
      const path = url.pathname.slice(idx + "/brand-logos/".length);
      await admin.storage.from("brand-logos").remove([path]);
    }
  } catch {
    // sessiz yut
  }

  const remaining = existing.filter((d) => d.id !== documentId);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        customDocuments: remaining,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  revalidatePath("/admin/share-links");
  return { success: "Belge kaldırıldı" };
}

// ─── Referans listesi ─────────────────────────────────────────────────

export async function saveBrandReferences(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Sadece yöneticiler düzenleyebilir" };

  const rawJson = (formData.get("references") as string) ?? "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { error: "Geçersiz referans formatı" };
  }
  if (!Array.isArray(parsed)) return { error: "Geçersiz referans listesi" };

  // Temizle + valide et (server-side; client'a güvenme)
  const cleaned = parsed
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      customer: typeof r.customer === "string" ? r.customer.trim().slice(0, 200) : "",
      sector: typeof r.sector === "string" ? r.sector.trim().slice(0, 120) : undefined,
      mwp: typeof r.mwp === "number" && Number.isFinite(r.mwp) ? r.mwp : undefined,
      year: typeof r.year === "number" && Number.isFinite(r.year) ? Math.round(r.year) : undefined,
      location: typeof r.location === "string" ? r.location.trim().slice(0, 200) : undefined,
    }))
    .filter((r) => r.customer.length > 0)
    .slice(0, 200); // max 200 referans

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  const current = parseBrandSettings(org?.brandSettings);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      brandSettings: {
        ...current,
        references: cleaned,
      } as never,
    },
  });

  revalidatePath("/firm-settings");
  return { success: `${cleaned.length} referans kaydedildi` };
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

  // Supabase davet quota'sı + spam koruma: yöneticisi başına saatte N davet.
  const rate = await checkRateLimit("invite", user.id);
  if (!rate.success) {
    return { error: "Saatlik davet limiti aşıldı. Lütfen sonra tekrar deneyin." };
  }

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
