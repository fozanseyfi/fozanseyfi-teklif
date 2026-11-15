/**
 * Tanıtım demo panelini örnek veriyle doldurur. YALNIZ demo kullanıcının kendi panelinde çalışır;
 * her çalıştırmada o paneldeki demo kayıtları silip yeniden oluşturur (şablonlara dokunmaz).
 *   node --env-file=.env scripts/tour/seed-demo.mjs
 * Önce: create-demo-user.mjs + demo hesapla bir kez giriş (profil/panel/şablonlar oluşsun).
 */
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const EMAIL = process.env.TOUR_DEMO_EMAIL;
if (!EMAIL) throw new Error("TOUR_DEMO_EMAIL yok");

const user = await prisma.profile.findFirst({ where: { email: EMAIL }, include: { organization: true } });
if (!user) throw new Error("Demo profil yok — önce demo hesapla bir kez giriş yapın");
const ORG = user.organizationId;
if (user.organization.ownerId !== user.id) throw new Error("Güvenlik: aktif panel demo kullanıcıya ait değil, durduruldu");
const memberCount = await prisma.organizationMember.count({ where: { organizationId: ORG } });
if (memberCount > 1) throw new Error("Güvenlik: demo panelde başka üyeler var, durduruldu");

const now = new Date();
const day = 86_400_000;
const ago = (d, h = 10) => new Date(now.getTime() - d * day + (h - now.getHours()) * 3_600_000);
const ahead = (d, h = 10, m = 0) => {
  const x = new Date(now.getTime() + d * day);
  x.setHours(h, m, 0, 0);
  return x;
};
const iso = (d) => d.toISOString().slice(0, 10);
/** Türkçe harfleri ASCII karşılığına çevirip e-posta alan adına uygun hale getirir. */
const slug = (s) => s.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]).replace(/[^a-z0-9]/g, "");
const cuid = () => "c" + crypto.randomBytes(12).toString("hex").slice(0, 24);

// ---------------------------------------------------------------- temizlik
await prisma.$transaction([
  prisma.notification.deleteMany({ where: { organizationId: ORG } }),
  prisma.calendarEvent.deleteMany({ where: { organizationId: ORG } }),
  prisma.costProject.deleteMany({ where: { organizationId: ORG } }),
  prisma.costVendor.deleteMany({ where: { organizationId: ORG } }),
  prisma.shareLink.deleteMany({ where: { organizationId: ORG } }),
  prisma.project.deleteMany({ where: { organizationId: ORG, isTemplate: false } }),
  prisma.materialCatalogItem.deleteMany({ where: { organizationId: ORG } }),
  prisma.auditLog.deleteMany({ where: { organizationId: ORG } }),
]);

await prisma.organization.update({
  where: { id: ORG },
  data: {
    name: "Demo Enerji Mühendislik A.Ş.",
    brandSettings: {
      color: "#059669",
      colorEnabled: true,
      slogan: "Güneşten enerji, mühendislikten güven",
      sloganEnabled: true,
      taxNumber: "1234567890",
      contact: "www.demoenerji.com.tr · 0312 000 00 00",
      payCompanyName: "DEMO ENERJİ MÜHENDİSLİK A.Ş.",
      payBankName: "Örnek Bankası",
      payIban: "TR00 0000 0000 0000 0000 0000 00",
    },
  },
});

// ---------------------------------------------------------------- anahtar teslim teklifler
const templates = await prisma.project.findMany({
  where: { organizationId: ORG, isTemplate: true },
  include: { projectDetail: true },
});
const tpl = (label) => {
  const t = templates.find((x) => x.templateLabel === label);
  if (!t) throw new Error(`Şablon yok: ${label}`);
  return t;
};

