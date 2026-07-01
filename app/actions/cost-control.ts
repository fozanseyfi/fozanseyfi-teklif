"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, type ProfileWithOrg } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_COST_CATEGORIES,
  computeCostProjectMetrics,
  type Rates,
} from "@/lib/cost-control";
import {
  parseQuoteItems,
  parseQuoteMeta,
  computeQuoteTotals,
} from "@/lib/quote";

// ————————————————————————————————————————————————————————————————
// Yardımcılar
// ————————————————————————————————————————————————————————————————

function canEdit(user: ProfileWithOrg): boolean {
  return user.platformRole !== "viewer";
}

async function assertOwnProject(user: ProfileWithOrg, id: string) {
  const p = await prisma.costProject.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!p) throw new Error("Maliyet projesi bulunamadı");
}

async function assertOwnLine(user: ProfileWithOrg, lineId: string): Promise<string> {
  const l = await prisma.costLine.findFirst({
    where: { id: lineId, costProject: { organizationId: user.organizationId } },
    select: { id: true, costProjectId: true },
  });
  if (!l) throw new Error("Kalem bulunamadı");
  return l.costProjectId;
}

/** Org'un öntanımlı kategorileri yoksa seed'ler. */
async function ensureDefaultCategories(organizationId: string) {
  const count = await prisma.costCategoryDef.count({ where: { organizationId } });
  if (count > 0) return;
  await prisma.costCategoryDef.createMany({
    data: DEFAULT_COST_CATEGORIES.map((c, i) => ({
      organizationId,
      code: c.code,
      name: c.name,
      isDefault: true,
      sortOrder: i,
    })),
  });
}

// ————————————————————————————————————————————————————————————————
// Liste + kart özetleri
// ————————————————————————————————————————————————————————————————

export interface CostProjectCard {
  id: string;
  name: string;
  customer: string;
  status: "ACTIVE" | "DONE";
  salesSym: string;
  salesPrice: number;
  actualNetTL: number;
  profitTL: number;
  profitMarginPct: number;
  collectedTotal: number;
  remainingReceivable: number;
  paidTL: number;
  payableBalanceTL: number;
  lineCount: number;
  updatedAt: string;
}

async function getRates(): Promise<Rates> {
  // Kalem kurları satırda donuk; sadece satış/tahsilat TL çevrimi için gerekir.
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000";
    const res = await fetch(`${base}/api/fx/latest`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      return { usd: Number(d.usd) || 0, eur: Number(d.eur) || 0 };
    }
  } catch {
    /* fallback below */
  }
  return { usd: 39.5, eur: 43.0 };
}

export async function listCostProjects(): Promise<CostProjectCard[]> {
  const user = await requireAuth();
  await ensureDefaultCategories(user.organizationId);
  const rates = await getRates();

  const projects = await prisma.costProject.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      lines: { include: { payments: { select: { amount: true } } } },
      collections: { select: { amount: true, isPlanned: true } },
      partners: { select: { name: true, sharePercent: true } },
    },
  });

  return projects.map((p) => {
    const m = computeCostProjectMetrics({
      salesPrice: p.salesPrice,
      salesCurrency: p.salesCurrency,
      lines: p.lines,
      collections: p.collections,
      partners: p.partners,
      rates,
    });
    return {
      id: p.id,
      name: p.name || "İsimsiz Proje",
      customer: p.customer,
      status: p.status,
      salesSym: m.salesSym,
      salesPrice: m.salesPrice,
      actualNetTL: m.actualNetTL,
      profitTL: m.profitTL,
      profitMarginPct: m.profitMarginPct,
      collectedTotal: m.collectedTotal,
      remainingReceivable: m.remainingReceivable,
      paidTL: m.paidTL,
      payableBalanceTL: m.payableBalanceTL,
      lineCount: p.lines.length,
      updatedAt: p.updatedAt.toISOString(),
    };
  });
}

// ————————————————————————————————————————————————————————————————
// Proje CRUD
// ————————————————————————————————————————————————————————————————

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function createCostProject(input: {
  name: string;
  customer?: string;
  salesPrice?: number;
  salesCurrency?: string;
  salesVatRate?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}): Promise<{ id?: string; error?: string }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Görüntüleyici kullanıcılar oluşturamaz" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Proje adı zorunludur" };
  await ensureDefaultCategories(user.organizationId);

  const p = await prisma.costProject.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      name,
      customer: (input.customer || "").trim(),
      salesPrice: Number(input.salesPrice) || 0,
      salesCurrency: input.salesCurrency || "TRY",
      salesVatRate: input.salesVatRate ?? 20,
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      notes: (input.notes || "").trim() || null,
    },
    select: { id: true },
  });
  revalidatePath("/cost-control");
  return { id: p.id };
}

