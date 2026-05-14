"use client";

import { useState, useRef } from "react";
import { read, utils, write } from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
  FileDown,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createProjectFromImport } from "@/app/actions/project-import";

// Excel'de aranacak başlık alias'ları → bizim alan adımıza eşleme.
// Auto-detect bu listeyi tarar; eşleşme bulamazsa kullanıcı manuel atar.
const HEADER_ALIASES: Record<string, string[]> = {
  groupCode: ["grup kodu", "grupkodu", "group code", "kod", "group"],
  groupName: ["grup adı", "grup adi", "grup", "kategori", "group name"],
  code: ["kalem kodu", "kalem kod", "item code", "alt kod", "kod no"],
  tanim: ["tanım", "tanim", "açıklama", "aciklama", "description", "malzeme", "item"],
  tip: ["tip", "model", "type"],
  marka: ["marka", "üretici", "uretici", "brand", "manufacturer"],
  birim: ["birim", "unit", "ölçü", "olcu"],
  miktar: ["miktar", "adet", "quantity", "qty"],
  rawFiyat: ["birim fiyat", "fiyat", "unit price", "price", "ücret", "ucret"],
  fiyatCur: ["para birimi", "para", "currency", "döviz", "doviz"],
};

type Field = keyof typeof HEADER_ALIASES;
const FIELD_LABELS: Record<Field, string> = {
  groupCode: "Grup Kodu (A.1)",
  groupName: "Grup Adı",
  code: "Kalem Kodu (A.1.1)",
  tanim: "Tanım *",
  tip: "Tip/Model",
  marka: "Marka",
  birim: "Birim *",
  miktar: "Miktar *",
  rawFiyat: "Birim Fiyat *",
  fiyatCur: "Para Birimi",
};

interface ParsedRow {
  values: Record<string, string | number>;
  rawIndex: number;
}