const TURNKEY = [
  { tpl: "5 MWp", name: "Karapınar 5 MWp Arazi GES", customer: "Anadolu Tarım Ürünleri A.Ş.", il: "Konya", ilce: "Karapınar", stage: "WON", created: 128, updated: 9 },
  { tpl: "10 MWp", name: "Polatlı 10 MWp Arazi GES", customer: "Bozkır Enerji Yatırım A.Ş.", il: "Ankara", ilce: "Polatlı", stage: "REVISED", created: 64, updated: 2 },
  { tpl: "500 kWp", name: "Manisa OSB Fabrika Çatı GES", customer: "Ege Tekstil San. ve Tic. A.Ş.", il: "Manisa", ilce: "Yunusemre", stage: "SENT", created: 41, updated: 4, roof: true },
  { tpl: "50 MWp", name: "Şahinbey 50 MWp Arazi GES", customer: "Güneydoğu Yatırım Holding", il: "Gaziantep", ilce: "Şahinbey", stage: "SENT", created: 33, updated: 6 },
  { tpl: "1 MWp", name: "İncesu 1 MWp Arazi GES", customer: "Erciyes Gıda Sanayi A.Ş.", il: "Kayseri", ilce: "İncesu", stage: "DRAFT", created: 12, updated: 1 },
  { tpl: "30 MWp", name: "Torbalı 30 MWp Arazi GES", customer: "Aksoy Holding A.Ş.", il: "İzmir", ilce: "Torbalı", stage: "LOST", created: 150, updated: 70, lost: "PRICE", competitor: "Batı Solar EPC" },
  { tpl: "25 kWp", name: "Kemer Otel Çatı GES", customer: "Akdeniz Otelcilik Ltd. Şti.", il: "Antalya", ilce: "Kemer", stage: "WON", created: 96, updated: 30, roof: true },
  { tpl: "10 MWp", name: "Bor 10 MWp Arazi GES", customer: "Niğde Tarım Kooperatifi", il: "Niğde", ilce: "Bor", stage: "DRAFT", created: 6, updated: 0 },
];

const INSIGHTS = {
  "Polatlı 10 MWp Arazi GES": ["Yatırım komitesi Huawei inverter tercih ediyor.", "Avans oranının %30'a düşürülmesini istiyor.", "Karar Aralık ayı yönetim kurulunda verilecek."],
  "Karapınar 5 MWp Arazi GES": ["Sulama pompaları için öz tüketim önceliği var.", "Bankası proje finansmanında yerli panel şartı arıyor."],
  "Manisa OSB Fabrika Çatı GES": ["Çatı statik raporu mevcut, trapez sac.", "Üretim duruşu istemiyor; montaj hafta sonu yapılmalı."],
  "Şahinbey 50 MWp Arazi GES": ["Birden fazla EPC'den teklif topluyor.", "Trafo merkezi bağlantı kapasitesi teyit edilecek."],
};
const created = {};
for (const [i, p] of TURNKEY.entries()) {
  const t = tpl(p.tpl);
  const d = t.projectDetail;
  const settings = {
    ...d.settings,
    projeAdi: p.name,
    isveren: p.customer,
    il: p.il,
    ilce: p.ilce,
    usd: 41.85,
    eur: 45.2,
    contingency: 3,
    genelGider: 4,
    netKar: 10 + (i % 3),
    krediFaiz: 38,
    mevduat: 32,
    baslangic: iso(ahead(30 + i * 7)),
    sure: p.roof ? 90 : 180,
    notes: ["Detay mühendislik aşamasında metraj farklılıkları olabilir.", "Fiyatlar teklif tarihindeki USD/TRY kuruyla hesaplanmıştır."],
    gesStep: 5,
    risks: ["Döviz kuru dalgalanması", "Panel tedarik süresi", "TEDAŞ bağlantı onay süreci"],
    customerInsights: INSIGHTS[p.name] ?? ["Karar sürecinde fiyat kadar teslim süresi de belirleyici."],
  };
  const proj = await prisma.project.create({
    data: {
      organizationId: ORG,
      createdById: user.id,
      name: p.name,
      customerName: p.customer,
      customerEmail: `satinalma@${slug(p.customer.split(" ")[0]) || "musteri"}.example`,
      customerPhone: "+90 312 000 00 0" + i,
      projectLocation: `${p.il} / ${p.ilce}`,
      installationType: t.installationType,
      systemSize: t.systemSize,
      electricityTariff: "INDUSTRIAL",
      status: p.stage === "WON" ? "COMPLETED" : "IN_PROGRESS",
      currentStep: 6,
      totalPowerKw: t.totalPowerKw,
      panelCount: t.panelCount,
      panelPowerWp: t.panelPowerWp,
      inverterCount: t.inverterCount,
      totalAreaM2: t.totalAreaM2,
      perimeterM: t.perimeterM,
      pipelineStage: p.stage,
      lostReason: p.lost ?? null,
      competitorName: p.competitor ?? null,
      createdAt: ago(p.created),
      updatedAt: ago(p.updated, 15),
      projectDetail: {
        create: { kesifA: d.kesifA, kesifB: d.kesifB, timeline: d.timeline, dor: d.dor, settings },
      },
    },
  });
  created[p.name] = proj;
}

