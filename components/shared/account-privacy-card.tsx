"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteMyAccount, exportMyData } from "@/app/actions/account";

/**
 * KVKK / GDPR uyumlu hesap yönetimi kartı — Profilim sayfasında.
 *
 * - Veri indirme: JSON formatında profil + üyelik + proje + audit log
 * - Hesap silme: çift onay gerekir (text input "SİL" yazılmalı)
 */
export function AccountPrivacyCard({ userEmail }: { userEmail: string }) {
  const [downloading, startDownload] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, startDelete] = useTransition();

  function handleDownload() {
    startDownload(async () => {
      const r = await exportMyData();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (!r.data) {
        toast.error("Veri alınamadı");
        return;
      }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verilerim-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Veri indirildi");
    });
  }

  function handleDelete() {
    if (confirmText !== "SİL") {
      toast.error("Silmek için kutuya büyük harflerle SİL yazın");
      return;
    }
    startDelete(async () => {
      const r = await deleteMyAccount();
      if (r?.error) {
        toast.error(r.error);
      }
      // Başarılıysa redirect kendi yapar; toast'a gerek yok.
    });
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Shield className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Hesap & Gizlilik (KVKK)
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              KVKK / GDPR kapsamında: kendi verilerinizi JSON olarak indirebilir,
              hesabınızı kalıcı olarak silebilirsiniz. Hesap silme geri alınamaz.
            </p>
          </div>
        </div>

        {/* Veri indir */}
        <div className="ml-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:ml-12">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">Verilerimi İndir</p>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Profil bilgisi, üyelikler, oluşturduğunuz projeler ve denetim kayıtlarınızdan
              oluşan bir JSON dosyası.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="gap-1.5"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            JSON İndir
          </Button>
        </div>

        {/* Hesap silme */}
        <div className="ml-0 rounded-lg border border-rose-200 bg-rose-50/30 p-4 sm:ml-12">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-rose-900">Hesabımı Sil</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-rose-700">
                <strong>{userEmail}</strong> hesabına ait profil ve üyelikleriniz kalıcı
                olarak silinir. Oluşturduğunuz projeler organizasyonunuzda kalır (sahibi
                boş işaretlenir). Bu işlem <strong>geri alınamaz</strong>.
              </p>

              {!showDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDelete(true)}
                  className="mt-3 gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="size-4" />
                  Hesabımı Silmek İstiyorum
                </Button>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-rose-800">
                    Onaylamak için kutuya{" "}
                    <strong className="font-mono">SİL</strong> yazın:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SİL"
                    className="w-full max-w-xs rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-mono font-semibold uppercase text-rose-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDelete(false);
                        setConfirmText("");
                      }}
                      disabled={deleting}
                    >
                      Vazgeç
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting || confirmText !== "SİL"}
                      className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700"
                    >
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Hesabımı Kalıcı Olarak Sil
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