export function ProjectImportClient() {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<Field, string>>>({});
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [installationType, setInstallationType] = useState<"ROOFTOP" | "GROUND_MOUNTED">("ROOFTOP");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        if (json.length === 0) {
          toast.error("Excel boş — en az 1 veri satırı olmalı");
          return;
        }

        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);

        // Auto-detect mapping
        const autoMapping: Partial<Record<Field, string>> = {};
        for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
          for (const hdr of hdrs) {
            const hdrLower = hdr.toLowerCase().trim();
            if (aliases.some((a) => hdrLower === a || hdrLower.includes(a))) {
              autoMapping[field as Field] = hdr;
              break;
            }
          }
        }
        setMapping(autoMapping);

        const parsed: ParsedRow[] = json.map((r, i) => ({
          values: r as Record<string, string | number>,
          rawIndex: i,
        }));
        setRows(parsed);
        setStep("preview");
        toast.success(`${parsed.length} satır okundu — eşlemeleri kontrol et`);
      } catch (err) {
        console.error(err);
        toast.error("Excel okunamadı — dosya bozuk veya format desteklenmiyor");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function downloadTemplate() {
    // 1 örnek satır içeren basit şablon. Kullanıcı doldurup geri yükler.
    const sampleData = [
      {
        "Grup Kodu": "A.1",
        "Grup Adı": "Panel",
        "Kalem Kodu": "A.1.1",
        "Tanım": "Solar Panel",
        "Tip": "SPE625-132GGT",
        "Marka": "Elin",
        "Birim": "Wp",
        "Miktar": 1000000,
        "Birim Fiyat": 0.185,
        "Para Birimi": "USD",
      },
      {
        "Grup Kodu": "A.2",
        "Grup Adı": "İnverter",
        "Kalem Kodu": "A.2.1",
        "Tanım": "String İnverter",
        "Tip": "SUN2000-100KTL",
        "Marka": "Huawei",
        "Birim": "adet",
        "Miktar": 10,
        "Birim Fiyat": 4500,
        "Para Birimi": "USD",
      },
      {
        "Grup Kodu": "B.1",
        "Grup Adı": "Montaj İşçilik",
        "Kalem Kodu": "B.1.1",
        "Tanım": "Panel Montaj İşçilik",
        "Tip": "",
        "Marka": "",
        "Birim": "MW",
        "Miktar": 1,
        "Birim Fiyat": 25000,
        "Para Birimi": "USD",
      },
    ];
    const ws = utils.json_to_sheet(sampleData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Kesif");
    const buf = write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teklif-platformu-proje-sablonu.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    if (!projectName.trim()) {
      toast.error("Proje adı zorunlu");
      return;
    }

    // Zorunlu alan kontrolü
    const required: Field[] = ["tanim", "birim", "miktar", "rawFiyat"];
    for (const f of required) {
      if (!mapping[f]) {
        toast.error(`${FIELD_LABELS[f]} kolonunu eşle`);
        return;
      }
    }

    // Satırları structured ImportedItem'a dönüştür
    const items: Array<{
      groupCode: string;
      groupName: string;
      code: string;
      tanim: string;
      tip?: string;
      marka?: string;
      birim: string;
      miktar: number;
      rawFiyat: number;
      fiyatCur: "USD" | "EUR" | "TRY";
      notlar?: string;
    }> = [];

    let skipped = 0;
    let autoGroupIdx = 1;
    for (const r of rows) {
      const tanim = String(r.values[mapping.tanim!] ?? "").trim();
      const miktarRaw = r.values[mapping.miktar!];
      const fiyatRaw = r.values[mapping.rawFiyat!];
      const birim = String(r.values[mapping.birim!] ?? "").trim();

      if (!tanim || !birim) {
        skipped++;
        continue;
      }
      const miktar = parseFloat(String(miktarRaw).replace(",", "."));
      const rawFiyat = parseFloat(String(fiyatRaw).replace(",", "."));
      if (isNaN(miktar) || isNaN(rawFiyat)) {
        skipped++;
        continue;
      }

      const groupCode =
        (mapping.groupCode && String(r.values[mapping.groupCode] ?? "").trim()) ||
        `A.${autoGroupIdx}`;
      const groupName =
        (mapping.groupName && String(r.values[mapping.groupName] ?? "").trim()) ||
        groupCode;
      const code =
        (mapping.code && String(r.values[mapping.code] ?? "").trim()) ||
        `${groupCode}.${items.filter((i) => i.groupCode === groupCode).length + 1}`;

      let fiyatCur: "USD" | "EUR" | "TRY" = "USD";
      const curRaw = (mapping.fiyatCur && String(r.values[mapping.fiyatCur] ?? "").trim().toUpperCase()) || "";
      if (curRaw === "EUR" || curRaw === "€") fiyatCur = "EUR";
      else if (curRaw === "TRY" || curRaw === "TL" || curRaw === "₺") fiyatCur = "TRY";

      items.push({
        groupCode,
        groupName,
        code,
        tanim,
        tip: mapping.tip ? String(r.values[mapping.tip] ?? "") : "",
        marka: mapping.marka ? String(r.values[mapping.marka] ?? "") : "",
        birim,
        miktar,
        rawFiyat,
        fiyatCur,
      });
    }

    if (items.length === 0) {
      toast.error("Geçerli satır bulunamadı — eşlemeleri kontrol et");
      return;
    }

    setSubmitting(true);
    toast.info(`${items.length} kalem ile proje oluşturuluyor...`);

    try {
      await createProjectFromImport({
        projectName: projectName.trim(),
        customerName: customerName.trim(),
        projectLocation: projectLocation.trim(),
        installationType,
        items,
      });
      // Server action redirect ediyor — buraya gelinmez
    } catch (e) {
      // redirect() bir error gibi davranır next.js'te — error mesajı
      // "NEXT_REDIRECT" içeriyorsa yutmak gerekir
      const msg = (e as Error)?.message ?? "";
      if (msg.includes("NEXT_REDIRECT")) return;
      console.error(e);
      toast.error("Proje oluşturulamadı");
      setSubmitting(false);
    }
  }

  // ─── UPLOAD STEP ───────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-7 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
              <Upload className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">
                Toplu İçe Aktarım
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                Excel'den Proje Yükle
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                Eski projelerini ya da elindeki BoQ listelerini Excel'den
                doğrudan içe aktar — sayfa otomatik kolon eşler, sen önizler kaydedersin.
              </p>
            </div>
          </div>
        </div>

        {/* Nasıl Çalışır */}
        <Card className="border-emerald-200/60">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-emerald-600" />
              Nasıl Çalışır?
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ol className="space-y-3 text-[13px]">
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  1
                </span>
                <div className="min-w-0">
                  <strong className="text-slate-900">Şablonumuzu indir</strong>
                  <span className="text-slate-600">
                    {" "}— sabit kolonlu bir Excel. Doldurup geri yükleyince eşleme
                    gerekmez. <span className="text-slate-500 italic">Veya:</span>{" "}
                    kendi Excel'in varsa direkt onu sürükle, sayfa kolonları
                    otomatik tanımaya çalışır.
                  </span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  2
                </span>
                <div className="min-w-0">
                  <strong className="text-slate-900">Önizleme + eşleme</strong>
                  <span className="text-slate-600">
                    {" "}— ilk satırlarını gösteririz. Kolonlar otomatik eşlenir;
                    farklı isim kullandıysan dropdown'lardan düzeltebilirsin.
                    Zorunlu alanlar:{" "}
                    <em className="font-semibold">Tanım, Birim, Miktar, Birim Fiyat</em>.
                  </span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  3
                </span>
                <div className="min-w-0">
                  <strong className="text-slate-900">Proje bilgilerini yaz</strong>
                  <span className="text-slate-600">
                    {" "}— proje adı, müşteri ve lokasyon. Kalemler{" "}
                    <strong>A.x</strong> kodluysa Keşif-A'ya,{" "}
                    <strong>B.x</strong> kodluysa Keşif-B'ye otomatik dağıtılır.
                  </span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  4
                </span>
                <div className="min-w-0">
                  <strong className="text-slate-900">İçe Aktar</strong>
                  <span className="text-slate-600">
                    {" "}— yeni proje açılır, detay sayfasında kalemler yerinde,
                    Teknik tab'tan güç/kur değerlerini girip teklifini bitirebilirsin.
                  </span>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* İki yol */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          {/* Yol 1: Şablon */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileDown className="size-4 text-emerald-600" />
                Şablonumuzu Kullan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-[13px] text-slate-600">
                Önerilen yol — şablonu indir, içini doldur, geri yükle. Kolonlar
                doğru yerlerde olduğu için eşleme adımı atlanır.
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="size-4" />
                Excel Şablonunu İndir
              </Button>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3 text-[11.5px] text-slate-600">
                <strong className="text-slate-800">İçerik:</strong> Grup Kodu,
                Grup Adı, Kalem Kodu, Tanım, Tip, Marka, Birim, Miktar, Birim Fiyat,
                Para Birimi. 3 örnek satır dolu.
              </div>
            </CardContent>
          </Card>

          {/* Yol 2: Drag-drop */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="size-4 text-emerald-600" />
                Kendi Excel'ini Yükle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/40 px-6 py-10 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/30"
              >
                <Upload className="size-8 text-slate-400" />
                <p className="text-[13px] font-semibold text-slate-800">
                  Excel'i buraya sürükle
                </p>
                <p className="text-[11px] text-slate-500">
                  veya dosya seçmek için tıkla — .xlsx, .xls, .csv
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/40 p-2.5 text-[11.5px] text-amber-800">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Tarayıcıda parse edilir — dosya hiçbir yere yüklenmez,{" "}
                  <strong>onayladıktan sonra</strong> sunucuya gider.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── PREVIEW STEP ──────────────────────────────────────────────────
  const requiredFields: Field[] = ["tanim", "birim", "miktar", "rawFiyat"];
  const optionalFields: Field[] = ["groupCode", "groupName", "code", "tip", "marka", "fiyatCur"];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Önizleme & Eşleme</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <FileSpreadsheet className="mr-1 inline size-3.5" />
            <strong className="text-slate-700">{fileName}</strong> · {rows.length} satır okundu
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <X className="size-4" />
          Vazgeç
        </Button>
      </div>

      {/* Proje meta + Mapping yan yana */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        {/* Proje meta */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Proje Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label>Proje Adı *</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Örnek: 2.5 MWp Çatı GES Projesi"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Müşteri</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Müşteri firma adı"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Lokasyon</Label>
              <Input
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                placeholder="Şehir / İlçe"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Kurulum Tipi</Label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInstallationType("ROOFTOP")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                    installationType === "ROOFTOP"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  Çatı GES
                </button>
                <button
                  type="button"
                  onClick={() => setInstallationType("GROUND_MOUNTED")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                    installationType === "GROUND_MOUNTED"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  Arazi GES
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mapping */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Kolon Eşleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <p className="mb-2 text-[11.5px] text-slate-500">
              <Sparkles className="mr-1 inline size-3 text-emerald-600" />
              Otomatik eşlenenler tik ile işaretlendi. Eksikleri dropdown'dan
              seç. Zorunlular yıldızlı (*).
            </p>
            <div className="space-y-1.5 text-[12.5px]">
              {[...requiredFields, ...optionalFields].map((f) => {
                const isRequired = requiredFields.includes(f);
                const matched = !!mapping[f];
                return (
                  <div key={f} className="grid grid-cols-[140px_1fr_24px] items-center gap-2">
                    <Label className="text-[12px] text-slate-700">
                      {FIELD_LABELS[f]}
                    </Label>
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) =>
                        setMapping((p) => ({
                          ...p,
                          [f]: e.target.value || undefined,
                        }))
                      }
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-[12.5px] outline-none",
                        isRequired && !matched
                          ? "border-rose-300 bg-rose-50/30 text-rose-700"
                          : "border-slate-200",
                      )}
                    >
                      <option value="">(Eşlenmedi)</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {matched ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : isRequired ? (
                      <AlertTriangle className="size-4 text-rose-500" />
                    ) : (
                      <span className="size-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Veri Önizleme */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Veri Önizleme ({rows.length} satır)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-600">
              <tr>
                {headers.map((h) => {
                  const mappedField = Object.entries(mapping).find(([, v]) => v === h)?.[0] as Field | undefined;
                  return (
                    <th key={h} className="px-3 py-2 text-left font-semibold">
                      <div>{h}</div>
                      {mappedField && (
                        <div className="mt-0.5 text-[9.5px] font-normal text-emerald-700">
                          → {FIELD_LABELS[mappedField]}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  {headers.map((h) => (
                    <td key={h} className="px-3 py-2 text-slate-700">
                      {String(r.values[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <div className="border-t bg-slate-50/40 px-3 py-2 text-center text-[11px] text-slate-500">
              … {rows.length - 10} satır daha. Tümü içe aktarılacak.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={reset} disabled={submitting}>
          Geri Dön
        </Button>
        <Button onClick={handleImport} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          İçe Aktar & Proje Oluştur
        </Button>
      </div>
    </div>
  );
}