// ---------------------------------------------------------------- malzeme kataloğu
const CATALOG = [
  ["MLZ0001", "Monokristal PV Panel 625 Wp", "adet", "MALZEME", 0.17 * 625, "USD"],
  ["MLZ0002", "String İnverter 110 kW", "adet", "MALZEME", 3150, "USD"],
  ["MLZ0003", "String İnverter 50 kW", "adet", "MALZEME", 1720, "USD"],
  ["MLZ0004", "Solar DC Kablo 6 mm²", "m", "MALZEME", 0.62, "USD"],
  ["MLZ0005", "AC Kablo NYY 4x50 mm²", "m", "MALZEME", 14.8, "USD"],
  ["MLZ0006", "Çatı Montaj Konstrüksiyonu (alüminyum)", "kWp", "MALZEME", 38, "USD"],
  ["MLZ0007", "MC4 Konnektör Takımı", "adet", "MALZEME", 1.1, "USD"],
  ["MLZ0008", "AG Dağıtım Panosu", "adet", "MALZEME", 2400, "EUR"],
  ["MLZ0009", "Enerji Analizörü", "adet", "MALZEME", 320, "EUR"],
  ["HZM0001", "Panel Montaj İşçiliği", "kWp", "HIZMET", 1450, "TRY"],
  ["HZM0002", "Elektrik Proje Çizimi ve Onay", "adet", "HIZMET", 85000, "TRY"],
  ["HZM0003", "Test ve Devreye Alma", "adet", "HIZMET", 60000, "TRY"],
  ["HZM0004", "Nakliye", "sefer", "HIZMET", 18000, "TRY"],
];
await prisma.materialCatalogItem.createMany({
  data: CATALOG.map(([code, name, unit, kind, lastUnitCost, currency]) => ({ organizationId: ORG, code, name, unit, kind, lastUnitCost, currency })),
});
const cat = Object.fromEntries(CATALOG.map((c) => [c[0], c]));
const qItem = (code, qty, marginPct, extra = {}) => {
  const [, name, unit, kind, unitCost, currency] = cat[code];
  return { id: cuid(), kind, code, name, unit, qty, currency, unitCost, marginPct, ...extra };
};

// ---------------------------------------------------------------- malzeme & hizmet teklifleri
const MS = [
  {
    name: "Eskişehir Fabrika Çatı — Malzeme Teklifi",
    customer: "Sakarya Makine Sanayi A.Ş.",
    loc: "Eskişehir / Odunpazarı",
    stage: "SENT",
    created: 20,
    updated: 3,
    items: [qItem("MLZ0001", 640, 12), qItem("MLZ0003", 7, 10), qItem("MLZ0004", 4200, 15), qItem("MLZ0006", 400, 12), qItem("MLZ0007", 180, 20), qItem("HZM0001", 400, 18), qItem("HZM0004", 3, 10), qItem("MLZ0009", 1, 15, { isOption: true })],
  },
  {
    name: "İnverter Değişimi ve Devreye Alma",
    customer: "Kuzey Tekstil Ltd. Şti.",
    loc: "Bursa / Nilüfer",
    stage: "WON",
    created: 55,
    updated: 25,
    items: [qItem("MLZ0002", 4, 9), qItem("MLZ0005", 120, 14), qItem("MLZ0008", 1, 12), qItem("HZM0003", 1, 20)],
  },
];
for (const [i, q] of MS.entries()) {
  const meta = {
    usd: 41.85,
    eur: 45.2,
    kdvRate: 20,
    outputCurrency: "TRY",
    quoteNo: `TKL-2026-${String(41 + i).padStart(4, "0")}`,
    quoteDate: iso(ago(q.updated)),
    validityDays: 30,
    notes: "Fiyatlara KDV dahil değildir. Teslim süresi sipariş onayından itibaren 4 haftadır.",
    paymentTerms: [
      { id: cuid(), percent: 40, method: "Havale", vade: "Sipariş ile", desc: "Avans", show: true },
      { id: cuid(), percent: 60, method: "Havale", vade: "Teslimde", desc: "Bakiye", show: true },
    ],
    customerName: q.customer,
    customerEmail: "satinalma@ornek.example",
    il: q.loc.split(" / ")[0],
    ilce: q.loc.split(" / ")[1],
    title: q.name,
    quoteStep: 3,
  };
  const proj = await prisma.project.create({
    data: {
      organizationId: ORG,
      createdById: user.id,
      name: q.name,
      customerName: q.customer,
      projectLocation: q.loc,
      quoteKind: "MATERIAL_SERVICE",
      status: q.stage === "WON" ? "COMPLETED" : "IN_PROGRESS",
      pipelineStage: q.stage,
      createdAt: ago(q.created),
      updatedAt: ago(q.updated, 14),
      projectDetail: {
        create: {
          quoteItems: q.items,
          settings: meta,
          quoteRevisions: [{ id: cuid(), label: "Revize 0", createdAt: ago(q.updated).toISOString(), items: q.items, meta }],
        },
      },
    },
  });
  created[q.name] = proj;
}

