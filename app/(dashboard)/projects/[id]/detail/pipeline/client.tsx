"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Plus,
  MessageSquare,
  Phone,
  Mail,
  Eye,
  CheckCircle2,
  RotateCcw,
  HelpCircle,
  StickyNote,
  TrendingUp,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updatePipelineStageAction,
  addProjectActivityAction,
} from "@/app/actions/share-response";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_TONE,
  ACTIVITY_TYPE_LABELS,
  LOST_REASON_LABELS,
} from "@/lib/pipeline-labels";
import type { ActivityType, PipelineStage, LostReason } from "@prisma/client";

interface ActivityRow {
  id: string;
  type: ActivityType;
  message: string | null;
  actorName: string | null;
  actorEmail: string | null;
  shareLinkToken: string | null;
  shareLinkLabel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  customerName: string;
  pipelineStage: PipelineStage | null;
  lostReason: LostReason | null;
  competitorName: string | null;
  createdAt: string;
}

interface Props {
  project: ProjectInfo;
  activities: ActivityRow[];
}

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: "SENT", label: "Gönderildi" },
  { value: "UNDER_REVIEW", label: "İnceleniyor" },
  { value: "REVISED", label: "Revizyon İstendi" },
  { value: "WON", label: "Kazanıldı" },
  { value: "LOST", label: "Kaybedildi" },
];

const LOST_REASON_OPTIONS: { value: LostReason; label: string }[] = [
  { value: "PRICE", label: "Fiyat" },
  { value: "TECHNICAL", label: "Teknik" },
  { value: "REFERENCE", label: "Referans" },
  { value: "TIMING", label: "Zamanlama" },
  { value: "RELATIONSHIP", label: "Müşteri ilişkisi" },
  { value: "OTHER", label: "Diğer" },
];

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CUSTOMER_VIEWED: Eye,
  CUSTOMER_ACCEPTED: CheckCircle2,
  CUSTOMER_REVISION: RotateCcw,
  CUSTOMER_QUESTION: HelpCircle,
  INTERNAL_NOTE: StickyNote,
  PHONE_CALL: Phone,
  EMAIL_SENT: Mail,
  STAGE_CHANGE: TrendingUp,
};

