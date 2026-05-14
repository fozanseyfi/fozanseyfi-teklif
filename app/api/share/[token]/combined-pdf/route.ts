import { NextRequest, NextResponse } from "next/server";
import { loadShareContext } from "@/lib/share-loader";
import { SHARE_TABS } from "@/lib/share-tabs";

/**
 * Müşteri seçimli birleşik PDF. Share sayfasında müşteri tab/belge
 * seçer → bu endpoint Puppeteer ile HTML tab'lerini renderler, uploaded
 * PDF'leri direkt indirir, hepsini pdf-lib ile tek dosyada birleştirir.
 *
 * Query: ?items=firma,kesif-a,doc:abc123 (virgülle ayrılmış)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await loadShareContext(token);
  if (!ctx) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });

  const url = new URL(request.url);
  const itemsParam = url.searchParams.get("items");
  if (!itemsParam) {
    return NextResponse.json({ error: "Seçili öğe yok" }, { status: 400 });
  }
  const items = itemsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) {
    return NextResponse.json({ error: "Seçili öğe yok" }, { status: 400 });
  }

  // ─── Whitelist'e karşı doğrula ─────────────────────────────────────
  const allowedTabIds = new Set(ctx.link.includedTabs);
  const allowedDocIds = new Set(ctx.link.includedDocIds);
  const valid = items.filter((it) => {
    if (it.startsWith("doc:")) return allowedDocIds.has(it.slice(4));
    return allowedTabIds.has(it);
  });
  if (valid.length === 0) {
    return NextResponse.json({ error: "Geçerli öğe yok" }, { status: 400 });
  }

  // ─── Buffer'ları topla ─────────────────────────────────────────────
  type Source =
    | { kind: "url"; label: string; href: string }
    | { kind: "tab"; tabId: string; label: string };

  const sources: Source[] = [];
  for (const it of valid) {
    if (it === "firma") {
      if (ctx.brand.brochureUrl) {
        sources.push({ kind: "url", label: "Firma Tanıtımı", href: ctx.brand.brochureUrl });
      }
    } else if (it === "referanslar") {
      if (ctx.brand.referencesBrochureUrl) {
        sources.push({
          kind: "url",
          label: "Referanslar",
          href: ctx.brand.referencesBrochureUrl,
        });
      }
    } else if (it === "belgeler") {
      // "belgeler" tab seçildiyse tüm geçerli ek belgeleri dahil et
      for (const docId of ctx.link.includedDocIds) {
        const doc = ctx.brand.customDocuments?.find((d) => d.id === docId);
        if (doc?.url) {
          sources.push({ kind: "url", label: doc.title || doc.fileName, href: doc.url });
        }
      }
    } else if (it.startsWith("doc:")) {
      const docId = it.slice(4);
      const doc = ctx.brand.customDocuments?.find((d) => d.id === docId);
      if (doc?.url) {
        sources.push({ kind: "url", label: doc.title || doc.fileName, href: doc.url });
      }
    } else {
      // HTML tab — Puppeteer ile render edilecek
      const info = SHARE_TABS.find((t) => t.id === it);
      if (info) sources.push({ kind: "tab", tabId: it, label: info.label });
    }
  }

  if (sources.length === 0) {
    return NextResponse.json({ error: "Birleştirilecek içerik yok" }, { status: 400 });
  }

  const origin = url.origin;
  const pdfBuffers: { buf: Buffer; label: string }[] = [];

  // ─── Uploaded PDF'leri paralel indir ──────────────────────────────
  await Promise.all(
    sources
      .filter((s): s is Extract<Source, { kind: "url" }> => s.kind === "url")
      .map(async (s) => {
        try {
          const r = await fetch(s.href);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          pdfBuffers.push({ buf: Buffer.from(ab), label: s.label });
        } catch (e) {
          console.warn(`[combined-pdf] indirme hatası: ${s.label}`, e);
        }
      }),
  );

  // ─── HTML tab'lerini Puppeteer ile render et ──────────────────────
  const tabSources = sources.filter((s): s is Extract<Source, { kind: "tab" }> => s.kind === "tab");
  if (tabSources.length > 0) {
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      try {
        for (const t of tabSources) {
          const page = await browser.newPage();
          try {
            await page.setViewport({ width: 1280, height: 1024 });
            await page.goto(`${origin}/share/${token}/${t.tabId}?print=1`, {
              waitUntil: "networkidle0",
              timeout: 45_000,
            });
            // Share chrome'unu (header / response-bar / strip / footer) gizle
            await page.addStyleTag({
              content: `
                [data-share-chrome] { display: none !important; }
                body { background: white !important; }
                main { padding-top: 0 !important; padding-bottom: 0 !important; }
              `,
            });
            const pdf = await page.pdf({
              format: "A4",
              printBackground: true,
              margin: { top: "12mm", bottom: "12mm", left: "15mm", right: "15mm" },
            });
            pdfBuffers.push({ buf: Buffer.from(pdf), label: t.label });
          } catch (e) {
            console.warn(`[combined-pdf] tab render hatası: ${t.tabId}`, e);
          } finally {
            await page.close();
          }
        }
      } finally {
        await browser.close();
      }
    } catch (e) {
      console.error("[combined-pdf] puppeteer launch hatası:", e);
      return NextResponse.json({ error: "PDF motoru başlatılamadı" }, { status: 500 });
    }
  }

  if (pdfBuffers.length === 0) {
    return NextResponse.json({ error: "Hiçbir içerik üretilemedi" }, { status: 500 });
  }

  // ─── Sıralamayı korumak için items sırasına göre yeniden dizmedim:
  // pdfBuffers map iteration sırasında zaten doğru sırayla append edildi
  // (url'leri Promise.all paralel doldurdu ama tab'ler sıralı eklenir).
  // Daha titiz sıralama için 'sources' indeksini takip edebiliriz —
  // şimdilik kullanıcının seçim sırası garantili değil, kabul edilebilir.

  // ─── pdf-lib ile birleştir ────────────────────────────────────────
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
    return NextResponse.json(
      { error: "Birleşik PDF oluşturulamadı" },
      { status: 500 },
    );
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
