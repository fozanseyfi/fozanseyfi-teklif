"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, LandPlot, Save, FileText, FileType2, Download, Package, Table2, RefreshCw, FileCheck2, Upload, Trash2, Briefcase, Wrench } from "lucide-react";
import { saveSozlesme, uploadSignedContract, removeSignedContract } from "@/app/actions/sozlesme";
import {
  getTemplate,
  fieldKey,
  isOptionalField,
  SOZLESME_TURS,
  type SozlesmeTur,
  type SozlesmeData,
  type SozlesmeField,
  type SozlesmeDoc,
} from "@/lib/sozlesme/schema";
import { docList, finalDocText, computedAmount } from "@/lib/sozlesme/render";
import { useDirtyTracker } from "@/lib/unsaved-changes";

/** Nihai metni düzgün belge görünümünde (salt okunur) render eder. */
function PreviewDoc({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-md border border-border bg-white px-6 py-5 text-slate-800 shadow-inner">
      <div className="mx-auto max-w-2xl space-y-0.5">
        {lines.map((raw, i) => {
          const t = raw.trim();
          if (!t) return <div key={i} className="h-2.5" />;
          const upper = t === t.toLocaleUpperCase("tr-TR") && /[A-ZÇĞİÖŞÜ]/.test(t);
          // Ana başlık (belge/bölüm adı)
          if (upper && t.length < 90 && /^(EK-|ÇATI|ARAZİ|ANAHTAR|SÖZLEŞME|PROJE|EKLER|TEMİNAT|PERFORMANS|SORUMLULUK|ONAYLI|KABUL)/.test(t)) {
            return <p key={i} className="mt-3 border-b border-slate-200 pb-1 text-center text-[14px] font-bold tracking-wide text-slate-900">{t}</p>;
          }
          if (/^MADDE\b/i.test(t)) {
            return <p key={i} className="mt-3 text-[13px] font-bold text-slate-900">{t}</p>;
          }
          // Bölüm başlığı (A. / (A) / 1. …)
          if (/^(\([A-Ga-g]\)|[A-G]\.|\d+(\.\d+)*\.?)\s/.test(t) && t.length < 90) {
            return <p key={i} className="mt-2 text-[12.5px] font-semibold text-slate-900">{t}</p>;
          }
          // "Etiket: değer" alan satırı
          const fm = raw.match(/^(\s*)([^:]{2,60}):\s*(.*)$/);
          if (fm) {
            const [, indent, label, val] = fm;
            const isSub = indent.length >= 6 || /^→/.test(label.trim());
            const empty = /^[…\s]*$/.test(val);
            return (
              <p key={i} className={cn("flex flex-wrap gap-x-2 text-[12.5px] leading-relaxed", isSub ? "pl-6" : "pl-1")}>
                <span className="text-slate-500">{label.trim()}:</span>
                <span className={cn("font-medium", empty ? "text-slate-300" : "text-slate-900")}>{empty ? "—" : val}</span>
              </p>
            );
          }
          return <p key={i} className="pl-1 text-[12px] leading-relaxed text-slate-700">{t}</p>;
        })}
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
  projectName: string;
  canEdit: boolean;
  tur: SozlesmeTur;
  autofill: Record<string, string>;
  saved: SozlesmeData | null;
  staticTexts: Record<string, string>;
  signed: { name: string; uploadedAt: string } | null;
}

const TUR_META: { tur: SozlesmeTur; label: string; icon: typeof Sun }[] = [
  { tur: "cati", label: "Çatı GES", icon: Sun },
  { tur: "arazi", label: "Arazi GES", icon: LandPlot },
  { tur: "malzeme", label: "Malzeme", icon: Package },
  { tur: "hizmet", label: "Hizmet", icon: Briefcase },
  { tur: "iscilik", label: "İşçilik", icon: Wrench },
];

function buildInitialValues(saved: SozlesmeData | null, autofill: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = { ...(saved?.values || {}) };
  SOZLESME_TURS.forEach((t) => {
    getTemplate(t).docs.forEach((doc) => {
      doc.sections.forEach((sec) => {
        sec.fields.forEach((f) => {
          const k = fieldKey(doc.id, f.key);
          if (f.autofill && !values[k] && autofill[f.autofill]) values[k] = autofill[f.autofill];
        });
      });
    });
  });
  return values;
}

export function SozlesmeEditor({ projectId, projectName, canEdit, tur, autofill, saved, staticTexts, signed }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(saved, autofill));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [signedLocal, setSignedLocal] = useState(signed);
  const [uploading, setUploading] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  useDirtyTracker(dirty);

  const template = getTemplate(tur);
  const list = docList(template);
  const [activeId, setActiveId] = useState<string>(list[0]?.id ?? "");
  const [docView, setDocView] = useState<"form" | "metin">("form");

  const meta = list.find((d) => d.id === activeId) ?? list[0];
  const formDoc: SozlesmeDoc | undefined = meta?.kind === "form" ? template.docs.find((d) => d.id === meta.id) : undefined;
  const effectiveView: "form" | "metin" = meta?.kind === "static" ? "metin" : docView;

  const setVal = (docId: string, key: string, v: string) => { setValues((p) => ({ ...p, [fieldKey(docId, key)]: v })); setDirty(true); };
  const getVal = (docId: string, key: string) => values[fieldKey(docId, key)] ?? "";

  // Zorunlu (opsiyonel olmayan) EK-1 alanlarından boş olanlar.
  const ek1 = template.docs.find((d) => d.id === "ek1");
  const missingRequired = ek1
    ? ek1.sections.flatMap((s) => s.fields).filter((f) => !isOptionalField(f) && !(values[fieldKey("ek1", f.key)] ?? "").trim())
    : [];
  const isReqEmpty = (docId: string, f: SozlesmeField) => docId === "ek1" && !isOptionalField(f) && !getVal(docId, f.key).trim();
  const previewText = meta ? finalDocText(tur, meta, values, {}, staticTexts) : "";

  // Önizleme = dolu .docx'in gerçek görüntüsü (mammoth ile HTML). Yazarken değil,
  // sekmeye/belgeye girince veya "Yenile" ile çekilir.
  const loadPreview = useCallback(
    async (docId: string) => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/docx/sozlesme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, tur, docId, format: "html", values }),
        });
        const data = await res.json();
        setPreviewHtml(res.ok ? data.html || "" : null);
      } catch {
        setPreviewHtml(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    // values dahil → önizleme her zaman GÜNCEL form değerleriyle çekilir
    [projectId, tur, values],
  );

  useEffect(() => {
    if (effectiveView !== "metin") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- önizlemeyi sunucudan çek (dış sistem senkronizasyonu)
    loadPreview(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, effectiveView, tur]);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveSozlesme(projectId, { tur, values });
      setDirty(false);
      if (missingRequired.length > 0) {
        toast.warning(`Kaydedildi — ancak ${missingRequired.length} zorunlu alan (EK-1) boş. Lütfen tamamlayın.`);
      } else {
        toast.success("Sözleşme kaydedildi");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function download(docId?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/docx/sozlesme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, tur, projectName, docId: docId ?? "all", values }),
      });
      if (!res.ok) {
        toast.error("Word oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = (projectName || "sozlesme").replace(/[^\w.-]+/g, "_").slice(0, 40);
      a.href = url;
      a.download = docId
        ? `${safe}_${docId}.docx`
        : `${safe}_${tur === "cati" ? "Cati" : "Arazi"}_GES_Sozlesme.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("İndirme başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function onPickSigned(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadSignedContract(projectId, fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success(r.success ?? "Yüklendi");
        setSignedLocal({ name: file.name, uploadedAt: new Date().toISOString() });
        setPdfKey((k) => k + 1);
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveSigned() {
    if (!confirm("İmzalı sözleşme kaldırılsın mı?")) return;
    const r = await removeSignedContract(projectId);
    if (r.error) toast.error(r.error);
    else {
      toast.success(r.success ?? "Kaldırıldı");
      setSignedLocal(null);
      router.refresh();
    }
  }

  const isImzali = activeId === "imzali";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/sozlesmeler" className="text-[12px] text-muted-foreground hover:text-foreground">
          ← Sözleşmeler
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{projectName}</h1>
        </div>
        {(() => {
          const tm = TUR_META.find((t) => t.tur === tur);
          const Icon = tm?.icon ?? FileText;
          return (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-[12px] font-semibold text-primary-soft-foreground">
              <Icon className="size-3.5" /> {tm?.label ?? "Sözleşme"}
            </span>
          );
        })()}
        {canEdit && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => download()} disabled={busy}>
          <Package className="size-4" /> Tümünü indir (ZIP)
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {list.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveId(d.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors",
              activeId === d.id ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft",
            )}
          >
            <FileText className="size-3.5" /> {d.ek ? `${d.ek} · ` : ""}{d.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveId("imzali")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors",
            isImzali ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          )}
        >
          <FileCheck2 className="size-3.5" /> İmzalı Sözleşme{signedLocal ? " ✓" : ""}
        </button>
      </div>

      {isImzali && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
              <h2 className="mr-auto text-[14px] font-semibold text-foreground">İmzalı Sözleşme (tek tarama PDF)</h2>
              {canEdit && (
                <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-[12px] font-semibold hover:bg-muted", uploading && "pointer-events-none opacity-60")}>
                  <Upload className="size-4" /> {uploading ? "Yükleniyor…" : signedLocal ? "Yeni yükle" : "PDF yükle"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={onPickSigned} />
                </label>
              )}
              {canEdit && signedLocal && (
                <Button size="sm" variant="ghost" onClick={onRemoveSigned}>
                  <Trash2 className="size-4" /> Kaldır
                </Button>
              )}
            </div>

            {signedLocal ? (
              <div className="space-y-2">
                <p className="text-[11.5px] text-muted-foreground">
                  {signedLocal.name} · yüklendi {new Date(signedLocal.uploadedAt).toLocaleString("tr-TR")}
                </p>
                <iframe
                  key={pdfKey}
                  src={`/api/sozlesme/imzali?projectId=${projectId}&v=${pdfKey}#view=FitH`}
                  title="İmzalı Sözleşme"
                  style={{ height: "min(85vh, 1100px)", minHeight: 700 }}
                  className="w-full rounded-md border border-border bg-slate-100"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-14 text-center">
                <FileCheck2 className="size-8 text-muted-foreground/60" />
                <p className="text-[13px] font-medium text-foreground">Henüz imzalı sözleşme yüklenmedi</p>
                <p className="max-w-sm text-[11.5px] text-muted-foreground">
                  Islak/e-imzalı sözleşmenin <b>tümünü tek PDF</b> (ana metin + ekler, tek tarama) olarak yükleyin;
                  burada sayfa sayfa görüntülenir.
                </p>
                {canEdit && (
                  <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
                    <Upload className="size-4" /> PDF seç
                    <input type="file" accept="application/pdf" className="hidden" onChange={onPickSigned} />
                  </label>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isImzali && meta && (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
              <h2 className="mr-auto text-[14px] font-semibold text-foreground">
                {meta.ek ? `${meta.ek} · ` : ""}{meta.title}
              </h2>
              {meta.kind === "form" && (
                <div className="flex items-center gap-1 rounded-md border border-border/60 p-0.5">
                  <button type="button" onClick={() => setDocView("form")} className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium", effectiveView === "form" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                    <Table2 className="size-3.5" /> Form
                  </button>
                  <button type="button" onClick={() => setDocView("metin")} className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium", effectiveView === "metin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                    <FileType2 className="size-3.5" /> Önizleme
                  </button>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => download(meta.id)} disabled={busy}>
                <Download className="size-4" /> Bu belgeyi indir
              </Button>
            </div>

            {effectiveView === "form" && formDoc ? (
              <div className="space-y-5">
                {formDoc.id === "ek1" && missingRequired.length > 0 && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
                    <b>{missingRequired.length}</b> zorunlu alan boş (kırmızı işaretli). Sözleşme bilgilerinin tamamını doldurun; opsiyonel/“varsa” alanlar hariç.
                  </p>
                )}
                {formDoc.sections.map((sec) => (
                  <div key={sec.title}>
                    <h3 className="mb-2 text-[13px] font-semibold text-foreground">{sec.title}</h3>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                      {sec.fields.map((f: SozlesmeField) => {
                        const amount = computedAmount(formDoc, f, values);
                        const required = formDoc.id === "ek1" && !isOptionalField(f);
                        const invalid = isReqEmpty(formDoc.id, f);
                        const inputCls = cn(
                          "w-full rounded-md border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-primary disabled:opacity-60",
                          invalid ? "border-rose-400 ring-1 ring-rose-200" : "border-border",
                        );
                        return (
                          <div key={f.key} className={cn("min-w-0", f.full && "sm:col-span-2")}>
                            <label className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                              {f.label}{f.suffix ? ` (${f.suffix})` : ""}{required && <span className="ml-0.5 text-rose-500">*</span>}
                            </label>
                            {f.type === "textarea" ? (
                              <textarea value={getVal(formDoc.id, f.key)} onChange={(e) => setVal(formDoc.id, f.key, e.target.value)} disabled={!canEdit} rows={2} className={cn(inputCls, "resize-y")} />
                            ) : f.type === "select" ? (
                              <select value={getVal(formDoc.id, f.key)} onChange={(e) => setVal(formDoc.id, f.key, e.target.value)} disabled={!canEdit} className={inputCls}>
                                {(f.options ?? []).map((o) => (<option key={o} value={o}>{o || "—"}</option>))}
                              </select>
                            ) : (
                              <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} value={getVal(formDoc.id, f.key)} onChange={(e) => setVal(formDoc.id, f.key, e.target.value)} disabled={!canEdit} className={inputCls} />
                            )}
                            {amount && <p className="mt-0.5 text-[11px] text-primary">Tutar ≈ {amount}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="mr-auto text-[11.5px] text-muted-foreground">
                    Word belgesinin birebir önizlemesi (dolu, orijinal biçim). İndirince aynısı .docx olarak gelir.
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => loadPreview(activeId)} disabled={previewLoading}>
                    <RefreshCw className={cn("size-3.5", previewLoading && "animate-spin")} /> Yenile
                  </Button>
                </div>
                {previewLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-md border border-border bg-muted/20 text-[12px] text-muted-foreground">
                    Önizleme hazırlanıyor…
                  </div>
                ) : previewHtml != null ? (
                  <div className="sozlesme-preview max-h-[74vh] overflow-y-auto rounded-md border border-border bg-slate-100 p-4 sm:p-6">
                    <div
                      className="mx-auto max-w-[820px] bg-white px-10 py-12 text-[13px] leading-relaxed text-slate-800 shadow-md"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                ) : (
                  <PreviewDoc text={previewText} />
                )}
                <style>{`
                  .sozlesme-preview table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                  .sozlesme-preview td, .sozlesme-preview th { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; font-size: 12.5px; }
                  .sozlesme-preview th { background: #eef1f7; font-weight: 600; }
                  .sozlesme-preview h1 { font-size: 17px; font-weight: 700; text-align: center; margin: 6px 0; }
                  .sozlesme-preview h2 { font-size: 14px; font-weight: 700; margin: 14px 0 6px; }
                  .sozlesme-preview h3 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
                  .sozlesme-preview p { margin: 5px 0; }
                  .sozlesme-preview strong { font-weight: 600; }
                `}</style>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
