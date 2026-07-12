"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { NotebookData } from "@/lib/notebook/types";

/** Kullanıcının izole not defteri verisini getirir (yoksa boş). */
export async function getNotebook(): Promise<NotebookData> {
  const user = await requireAuth();
  const nb = await prisma.notebook.findUnique({ where: { profileId: user.id } });
  const d = (nb?.data as Partial<NotebookData> | null) || null;
  return {
    notes: Array.isArray(d?.notes) ? d!.notes : [],
    contacts: Array.isArray(d?.contacts) ? d!.contacts : [],
    companies: Array.isArray(d?.companies) ? d!.companies : [],
    tasks: Array.isArray(d?.tasks) ? d!.tasks : [],
  };
}

/** Tüm defteri (notlar+kişiler+şirketler) kaydeder.
 *  Silme yalnızca tam yetkili (admin) rolünde: user/viewer kaydettiğinde mevcut
 *  notlar/kişiler/firmalar kaybolamaz — sunucuda geri eklenir. */
export async function saveNotebook(data: NotebookData): Promise<void> {
  const user = await requireAuth();
  const payload = {
    notes: Array.isArray(data?.notes) ? data.notes : [],
    contacts: Array.isArray(data?.contacts) ? data.contacts : [],
    companies: Array.isArray(data?.companies) ? data.companies : [],
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
  };

  if (user.platformRole !== "admin") {
    const prev = await prisma.notebook.findUnique({ where: { profileId: user.id } });
    const old = (prev?.data as Partial<NotebookData> | null) || null;
    const keep = <T extends { id: string }>(oldArr: T[] | undefined, next: T[]): T[] => {
      if (!Array.isArray(oldArr) || oldArr.length === 0) return next;
      const ids = new Set(next.map((x) => x.id));
      const dropped = oldArr.filter((x) => !ids.has(x.id));
      return dropped.length ? [...next, ...dropped] : next;
    };
    payload.notes = keep(old?.notes, payload.notes);
    payload.contacts = keep(old?.contacts, payload.contacts);
    payload.companies = keep(old?.companies, payload.companies);
  }

  await prisma.notebook.upsert({
    where: { profileId: user.id },
    create: { profileId: user.id, organizationId: user.organizationId, data: payload as never },
    update: { data: payload as never },
  });
  revalidatePath("/not-defteri");
}

/** Nota fotoğraf yükler (Storage) — URL döner. */
export async function uploadNotebookPhoto(formData: FormData): Promise<{ url?: string; error?: string }> {
  const user = await requireAuth();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!file.type.startsWith("image/")) return { error: "Sadece görsel yüklenebilir" };
  if (file.size > 8 * 1024 * 1024) return { error: "Görsel 8 MB'tan büyük olamaz" };
  const admin = createSupabaseAdmin();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `notebook/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await admin.storage.from("brand-logos").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Yüklenemedi: ${error.message}` };
  const { data } = admin.storage.from("brand-logos").getPublicUrl(path);
  return { url: data?.publicUrl };
}
