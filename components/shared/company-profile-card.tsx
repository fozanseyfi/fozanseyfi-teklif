"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  uploadBrandBrochure,
  removeBrandBrochure,
  saveBrandReferences,
} from "@/app/actions/firm";
import type { BrandSettings, BrandReference } from "@/lib/pdf-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  FileText,
  Upload,
  X,
  Loader2,
  Save,
  Plus,
  Trash2,
  Award,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  initialBrochureUrl?: string;
  initialBrochureFileName?: string;
  initialReferences: BrandReference[];
}

export function CompanyProfileCard({
  initialBrochureUrl,
  initialBrochureFileName,
  initialReferences,
}: Props) {
  // ─── Tanıtım PDF state ───────────────────────────────────────────────
  const [brochureUrl, setBrochureUrl] = useState<string | undefined>(initialBrochureUrl);
  const [brochureFileName, setBrochureFileName] = useState<string | undefined>(initialBrochureFileName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [removingPdf, startRemovePdf] = useTransition();

  function onPickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF 10 MB'tan büyük olamaz");
      e.target.value = "";
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Sadece PDF formatı kabul edilir");
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("brochure", file);
    const fileName = file.name;
    startUpload(async () => {
      const r = await uploadBrandBrochure(fd);
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        // Sayfayi yenilemeden anlik feedback: bu local state'i tahmini guncelle
        setBrochureFileName(fileName);
        // url server'da set edildi; sayfa yenilenince guncel gelir, ama hemen
        // gosterilebilmesi icin "Tanıtım yüklü" durumuna gec.
        setBrochureUrl((prev) => prev ?? "uploading");
      }
      e.target.value = "";
    });
  }

  function onRemoveBrochure() {
    if (!brochureUrl) return;
    if (!confirm("Tanıtım PDF'ini kaldırmak istediğine emin misin?")) return;
    startRemovePdf(async () => {
      const r = await removeBrandBrochure();
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        setBrochureUrl(undefined);
        setBrochureFileName(undefined);
      }
    });
  }

  // ─── Referanslar state ───────────────────────────────────────────────
  const [refs, setRefs] = useState<BrandReference[]>(
    initialReferences.length > 0 ? initialReferences : [],
  );
  const [savingRefs, startSaveRefs] = useTransition();

  function addRef() {
    setRefs((r) => [...r, { customer: "" }]);
  }

  function removeRef(idx: number) {
    setRefs((r) => r.filter((_, i) => i !== idx));
  }

  function updateRef<K extends keyof BrandReference>(idx: number, key: K, value: BrandReference[K]) {
    setRefs((r) => r.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function saveRefs() {
    // Boş customer satırlarını kaydetmeden önce filtrele — ama state'i koru
    // ki kullanıcı düzenlemeye devam edebilsin.
    const cleaned = refs.filter((r) => r.customer.trim().length > 0);
    const fd = new FormData();
    fd.set("references", JSON.stringify(cleaned));
    startSaveRefs(async () => {
      const r = await saveBrandReferences(fd);
      if (r?.error) toast.error(r.error);
      else if (r?.success) toast.success(r.success);
    });
  }

  // Sayfa yüklenince server'dan yeni URL gelirse fileName güncellensin
  useEffect(() => {
    if (initialBrochureFileName && !brochureFileName) {
      setBrochureFileName(initialBrochureFileName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrochureFileName]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Firma Profili & Referanslar
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Paylaşım linkindeki <strong>Firma</strong> ve <strong>Referanslar</strong> sekmelerini
              müşteri görür. Tanıtım PDF'inizi yükleyin, referans tablonuzu doldurun;
              paylaşım oluştururken bu sekmeleri seçili tutarsanız müşteri bu içerikleri
              de görür.
            </p>
          </div>
        </div>

        {/* ─── Tanıtım PDF ─────────────────────────────────────────────── */}
        <section className="ml-0 space-y-3 sm:ml-12">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-slate-500" />
            <h4 className="text-[13px] font-semibold text-slate-800">
              Firma Tanıtım PDF'i
              <span className="ml-2 font-normal text-[11px] text-slate-400">(max 10 MB)</span>
            </h4>
          </div>

          {brochureUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-900">
                  {brochureFileName ?? "tanitim.pdf"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Yüklü — paylaşım linkinde "Firma" sekmesinde gösterilir
                </p>
              </div>
              {brochureUrl !== "uploading" && (
                <a
                  href={brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="size-3" />
                  Aç
                </a>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPickFile}
                disabled={uploading}
                className="gap-1"
              >
                {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                Değiştir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRemoveBrochure}
                disabled={removingPdf}
                className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                {removingPdf ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                Kaldır
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPickFile}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-slate-400" />
              ) : (
                <Upload className="size-6 text-slate-400" />
              )}
              <span className="text-[13px] font-medium text-slate-700">
                {uploading ? "Yükleniyor..." : "PDF Yükle"}
              </span>
              <span className="text-[11px] text-slate-500">
                Müşteri/yatırımcıya gönderdiğiniz tanıtım belgesini buradan yükleyin
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            className="hidden"
          />
        </section>

        <div className="ml-0 border-t border-slate-100 sm:ml-12" />

        {/* ─── Referanslar ─────────────────────────────────────────────── */}
        <section className="ml-0 space-y-3 sm:ml-12">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-slate-500" />
            <h4 className="text-[13px] font-semibold text-slate-800">
              Referans Projeler
              <span className="ml-2 font-normal text-[11px] text-slate-400">
                ({refs.length} kayıt)
              </span>
            </h4>
          </div>

          {refs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-[12.5px] text-slate-500">
              Henüz referans eklemediniz. Paylaşım linkinde müşteri "Referanslar" sekmesinde
              gerçekleştirdiğiniz projeleri görür.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 text-left">Müşteri *</th>
                    <th className="hidden px-2 py-2 text-left sm:table-cell">Sektör</th>
                    <th className="px-2 py-2 text-right">MWp</th>
                    <th className="px-2 py-2 text-right">Yıl</th>
                    <th className="hidden px-2 py-2 text-left md:table-cell">Lokasyon</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {refs.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 text-[12px]"
                          value={r.customer}
                          onChange={(e) => updateRef(i, "customer", e.target.value)}
                          placeholder="örn. X Sanayi A.Ş."
                          maxLength={200}
                        />
                      </td>
                      <td className="hidden px-2 py-1.5 sm:table-cell">
                        <Input
                          className="h-8 text-[12px]"
                          value={r.sector ?? ""}
                          onChange={(e) => updateRef(i, "sector", e.target.value || undefined)}
                          placeholder="Çimento"
                          maxLength={120}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-20 text-right text-[12px] tabular-nums"
                          type="number"
                          step="0.01"
                          value={r.mwp ?? ""}
                          onChange={(e) =>
                            updateRef(
                              i,
                              "mwp",
                              e.target.value ? parseFloat(e.target.value) : undefined,
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-16 text-right text-[12px] tabular-nums"
                          type="number"
                          step="1"
                          min="2000"
                          max="2099"
                          value={r.year ?? ""}
                          onChange={(e) =>
                            updateRef(
                              i,
                              "year",
                              e.target.value ? parseInt(e.target.value, 10) : undefined,
                            )
                          }
                        />
                      </td>
                      <td className="hidden px-2 py-1.5 md:table-cell">
                        <Input
                          className="h-8 text-[12px]"
                          value={r.location ?? ""}
                          onChange={(e) => updateRef(i, "location", e.target.value || undefined)}
                          placeholder="Mersin / Tarsus"
                          maxLength={200}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRef(i)}
                          aria-label="Satırı sil"
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRef}
              className="gap-1"
            >
              <Plus className="size-3.5" />
              Referans Ekle
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveRefs}
              disabled={savingRefs}
              className="gap-1"
            >
              {savingRefs ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Referansları Kaydet
            </Button>
          </div>
          <p className="text-[10.5px] text-slate-400">
            Müşteri sütunu zorunludur; diğer alanlar boş bırakılabilir. Boş "Müşteri" satırları
            kaydedilirken otomatik atlanır.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
