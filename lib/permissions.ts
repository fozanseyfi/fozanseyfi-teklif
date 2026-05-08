import type { Profile } from "@prisma/client";

export type Role = "admin" | "user" | "viewer";

export function isAdmin(profile: Pick<Profile, "role">): boolean {
  return profile.role === "admin";
}

export function isUser(profile: Pick<Profile, "role">): boolean {
  // user VEYA admin — yaratabilir, duzenleyebilir
  return profile.role === "admin" || profile.role === "user";
}

export function isViewer(profile: Pick<Profile, "role">): boolean {
  return profile.role === "viewer";
}

// Yeni kayit acabilir mi? (proje, vb.)
export function canCreateResource(profile: Pick<Profile, "role">): boolean {
  return isUser(profile);
}

// Genel duzenleme yetkisi (admin tum kayitlari, user kendi kayitlarini)
export function canEditResource(
  profile: Pick<Profile, "id" | "role">,
  resourceOwnerId: string,
): boolean {
  if (isAdmin(profile)) return true;
  if (isUser(profile)) return profile.id === resourceOwnerId;
  return false;
}

export function canDeleteResource(
  profile: Pick<Profile, "id" | "role">,
  resourceOwnerId: string,
): boolean {
  if (isAdmin(profile)) return true;
  if (isUser(profile)) return profile.id === resourceOwnerId;
  return false;
}

// Sadece admin kullanici yonetebilir
export function canManageUsers(profile: Pick<Profile, "role">): boolean {
  return isAdmin(profile);
}

// Sadece admin gorunurluk (visibility) atayabilir
export function canManageVisibility(profile: Pick<Profile, "role">): boolean {
  return isAdmin(profile);
}

// Sadece admin teklif/PDF cikarabilir (eskiden FIRM_ADMIN/MANAGER)
export function canGeneratePDF(profile: Pick<Profile, "role">): boolean {
  return isUser(profile);
}

// UI etiketleri
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Yönetici",
  user: "Kullanıcı",
  viewer: "Görüntüleyici",
};

export const ACCESS_LEVEL_LABELS = {
  full: "Tam Erişim",
  readonly: "Salt Okunur",
  hidden: "Gizli",
} as const;