// ---------------------------------------------------------------- satış süreci aktiviteleri + paylaşım linkleri
const P1 = created["Karapınar 5 MWp Arazi GES"];
const P2 = created["Polatlı 10 MWp Arazi GES"];
const P3 = created["Manisa OSB Fabrika Çatı GES"];
const actor = { actorId: user.id, actorEmail: EMAIL, actorName: "Deniz Aydın" };
const token = () => crypto.randomBytes(18).toString("base64url");
const share1 = await prisma.shareLink.create({
  data: { token: token(), organizationId: ORG, projectId: P2.id, createdById: user.id, customerLabel: "Yatırımcı", recipientEmail: "yatirim@bozkir.example", includedTabs: ["firma", "referanslar", "priced-boq-summary", "boq-unpriced", "dor"], expiresAt: ahead(23), viewCount: 7, lastViewedAt: ago(1, 16), createdAt: ago(14) },
});
await prisma.shareLink.create({
  data: { token: token(), organizationId: ORG, projectId: P3.id, createdById: user.id, customerLabel: "Satınalma", includedTabs: ["firma", "priced-boq-detailed", "dor"], expiresAt: ahead(26), viewCount: 3, lastViewedAt: ago(2, 11), createdAt: ago(4) },
});
await prisma.shareLink.create({
  data: { token: token(), organizationId: ORG, projectId: P1.id, createdById: user.id, customerLabel: "Yönetim Kurulu", includedTabs: ["firma", "referanslar", "priced-boq-summary", "analiz"], expiresAt: ago(40), viewCount: 12, lastViewedAt: ago(45), createdAt: ago(75) },
});
const act = (projectId, type, daysAgo, message, extra = {}) => ({ projectId, organizationId: ORG, type, message, createdAt: ago(daysAgo, 11), ...extra });
await prisma.projectActivity.createMany({
  data: [
    act(P2.id, "STAGE_CHANGE", 14, "Taslak → Müşteriye Gönderildi", { ...actor, details: { from: "DRAFT", to: "SENT" } }),
    act(P2.id, "CUSTOMER_VIEWED", 13, null, { shareLinkId: share1.id, actorName: "Yatırımcı" }),
    act(P2.id, "PHONE_CALL", 9, "Mehmet Bey ile görüşüldü; trafo merkezi bağlantı mesafesi soruldu, teknik ekip dönüş yapacak.", actor),
    act(P2.id, "CUSTOMER_REVISION", 3, "Inverter markasının Huawei olarak revize edilmesini ve ödeme planında avansın %30'a düşürülmesini rica ediyoruz.", { shareLinkId: share1.id, actorName: "Mehmet Yıldız (Bozkır Enerji)" }),
    act(P2.id, "STAGE_CHANGE", 3, "Müşteriye Gönderildi → Revizyon İstendi", { details: { from: "SENT", to: "REVISED" } }),
    act(P2.id, "INTERNAL_NOTE", 2, "Revize teklif Cuma gününe kadar gönderilecek. Huawei fiyatı tedarikçiden istendi.", actor),
    act(P1.id, "STAGE_CHANGE", 75, "Taslak → Müşteriye Gönderildi", { ...actor, details: { from: "DRAFT", to: "SENT" } }),
    act(P1.id, "CUSTOMER_ACCEPTED", 60, "Teklifinizi onaylıyoruz, sözleşme taslağını bekliyoruz.", { actorName: "Ayşe Kaya (Anadolu Tarım)" }),
    act(P1.id, "STAGE_CHANGE", 60, "Müşteriye Gönderildi → Kazanıldı", { details: { from: "SENT", to: "WON" } }),
  ],
});

