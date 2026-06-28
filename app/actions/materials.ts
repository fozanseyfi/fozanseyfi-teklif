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

type Kind = "MALZEME" | "HIZMET";
// Malzeme → MLZ####, Hizmet → HZM####
function codePrefix(kind: Kind): string {
  return kind === "HIZMET" ? "HZM" : "MLZ";
}
function formatCode(kind: Kind, n: number): string {
  return `${codePrefix(kind)}${String(n).padStart(4, "0")}`;
}
function maxNumberForKind(codes: string[], kind: Kind): number {
  const re = new RegExp(`^${codePrefix(kind)}(\\d+)$`);
  let max = 0;
  for (const c of codes) {
    const m = re.exec((c || "").trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
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

/**
 * Yeni katalog kalemi ekler (fiyatsız). Kod verilmezse otomatik ANK-#### üretilir
 * (son numaradan devam eder). Kod elle verilirse benzersizlik kontrol edilir.
 */
export async function createCatalogItem(input: {
  code?: string;
  name: string;
  unit?: string;
  kind?: "MALZEME" | "HIZMET";
}): Promise<{ item?: CatalogItemDTO; error?: string }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Görüntüleyici kullanıcılar ekleyemez" };

  const name = input.name.trim();
  if (!name) return { error: "Ad zorunludur" };
  const unit = (input.unit || "adet").trim() || "adet";
  const kind = input.kind === "HIZMET" ? "HIZMET" : "MALZEME";

  let code = (input.code ?? "").trim();
  if (!code) {
    // Otomatik kod: aynı türün (MLZ/HZM) son numarasından devam et.
    const sameKind = await prisma.materialCatalogItem.findMany({
      where: { organizationId: user.organizationId, kind },
      select: { code: true },
    });
    code = formatCode(kind, maxNumberForKind(sameKind.map((r) => r.code), kind) + 1);
  } else {
    const existing = await prisma.materialCatalogItem.findUnique({
      where: { organizationId_code: { organizationId: user.organizationId, code } },
      select: { id: true },
    });
    if (existing) return { error: `"${code}" kodu zaten kayıtlı` };
  }

  const row = await prisma.materialCatalogItem.create({
    data: { organizationId: user.organizationId, code, name, unit, kind },
    select: { id: true, code: true, name: true, unit: true, kind: true },
  });

  revalidatePath("/materials");
  return { item: row };
}

/**
 * Katalog kodlarını yeniden numaralandırır: malzemeler MLZ0001…, hizmetler
 * HZM0001… (mevcut sıraya göre). İki aşamalı: önce geçici kod, sonra final —
 * unique çakışması olmasın diye.
 */
export async function renumberCatalogCodes(): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (user.platformRole === "viewer") return { error: "Yetkiniz yok" };

  for (const kind of ["MALZEME", "HIZMET"] as Kind[]) {
    const rows = await prisma.materialCatalogItem.findMany({
      where: { organizationId: user.organizationId, kind },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    for (const r of rows) {
      await prisma.materialCatalogItem.update({ where: { id: r.id }, data: { code: `__tmp_${r.id}` } });
    }
    for (let i = 0; i < rows.length; i++) {
      await prisma.materialCatalogItem.update({ where: { id: rows[i].id }, data: { code: formatCode(kind, i + 1) } });
    }
  }

  revalidatePath("/materials");
  return { success: true };
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