const ACTIVITY_TONE: Record<ActivityType, string> = {
  CUSTOMER_VIEWED: "border-slate-200 bg-slate-50 text-slate-600",
  CUSTOMER_ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CUSTOMER_REVISION: "border-amber-200 bg-amber-50 text-amber-700",
  CUSTOMER_QUESTION: "border-sky-200 bg-sky-50 text-sky-700",
  INTERNAL_NOTE: "border-slate-200 bg-slate-50 text-slate-700",
  PHONE_CALL: "border-violet-200 bg-violet-50 text-violet-700",
  EMAIL_SENT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  STAGE_CHANGE: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PipelineClient({ project, activities }: Props) {
  const [stage, setStage] = useState<PipelineStage | "__none__">(project.pipelineStage ?? "__none__");
  const [lostReason, setLostReason] = useState<LostReason | "__none__">(project.lostReason ?? "__none__");
  const [competitorName, setCompetitorName] = useState(project.competitorName ?? "");
  const [pending, startTransition] = useTransition();

  // Yeni aktivite ekleme
  const [noteType, setNoteType] = useState<"INTERNAL_NOTE" | "PHONE_CALL" | "EMAIL_SENT">("INTERNAL_NOTE");
  const [noteText, setNoteText] = useState("");

  const isLost = stage === "LOST";
  const showLostFields = isLost;

  function handleStageSave() {
    if (stage === "__none__") {
      toast.error("Aşama seçmelisiniz");
      return;
    }
    if (isLost && lostReason === "__none__") {
      toast.error("Kayıp sebebi seçmelisiniz");
      return;
    }

    startTransition(async () => {
      const result = await updatePipelineStageAction({
        projectId: project.id,
        newStage: stage as PipelineStage,
        lostReason: isLost ? (lostReason as string) : null,
        competitorName: isLost ? competitorName.trim() : null,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Güncellendi");
        // Refresh activities — server side render gerek
        window.location.reload();
      }
    });
  }

  function handleAddNote() {
    if (!noteText.trim()) {
      toast.error("Mesaj boş olamaz");
      return;
    }
    startTransition(async () => {
      const result = await addProjectActivityAction({
        projectId: project.id,
        type: noteType,
        message: noteText.trim(),
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Eklendi");
        setNoteText("");
        window.location.reload();
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero — Pipeline */}
      <Card className="overflow-hidden border-emerald-200 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <GitBranch className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                  Satış Süreci
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Pipeline & Aktivite
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  <strong className="text-slate-900">{project.name}</strong> projesinin müşteri
                  yolculuğu — gönderim, görüntülenme, müşteri yanıtları ve iç notlar tek
                  bir zaman çizelgesinde.
                </p>
              </div>
              {project.pipelineStage && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-semibold",
                    PIPELINE_STAGE_TONE[project.pipelineStage],
                  )}
                >
                  {PIPELINE_STAGE_LABELS[project.pipelineStage]}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Pipeline Aşaması
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="stage">Aşama</Label>
              <Select
                value={stage}
                onValueChange={(v) => setStage(v as PipelineStage | "__none__")}
              >
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue placeholder="Aşama seç..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Henüz pipeline'a girmemiş</SelectItem>
                  {STAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleStageSave}
                disabled={pending || stage === "__none__"}
                className="w-full sm:w-auto"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Kaydet
              </Button>
            </div>
          </div>

          {showLostFields && (
            <div className="grid gap-3 rounded-lg border border-rose-200 bg-rose-50/30 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lostReason">Kayıp Sebebi *</Label>
                <Select
                  value={lostReason}
                  onValueChange={(v) => setLostReason(v as LostReason | "__none__")}
                >
                  <SelectTrigger id="lostReason" className="w-full">
                    <SelectValue placeholder="Sebep seç..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Sebep seç...
                    </SelectItem>
                    {LOST_REASON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="competitor">Rakip Firma (opsiyonel)</Label>
                <Input
                  id="competitor"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  placeholder="örn. X EPC, Y A.Ş."
                  maxLength={120}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni not / aktivite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" /> Yeni Aktivite / Not Ekle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-1.5">
              <Label>Tür</Label>
              <Select
                value={noteType}
                onValueChange={(v) => setNoteType(v as typeof noteType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL_NOTE">İç Not</SelectItem>
                  <SelectItem value="PHONE_CALL">Telefon Görüşmesi</SelectItem>
                  <SelectItem value="EMAIL_SENT">Mail Gönderildi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="noteText">Mesaj</Label>
              <Textarea
                id="noteText"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Detayları yaz..."
                rows={3}
                maxLength={4000}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleAddNote}
              disabled={pending || !noteText.trim()}
              className="gap-1.5"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4" /> Aktivite Akışı ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Henüz aktivite kaydı yok. Paylaşım linki oluşturup müşteri görüntülediğinde,
              veya manuel olarak buradan not eklediğinde burada listelenir.
            </div>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
              {activities.map((a) => {
                const Icon = ACTIVITY_ICON[a.type];
                return (
                  <li key={a.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[28px] flex size-5 items-center justify-center rounded-full border bg-card",
                        ACTIVITY_TONE[a.type],
                      )}
                    >
                      <Icon className="size-2.5" />
                    </span>
                    <div className="rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            {ACTIVITY_TYPE_LABELS[a.type]}
                          </p>
                          {(a.actorName || a.actorEmail) && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {a.actorName ?? a.actorEmail}
                              {a.actorEmail && a.actorName && (
                                <span className="text-muted-foreground/60"> · {a.actorEmail}</span>
                              )}
                            </p>
                          )}
                          {a.shareLinkLabel && (
                            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                              Paylaşım: {a.shareLinkLabel}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground whitespace-nowrap">
                          {formatDateTime(a.createdAt)}
                        </span>
                      </div>
                      {a.message && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-foreground">
                          {a.message}
                        </p>
                      )}
                      {a.type === "STAGE_CHANGE" && a.details && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          <strong>
                            {a.details.from
                              ? PIPELINE_STAGE_LABELS[a.details.from as PipelineStage]
                              : "—"}
                          </strong>{" "}
                          →{" "}
                          <strong>
                            {a.details.to
                              ? PIPELINE_STAGE_LABELS[a.details.to as PipelineStage]
                              : "—"}
                          </strong>
                          {typeof a.details.reason === "string" && a.details.reason
                            ? ` · ${a.details.reason}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* LOST gösterimi */}
      {project.pipelineStage === "LOST" && project.lostReason && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kayıp Bilgisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Sebep:</span>{" "}
              <strong>{LOST_REASON_LABELS[project.lostReason] ?? project.lostReason}</strong>
            </div>
            {project.competitorName && (
              <div>
                <span className="text-muted-foreground">Rakip:</span>{" "}
                <strong>{project.competitorName}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