// ---------------------------------------------------------------- maliyet kontrol
const cats = await prisma.costCategoryDef.findMany({ where: { organizationId: ORG } });
if (!cats.length) {
  const DEF = [["A.1", "Panel"], ["A.2", "İnverter Sistemi"], ["A.3", "Taşıyıcı Sistem"], ["A.4", "Kablo - DC - AG - OG - ZA - Topraklama"], ["A.7", "OG Hücre - Trafo - Köşk"], ["A.13", "İşçilik - Makine - Ekipman"], ["A.16", "Nakliye - Gümrük"], ["B.6", "Proje Finans Maliyeti"]];
  await prisma.costCategoryDef.createMany({ data: DEF.map(([code, name], i) => ({ organizationId: ORG, code, name, isDefault: true, sortOrder: i })) });
}
const catBy = Object.fromEntries((await prisma.costCategoryDef.findMany({ where: { organizationId: ORG } })).map((c) => [c.code, c.id]));

const vendors = {};
for (const v of [
  ["Güneş Panel Dağıtım A.Ş.", "TR12 0001 0000 0000 0000 1111 11"],
  ["Anka İnverter Teknolojileri", "TR34 0002 0000 0000 0000 2222 22"],
  ["Demir Konstrüksiyon Ltd. Şti.", "TR56 0003 0000 0000 0000 3333 33"],
  ["Kablo Market Elektrik", "TR78 0004 0000 0000 0000 4444 44"],
  ["Yıldız Montaj ve İnşaat", "TR90 0005 0000 0000 0000 5555 55"],
  ["Hızlı Lojistik", "TR11 0006 0000 0000 0000 6666 66"],
]) {
  vendors[v[0]] = await prisma.costVendor.create({ data: { organizationId: ORG, name: v[0], payIban: v[1], payAccountName: v[0], bank: "Örnek Bankası", taxNo: String(1000000000 + Object.keys(vendors).length * 7919) } });
}
const V = (n) => vendors[n].id;

const cp = await prisma.costProject.create({
  data: {
    organizationId: ORG,
    createdById: user.id,
    name: "Karapınar 5 MWp Arazi GES",
    customer: "Anadolu Tarım Ürünleri A.Ş.",
    salesPrice: 168_500_000,
    salesCurrency: "TRY",
    salesVatRate: 20,
    salesInvoicedAmount: 168_500_000,
    plannedCostTotal: 141_000_000,
    startDate: ago(58),
    endDate: ahead(120),
    sourceProjectId: P1.id,
    createdAt: ago(58),
    lines: {
      create: [
        { categoryId: catBy["A.1"], code: "A.1.1", description: "PV Panel 625 Wp", brand: "Örnek Solar", model: "Mono PERC 625", unit: "adet", quantity: 8000, unitPrice: 106, currency: "USD", exchangeRate: 41.85, vendorId: V("Güneş Panel Dağıtım A.Ş."), sortOrder: 1, payments: { create: [{ amount: 21_293_280, paidDate: ago(50), method: "HAVALE", note: "Avans %50" }, { amount: 21_293_280, paidDate: ago(12), method: "HAVALE", note: "Sevkiyat" }] } },
        { categoryId: catBy["A.2"], code: "A.2.1", description: "String İnverter 250 kVA", brand: "Örnek", model: "SG250", unit: "adet", quantity: 20, unitPrice: 7250, currency: "USD", exchangeRate: 41.85, vendorId: V("Anka İnverter Teknolojileri"), sortOrder: 2, payments: { create: [{ amount: 3_000_000, paidDate: ago(30), method: "EFT", note: "Avans" }] } },
        { categoryId: catBy["A.3"], code: "A.3.1", description: "Arazi Montaj Konstrüksiyonu", unit: "MWp", quantity: 5, unitPrice: 31000, currency: "USD", exchangeRate: 41.85, vendorId: V("Demir Konstrüksiyon Ltd. Şti."), sortOrder: 3, payments: { create: [{ amount: 3_900_000, paidDate: ago(20), method: "HAVALE" }] } },
        { categoryId: catBy["A.4"], code: "A.4.1", description: "DC Solar Kablo 6 mm²", unit: "m", quantity: 60000, unitPrice: 26, currency: "TRY", vendorId: V("Kablo Market Elektrik"), sortOrder: 4 },
        { categoryId: catBy["A.13"], code: "A.13.1", description: "Mekanik ve Elektrik Montaj İşçiliği", unit: "kWp", quantity: 5000, unitPrice: 1450, currency: "TRY", vendorId: V("Yıldız Montaj ve İnşaat"), isInvoiced: false, sortOrder: 5, payments: { create: [{ amount: 1_500_000, paidDate: ago(6), method: "NAKIT", note: "1. hakediş" }] } },
        { categoryId: catBy["A.16"], code: "A.16.1", description: "Saha Nakliyesi", unit: "sefer", quantity: 24, unitPrice: 18000, currency: "TRY", vendorId: V("Hızlı Lojistik"), sortOrder: 6, payments: { create: [{ amount: 432_000, paidDate: ago(10), method: "EFT" }] } },
      ],
    },
    collections: {
      create: [
        { amount: 50_550_000, collectedDate: ago(55), note: "Avans %30" },
        { amount: 33_700_000, collectedDate: ago(15), note: "1. hakediş" },
        { amount: 42_125_000, collectedDate: ahead(20), isPlanned: true, note: "2. hakediş" },
        { amount: 42_125_000, collectedDate: ahead(75), isPlanned: true, note: "Kabul sonrası bakiye" },
      ],
    },
    partners: { create: [{ name: "Deniz Aydın", sharePercent: 60 }, { name: "Kerem Şahin", sharePercent: 40 }] },
  },
}).catch(async (e) => {
  // CostPartner alan adları farklıysa ortaksız oluştur
  if (!/partners|sharePct|Unknown arg/i.test(String(e))) throw e;
  console.warn("Ortak kaydı atlandı:", String(e).split("\n").slice(-2).join(" "));
  return null;
});
if (!cp) console.warn("Maliyet projesi ortaklarla oluşturulamadı; scripti CostPartner alanlarına göre düzeltin.");

