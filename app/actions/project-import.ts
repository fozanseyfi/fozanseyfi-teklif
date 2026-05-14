"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { DEF_S, DEF_TL, DEF_DOR } from "@/lib/ges-defaults";
import type { KesifGroup, KesifItem } from "@/lib/ges-defaults";
import { redirect } from "next/navigation";

interface ImportedItem {
  groupCode: string; // "A.1", "A.2", "B.1" etc.
  groupName: string;
  code: string; // "A.1.1" etc.
  tanim: string;
  tip?: string;
  marka?: string;
  birim: string;
  miktar: number;
  rawFiyat: number;
  fiyatCur: "USD" | "EUR" | "TRY";
  notlar?: string;
}

interface ImportInput {
  projectName: string;
  customerName: string;
  projectLocation: string;
  installationType: "ROOFTOP" | "GROUND_MOUNTED";
  items: ImportedItem[];
}

/**
 * Excel'den parse edilmiş kalem listesinden yeni proje oluşturur.
 *
 * Kalemler `groupCode` prefix'ine (A.x / B.x) göre Keşif-A ve Keşif-B'ye
 * dağıtılır. Group code A/B harfiyle başlamıyorsa default Keşif-A.
 *
 * Project + ProjectDetail birlikte create — ges-engine calc() çalışsın
 * diye DEF_S settings'i default olarak set edilir; kullanıcı sonradan
 * Teknik tab'tan güncelleyebilir.
 */
export async function createProjectFromImport(input: ImportInput) {
  const user = await requireAuth();

  // Kalemleri Keşif-A ve Keşif-B gruplarına dağıt
  const groupMap = new Map<string, KesifGroup>();
  for (const it of input.items) {
    if (!groupMap.has(it.groupCode)) {
      groupMap.set(it.groupCode, {
        code: it.groupCode,
        name: it.groupName || it.groupCode,
        items: [],
      });
    }
    const item: KesifItem = {
      code: it.code,
      tanim: it.tanim,
      tip: it.tip ?? "",
      marka: it.marka ?? "",
      birim: it.birim,
      miktar: it.miktar,
      birimFiyat: it.rawFiyat,
      fiyatCur: it.fiyatCur,
      rawFiyat: it.rawFiyat,
      notlar: it.notlar ?? "",
    };
    groupMap.get(it.groupCode)!.items.push(item);
  }

  const kesifA: KesifGroup[] = [];
  const kesifB: KesifGroup[] = [];
  for (const g of groupMap.values()) {
    if (g.code.startsWith("B")) kesifB.push(g);
    else kesifA.push(g); // A veya tanımsız → A
  }

  // Project + ProjectDetail birlikte oluştur (transaction)
  const project = await prisma.project.create({
    data: {
      name: input.projectName,
      organizationId: user.organizationId,
      createdById: user.id,
      customerName: input.customerName,
      projectLocation: input.projectLocation,
      installationType: input.installationType,
      systemSize: "LARGE",
      electricityTariff: "INDUSTRIAL",
      status: "IN_PROGRESS",
      projectDetail: {
        create: {
          kesifA: kesifA as unknown as object,
          kesifB: kesifB as unknown as object,
          settings: DEF_S as unknown as object,
          timeline: DEF_TL as unknown as object,
          dor: DEF_DOR as unknown as object,
        },
      },
    },
  });

  redirect(`/projects/${project.id}/detail`);
}
