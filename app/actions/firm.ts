"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAdmin, type Role } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// Karardestek pattern'inde Organization tablosu sadece (id, name, owner_id)
// alanlarini tutar — eski Firm.themeColor/address/logo gibi alanlar yok.
// Firma adi guncellemesi tek desteklenen alan.
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

// Davet sistemi public.invitations tablosu uzerinden ilerler. Burada
// invitation INSERT yapariz; davet kabul edilince /invite/[token] sayfasi
// organization_members kaydi acar.
export async function inviteUser(formData: FormData) {
  const user = await requireAuth();
  if (!isAdmin(user)) return { error: "Bu islem icin yetkin yok" };

  const email = formData.get("email") as string;
  const role = formData.get("role") as Role;

  if (!email || !role) return { error: "E-posta ve rol zorunludur" };
  if (!["admin", "user", "viewer"].includes(role)) return { error: "Gecersiz rol" };

  // Mevcut davet varsa kaldir (yenisi olusturulacak)
  // Note: invitations tablosu public schema'da, Prisma'da henuz model yok.
  // Bu islemi raw SQL veya Supabase client ile yapmak gerekecek — simdilik TODO.

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept`;

  // TODO: invitations tablosuna INSERT (Karardestek pattern), Resend ile e-posta gonder.
  console.log(`Davet linki (${email}, role=${role}): ${inviteUrl}`);

  revalidatePath("/firm-settings");
  return { success: `${email} adresine davet linki olusturuldu (e-posta gonderimi henuz aktif degil)`, inviteUrl };
}

// Kullanici rolunu degistir — organization_members.role guncellenir.
// Profile.role o anda aktif org icin uretilir; eger hedef kullanici bu org'u
// active tutuyorsa onun profile.role'unu de yenilemek gerekir.
export async function updateUserRole(userId: string, role: Role) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;
  if (!["admin", "user", "viewer"].includes(role)) return;

  // Hedef kullanici bizim org'a uye mi?
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: admin.organizationId } },
  });
  if (!membership) return;

  // Kendi rolumuzu degistirmemize izin verme
  if (userId === admin.id) return;

  await prisma.organizationMember.update({
    where: { userId_organizationId: { userId, organizationId: admin.organizationId } },
    data: { role },
  });

  // Hedef kullanici bu org'u aktif tutuyorsa profile.role'unu da senkronla
  const target = await prisma.profile.findUnique({ where: { id: userId } });
  if (target && target.organizationId === admin.organizationId) {
    await prisma.profile.update({ where: { id: userId }, data: { role } });
  }

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
}

// Kullaniciyi org'dan cikar — organization_members kaydi silinir.
// Eger hedef bu org'u aktif tutuyorsa, kendi org'una geri at (default).
export async function removeUser(userId: string) {
  const admin = await requireAuth();
  if (!isAdmin(admin)) return;
  if (userId === admin.id) return;

  await prisma.organizationMember.deleteMany({
    where: { userId, organizationId: admin.organizationId },
  });

  // Eger hedef bu org'u aktif tutuyorsa, kullanicinin sahip oldugu bir org'a yonlendir
  const target = await prisma.profile.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true }, take: 1 } },
  });
  if (target && target.organizationId === admin.organizationId) {
    const fallback = target.memberships[0];
    if (fallback) {
      await prisma.profile.update({
        where: { id: userId },
        data: { organizationId: fallback.organizationId, role: fallback.role },
      });
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/firm-settings");
}