await prisma.costProject.create({
  data: {
    organizationId: ORG,
    createdById: user.id,
    name: "Kemer Otel Çatı GES",
    customer: "Akdeniz Otelcilik Ltd. Şti.",
    salesPrice: 1_150_000,
    salesCurrency: "TRY",
    salesVatRate: 20,
    salesInvoicedAmount: 1_150_000,
    plannedCostTotal: 930_000,
    startDate: ago(28),
    status: "DONE",
    sourceProjectId: created["Kemer Otel Çatı GES"].id,
    lines: {
      create: [
        { categoryId: catBy["A.1"], code: "A.1.1", description: "PV Panel 625 Wp", unit: "adet", quantity: 40, unitPrice: 106, currency: "USD", exchangeRate: 41.85, vendorId: V("Güneş Panel Dağıtım A.Ş."), payments: { create: [{ amount: 212_800, paidDate: ago(25), method: "HAVALE" }] } },
        { categoryId: catBy["A.2"], code: "A.2.1", description: "String İnverter 25 kW", unit: "adet", quantity: 1, unitPrice: 1450, currency: "USD", exchangeRate: 41.85, vendorId: V("Anka İnverter Teknolojileri"), payments: { create: [{ amount: 72_800, paidDate: ago(25), method: "HAVALE" }] } },
        { categoryId: catBy["A.13"], code: "A.13.1", description: "Montaj İşçiliği", unit: "kWp", quantity: 25, unitPrice: 1450, currency: "TRY", vendorId: V("Yıldız Montaj ve İnşaat"), payments: { create: [{ amount: 36_250, paidDate: ago(8), method: "NAKIT" }] } },
      ],
    },
    collections: { create: [{ amount: 1_380_000, collectedDate: ago(5), note: "Tamamı" }] },
  },
});