export async function updateCostProject(
  id: string,
  patch: {
    name?: string;
    customer?: string;
    salesPrice?: number;
    salesCurrency?: string;
    salesVatRate?: number;
    startDate?: string | null;
    endDate?: string | null;
    status?: "ACTIVE" | "DONE";
    notes?: string;
  },
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await assertOwnProject(user, id);

  await prisma.costProject.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.customer !== undefined ? { customer: patch.customer.trim() } : {}),
      ...(patch.salesPrice !== undefined ? { salesPrice: Number(patch.salesPrice) || 0 } : {}),
      ...(patch.salesCurrency !== undefined ? { salesCurrency: patch.salesCurrency } : {}),
      ...(patch.salesVatRate !== undefined ? { salesVatRate: Number(patch.salesVatRate) || 0 } : {}),
      ...(patch.startDate !== undefined ? { startDate: toDate(patch.startDate) } : {}),
      ...(patch.endDate !== undefined ? { endDate: toDate(patch.endDate) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() || null } : {}),
    },
  });
  revalidatePath(`/cost-control/${id}`);
  revalidatePath("/cost-control");
  return { success: true };
}

export async function deleteCostProject(id: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await assertOwnProject(user, id);
  await prisma.costProject.delete({ where: { id } });
  revalidatePath("/cost-control");
  return { success: true };
}

// ————————————————————————————————————————————————————————————————
// Kalem (line) CRUD
// ————————————————————————————————————————————————————————————————

export interface CostLineInput {
  categoryId?: string | null;
  code?: string;
  description: string;
  model?: string;
  brand?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  currency?: string;
  exchangeRate?: number;
  vatRate?: number;
  isInvoiced?: boolean;
  vendorId?: string | null;
  payAccountNameOverride?: string | null;
  payIbanOverride?: string | null;
  link?: string | null;
  plannedAmount?: number | null;
}

function normalizeLine(input: CostLineInput) {
  const currency = input.currency || "TRY";
  const exchangeRate = currency === "TRY" ? 1 : Number(input.exchangeRate) || 0;
  return {
    categoryId: input.categoryId || null,
    code: (input.code || "").trim(),
    description: (input.description || "").trim(),
    model: (input.model || "").trim() || null,
    brand: (input.brand || "").trim() || null,
    unit: (input.unit || "adet").trim() || "adet",
    quantity: Number(input.quantity) || 0,
    unitPrice: Number(input.unitPrice) || 0,
    currency,
    exchangeRate,
    vatRate: input.vatRate ?? 20,
    isInvoiced: input.isInvoiced ?? true,
    vendorId: input.vendorId || null,
    payAccountNameOverride: (input.payAccountNameOverride || "").trim() || null,
    payIbanOverride: (input.payIbanOverride || "").trim() || null,
    link: (input.link || "").trim() || null,
    plannedAmount: input.plannedAmount == null ? null : Number(input.plannedAmount),
  };
}

export async function createCostLine(
  costProjectId: string,
  input: CostLineInput,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await assertOwnProject(user, costProjectId);
  if (!(input.description || "").trim()) return { error: "Tanım zorunludur" };

  const max = await prisma.costLine.aggregate({
    where: { costProjectId },
    _max: { sortOrder: true },
  });
  await prisma.costLine.create({
    data: {
      costProjectId,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      ...normalizeLine(input),
    },
  });
  revalidatePath(`/cost-control/${costProjectId}`);
  return { success: true };
}

export async function updateCostLine(
  lineId: string,
  input: CostLineInput,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const projectId = await assertOwnLine(user, lineId);
  await prisma.costLine.update({ where: { id: lineId }, data: normalizeLine(input) });
  revalidatePath(`/cost-control/${projectId}`);
  return { success: true };
}

export async function deleteCostLine(lineId: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const projectId = await assertOwnLine(user, lineId);
  await prisma.costLine.delete({ where: { id: lineId } });
  revalidatePath(`/cost-control/${projectId}`);
  return { success: true };
}

// ————————————————————————————————————————————————————————————————
// Ödeme (tedarikçiye) + Tahsilat (müşteriden)
// ————————————————————————————————————————————————————————————————

export async function addCostPayment(
  lineId: string,
  input: { amount: number; paidDate?: string; method?: string; note?: string },
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const projectId = await assertOwnLine(user, lineId);
  const amount = Number(input.amount) || 0;
  if (amount <= 0) return { error: "Geçerli bir tutar girin" };
  const method = ["HAVALE", "EFT", "NAKIT", "KART", "CEK"].includes(input.method || "")
    ? (input.method as "HAVALE" | "EFT" | "NAKIT" | "KART" | "CEK")
    : "HAVALE";
  await prisma.costPayment.create({
    data: {
      costLineId: lineId,
      amount,
      paidDate: toDate(input.paidDate) ?? new Date(),
      method,
      note: (input.note || "").trim() || null,
    },
  });
  revalidatePath(`/cost-control/${projectId}`);
  return { success: true };
}

