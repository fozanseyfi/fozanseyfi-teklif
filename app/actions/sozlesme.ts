"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadEditableProject } from "@/lib/project-access";
import { logAudit } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { DEF_KA, DEF_KB, DEF_TL, DEF_DOR } from "@/lib/ges-defaults";
import type { SozlesmeData, ImzaliSozlesme } from "@/lib/sozlesme/schema";

const BUCKET = "brand-logos"; // mevcut (PDF destekli) bucket; alt-klasör sozlesme/

async function readSozlesme(projectId: string): Promise<Record<string, unknown>> {
  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const settings = (detail?.settings as Record<string, unknown>) || {};
  return (settings.sozlesme as Record<string, unknown>) || {};
}

async function writeSozlesme(projectId: string, next: Record<string, unknown>) {
  const detail = await prisma.projectDetail.findUnique({ where: { projectId } });
  const oldSettings = (detail?.settings as Record<string, unknown>) || {};
  const newSettings = { ...oldSettings, sozlesme: next };
  await prisma.projectDetail.upsert({
    where: { projectId },
    create: {
      projectId,
      settings: newSettings as never,
      kesifA: DEF_KA as never,
      kesifB: DEF_KB as never,
      timeline: DEF_TL as never,
      dor: DEF_DOR as never,
    },
    update: { settings: newSettings as never },
  });
}

/** Form + metin verisini kaydeder (imzalı PDF meta'sı KORUNUR). */
export async function saveSozlesme(projectId: string, data: SozlesmeData) {
  const project = await loadEditableProject(projectId);
  const user = await requireAuth();
  const old = await readSozlesme(projectId);
  await writeSozlesme(projectId, {
    ...old,
    tur: data.tur,
    values: data.values,
    textOverrides: data.textOverrides || {},
    updatedAt: new Date().toISOString(),
  });
  await logAudit(user, "save_sozlesme", "project", projectId, project.name, {
    tur: data.tur,
    alanSayisi: Object.keys(data.values).length,
  });
  revalidatePath(`/sozlesmeler/${projectId}`);
}

const MAX_SIGNED = 30 * 1024 * 1024;
const isPdf = (name: string, type: string) => type === "application/pdf" || /.pdf$/i.test(name);

/**
 * İmzalı sözleşme yükleme — 1. adım: depoya doğrudan yükleme için imzalı link üretir.
 * Dosya sunucu fonksiyonundan geçmez (Vercel istek gövdesi ~4,5 MB ile sınırlı; taranmış
 * sözleşmeler genelde daha büyük), tarayıcı bu linkle doğrudan Supabase Storage'a yükler.
 */
export async function prepareSignedContractUpload(
  projectId: string,
  file: { name: string; size: number; type: string },
): Promise<{ error?: string; path?: string; token?: string }> {
  await loadEditableProject(projectId);
  const user = await requireAuth();
  if (!file.size) return { error: "Dosya seçilmedi" };
  if (!isPdf(file.name, file.type)) return { error: "Sadece PDF (tek tarama imzalı sözleşme) kabul edilir" };
  if (file.size > MAX_SIGNED) return { error: "PDF 30 MB'tan büyük olamaz" };

  const path = `org-${user.organizationId}/sozlesme/${projectId}/imzali-${Date.now()}.pdf`;
  const { data, error } = await createSupabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: `Yükleme başlatılamadı: ${error?.message ?? "bilinmeyen hata"}` };
  return { path: data.path, token: data.token };
}

/** İmzalı sözleşme yükleme — 2. adım: depoya yüklenen dosyayı sözleşmeye bağlar, eskisini siler. */
export async function confirmSignedContractUpload(
  projectId: string,
  file: { path: string; name: string; size: number },
): Promise<{ error?: string; success?: string }> {
  const project = await loadEditableProject(projectId);
  const user = await requireAuth();
  // Yalnız bu proje için üretilmiş yollar kabul edilir
  const prefix = `org-${user.organizationId}/sozlesme/${projectId}/imzali-`;
  if (!file.path.startsWith(prefix) || !file.path.endsWith(".pdf") || file.path.includes("..")) {
    return { error: "Geçersiz dosya yolu" };
  }

  const admin = createSupabaseAdmin();
  const folder = file.path.slice(0, file.path.lastIndexOf("/"));
  const { data: list } = await admin.storage.from(BUCKET).list(folder, { search: file.path.slice(folder.length + 1) });
  const stored = list?.find((o) => `${folder}/${o.name}` === file.path);
  if (!stored) return { error: "Dosya depoya ulaşmadı, tekrar deneyin" };
  const size = Number((stored.metadata as { size?: number } | null)?.size ?? file.size);
  if (size > MAX_SIGNED) {
    await admin.storage.from(BUCKET).remove([file.path]);
    return { error: "PDF 30 MB'tan büyük olamaz" };
  }

  const old = await readSozlesme(projectId);
  const prev = old.imzali as ImzaliSozlesme | undefined;
  if (prev?.path && prev.path !== file.path) {
    try { await admin.storage.from(BUCKET).remove([prev.path]); } catch { /* yut */ }
  }

  const name = file.name.slice(0, 200);
  const imzali: ImzaliSozlesme = { path: file.path, name, uploadedAt: new Date().toISOString(), size };
  await writeSozlesme(projectId, { ...old, imzali });
  await logAudit(user, "upload_signed_contract", "project", projectId, project.name, { name });
  revalidatePath(`/sozlesmeler/${projectId}`);
  return { success: "İmzalı sözleşme yüklendi" };
}

/** İmzalı sözleşmeyi kaldırır. */
export async function removeSignedContract(projectId: string): Promise<{ error?: string; success?: string }> {
  const project = await loadEditableProject(projectId);
  const user = await requireAuth();
  const old = await readSozlesme(projectId);
  const prev = old.imzali as ImzaliSozlesme | undefined;
  if (prev?.path) {
    try { await createSupabaseAdmin().storage.from(BUCKET).remove([prev.path]); } catch { /* yut */ }
  }
  const next = { ...old };
  delete next.imzali;
  await writeSozlesme(projectId, next);
  await logAudit(user, "remove_signed_contract", "project", projectId, project.name);
  revalidatePath(`/sozlesmeler/${projectId}`);
  return { success: "İmzalı sözleşme kaldırıldı" };
}