// ---------------------------------------------------------------- takvim
const ev = (title, type, start, end, extra = {}) => ({ organizationId: ORG, createdById: user.id, title, type, startAt: start, endAt: end, ...extra });
const events = [
  ev("Bozkır Enerji — revize teklif sunumu", "TOPLANTI", ahead(1, 10), ahead(1, 11, 30), { location: "Ankara ofis", projectId: P2.id, priority: "YUKSEK" }),
  ev("Karapınar saha ziyareti", "ZIYARET", ahead(2, 9), ahead(2, 16), { location: "Konya / Karapınar", projectId: P1.id }),
  ev("Huawei fiyatını tedarikçiden al", "GOREV", ahead(0, 14), ahead(0, 14, 30), { projectId: P2.id }),
  ev("Ege Tekstil — teklif takip araması", "ARAMA", ahead(3, 11), ahead(3, 11, 20), { projectId: P3.id }),
  ev("TEDAŞ bağlantı başvurusu son gün", "TERMIN", ahead(6, 9), null, { allDay: true, priority: "YUKSEK", projectId: P1.id }),
  ev("Haftalık satış toplantısı", "TOPLANTI", ahead(4, 9, 30), ahead(4, 10, 30), { location: "Toplantı odası" }),
  ev("Panel sevkiyatı teslim kontrolü", "HATIRLATMA", ahead(8, 15), null, { projectId: P1.id }),
  ev("Erciyes Gıda keşif ziyareti", "ZIYARET", ahead(9, 10), ahead(9, 13), { location: "Kayseri / İncesu" }),
  ev("Solarex fuarı", "DIGER", ahead(13, 9), ahead(13, 18), { location: "İstanbul Fuar Merkezi" }),
  ev("Aylık maliyet raporu", "GOREV", ahead(-2, 16), ahead(-2, 17), { status: "TAMAMLANDI" }),
];
for (const e of events) {
  try {
    await prisma.calendarEvent.create({ data: { ...e, attendees: { create: [{ userId: user.id, status: "KABUL" }] } } });
  } catch (err) {
    // Enum değerleri farklıysa öncelik/durum alanlarını atla
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { priority, status, ...rest } = e;
    await prisma.calendarEvent.create({ data: rest }).catch(() => console.warn("Takvim etkinliği atlandı:", e.title, String(err).split("\n").pop()));
  }
}

// ---------------------------------------------------------------- bildirimler
await prisma.notification.createMany({
  data: [
    // Platform yalnız takvim bildirimleri üretir (hatırlatma, davet, değişiklik) — demo da yalnız bunları içerir.
    { organizationId: ORG, userId: user.id, type: "calendar_reminder", title: "Hatırlatma: Huawei fiyatını tedarikçiden al", body: `${ahead(0).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · 14:00`, link: "/takvim", createdAt: ago(0, 9) },
    { organizationId: ORG, userId: user.id, type: "calendar_invite", title: "Yeni davet: Bozkır Enerji — revize teklif sunumu", body: `${ahead(1).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · 10:00`, link: "/takvim", createdAt: ago(1, 16) },
    { organizationId: ORG, userId: user.id, type: "calendar_invite", title: "Yeni davet: Karapınar saha ziyareti", body: `${ahead(2).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · 09:00`, link: "/takvim", createdAt: ago(2, 11) },
    { organizationId: ORG, userId: user.id, type: "calendar_reminder", title: "Hatırlatma: Aylık maliyet raporu", body: `${ago(2).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · 16:00`, link: "/takvim", readAt: ago(2), createdAt: ago(2, 15) },
  ],
});

// ---------------------------------------------------------------- aktivite kayıtları (lib/audit-log.ts eylem anahtarları)
const au = (action, resourceType, p, daysAgo, details = {}, who = actor) => ({
  organizationId: ORG,
  actorId: who.actorId ?? null,
  actorEmail: who.actorEmail ?? null,
  actorName: who.actorName,
  action,
  resourceType,
  resourceId: p?.id ?? null,
  resourceName: p?.name ?? null,
  details,
  createdAt: ago(daysAgo, 9 + (daysAgo % 8)),
});
await prisma.auditLog.createMany({
  data: [
    au("create_project", "project", created["Bor 10 MWp Arazi GES"], 6),
    au("save_project_info", "project", created["Bor 10 MWp Arazi GES"], 6),
    au("save_teknik", "project", created["Bor 10 MWp Arazi GES"], 5, { dcGuc: 10, acGuc: 9.2 }),
    au("save_kesif_a", "project", created["Bor 10 MWp Arazi GES"], 4),
    au("customer_revision_request", "project", P2, 3, { customerName: "Mehmet Yıldız" }, { actorName: "Mehmet Yıldız (Bozkır Enerji)" }),
    au("update_pipeline_stage", "project", P2, 3, { from: "SENT", to: "REVISED" }),
    au("save_kesif_b", "project", P2, 2),
    au("create_share_link", "project", P3, 4, { tabs: ["firma", "priced-boq-detailed", "dor"] }),
    au("save_timeline", "project", created["İncesu 1 MWp Arazi GES"], 12),
    au("update_brand", "settings", null, 20, { slogan: true, color: "#059669" }),
    au("customer_accepted", "project", P1, 60, { customerName: "Ayşe Kaya" }, { actorName: "Ayşe Kaya (Anadolu Tarım)" }),
    au("mark_completed", "project", P1, 59),
  ],
});

