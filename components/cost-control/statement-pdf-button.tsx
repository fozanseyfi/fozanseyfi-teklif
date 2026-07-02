"use client";

import { FileDown } from "lucide-react";
import { buildStatementPrintHtml, type StatementPrintInput } from "@/lib/cost-statement-print";
import { qrSvgMarkup } from "@/lib/qr";

/** Public ekstre sayfasında "PDF indir" — tarayıcı yazdır ile PDF üretir. */
export function StatementPdfButton({ input }: { input: StatementPrintInput }) {
  function download() {
    const qrSvg = input.linkUrl ? qrSvgMarkup(input.linkUrl) : undefined;
    const html = buildStatementPrintHtml({ ...input, qrSvg });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
    >
      <FileDown className="size-4" /> PDF İndir
    </button>
  );
}