export async function deleteCostPayment(paymentId: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const pay = await prisma.costPayment.findFirst({
    where: { id: paymentId, costLine: { costProject: { organizationId: user.organizationId } } },
    select: { id: true, costLine: { select: { costProjectId: true } } },
  });
  if (!pay) return { error: "Ödeme bulunamadı" };
  await prisma.costPayment.delete({ where: { id: paymentId } });
  revalidatePath(`/cost-control/${pay.costLine.costProjectId}`);
  return { success: true };
}

export async function addCostCollection(
  costProjectId: string,
  input: { amount: number; collectedDate?: string; note?: string; isPlanned?: boolean },
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await assertOwnProject(user, costProjectId);
  const amount = Number(input.amount) || 0;
  if (amount <= 0) return { error: "Geçerli bir tutar girin" };
  await prisma.costCollection.create({
    data: {
      costProjectId,
      amount,
      collectedDate: toDate(input.collectedDate) ?? new Date(),
      isPlanned: !!input.isPlanned,
      note: (input.note || "").trim() || null,
    },
  });
  revalidatePath(`/cost-control/${costProjectId}`);
  return { success: true };
}

export async function deleteCostCollection(id: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const c = await prisma.costCollection.findFirst({
    where: { id, costProject: { organizationId: user.organizationId } },
    select: { id: true, costProjectId: true },
  });
  if (!c) return { error: "Tahsilat bulunamadı" };
  await prisma.costCollection.delete({ where: { id } });
  revalidatePath(`/cost-control/${c.costProjectId}`);
  return { success: true };
}

// ————————————————————————————————————————————————————————————————
// Ortak payları (kâr dağıtımı) — hepsini değiştir
// ————————————————————————————————————————————————————————————————

export async function saveCostPartners(
  costProjectId: string,
  partners: { name: string; sharePercent: number }[],
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await assertOwnProject(user, costProjectId);
  const clean = partners
    .map((p) => ({ name: (p.name || "").trim(), sharePercent: Number(p.sharePercent) || 0 }))
    .filter((p) => p.name);
  await prisma.$transaction([
    prisma.costPartner.deleteMany({ where: { costProjectId } }),
    ...(clean.length
      ? [prisma.costPartner.createMany({ data: clean.map((p) => ({ costProjectId, ...p })) })]
      : []),
  ]);
  revalidatePath(`/cost-control/${costProjectId}`);
  return { success: true };
}

// ————————————————————————————————————————————————————————————————
// Tedarikçiler (vendors)
// ————————————————————————————————————————————————————————————————

export interface VendorInput {
  name: string;
  email?: string;
  phone?: string;
  taxNo?: string;
  defaultInvoiced?: boolean;
  payAccountName?: string;
  payIban?: string;
  bank?: string;
  notes?: string;
}

export async function createVendor(input: VendorInput): Promise<{ id?: string; error?: string }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Tedarikçi adı zorunludur" };
  const v = await prisma.costVendor.create({
    data: {
      organizationId: user.organizationId,
      name,
      email: (input.email || "").trim() || null,
      phone: (input.phone || "").trim() || null,
      taxNo: (input.taxNo || "").trim() || null,
      defaultInvoiced: input.defaultInvoiced ?? true,
      payAccountName: (input.payAccountName || "").trim() || null,
      payIban: (input.payIban || "").trim() || null,
      bank: (input.bank || "").trim() || null,
      notes: (input.notes || "").trim() || null,
    },
    select: { id: true },
  });
  revalidatePath("/cost-control/vendors");
  return { id: v.id };
}

export async function updateVendor(id: string, input: VendorInput): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const own = await prisma.costVendor.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } });
  if (!own) return { error: "Tedarikçi bulunamadı" };
  await prisma.costVendor.update({
    where: { id },
    data: {
      name: (input.name || "").trim(),
      email: (input.email || "").trim() || null,
      phone: (input.phone || "").trim() || null,
      taxNo: (input.taxNo || "").trim() || null,
      defaultInvoiced: input.defaultInvoiced ?? true,
      payAccountName: (input.payAccountName || "").trim() || null,
      payIban: (input.payIban || "").trim() || null,
      bank: (input.bank || "").trim() || null,
      notes: (input.notes || "").trim() || null,
    },
  });
  revalidatePath("/cost-control/vendors");
  return { success: true };
}

