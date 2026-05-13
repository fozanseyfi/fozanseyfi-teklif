"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  uploadBrandBrochure,
  removeBrandBrochure,
  uploadReferencesBrochure,
  removeReferencesBrochure,
  uploadCustomDocument,
  removeCustomDocument,
} from "@/app/actions/firm";
import type { BrandDocument } from "@/lib/pdf-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  FileText,
  Upload,
  X,
  Loader2,
  Plus,
  Trash2,
  Award,
  ExternalLink,
  Files,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  initialBrochureUrl?: string;
  initialBrochureFileName?: string;
  initialReferencesBrochureUrl?: string;
  initialReferencesBrochureFileName?: string;
  initialCustomDocuments: BrandDocument[];
}

const MAX_CUSTOM_DOCS = 10;

export function CompanyProfileCard({
  initialBrochureUrl,
  initialBrochureFileName,
  initialReferencesBrochureUrl,
  initialReferencesBrochureFileName,
  initialCustomDocuments,
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
        setBrochureFileName(fileName);
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

  // ─── Referans PDF state ──────────────────────────────────────────────
  const [refPdfUrl, setRefPdfUrl] = useState<string | undefined>(initialReferencesBrochureUrl);
  const [refPdfFileName, setRefPdfFileName] = useState<string | undefined>(initialReferencesBrochureFileName);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRef, startUploadRef] = useTransition();
  const [removingRefPdf, startRemoveRefPdf] = useTransition();

  function onPickRefFile() {
    refFileInputRef.current?.click();
  }

  function onRefFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    startUploadRef(async () => {
      const r = await uploadReferencesBrochure(fd);
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        setRefPdfFileName(fileName);
        setRefPdfUrl((prev) => prev ?? "uploading");
      }
      e.target.value = "";
    });
  }

  function onRemoveRefPdf() {
    if (!refPdfUrl) return;
    if (!confirm("Referans PDF'ini kaldırmak istediğine emin misin?")) return;
    startRemoveRefPdf(async () => {
      const r = await removeReferencesBrochure();
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        setRefPdfUrl(undefined);
        setRefPdfFileName(undefined);
      }
    });
  }


  // Sayfa yüklenince server'dan yeni URL gelirse fileName güncellensin
  useEffect(() => {
    if (initialBrochureFileName && !brochureFileName) {
      setBrochureFileName(initialBrochureFileName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrochureFileName]);

  // ─── Ek Belgeler state ───────────────────────────────────────────────
  const [customDocs, setCustomDocs] = useState<BrandDocument[]>(initialCustomDocuments);
  const [docTitle, setDocTitle] = useState("");
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, startUploadDoc] = useTransition();
  const [removingDocId, setRemovingDocId] = useState<string | null>(null);
  const [removingDoc, startRemoveDoc] = useTransition();

  function onPickDocFile() {
    if (!docTitle.trim()) {
      toast.error("Önce belge başlığını yaz");
      return;
    }
    docFileInputRef.current?.click();
  }

  function onDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    fd.append("title", docTitle.trim());
    fd.append("file", file);
    startUploadDoc(async () => {
      const r = await uploadCustomDocument(fd);
      if (r?.error) toast.error(r.error);
      else if (r?.success && r.documentId) {
        toast.success(r.success);
        // Optimistic append; server-driven URL ileride revalidate ile gelir,
        // şimdilik placeholder url ile dolduralım — gerçek URL revalidate
        // sonrası ortaya çıkar (sayfa yenilenir).
        setCustomDocs((prev) => [
          ...prev,
          {
            id: r.documentId!,
            title: docTitle.trim(),
            url: "uploading",
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        ]);
        setDocTitle("");
      }
      e.target.value = "";
    });
  }

  function onRemoveDoc(docId: string) {
    if (!confirm("Bu belgeyi kaldırmak istediğine emin misin? Paylaşılan linklerden de kaldırılacak.")) return;
    setRemovingDocId(docId);
    startRemoveDoc(async () => {
      const r = await removeCustomDocument(docId);
      if (r?.error) toast.error(r.error);
      else if (r?.success) {
        toast.success(r.success);
        setCustomDocs((prev) => prev.filter((d) => d.id !== docId));
      }
      setRemovingDocId(null);
    });
  }

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
        <section className="ml-0 space-y-4 sm:ml-12">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-slate-500" />
            <h4 className="text-[13px] font-semibold text-slate-800">
              Referanslar
              <span className="ml-2 font-normal text-[11px] text-slate-400">
                PDF (max 10 MB)
              </span>
            </h4>
          </div>

          {/* Referans PDF upload */}
          <div className="space-y-2">
            {refPdfUrl ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">
                    {refPdfFileName ?? "referanslar.pdf"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">
                    Yüklü — paylaşımda Referanslar sekmesinde gösterilir
                  </p>
                </div>
                {refPdfUrl !== "uploading" && (
                  <a
                    href={refPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="size-3" />
                    Aç
                  </a>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPickRefFile}
                  disabled={uploadingRef}
                  className="gap-1"
                >
                  {uploadingRef ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                  Değiştir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRemoveRefPdf}
                  disabled={removingRefPdf}
                  className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  {removingRefPdf ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                  Kaldır
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onPickRefFile}
                disabled={uploadingRef}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-4 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 disabled:opacity-50"
              >
                {uploadingRef ? (
                  <Loader2 className="size-5 animate-spin text-slate-400" />
                ) : (
                  <Upload className="size-5 text-slate-400" />
                )}
                <span className="text-[12px] font-medium text-slate-700">
                  {uploadingRef ? "Yükleniyor..." : "Referans PDF'i Yükle"}
                </span>
                <span className="text-[10.5px] text-slate-500">
                  Şirket içi referans belgenizi PDF olarak yükleyin
                </span>
              </button>
            )}
            <input
              ref={refFileInputRef}
              type="file"
              accept="application/pdf"
              onChange={onRefFileChange}
              className="hidden"
            />
          </div>

        </section>

        <div className="ml-0 border-t border-slate-100 sm:ml-12" />

        {/* ─── Ek Belgeler ────────────────────────────────────────────── */}
        <section className="ml-0 space-y-3 sm:ml-12">
          <div className="flex items-center gap-2">
            <Files className="size-4 text-slate-500" />
            <h4 className="text-[13px] font-semibold text-slate-800">
              Ek Belgeler
              <span className="ml-2 font-normal text-[11px] text-slate-400">
                ({customDocs.length} / {MAX_CUSTOM_DOCS}) — sertifika, katalog, garanti vb.
              </span>
            </h4>
          </div>

          {/* Mevcut belgeler */}
          {customDocs.length > 0 ? (
            <ul className="space-y-2">
              {customDocs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-slate-900">
                      {d.title}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-slate-500">
                      {d.fileName}
                    </p>
                  </div>
                  {d.url !== "uploading" && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="size-3" />
                      Aç
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveDoc(d.id)}
                    disabled={removingDoc && removingDocId === d.id}
                    className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    {removingDoc && removingDocId === d.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    Sil
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11.5px] text-slate-500">
              Henüz ek belge yok. Aşağıdan yeni belge ekleyebilirsin.
            </p>
          )}

          {/* Yeni belge ekleme formu — limit dolmadıysa */}
          {customDocs.length < MAX_CUSTOM_DOCS && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3">
              <div className="grid gap-2 sm:grid-cols-[2fr_auto]">
                <Input
                  type="text"
                  placeholder="Belge başlığı (örn. ISO 9001 Sertifikası)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  maxLength={120}
                  disabled={uploadingDoc}
                  className="text-[12.5px]"
                />
                <Button
                  type="button"
                  onClick={onPickDocFile}
                  disabled={uploadingDoc || !docTitle.trim()}
                  className="gap-1.5"
                >
                  {uploadingDoc ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  PDF Seç & Yükle
                </Button>
              </div>
              <p className="mt-2 text-[10.5px] text-slate-500">
                Önce başlık yaz, sonra PDF seç (max 10 MB). Eklediğin belgeler paylaşım
                oluştururken seçenek olarak görünür.
              </p>
              <input
                ref={docFileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onDocFileChange}
                className="hidden"
              />
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
