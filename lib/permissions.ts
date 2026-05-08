import type { ProfileWithOrg } from "@/lib/auth";

export type Role = "admin" | "user" | "viewer";
export type ResourceType = "project" | "customer";
export type AccessLevel = "full" | "readonly" | "hidden";

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

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  full: "Tam Erişim",
  readonly: "Salt Okunur",
  hidden: "Gizli",
};

// Pure helpers — read state, decide capabilities. DB-touching versions yasiyor
// `lib/permission-server.ts`'de (server-only). Client component'ler bu dosyayi
// safely import edebilir.

export function canViewResource(
  profile: ProfileLike,
  isHidden: boolean,
): boolean {
  if (isAdmin(profile)) return true;
  return !isHidden;
}

export function canEditResource(
  profile: ProfileLike,
  isLocked: boolean,
): boolean {
  if (isAdmin(profile)) return true;
  if (isViewer(profile)) return false;
  return !isLocked;
}

export function canDeleteResource(
  profile: ProfileLike,
  resourceOwnerId: string,
  isLocked: boolean,
): boolean {
  if (isAdmin(profile)) return true;
  if (isViewer(profile)) return false;
  if (profile.id !== resourceOwnerId) return false;
  return !isLocked;
}

export function getAccessLevel(
  isHidden: boolean,
  isLocked: boolean,
): AccessLevel {
  if (isHidden) return "hidden";
  if (isLocked) return "readonly";
  return "full";
}

