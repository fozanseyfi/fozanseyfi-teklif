"use client";

import { FileDown } from "lucide-react";
import { buildStatementPrintHtml, type StatementPrintInput } from "@/lib/cost-statement-print";

/** Public ekstre sayfasında "PDF indir" — tarayıcı yazdır ile PDF üretir. */
export function StatementPdfButton({ input }: { input: StatementPrintInput }) {
  function download() {
    const html = buildStatementPrintHtml(input);
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
