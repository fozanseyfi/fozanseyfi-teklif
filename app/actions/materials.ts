"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface CatalogItemDTO {
  id: string;
  code: string;
  name: string;
  unit: string;
  kind: "MALZEME" | "HIZMET";
}

/** Firma kataloğunu listeler (fiyatsız — malzeme/hizmet tanımları). */
export async function listCatalogItems(): Promise<CatalogItemDTO[]> {
  const user = await requireAuth();
  const rows = await prisma.materialCatalogItem.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, unit: true, kind: true },
  });
  return rows;
}

/** Yeni katalog kalemi ekler (fiyatsız). Kod firma içinde benzersizdir. */
export async function createCatalogItem(input: {
  code: string;
  name: string;
  unit?: string;
  kind?: "MALZEME" | "HIZMET";
}): Promise<{ item?: CatalogItemDTO; error?: string }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Görüntüleyici kullanıcılar ekleyemez" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { error: "Kod zorunludur" };
  if (!name) return { error: "Ad zorunludur" };
  const unit = (input.unit || "adet").trim() || "adet";
  const kind = input.kind === "HIZMET" ? "HIZMET" : "MALZEME";

  const existing = await prisma.materialCatalogItem.findUnique({
    where: { organizationId_code: { organizationId: user.organizationId, code } },
    select: { id: true },
  });
  if (existing) return { error: `"${code}" kodu zaten kayıtlı` };

  const row = await prisma.materialCatalogItem.create({
    data: { organizationId: user.organizationId, code, name, unit, kind },
    select: { id: true, code: true, name: true, unit: true, kind: true },
  });

  revalidatePath("/materials");
  return { item: row };
}

/** Katalog kalemini günceller. */
export async function updateCatalogItem(
  id: string,
  input: { code: string; name: string; unit?: string; kind?: "MALZEME" | "HIZMET" },
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Yetkiniz yok" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { error: "Kod ve ad zorunludur" };

  // Aynı kod başka bir kayıtta varsa engelle.
  const clash = await prisma.materialCatalogItem.findFirst({
    where: { organizationId: user.organizationId, code, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { error: `"${code}" kodu başka bir kalemde kullanılıyor` };

  await prisma.materialCatalogItem.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { code, name, unit: (input.unit || "adet").trim() || "adet", kind: input.kind === "HIZMET" ? "HIZMET" : "MALZEME" },
  });

  revalidatePath("/materials");
  return { success: true };
}

/** Katalog kalemini siler. */
export async function deleteCatalogItem(id: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Yetkiniz yok" };
  await prisma.materialCatalogItem.deleteMany({
    where: { id, organizationId: user.organizationId },
  });
  revalidatePath("/materials");
  return { success: true };
}
