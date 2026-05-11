"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollText, Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogRow {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  actionLabel: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface ActorOption {
  id: string;
  label: string;
}

interface ActionOption {
  value: string;
  label: string;
}

interface Props {
  logs: LogRow[];
  actors: ActorOption[];
  actions: ActionOption[];
  filters: {
    actor: string;
    action: string;
    resource: string;
  };
  organizationName: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  project: "Proje",
  template: "Şablon",
  user: "Kullanıcı",
  settings: "Ayarlar",
};

const RESOURCE_BADGE_TONE: Record<string, string> = {
  project: "bg-emerald-50 text-emerald-700 border-emerald-200",
  template: "bg-violet-50 text-violet-700 border-violet-200",
  user: "bg-sky-50 text-sky-700 border-sky-200",
  settings: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AuditClient({
  logs,
  actors,
  actions,
  filters,
  organizationName,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasActiveFilter =
    Boolean(filters.actor) || Boolean(filters.action) || Boolean(filters.resource);

  const resourceOptions = useMemo(
    () => Object.entries(RESOURCE_LABELS).map(([v, l]) => ({ value: v, label: l })),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-emerald-200 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <ScrollText className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                  Yönetici Paneli
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Aktivite Kayıtları
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  <strong className="text-slate-900">{organizationName}</strong>{" "}
                  panelindeki kim-ne-ne zaman kayıtları. Kayıt silinmez, son 200
                  girişi listeler. Bir satıra tıkla → değişiklik detayları açılır.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" /> Filtrele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Kullanıcı
              </label>
              <Select
                value={filters.actor || "__all__"}
                onValueChange={(v) => setParam("actor", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tüm kullanıcılar</SelectItem>
                  {actors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Aksiyon
              </label>
              <Select
                value={filters.action || "__all__"}
                onValueChange={(v) => setParam("action", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tüm aksiyonlar</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Kaynak Türü
              </label>
              <Select
                value={filters.resource || "__all__"}
                onValueChange={(v) => setParam("resource", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tüm türler</SelectItem>
                  {resourceOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilter && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="gap-1.5"
              >
                <X className="size-3.5" /> Filtreleri Temizle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" /> Son Kayıtlar ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              {hasActiveFilter
                ? "Bu filtreye uygun kayıt bulunamadı."
                : "Henüz aktivite kaydı yok. Bir kullanıcı bir kaydetme işlemi yaptığında burada görünecek."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Zaman</th>
                    <th className="px-4 py-2.5 text-left font-medium">Kullanıcı</th>
                    <th className="px-4 py-2.5 text-left font-medium">Aksiyon</th>
                    <th className="px-4 py-2.5 text-left font-medium">Kaynak</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((l) => {
                    const isOpen = expanded === l.id;
                    const hasDetails =
                      l.details && Object.keys(l.details).length > 0;
                    return (
                      <Fragment key={l.id}>
                        <tr
                          className={cn(
                            "transition-colors",
                            hasDetails && "cursor-pointer hover:bg-muted/40",
                            isOpen && "bg-muted/30",
                          )}
                          onClick={() =>
                            hasDetails && setExpanded(isOpen ? null : l.id)
                          }
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(l.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {l.actorName ?? l.actorEmail ?? "—"}
                            </div>
                            {l.actorName && l.actorEmail && (
                              <div className="text-[10.5px] text-muted-foreground">
                                {l.actorEmail}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {l.actionLabel}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-fit text-[10px] font-semibold",
                                  RESOURCE_BADGE_TONE[l.resourceType] ??
                                    "bg-slate-50 text-slate-700 border-slate-200",
                                )}
                              >
                                {RESOURCE_LABELS[l.resourceType] ?? l.resourceType}
                              </Badge>
                              {l.resourceName && (
                                <span className="text-xs text-foreground">
                                  {l.resourceName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {hasDetails &&
                              (isOpen ? (
                                <ChevronDown className="ml-auto size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                              ))}
                          </td>
                        </tr>
                        {isOpen && hasDetails && (
                          <tr className="bg-muted/30">
                            <td colSpan={5} className="px-4 py-3">
                              <pre className="overflow-x-auto rounded-md border bg-card p-3 text-[11px] text-foreground">
{JSON.stringify(l.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
