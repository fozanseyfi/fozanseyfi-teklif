import type { ProfileWithOrg } from "@/lib/auth";

export type Role = "admin" | "user" | "viewer";

// Bu platforma ait roller `profile.platformRole` uzerinden okunur (organization_members.role'u
// platform = 'solar-teklif' ile filtrelenmis hali). Karardestek'in profile.role'u
// burada KULLANILMAZ — onun kendi platformuna ait kararlari icin geçerli.
type ProfileLike = Pick<ProfileWithOrg, "id" | "platformRole">;

export function isAdmin(profile: ProfileLike): boolean {
  return profile.platformRole === "admin";
}

export function isUser(profile: ProfileLike): boolean {
  return profile.platformRole === "admin" || profile.platformRole === "user";
}

export function isViewer(profile: ProfileLike): boolean {
  return profile.platformRole === "viewer";
}

export function canCreateResource(profile: ProfileLike): boolean {
  return isUser(profile);
}

export function canEditResource(profile: ProfileLike, resourceOwnerId: string): boolean {
  if (isAdmin(profile)) return true;
  if (isUser(profile)) return profile.id === resourceOwnerId;
  return false;
}

export function canDeleteResource(profile: ProfileLike, resourceOwnerId: string): boolean {
  if (isAdmin(profile)) return true;
  if (isUser(profile)) return profile.id === resourceOwnerId;
  return false;
}

export function canManageUsers(profile: ProfileLike): boolean {
  return isAdmin(profile);
}

export function canManageVisibility(profile: ProfileLike): boolean {
  return isAdmin(profile);
}

export function canGeneratePDF(profile: ProfileLike): boolean {
  return isUser(profile);
}

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
