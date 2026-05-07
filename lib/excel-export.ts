/**
 * Excel'e gercek tablo formatinda export.
 *
 * Strateji: HTML table'i Microsoft Office namespace'leri ile birlikte
 * .xls uzantili tek-dosya olarak indiriyoruz. Excel acildiginda HTML'i
 * formatli sheet olarak gosterir; hucre kenarliklari, kalin yazi, renk,
 * sayisal hizalama hepsi korunur. CSV gibi duz metin degil — gercek
 * formatli tablo.
 */
export function downloadExcel(filename: string, html: string) {
  const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Sheet1</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; mso-displayed-decimal-separator: "\\,"; mso-displayed-thousand-separator: "\\."; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: middle; font-family: Calibri, Arial, sans-serif; }
    th { background-color: #1e293b; color: #ffffff; font-weight: 700; text-align: left; }
    .group-row { background-color: #ecfdf5; font-weight: 700; color: #047857; }
    .item-row { background-color: #ffffff; }
    .item-row.alt { background-color: #f8fafc; }
    .num { text-align: right; mso-number-format: "#,##0\\.00"; }
    .int { text-align: right; mso-number-format: "#,##0"; }
    .center { text-align: center; }
    .total-row { background-color: #fef3c7; font-weight: 700; }
    .grand-total { background-color: #d1fae5; font-weight: 700; font-size: 14px; color: #047857; }
    .dim { color: #64748b; }
  </style>
</head>
<body>${html}</body>
</html>`;
  // BOM karakteri + utf-16-le encode trick'i — TR karakterler için
  const blob = new Blob(["﻿" + fullHtml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
