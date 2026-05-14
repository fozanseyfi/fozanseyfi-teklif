import { NextRequest, NextResponse } from "next/server";
import { loadShareContext } from "@/lib/share-loader";
import { resolveBrand } from "@/lib/pdf-brand";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings, DorGroup, TimelineData } from "@/lib/ges-defaults";
import { buildKesifPrintHtml } from "@/lib/share-print/kesif";
import { buildDorPrintHtml } from "@/lib/share-print/dor";
import { buildBoqPrintHtml } from "@/lib/share-print/boq";
import {
  buildPricedBoqSummaryHtml,
  buildPricedBoqDetailedHtml,
} from "@/lib/share-print/priced-boq";
import { buildAnalizPrintHtml } from "@/components/ges/analiz-print";

/**
 * Müşteri seçimli birleşik PDF — paylaşımda gözüken HER tab'in kendi orijinal
 * "PDF İndir" şablonuyla aynı çıktıyı server-side üretir, uploaded PDF'lerle
 * birlikte pdf-lib ile tek dosyada birleştirir.
 *
 * Her tab kendi başlığını korur — pdf-lib dokümanları birbirine
 * karıştırmadan, her birinin kendi sayfalarıyla ekler. Birinin bittiği
 * yerde diğerinin ilk sayfası başlar.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await loadShareContext(token);
  if (!ctx) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });

  const brandCtx = resolveBrand(ctx.brand);
  // Public share kullanıcının (müşterinin) emaili yok — branding footer'da
  // boş geçer, "by <firma>" görünür.
  const userEmail = "";
  const projectName = ctx.project.name || "Proje";

  const kesifA = (ctx.detail.kesifA as unknown as KesifGroup[]) ?? [];
  const kesifB = (ctx.detail.kesifB as unknown as KesifGroup[]) ?? [];
  const settings = (ctx.detail.settings as unknown as GesSettings) ?? ({} as GesSettings);
  const dorGroups = (ctx.detail.dor as unknown as DorGroup[]) ?? [];
  const timeline = (ctx.detail.timeline as unknown as TimelineData) ?? ({} as TimelineData);
  const result = calc(kesifA, kesifB, settings);

  // Sıralı oluşturma listesi — tab order'ı SHARE_TABS sırasıyla aynı
  type Source =
    | { kind: "html"; label: string; html: string }
    | { kind: "url"; label: string; href: string };

  const sources: Source[] = [];
  const tabIds = ctx.link.includedTabs;

  // --- 1) Firma Tanıtımı (uploaded PDF) ---
  if (tabIds.includes("firma") && ctx.brand.brochureUrl) {
    sources.push({ kind: "url", label: "Firma Tanıtımı", href: ctx.brand.brochureUrl });
  }

  // --- 2) Referanslar (uploaded PDF) ---
  if (tabIds.includes("referanslar") && ctx.brand.referencesBrochureUrl) {
    sources.push({
      kind: "url",
      label: "Referanslar",
      href: ctx.brand.referencesBrochureUrl,
    });
  }

  // --- 3) Keşif-A ---
  if (tabIds.includes("kesif-a") && kesifA.length > 0) {
    sources.push({
      kind: "html",
      label: "Keşif-A",
      html: buildKesifPrintHtml({
        title: "Keşif-A — Mal Listesi",
        groups: kesifA,
        settings,
        grandTotal: result.kaTotal,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
      }),
    });
  }

  // --- 4) Keşif-B ---
  if (tabIds.includes("kesif-b") && kesifB.length > 0) {
    sources.push({
      kind: "html",
      label: "Keşif-B",
      html: buildKesifPrintHtml({
        title: "Keşif-B — İşçilik & Sair Maliyetler",
        groups: kesifB,
        settings,
        grandTotal: result.kbTotal,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
      }),
    });
  }

  // --- 5) BoQ (fiyatsız) ---
  if (tabIds.includes("boq-unpriced")) {
    sources.push({
      kind: "html",
      label: "Fiyatsız BoQ",
      html: buildBoqPrintHtml({
        project: ctx.project,
        projectName,
        kesifA,
        kesifB,
        settings,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
        showPrices: false,
      }),
    });
  }

  // --- 6) BoQ (fiyatlı) ---
  if (tabIds.includes("boq-priced")) {
    sources.push({
      kind: "html",
      label: "Fiyatlı BoQ",
      html: buildBoqPrintHtml({
        project: ctx.project,
        projectName,
        kesifA,
        kesifB,
        settings,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
        showPrices: true,
      }),
    });
  }

  // --- 7) Birim Fiyat Cetveli — Özet ---
  if (tabIds.includes("priced-boq-summary")) {
    sources.push({
      kind: "html",
      label: "Birim Fiyat Cetveli — Özet",
      html: buildPricedBoqSummaryHtml({
        project: ctx.project,
        projectName,
        kesifA,
        kesifB,
        settings,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
      }),
    });
  }

  // --- 8) Birim Fiyat Cetveli — Detaylı ---
  if (tabIds.includes("priced-boq-detailed")) {
    sources.push({
      kind: "html",
      label: "Birim Fiyat Cetveli — Detaylı",
      html: buildPricedBoqDetailedHtml({
        project: ctx.project,
        projectName,
        kesifA,
        kesifB,
        settings,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
      }),
    });
  }

  // --- 9) Analiz ---
  if (tabIds.includes("analiz")) {
    sources.push({
      kind: "html",
      label: "Analiz",
      html: buildAnalizPrintHtml({
        project: ctx.project,
        settings,
        kesifA,
        kesifB,
        timeline,
        firmName: ctx.firmName,
        brand: ctx.brand,
        userEmail,
      }),
    });
  }

  // --- 10) DoR ---
  if (tabIds.includes("dor") && dorGroups.length > 0) {
    sources.push({
      kind: "html",
      label: "DoR",
      html: buildDorPrintHtml({
        projectName,
        groups: dorGroups,
        brand: brandCtx,
        firmName: ctx.firmName,
        userEmail,
      }),
    });
  }

  // --- 11) Ek belgeler (her biri uploaded PDF) ---
  for (const docId of ctx.link.includedDocIds) {
    const doc = ctx.brand.customDocuments?.find((d) => d.id === docId);
    if (doc?.url) {
      sources.push({ kind: "url", label: doc.title || doc.fileName, href: doc.url });
    }
  }

  if (sources.length === 0) {
    return NextResponse.json({ error: "Birleştirilecek içerik yok" }, { status: 400 });
  }

  // ─── PDF buffer'larını topla (sıra korunur) ──────────────────────
  const pdfBuffers: { buf: Buffer; label: string }[] = [];

  // HTML kaynaklarını Puppeteer ile render et — tek browser instance,
  // sırayla page açıp PDF al
  const htmlSources = sources.filter((s): s is Extract<Source, { kind: "html" }> => s.kind === "html");
  const browser =
    htmlSources.length > 0
      ? await (await import("puppeteer")).default.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        })
      : null;

  try {
    for (const s of sources) {
      if (s.kind === "url") {
        try {
          const r = await fetch(s.href);
          if (r.ok) {
            const ab = await r.arrayBuffer();
            pdfBuffers.push({ buf: Buffer.from(ab), label: s.label });
          } else {
            console.warn(`[combined-pdf] indirme HTTP ${r.status}: ${s.label}`);
          }
        } catch (e) {
          console.warn(`[combined-pdf] indirme hatası: ${s.label}`, e);
        }
      } else if (s.kind === "html" && browser) {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: 1280, height: 1024 });
          await page.setContent(s.html, { waitUntil: "networkidle0", timeout: 45_000 });
          const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
          });
          pdfBuffers.push({ buf: Buffer.from(pdf), label: s.label });
        } catch (e) {
          console.warn(`[combined-pdf] render hatası: ${s.label}`, e);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  if (pdfBuffers.length === 0) {
    return NextResponse.json({ error: "Hiçbir içerik üretilemedi" }, { status: 500 });
  }

  // ─── pdf-lib ile sıralı birleştir ─────────────────────────────────
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const { buf, label } of pdfBuffers) {
    try {
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch (e) {
      console.warn(`[combined-pdf] merge hatası (${label}):`, e);
    }
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json({ error: "Birleşik PDF oluşturulamadı" }, { status: 500 });
  }

  const mergedBytes = await merged.save();
  const fileName = ctx.project.name
    ? `teklif-paketi-${ctx.project.name.replace(/[^\w-]+/g, "-")}.pdf`
    : "teklif-paketi.pdf";

  return new NextResponse(Buffer.from(mergedBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