export async function deleteVendor(id: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const own = await prisma.costVendor.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } });
  if (!own) return { error: "Tedarikçi bulunamadı" };
  await prisma.costVendor.delete({ where: { id } });
  revalidatePath("/cost-control/vendors");
  return { success: true };
}

// ————————————————————————————————————————————————————————————————
// Kategoriler
// ————————————————————————————————————————————————————————————————

export async function createCategory(input: { code?: string; name: string }): Promise<{ id?: string; error?: string }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Kategori adı zorunludur" };
  let code = (input.code || "").trim();
  if (!code) {
    const count = await prisma.costCategoryDef.count({ where: { organizationId: user.organizationId } });
    code = `A.${count + 1}`;
  }
  const v = await prisma.costCategoryDef.create({
    data: { organizationId: user.organizationId, code, name, sortOrder: 999 },
    select: { id: true },
  });
  revalidatePath("/cost-control");
  return { id: v.id };
}

// ————————————————————————————————————————————————————————————————
// Tekliften import
// ————————————————————————————————————————————————————————————————

export interface ImportableQuote {
  id: string;
  name: string;
  customer: string;
  kind: "TURNKEY" | "MATERIAL_SERVICE";
  itemCount: number;
}

export async function listImportableQuotes(): Promise<ImportableQuote[]> {
  const user = await requireAuth();
  const projects = await prisma.project.findMany({
    where: { organizationId: user.organizationId, isTemplate: false, name: { not: "" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      customerName: true,
      quoteKind: true,
      projectDetail: { select: { quoteItems: true } },
    },
    take: 200,
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    customer: p.customerName,
    kind: p.quoteKind,
    itemCount: p.quoteKind === "MATERIAL_SERVICE" ? parseQuoteItems(p.projectDetail?.quoteItems).length : 0,
  }));
}

export async function createCostProjectFromQuote(
  sourceProjectId: string,
): Promise<{ id?: string; error?: string }> {
  const user = await requireAuth();
  if (!canEdit(user)) return { error: "Yetkiniz yok" };
  await ensureDefaultCategories(user.organizationId);

  const src = await prisma.project.findFirst({
    where: { id: sourceProjectId, organizationId: user.organizationId },
    include: { projectDetail: { select: { quoteItems: true, settings: true } }, pricingSnapshot: true },
  });
  if (!src) return { error: "Kaynak teklif bulunamadı" };

  let salesPrice = 0;
  let salesCurrency = "TRY";
  const lineData: {
    code: string; description: string; unit: string; quantity: number;
    unitPrice: number; currency: string; exchangeRate: number; vatRate: number;
    plannedAmount: number | null; sortOrder: number;
  }[] = [];

  if (src.quoteKind === "MATERIAL_SERVICE") {
    const items = parseQuoteItems(src.projectDetail?.quoteItems);
    const meta = parseQuoteMeta(src.projectDetail?.settings);
    const totals = computeQuoteTotals(items, meta);
    // Satış = müşteri geneli toplam (KDV dahil), seçilen çıktı para biriminde.
    salesPrice = totals.grandTotal;
    salesCurrency = meta.outputCurrency || "TRY";
    const rateOf = (cur: string) => (cur === "USD" ? meta.usd : cur === "EUR" ? meta.eur : 1);
    items
      .filter((it) => !it.isOption)
      .forEach((it, i) => {
        const rate = rateOf(it.currency);
        lineData.push({
          code: it.code || "",
          description: it.name || it.code || "Kalem",
          unit: it.unit || "adet",
          quantity: it.qty || 0,
          unitPrice: it.unitCost || 0,
          currency: it.currency || "TRY",
          exchangeRate: it.currency === "TRY" ? 1 : rate,
          vatRate: meta.kdvRate ?? 20,
          // Teklifteki maliyet = planlanan bütçe (gerçekleşen başlangıçta = aynı).
          plannedAmount: (it.qty || 0) * (it.unitCost || 0) * (it.currency === "TRY" ? 1 : rate),
          sortOrder: i,
        });
      });
  } else {
    // TURNKEY: satış fiyatını pricingSnapshot'tan al; kalemler kullanıcı tarafından
    // eklenir (BOQ import v2'de). En azından satış + başlık hazır gelir.
    salesPrice = src.pricingSnapshot?.finalSalePrice ?? 0;
    salesCurrency = "TRY";
  }

  const created = await prisma.costProject.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      name: src.name || "Teklif",
      customer: src.customerName || "",
      salesPrice,
      salesCurrency,
      sourceProjectId: src.id,
      lines: lineData.length ? { create: lineData } : undefined,
    },
    select: { id: true },
  });
  revalidatePath("/cost-control");
  return { id: created.id };
}
