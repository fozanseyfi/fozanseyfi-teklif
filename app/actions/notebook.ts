"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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
  };
}

/** Tüm defteri (notlar+kişiler+şirketler) kaydeder. */
export async function saveNotebook(data: NotebookData): Promise<void> {
  const user = await requireAuth();
  const payload = {
    notes: Array.isArray(data?.notes) ? data.notes : [],
    contacts: Array.isArray(data?.contacts) ? data.contacts : [],
    companies: Array.isArray(data?.companies) ? data.companies : [],
  };
  await prisma.notebook.upsert({
    where: { profileId: user.id },
    create: { profileId: user.id, organizationId: user.organizationId, data: payload as never },
    update: { data: payload as never },
  });
  revalidatePath("/not-defteri");
}