// ---------------------------------------------------------------- not defteri
const nb = {
  companies: [
    { id: cuid(), name: "Bozkır Enerji Yatırım A.Ş.", segment: "Yatırımcı", city: "Ankara", phone: "+90 312 000 00 10", createdAt: ago(40).toISOString() },
    { id: cuid(), name: "Ege Tekstil San. ve Tic. A.Ş.", segment: "Sanayi", city: "Manisa", createdAt: ago(35).toISOString() },
    { id: cuid(), name: "Niğde Tarım Kooperatifi", segment: "Tarım / Sulama", city: "Niğde", createdAt: ago(7).toISOString() },
  ],
  contacts: [
    { id: cuid(), name: "Mehmet Yıldız", title: "Yatırım Direktörü", company: "Bozkır Enerji Yatırım A.Ş.", phone: "+90 532 000 00 01", email: "mehmet@bozkir.example" },
    { id: cuid(), name: "Selin Ak", title: "Satınalma Müdürü", company: "Ege Tekstil San. ve Tic. A.Ş.", email: "selin@egetekstil.example" },
    { id: cuid(), name: "Hasan Demir", title: "Kooperatif Başkanı", company: "Niğde Tarım Kooperatifi", phone: "+90 533 000 00 02" },
  ],
  notes: [
    {
      id: cuid(), title: "Polatlı 10 MWp — teknik değerlendirme", date: iso(ago(9)), startTime: "10:00", endTime: "11:30", type: "musteri",
      company: "Bozkır Enerji Yatırım A.Ş.", people: ["Mehmet Yıldız"], ourAttendees: "Deniz Aydın, Kerem Şahin", location: "Ankara",
      topics: [
        { subject: "İnverter seçimi", summary: "Müşteri Huawei tercih ediyor; mevcut teklifte Sungrow var.", decisions: ["Huawei ile revize fiyat çalışılacak"] },
        { subject: "Ödeme planı", summary: "Avansın %30'a düşürülmesi istendi.", decisions: ["Finans ile görüşülüp dönüş yapılacak"] },
      ],
      actions: [
        { what: "Huawei fiyatını tedarikçiden al", who: "Kerem Şahin", due: iso(ahead(0)), done: false },
        { what: "Revize teklifi gönder", who: "Deniz Aydın", due: iso(ahead(3)), done: false },
      ],
      tags: "revize, inverter", followUp: iso(ahead(3)), nextMeeting: iso(ahead(1)), pinned: true, createdAt: ago(9).toISOString(),
    },
    {
      id: cuid(), title: "Ege Tekstil — çatı keşfi", date: iso(ago(30)), type: "musteri", company: "Ege Tekstil San. ve Tic. A.Ş.", people: ["Selin Ak"],
      topics: [{ subject: "Çatı durumu", summary: "Trapez sac çatı, 4.200 m² kullanılabilir alan.", decisions: ["500 kWp ile teklif hazırlanacak"] }],
      actions: [{ what: "Statik rapor iste", who: "Deniz Aydın", due: iso(ago(25)), done: true }],
      tags: "çatı, keşif", createdAt: ago(30).toISOString(),
    },
    {
      id: cuid(), title: "Haftalık satış toplantısı", date: iso(ago(3)), type: "ic", people: [], ourAttendees: "Satış ekibi",
      topics: [{ subject: "Açık teklifler", summary: "4 teklif müşteride, 1 revizyon bekliyor.", decisions: ["Bor 10 MWp teklifi bu hafta tamamlanacak"] }],
      actions: [{ what: "Bor 10 MWp teklifini tamamla", who: "Deniz Aydın", due: iso(ahead(4)), done: false }],
      createdAt: ago(3).toISOString(),
    },
  ],
  tasks: [
    { id: cuid(), what: "Karapınar sözleşme eklerini gözden geçir", due: iso(ahead(2)), done: false, createdAt: ago(1).toISOString() },
    { id: cuid(), what: "Tedarikçi fiyat listesini güncelle", due: iso(ahead(5)), done: false, createdAt: ago(2).toISOString() },
    { id: cuid(), what: "Referans listesine Kemer projesini ekle", due: iso(ago(1)), done: true, createdAt: ago(6).toISOString() },
  ],
};
await prisma.notebook.upsert({
  where: { profileId: user.id },
  create: { profileId: user.id, organizationId: ORG, data: nb },
  update: { organizationId: ORG, data: nb },
});

console.log("Demo panel hazır:", ORG, Object.keys(created).length, "teklif");
await prisma.$disconnect();
