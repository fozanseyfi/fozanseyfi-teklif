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

/** İmzalı sözleşme (tek tarama PDF) yükler. */
export async function uploadSignedContract(projectId: string, formData: FormData): Promise<{ error?: string; success?: string }> {
  const project = await loadEditableProject(projectId);
  const user = await requireAuth();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (file.type !== "application/pdf") return { error: "Sadece PDF (tek tarama imzalı sözleşme) kabul edilir" };
  if (file.size > 30 * 1024 * 1024) return { error: "PDF 30 MB'tan büyük olamaz" };

  const admin = createSupabaseAdmin();
  const old = await readSozlesme(projectId);
  const prev = old.imzali as ImzaliSozlesme | undefined;

  const path = `org-${user.organizationId}/sozlesme/${projectId}/imzali-${Date.now()}.pdf`;
  const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: true });
  if (error) return { error: `Yüklenemedi: ${error.message}` };

  // Eski dosyayı temizle
  if (prev?.path && prev.path !== path) {
    try { await admin.storage.from(BUCKET).remove([prev.path]); } catch { /* yut */ }
  }

  const imzali: ImzaliSozlesme = { path, name: file.name, uploadedAt: new Date().toISOString(), size: file.size };
  await writeSozlesme(projectId, { ...old, imzali });
  await logAudit(user, "upload_signed_contract", "project", projectId, project.name, { name: file.name });
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
