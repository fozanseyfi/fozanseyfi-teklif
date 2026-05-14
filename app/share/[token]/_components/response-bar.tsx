"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, HelpCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitShareResponse } from "@/app/actions/share-response";
import type { CustomerResponseKind } from "@/lib/email";
import type { BrandSettings } from "@/lib/pdf-brand";

interface Props {
  token: string;
  brand: BrandSettings;
  // Bu paylaşım için bir önceki müşteri yanıtı varsa: tekrar göstermemek için.
  alreadyResponded: { kind: CustomerResponseKind; at: string } | null;
}

const KIND_LABELS: Record<CustomerResponseKind, string> = {
  accept: "Onayla",
  revision: "Revizyon İste",
  question: "Soru Sor",
};

const KIND_TITLES: Record<CustomerResponseKind, string> = {
  accept: "Teklifi Onayla",
  revision: "Revizyon İste",
  question: "Soru Sor",
};

const KIND_DESCRIPTIONS: Record<CustomerResponseKind, string> = {
  accept:
    "Bu teklifi onayladığınıza dair tercihiniz proje sahibine bildirilecek. İsterseniz adınızı ve kısa bir not ekleyebilirsiniz.",
  revision:
    "Hangi noktaların revize edilmesini istediğinizi yazın. Proje sahibi en kısa sürede dönüş yapacak.",
  question:
    "Sormak istediğiniz noktaları yazın. Proje sahibi yanıt verecek.",
};

const PREVIOUS_LABELS: Record<CustomerResponseKind, string> = {
  accept: "Bu teklif onaylandı olarak işaretlendi",
  revision: "Bu teklif için revizyon istendi",
  question: "Bu teklif için soru iletildi",
};

export function ShareResponseBar({ token, brand, alreadyResponded }: Props) {
  const [openKind, setOpenKind] = useState<CustomerResponseKind | null>(null);
  const accent = brand.colorEnabled && brand.color ? brand.color : "#059669";

  if (alreadyResponded) {
    const date = new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(alreadyResponded.at));
    return (
      <div
        data-share-chrome="response"
        className="sticky bottom-0 z-20 mx-auto max-w-[1440px] border-t-2 border-emerald-200 bg-emerald-50/95 px-4 py-3 text-center backdrop-blur-md sm:px-6 lg:px-8"
        style={{ borderTopColor: `${accent}55` }}
      >
        <p className="text-[12.5px] font-semibold text-emerald-800">
          <CheckCircle2 className="mr-1 inline size-4" style={{ color: accent }} />
          {PREVIOUS_LABELS[alreadyResponded.kind]}
          <span className="ml-2 text-[11px] font-normal text-emerald-700/80">
            · {date}
          </span>
        </p>
        <p className="mt-0.5 text-[10.5px] text-emerald-700/70">
          İlave soru veya talep için proje sahibine iletişim kurabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        data-share-chrome="response"
        className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] font-medium text-slate-600">
            Teklifle ilgili kararınız:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenKind("question")}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
            >
              <HelpCircle className="size-3.5" />
              Soru Sor
            </button>
            <button
              type="button"
              onClick={() => setOpenKind("revision")}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              <RotateCcw className="size-3.5" />
              Revizyon İste
            </button>
            <button
              type="button"
              onClick={() => setOpenKind("accept")}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <CheckCircle2 className="size-3.5" />
              Onayla
            </button>
          </div>
        </div>
      </div>

      {openKind && (
        <ResponseModal
          token={token}
          kind={openKind}
          accent={accent}
          onClose={() => setOpenKind(null)}
        />
      )}
    </>
  );
}

function ResponseModal({
  token,
  kind,
  accent,
  onClose,
}: {
  token: string;
  kind: CustomerResponseKind;
  accent: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const messageRequired = kind !== "accept";

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Ad Soyad zorunludur");
      return;
    }
    if (messageRequired && !message.trim()) {
      toast.error("Lütfen mesaj yazın");
      return;
    }
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("email", email.trim());
    fd.set("phone", phone.trim());
    fd.set("message", message.trim());

    startTransition(async () => {
      const result = await submitShareResponse(token, kind, fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "İletildi");
      onClose();
      // Sayfa state'i için: kullanıcı yenilenince "zaten yanıt verildi" ekranı görür.
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between rounded-t-2xl px-5 py-4 text-white"
          style={{ backgroundColor: accent }}
        >
          <h2 className="text-base font-bold">{KIND_TITLES[kind]}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Kapat"
            className="rounded-md p-1 transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-[12.5px] leading-relaxed text-slate-600">
            {KIND_DESCRIPTIONS[kind]}
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ad Soyad <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={pending}
              required
              placeholder="Ad Soyad"
              className="w-full rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                E-posta <span className="font-normal text-slate-400">(opsiyonel)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
                disabled={pending}
                placeholder="ornek@firma.com"
                className="w-full rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Telefon <span className="font-normal text-slate-400">(opsiyonel)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                disabled={pending}
                placeholder="+90 5XX XXX XX XX"
                className="w-full rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mesaj{" "}
              {messageRequired ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="font-normal text-slate-400">(opsiyonel)</span>
              )}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={5}
              disabled={pending}
              placeholder={
                kind === "accept"
                  ? "İsterseniz bir teşekkür notu ekleyin..."
                  : kind === "revision"
                    ? "Hangi noktaların revize edilmesini istiyorsunuz?"
                    : "Sormak istediğiniz noktalar..."
              }
              className="w-full resize-none rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-400">{message.length} / 4000</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !name.trim() || (messageRequired && !message.trim())}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={{ backgroundColor: accent }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

export { KIND_LABELS as RESPONSE_KIND_LABELS };
