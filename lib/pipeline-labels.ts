// Pipeline + activity etiketleri ve renk tonları — client/server her yerden
// kullanılabilsin diye server-only sınırı içermez. Saf veridir.

import type { ActivityType, PipelineStage } from "@prisma/client";

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  DRAFT: "Taslak",
  SENT: "Müşteriye Gönderildi",
  REVISED: "Revizyon İstendi",
  WON: "Closed Won",
  LOST: "Closed Lost",
  CANCELLED: "Proje İptal",
};

export const PIPELINE_STAGE_TONE: Record<PipelineStage, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  SENT: "border-sky-200 bg-sky-50 text-sky-700",
  REVISED: "border-violet-200 bg-violet-50 text-violet-700",
  WON: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOST: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CUSTOMER_VIEWED: "Müşteri paylaşımı görüntüledi",
  CUSTOMER_ACCEPTED: "Müşteri teklifi onayladı",
  CUSTOMER_REVISION: "Müşteri revizyon istedi",
  CUSTOMER_QUESTION: "Müşteri soru sordu",
  INTERNAL_NOTE: "İç not",
  PHONE_CALL: "Telefon görüşmesi",
  EMAIL_SENT: "Mail gönderildi",
  STAGE_CHANGE: "Aşama değişti",
};

export const LOST_REASON_LABELS: Record<string, string> = {
  PRICE: "Fiyat",
  TECHNICAL: "Teknik",
  REFERENCE: "Referans",
  TIMING: "Zamanlama",
  RELATIONSHIP: "Müşteri ilişkisi",
  OTHER: "Diğer",
};
