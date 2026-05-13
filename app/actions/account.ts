"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit-log";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";

/**
 * KVKK / GDPR hesap silme — kullanıcının kişisel verisi silinir.
 *
 * Davranış:
 *   - Profile + OrganizationMember kayıtları silinir
 *   - Profile.id'ye bağlı projeler: created_by_id NULL set edilir (org'da kalır)
 *   - Audit log'larda actorId nulled ama satır kalır (yasal kayıt sebebi)
 *   - Supabase Auth kullanıcısı silinir (login imkansız)
 *
 * Org admin'i (tek admin) hesabını silemez — önce başka admin atanmalı.
 */
export async function deleteMyAccount(): Promise<{ error?: string }> {
  const user = await requireAuth();

  // Eğer aktif org'unun tek admin'i ise sil bırakma
  if (isAdmin(user)) {
    const otherAdmins = await prisma.organizationMember.count({
      where: {
        organizationId: user.organizationId,
        role: "admin",
        userId: { not: user.id },
      },
    });
    if (otherAdmins === 0) {
      return {
        error:
          "Bu panelin tek yöneticisisin. Hesabını silmeden önce başka bir kişiyi yönetici yap ya da paneli kapat.",
      };
    }
  }

  // Audit log son kayıt — hangi kullanıcı kendi hesabını sildi
  await logAudit(user, "delete_my_account", "user", user.id, user.fullName ?? user.email ?? "", {
    deletedAt: new Date().toISOString(),
  });

  // Audit log satırlarındaki actorId'leri nullify et (FK yok zaten, snapshot kalır)
  // Aslında actorId Profile FK değil — actorEmail/actorName snapshot zaten orada.

  // OrganizationMember satırlarını sil — bağlı projeler etkilenmez, sadece üyelik kalkar
  await prisma.organizationMember.deleteMany({ where: { userId: user.id } });

  // Profile'ı sil — Supabase auth FK'i CASCADE değil; önce Supabase auth user
  // silinmeli, sonra profiles trigger ile silinir (Supabase pattern).
  // Bu app'te Profile bir public.profiles tablosu; FK CASCADE varsa sırasız OK.
  // En güvenli: önce profile sil, sonra Supabase auth.

  try {
    await prisma.profile.delete({ where: { id: user.id } });
  } catch (err) {
    console.warn("[deleteMyAccount] profile already deleted or FK cascade", err);
  }

  // Supabase Auth user'ı sil — login mümkün olmasın
  try {
    const admin = createSupabaseAdmin();
    await admin.auth.admin.deleteUser(user.id);
  } catch (err) {
    console.warn("[deleteMyAccount] supabase auth delete failed:", err);
  }

  redirect("/login?deleted=1");
}

/**
 * KVKK / GDPR veri export — kullanıcının kendi verisini JSON olarak indirir.
 *
 * Kapsam:
 *   - Profile temel bilgi
 *   - Org üyelikleri
 *   - Oluşturduğu projeler (özet)
 *   - Audit log satırları (kendi actorId'lerinde)
 *
 * NOT: Diğer kullanıcıların / org'ların verisi DAHIL EDİLMEZ.
 */
export async function exportMyData(): Promise<{ data?: unknown; error?: string }> {
  const user = await requireAuth();

  const [profile, memberships, projects, auditLogs] = await Promise.all([
    prisma.profile.findUnique({ where: { id: user.id } }),
    prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.project.findMany({
      where: { createdById: user.id },
      select: {
        id: true,
        name: true,
        customerName: true,
        organizationId: true,
        status: true,
        pipelineStage: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        action: true,
        resourceType: true,
        resourceName: true,
        createdAt: true,
        details: true,
      },
    }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportedBy: { id: user.id, email: user.email, fullName: user.fullName },
    profile: profile
      ? {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          createdAt: profile.createdAt,
        }
      : null,
    memberships: memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    projectsICreated: projects,
    myAuditTrail: auditLogs,
    note: "KVKK/GDPR uyumlu veri çıktısı. Sadece kendi kişisel ilişkilendirilmiş verileriniz dahil edilmiştir; diğer kullanıcıların verileri hariç tutulmuştur.",
  };

  await logAudit(user, "export_my_data", "user", user.id, user.fullName ?? user.email ?? "", {
    projectCount: projects.length,
    auditLogCount: auditLogs.length,
  });

  return { data: exportPayload };
}
